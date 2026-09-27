# All Gemini calls live here. Without a GEMINI_API_KEY the app runs in mock
# mode (sample menu + keyword answers) so the frontend can be built offline.

import io
import os

from google import genai
from google.genai import types, errors # errors-the execeptions the SDK raises when a call fails
from PIL import Image, ImageOps, UnidentifiedImageError
import time # lets us pause between gemini retry calls

from i18n import DEFAULT_LANGUAGE, LANGUAGES, allergen_list, t
from menu import SAMPLE_MENU, Menu, clean_menu, find_items

MODEL = os.getenv("GEMINI_MODEL") or "gemini-flash-latest"
_client = None

RETRY_CODES = (429, 503)
MAX_ATTEMPTS = 3

class BadPhoto(ValueError):
    """A user-facing problem with an uploaded photo (safe to read aloud)."""


def mock_mode() -> bool:
    return not os.getenv("GEMINI_API_KEY")


def client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client

def call_gemini(**kwargs): # **kwargs - allows for any args to be passed and received as params
    # retry logic for when met with 503 errors (google api server busy, not a code error) calls gemini

    #range(1,4) gives 1,2,3, so attempt is readable count, not starting at 0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # actual gemini call; if it works return response & loop ends, so no more attempts
            return client().models.generate_content(**kwargs)
        except errors.APIError as e:
            # SDK doesnt give a response.status_code like requests did; it raises an APIError instead and status code is on e.code
            # gives up (re-raise) if this error won't fix itself by waiting (400 bad request, 403 bad key) or if it was the last attempt
            if e.code not in RETRY_CODES or attempt == MAX_ATTEMPTS:
                raise # a bare raise rethrows the same error, so app.py's error handler gets it
            # backoff: wait longer each time (2s, then 4s) so a busy server can recover. kept short because a real person is waiting
            wait_seconds = attempt * 2
            print(f"Gemini returned {e.code}. Retrying in {wait_seconds} s"
                  f"(attempt {attempt}/{MAX_ATTEMPTS})")
            time.sleep(wait_seconds) # after sleeping, the for loop continues to the next attempt



    

def prep_image(raw: bytes) -> bytes:
    """Phone photos are 4-12 MB; shrinking them roughly halves parse time."""
    try:
        img = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError:
        raise BadPhoto("That file isn't a photo I can read. Try a JPEG or PNG.")
    img = ImageOps.exif_transpose(img).convert("RGB")  # fixes sideways phone photos
    img.thumbnail((1600, 1600))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)
    return out.getvalue()


PARSE_PROMPT = """
Extract every dish from these menu photos (they may be several pages of one menu).
- Keep the menu's own section names and order.
- price: the number printed for the dish. Use null if no price is printed. Never guess.
- contains: allergens explicitly named or obviously present in the name/description.
- possibly_contains: allergens commonly used in this dish that the text doesn't mention.
- Only use these allergens: milk, egg, fish, shellfish, tree nuts, peanuts, wheat, gluten, soy, sesame.
- gluten: anything with wheat, barley, rye or malt (e.g. beer batter, soy sauce, seitan).
- tags: only what the menu states or is unambiguous (vegetarian, vegan, spicy, gluten-free).
- language: the menu's own language as a 2-letter code (en, es, fr, it, zh...).
- Keep name, section and description exactly as printed, in the menu's own language.
""".strip()

# added to PARSE_PROMPT: translating happens in the SAME Gemini call as reading
# the photo, so it costs no extra requests
TRANSLATE_PROMPT = """
- The reader speaks {language}. Fill name_translated, section_translated and
  description_translated in {language}. If the menu is already in {language},
  leave those three empty.
- Translate dish names by meaning (e.g. "Pollo asado" -> "Roast chicken"); keep
  names that are commonly used as-is (e.g. "Tiramisu", "Pad Thai").
""".strip()


def parse_menu(images: list[bytes], language: str = DEFAULT_LANGUAGE) -> Menu:
    """Menu photos -> structured, cleaned Menu, translated into `language`."""
    if mock_mode():
        return SAMPLE_MENU

    # prep images once, outside any retry, so a retry doesnt shrink them again
    parts = [types.Part.from_bytes(data=prep_image(i), mime_type="image/jpeg") for i in images]

    # we call_gemini instead of client().models.generate_content so we have retry logic
    response = call_gemini(
        model=MODEL,
        contents=[*parts, PARSE_PROMPT + "\n" + TRANSLATE_PROMPT.format(language=LANGUAGES[language])],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Menu,
        ),
    )
    menu = response.parsed or Menu.model_validate_json(response.text)
    return clean_menu(menu)


ANSWER_INSTRUCTION = """
You help someone who cannot see the menu choose what to eat. Your reply is read aloud.
- Always use the search_menu tool to look things up. Never state a dish, price or
  allergen that the tool did not return.
- Reply in 1 to 3 short spoken sentences. No markdown, lists, symbols or emoji.
- Say the price right after each dish name. Mention at most 3 dishes.
- If a dish has a warning, say it may contain that allergen and to check with the server.
- Never call a dish "safe" or "allergen-free".
- If nothing matches, say so and offer the closest alternative.
When you are asked what a dish is, or to describe it even if the user has allergies:
- Find it with search_menu first. If it isn't returned, don't describe it; say it's
  not on the menu for them, possibly because of their allergies.
- Describe it in general terms using "usually" or "typically": appearance, texture,
  temperature, flavor, how it's served and eaten, and roughly how filling it is.
- You may mention ingredients it usually has, even if the tool didn't list them.
- If one of the user's allergies is commonly used in this dish, say so and to check
  with their server. Never say an allergen is absent.
- Description answers can be up to 4 sentences.
Example: "Pad Thai, 14 dollars. It's stir-fried flat rice noodles, a little sweet and
tangy, usually served with lime and bean sprouts. You'd eat it with a fork or
chopsticks. It's often topped with crushed peanuts, so check with your server."
User's allergies (already excluded by the tool): {allergies}.
Menu sections: {sections}.
""".strip()


# only the fields Gemini needs from a search result. The full contains /
# possibly_contains lists list EVERY allergen (not just the user's), which
# led Gemini to warn about the wrong one (e.g. "tree nuts" instead of "gluten").
# "warning" already holds exactly the user's allergies that might be in the dish.
MODEL_FIELDS = ("name", "name_translated", "section", "price", "description",
                "description_translated", "tags", "warning")


def find_dish(menu: Menu, name: str):
    """The menu item with this exact name (case-insensitive), or None."""
    return next((i for i in menu.items if i.name.lower() == name.strip().lower()), None)


def allergy_alerts(item, allergies: set[str], language: str = DEFAULT_LANGUAGE) -> tuple[str, str]:
    """The allergy alerts for one dish, written by code so they're always right.
    The wording and allergen names come from i18n.py (fixed translations).

    Returns (before, after):
    - before: the dish LISTS one of your allergies. Said first, because it's the
      most important thing and people may stop listening halfway through.
    - after: the dish MIGHT contain one. Said after the description.
    """
    listed = sorted(allergies & set(item.contains))
    maybe = sorted(allergies & set(item.possibly_contains) - set(listed))
    dish = item.name_translated or item.name

    before = ""
    if listed:
        before = t(language, "alert_contains", dish=dish, items=allergen_list(language, listed))

    after = ""
    if maybe:
        key = "note_maybe_also" if listed else "note_maybe"
        after = t(language, key, items=allergen_list(language, maybe))

    return before, after


def with_alerts(speech: str, item, allergies: set[str], language: str = DEFAULT_LANGUAGE) -> str:
    """alert (if any) + Gemini's answer + note (if any), as one spoken reply"""
    before, after = allergy_alerts(item, allergies, language)
    return " ".join(part for part in (before, speech, after) if part)


def dish_entry(item) -> str:
    """One dish's menu entry as text, handed straight to Gemini for dish questions."""
    price = "price not listed" if item.price is None else f"{item.price:g} dollars"
    translated = f" (in the reader's language: {item.name_translated})" if item.name_translated else ""
    description = item.description_translated or item.description or "none"
    return f"{item.name}{translated}, section {item.section}, {price}. Menu description: {description}."


def answer(menu: Menu, allergies: set[str], question: str, history: list[dict],
           dish: str | None = None, language: str = DEFAULT_LANGUAGE) -> tuple[str, list[dict]]:
    """A spoken question -> (speech, items). history is [{"question", "speech"}, ...].

    dish: set when the question came from a dish card (Describe / Ask). Gemini
    gets that dish's menu entry directly (so it can describe it even if it's
    filtered out of search results by the user's allergies), and the allergy
    alerts for it are added by code, not left to Gemini.
    """
    item = find_dish(menu, dish) if dish else None

    if mock_mode():
        speech, items = mock_answer(menu, allergies, question)
        return (with_alerts(speech, item, allergies, language) if item else speech), items

    found: list[dict] = []

    # Gemini decides the filters; Python does the filtering. The SDK reads this
    # signature + docstring, calls the function automatically, and feeds the
    # results back to the model before it writes the final answer.
    def search_menu(
        keywords: list[str] | None = None,
        section: str | None = None,
        max_price: float | None = None,
        tags: list[str] | None = None,
        sort: str = "menu_order",
        limit: int = 3,
    ) -> list[dict]:
        """Search the menu. Items containing the user's allergies are already removed.

        Args:
          keywords: words to match in dish names/descriptions, e.g. ["chicken"]. Omit to match everything.
          section: exact menu section name to restrict to.
          max_price: only dishes at or under this price.
          tags: required tags, e.g. ["vegetarian"].
          sort: "menu_order", "price_asc" (cheapest first) or "price_desc".
          limit: how many dishes to return (1-10).
        """
        results = find_items(menu, allergies, keywords, section, max_price, tags, sort, limit)
        found[:] = results  # full results go back to the app
        return [{k: r[k] for k in MODEL_FIELDS} for r in results]  # trimmed ones go to Gemini

    contents = []
    for turn in history[-4:]:
        contents.append(types.Content(role="user", parts=[types.Part(text=turn["question"])]))
        contents.append(types.Content(role="model", parts=[types.Part(text=turn["speech"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=question)]))

    instruction = ANSWER_INSTRUCTION.format(
        allergies=", ".join(sorted(allergies)) or "none",
        sections=", ".join(menu.sections),
    )
    # translation: Gemini answers in the reader's language, but searches in the
    # menu's language (an English menu has "chicken", not "pollo")
    instruction += (
        f"\nAlways reply in {LANGUAGES[language]}, whatever language the question or menu is in."
        f"\nWhen a dish has a translated name, say the translation followed by the original name"
        f" in brackets, so they can order it."
        f"\nsearch_menu keywords can be in either language; the tool searches both."
    )
    if item:
        # dish questions: hand Gemini the dish directly. search_menu leaves out
        # dishes with the user's allergies, and the rule above ("if it isn't
        # returned, don't describe it") would otherwise make Gemini refuse.
        # The app writes the allergy alerts itself (below), so Gemini must not,
        # or they'd be said twice (or wrong).
        instruction += (
            f"\nThis question is about one dish. Its menu entry: {dish_entry(item)}"
            f"\nAnswer about this dish without searching for it, even if search_menu doesn't return it."
            f"\nDo not mention allergens or allergy warnings for it; the app adds its own allergy alert."
        )

    # retrying here is safe: search_menu only reads menu so running it again on a retry doesnt change anything
    response = call_gemini(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=instruction,
            tools=[search_menu],
        ),
    )
    speech = (response.text or "").strip() or "Sorry, I didn't catch that. Tap and try again."
    if item:
        speech = with_alerts(speech, item, allergies, language)
    return speech, found


def speak_items(items: list[dict]) -> str:
    parts = []
    for item in items:
        price = f"${item['price']:g}" if item["price"] is not None else "price not listed"
        line = f"{item['name']}, {price}"
        if item["warning"]:
            line += f", may contain {' and '.join(item['warning'])}, check with your server"
        parts.append(line)
    return ". ".join(parts) + "."


def mock_answer(menu: Menu, allergies: set[str], question: str) -> tuple[str, list[dict]]:
    """Rough keyword matching so the UI flow can be tested without an API key."""
    q = question.lower()
    sort = "price_asc" if "cheap" in q else "price_desc" if "expensive" in q else "menu_order"
    section = next((s for s in menu.sections if s.lower().rstrip("s") in q), None)
    words = {w.strip("?,.!") for w in q.split()}
    names = " ".join(f"{i.name} {i.description}".lower() for i in menu.items)
    keywords = [w for w in words if len(w) > 3 and w in names and not (section and w in section.lower())]
    tags = [t for t in ("vegetarian", "vegan", "gluten-free", "spicy") if t in q]
    items = find_items(menu, allergies, keywords or None, section, None, tags or None, sort, 3)
    if not items:
        return "I couldn't find anything that matches. Try asking about a section, like mains.", []
    return "(Mock mode) " + speak_items(items), items
