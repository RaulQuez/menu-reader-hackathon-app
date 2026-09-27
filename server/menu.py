# Menu data model + the deterministic logic (validation, filtering, sorting).
# Nothing in this file calls an AI model: prices, rankings and allergy
# exclusions are computed here, so they can't be hallucinated.
# Spec: tests/test_menu.py (run `npm test` from the repo root).

from pydantic import BaseModel, Field

from i18n import DEFAULT_LANGUAGE, TEMPLATES, t

# the 9 major US allergens, plus gluten (celiac disease / gluten intolerance).
# gluten is separate from wheat because barley and rye have it too.
# Keep this list in sync with client/src/lib/allergens.js.
ALLERGENS = ["milk", "egg", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "gluten", "soy", "sesame"]

# anything containing wheat also contains gluten, so a wheat tag implies a gluten tag
IMPLIED_ALLERGENS = {"wheat": "gluten"}

# other ways menus/models say the same thing -> the canonical name above
ALLERGEN_ALIASES = {
    "dairy": "milk", "cheese": "milk", "butter": "milk", "cream": "milk", "lactose": "milk",
    "eggs": "egg",
    "nuts": "tree nuts", "tree nut": "tree nuts", "almond": "tree nuts", "almonds": "tree nuts",
    "walnut": "tree nuts", "walnuts": "tree nuts", "cashew": "tree nuts", "cashews": "tree nuts",
    "pecan": "tree nuts", "pine nuts": "tree nuts", "pistachio": "tree nuts",
    "peanut": "peanuts",
    "shrimp": "shellfish", "crab": "shellfish", "lobster": "shellfish", "crustacean": "shellfish",
    "flour": "wheat",
    "barley": "gluten", "rye": "gluten", "malt": "gluten", "seitan": "gluten",
    "soya": "soy", "soybean": "soy",
    "sesame seeds": "sesame", "tahini": "sesame",
}
MAX_REASONABLE_PRICE = 500


class MenuItem(BaseModel):
    name: str
    section: str = "Menu"
    price: float | None = Field(None, description="null when no price is printed")
    description: str = ""
    contains: list[str] = Field(default_factory=list, description="allergens named in the text")
    possibly_contains: list[str] = Field(default_factory=list, description="allergens typical for this dish but not stated")
    tags: list[str] = Field(default_factory=list, description="e.g. vegetarian, vegan, spicy, gluten-free")
    # translations into the reader's language ("" when the menu is already in it).
    # name/section/description stay exactly as printed, so you can still order
    # by pointing or saying the original name to the waiter.
    name_translated: str = ""
    section_translated: str = ""
    description_translated: str = ""


class Menu(BaseModel):
    restaurant: str | None = None
    language: str | None = Field(None, description="the menu's own language, as a 2-letter code like es")
    sections: list[str] = Field(default_factory=list)
    items: list[MenuItem] = Field(default_factory=list)


def normalize_allergen(name: str) -> str | None:
    key = name.strip().lower()
    key = ALLERGEN_ALIASES.get(key, key)
    return key if key in ALLERGENS else None


def normalize_allergens(names) -> list[str]:
    """["Peanut", "shrimp", "nope"] -> ["peanuts", "shellfish"]"""
    return sorted({a for a in (normalize_allergen(n) for n in names or []) if a})


def with_implied(allergens: list[str]) -> list[str]:
    """["wheat"] -> ["gluten", "wheat"]: add allergens that always come along."""
    extra = {IMPLIED_ALLERGENS[a] for a in allergens if a in IMPLIED_ALLERGENS}
    return sorted(set(allergens) | extra)


def clean_menu(menu: Menu) -> Menu:
    """Fix what the vision model commonly gets wrong before anyone relies on it."""
    items = []
    for item in menu.items:
        if not item.name.strip():
            continue
        price = item.price
        if price is not None and not (0 < price <= MAX_REASONABLE_PRICE):
            price = None  # say "price not listed" rather than read out a bad number
        contains = with_implied(normalize_allergens(item.contains))
        possibly = [a for a in with_implied(normalize_allergens(item.possibly_contains)) if a not in contains]
        items.append(item.model_copy(update={
            "name": item.name.strip(),
            "section": item.section.strip() or "Menu",
            "price": price,
            "contains": contains,
            "possibly_contains": possibly,
            "tags": sorted({tag.strip().lower() for tag in item.tags if tag.strip()}),
            "name_translated": item.name_translated.strip(),
            "section_translated": item.section_translated.strip(),
            "description_translated": item.description_translated.strip(),
        }))

    # keep the menu's section order, and include any section the items mention
    sections = []
    for s in [*menu.sections, *(i.section for i in items)]:
        if s.strip() and s.strip() not in sections:
            sections.append(s.strip())
    language = (menu.language or "").strip().lower()[:2] or None
    return Menu(restaurant=menu.restaurant, language=language, sections=sections, items=items)


def find_items(menu: Menu, allergies: set[str], keywords=None, section=None,
               max_price=None, tags=None, sort="menu_order", limit=3) -> list[dict]:
    """The search tool Gemini calls. Returns item dicts plus a "warning" key."""
    results = []
    for item in menu.items:
        if allergies & set(item.contains):  # hard exclude, never left to the model
            continue
        # search the original AND translated text, so "pollo" and "chicken" both work
        text = " ".join([item.name, item.description, item.name_translated, item.description_translated]).lower()
        if keywords and not any(k.lower() in text for k in keywords):
            continue
        if section and item.section.lower() != section.lower():
            continue
        if max_price is not None and (item.price is None or item.price > max_price):
            continue
        if tags and not {t.lower() for t in tags} <= set(item.tags):
            continue
        warning = sorted(allergies & set(item.possibly_contains))
        results.append({**item.model_dump(), "warning": warning or None})

    if sort == "price_asc":
        results.sort(key=lambda r: (r["price"] is None, r["price"] or 0))
    elif sort == "price_desc":
        results.sort(key=lambda r: (r["price"] is None, -(r["price"] or 0)))
    return results[:max(1, min(limit or 3, 10))]


def section_label(menu: Menu, section: str) -> str:
    """A section's name in the reader's language (the translation from any item in it)."""
    return next((i.section_translated for i in menu.items if i.section == section and i.section_translated), section)


def overview_speech(menu: Menu, language: str = DEFAULT_LANGUAGE) -> str:
    """The first thing the user hears after the photo is read, in their language."""
    if not menu.items:
        return t(language, "overview_empty")
    name = f"{menu.restaurant}. " if menu.restaurant else ""
    sections = TEMPLATES[language]["sep"].join(section_label(menu, s) for s in menu.sections)
    speech = name + t(language, "overview", count=len(menu.sections), sections=sections)
    prices = [i.price for i in menu.items if i.price is not None]
    if prices:
        speech += t(language, "overview_prices", low=f"{min(prices):g}", high=f"{max(prices):g}")
    return speech


# used when there's no GEMINI_API_KEY, so the frontend can be built and demoed offline.
# run through clean_menu like a real parse would be (e.g. wheat -> also gluten)
SAMPLE_MENU = clean_menu(Menu(
    restaurant="Sample Bistro",
    sections=["Starters", "Mains", "Desserts"],
    items=[
        MenuItem(name="Garlic Bread", section="Starters", price=6, description="Toasted bread with garlic butter",
                 contains=["wheat", "milk"], tags=["vegetarian"]),
        MenuItem(name="Chicken Satay", section="Starters", price=9, description="Grilled chicken skewers with peanut sauce",
                 contains=["peanuts"], possibly_contains=["soy"]),
        MenuItem(name="Chicken Caesar Wrap", section="Mains", price=11, description="Grilled chicken, romaine, parmesan, caesar dressing",
                 contains=["wheat", "milk"], possibly_contains=["egg", "fish"]),
        MenuItem(name="Pad Thai", section="Mains", price=14, description="Rice noodles with tofu, bean sprouts and lime",
                 possibly_contains=["peanuts", "egg", "soy", "fish"]),
        MenuItem(name="Shrimp Tacos", section="Mains", price=15, description="Three corn tortillas with shrimp and slaw",
                 contains=["shellfish"]),
        MenuItem(name="Mushroom Risotto", section="Mains", price=16, description="Arborio rice, wild mushrooms, parmesan",
                 contains=["milk"], tags=["vegetarian", "gluten-free"]),
        MenuItem(name="Chocolate Lava Cake", section="Desserts", price=8, description="Warm chocolate cake, vanilla ice cream",
                 contains=["milk", "egg", "wheat"], tags=["vegetarian"]),
    ],
))
