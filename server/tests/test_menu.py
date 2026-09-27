# Run from the repo root:  npm test

import io

import pytest
from PIL import Image

from menu import SAMPLE_MENU, Menu, MenuItem, clean_menu, find_items, normalize_allergens


def names(items):
    return [i["name"] for i in items]


def test_allergens_are_hard_excluded():
    results = find_items(SAMPLE_MENU, {"peanuts"}, keywords=["chicken"], limit=10)
    assert "Chicken Satay" not in names(results)
    assert "Chicken Caesar Wrap" in names(results)


def test_possible_allergens_warn_instead_of_exclude():
    results = find_items(SAMPLE_MENU, {"peanuts"}, keywords=["pad thai"])
    assert results[0]["name"] == "Pad Thai"
    assert results[0]["warning"] == ["peanuts"]


def test_cheapest_with_keyword():
    results = find_items(SAMPLE_MENU, set(), keywords=["chicken"], sort="price_asc", limit=1)
    assert names(results) == ["Chicken Satay"]


def test_filters_combine():
    results = find_items(SAMPLE_MENU, set(), section="mains", max_price=15, tags=["vegetarian"], limit=10)
    assert names(results) == []
    results = find_items(SAMPLE_MENU, set(), tags=["vegetarian"], sort="price_desc", limit=10)
    assert names(results) == ["Mushroom Risotto", "Chocolate Lava Cake", "Garlic Bread"]


def test_unknown_prices_sort_last_and_fail_price_filters():
    menu = Menu(items=[MenuItem(name="Market Fish", price=None), MenuItem(name="Soup", price=7)])
    assert names(find_items(menu, set(), sort="price_asc")) == ["Soup", "Market Fish"]
    assert names(find_items(menu, set(), max_price=20)) == ["Soup"]


def test_clean_menu_fixes_model_mistakes():
    raw = Menu(sections=["Mains"], items=[
        MenuItem(name="  Burger ", section="Mains", price=0, contains=["Dairy", "flour", "unicorn"]),
        MenuItem(name="", price=5),
        MenuItem(name="Pie", section="Desserts", price=9999, contains=["egg"], possibly_contains=["egg", "nuts"]),
    ])
    menu = clean_menu(raw)
    assert [i.name for i in menu.items] == ["Burger", "Pie"]
    assert menu.items[0].price is None and menu.items[1].price is None
    assert menu.items[0].contains == ["gluten", "milk", "wheat"]  # wheat implies gluten
    assert menu.items[1].possibly_contains == ["tree nuts"]
    assert menu.sections == ["Mains", "Desserts"]


def test_normalize_allergens():
    assert normalize_allergens(["Peanut", "shrimp", "Tahini", "nope"]) == ["peanuts", "sesame", "shellfish"]
    assert normalize_allergens(["Gluten", "barley"]) == ["gluten"]


def test_gluten_allergy_excludes_wheat_dishes():
    names_left = names(find_items(SAMPLE_MENU, {"gluten"}, limit=10))
    assert "Garlic Bread" not in names_left and "Mushroom Risotto" in names_left


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")  # mock mode, even if a .env has a real key
    import app as app_module
    return app_module.app.test_client()


def photo():
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buf, "JPEG")
    buf.seek(0)
    return buf


def test_parse_then_ask_mock_mode(client):
    res = client.post("/api/parse", data={"images": (photo(), "menu.jpg")})
    assert res.status_code == 200
    parsed = res.get_json()
    assert "3 sections" in parsed["overview_speech"] and parsed["pages"] == 1

    # stateless: the client sends the menu back with the question
    res = client.post("/api/ask", json={
        "menu": parsed["menu"], "question": "cheapest chicken?", "allergies": ["peanut"],
        "history": [{"question": "hi", "speech": "hello"}, "junk"],
    })
    body = res.get_json()
    assert res.status_code == 200
    assert body["items"][0]["name"] == "Chicken Caesar Wrap"  # satay is excluded (peanuts)


def test_errors_are_json(client):
    assert client.post("/api/parse").status_code == 400
    res = client.post("/api/ask", json={"menu": {"items": "not a list"}, "question": "hi"})
    assert res.status_code == 400 and "error" in res.get_json()
    res = client.post("/api/ask", json={"menu": {"items": []}, "question": "hi"})
    assert res.status_code == 400
    assert client.get("/api/missing").get_json() is not None


def test_bad_photo_raises_bad_photo():
    import ai
    with pytest.raises(ai.BadPhoto):
        ai.prep_image(b"not an image")


def test_prep_image_shrinks_and_converts():
    import ai
    buf = io.BytesIO()
    Image.new("RGBA", (4000, 3000)).save(buf, "PNG")
    out = Image.open(io.BytesIO(ai.prep_image(buf.getvalue())))
    assert out.format == "JPEG" and max(out.size) == 1600


def test_answer_wires_search_tool_to_gemini(monkeypatch):
    """Fake Gemini: 'call' the tool the way the SDK would, then reply."""
    import ai
    seen = {}

    class FakeModels:
        def generate_content(self, model, contents, config):
            seen["system"] = config.system_instruction
            seen["turns"] = len(contents)
            tool = config.tools[0]
            results = tool(keywords=["chicken"], sort="price_asc", limit=1)
            return type("R", (), {"text": f"The {results[0]['name']} is ${results[0]['price']:g}."})()

    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setattr(ai, "client", lambda: type("C", (), {"models": FakeModels()})())
    history = [{"question": "hi", "speech": "hello"}]
    speech, items = ai.answer(SAMPLE_MENU, {"peanuts"}, "cheapest chicken?", history)

    assert items[0]["name"] == "Chicken Caesar Wrap"   # satay excluded by Python, not the model
    assert speech == "The Chicken Caesar Wrap is $11."
    assert "peanuts" in seen["system"] and seen["turns"] == 3


def test_gemini_busy_is_a_friendly_503(client, monkeypatch):
    import ai
    from google.genai import errors

    def busy(images, language):
        raise errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})

    monkeypatch.setattr(ai, "parse_menu", busy)
    res = client.post("/api/parse", data={"images": (photo(), "menu.jpg")})
    assert res.status_code == 503
    assert "busy" in res.get_json()["error"] and "UNAVAILABLE" not in res.get_json()["error"]


def fake_gemini(monkeypatch, reply, tool_args):
    """Replace Gemini: 'call' the search tool like the SDK would, then reply."""
    import ai
    seen = {}

    class FakeModels:
        def generate_content(self, model, contents, config):
            seen["system"] = config.system_instruction
            seen["tool_result"] = config.tools[0](**tool_args)
            return type("R", (), {"text": reply})()

    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setattr(ai, "client", lambda: type("C", (), {"models": FakeModels()})())
    return seen


def test_describe_adds_the_right_allergy_note_in_code(monkeypatch):
    import ai
    # Gemini "forgets" the alert entirely; the code must still add the right one
    seen = fake_gemini(monkeypatch, "Pad Thai, 14 dollars. Stir-fried rice noodles.", {"keywords": ["Pad Thai"]})
    speech, _ = ai.answer(SAMPLE_MENU, {"peanuts", "shellfish"}, "Describe the Pad Thai", [], dish="Pad Thai")

    assert speech.endswith("Allergy note: it may contain peanuts, so check with your server.")
    assert not speech.startswith("Allergy alert")  # nothing it definitely contains
    assert "Do not mention allergens" in seen["system"]
    # Gemini only sees the user's warning, not every allergen in the dish
    assert "possibly_contains" not in seen["tool_result"][0]
    assert seen["tool_result"][0]["warning"] == ["peanuts"]


def test_describe_a_dish_you_must_avoid_still_describes_it(monkeypatch):
    import ai
    # search finds nothing (satay is filtered out for peanuts), but Gemini gets
    # the dish's entry directly, so it can still describe it
    seen = fake_gemini(monkeypatch, "Chicken Satay, 9 dollars. Grilled skewers.", {"keywords": ["Chicken Satay"]})
    speech, _ = ai.answer(SAMPLE_MENU, {"peanuts", "soy"}, "Describe the Chicken Satay", [], dish="Chicken Satay")

    assert seen["tool_result"] == []                                # excluded from search...
    assert "Chicken Satay, section Starters, 9 dollars" in seen["system"]  # ...but handed over directly
    # the "contains" alert comes FIRST, the "may contain" note after the description
    assert speech == ("Allergy alert: the Chicken Satay contains peanuts, which is on your allergy list. "
                      "Chicken Satay, 9 dollars. Grilled skewers. "
                      "Allergy note: it may also contain soy, so check with your server.")


def test_questions_without_a_dish_are_unchanged(monkeypatch):
    import ai
    seen = fake_gemini(monkeypatch, "The Garlic Bread is 6 dollars.", {"sort": "price_asc", "limit": 1})
    speech, _ = ai.answer(SAMPLE_MENU, {"peanuts"}, "cheapest thing?", [])
    assert speech == "The Garlic Bread is 6 dollars." and "Do not mention allergens" not in seen["system"]
