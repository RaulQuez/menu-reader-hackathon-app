# Translation tests. The allergy wording is safety text, so every language
# must have every allergen and every template; these fail if one is missing.

import pytest

from i18n import ALLERGEN_NAMES, LANGUAGES, TEMPLATES, allergen_list, clean_language, t
from menu import ALLERGENS, SAMPLE_MENU, Menu, MenuItem, clean_menu, find_items, overview_speech


@pytest.mark.parametrize("language", LANGUAGES)
def test_every_language_is_complete(language):
    assert set(ALLERGEN_NAMES[language]) == set(ALLERGENS), f"{language} is missing allergen names"
    assert set(TEMPLATES[language]) == set(TEMPLATES["en"]), f"{language} is missing templates"
    # every template fills in without errors
    for key in TEMPLATES[language]:
        t(language, key, dish="X", items="Y", count=2, sections="A, B", low="5", high="9")


def test_allergen_lists_use_each_languages_words():
    assert allergen_list("en", ["peanuts", "gluten", "soy"]) == "peanuts, gluten and soy"
    assert allergen_list("es", ["peanuts", "gluten"]) == "cacahuetes y gluten"
    assert allergen_list("zh", ["peanuts", "soy", "sesame"]) == "花生、大豆和芝麻"
    assert allergen_list("ar", ["peanuts", "sesame"]) == "الفول السوداني والسمسم"


def test_unknown_language_falls_back_to_english():
    assert clean_language("es") == "es" and clean_language("es-MX") == "es"
    assert clean_language("klingon") == "en" and clean_language(None) == "en"


def test_overview_is_in_the_readers_language():
    assert overview_speech(SAMPLE_MENU, "es").startswith("Sample Bistro. Este menú tiene 3 secciones")
    assert "dólares" in overview_speech(SAMPLE_MENU, "es")


def test_search_matches_original_or_translated_names():
    menu = clean_menu(Menu(items=[MenuItem(name="Pollo asado", name_translated="Roast chicken", price=14)]))
    assert find_items(menu, set(), keywords=["chicken"])[0]["name"] == "Pollo asado"
    assert find_items(menu, set(), keywords=["pollo"])[0]["name"] == "Pollo asado"


def test_alerts_are_translated_by_code_not_gemini(monkeypatch):
    import ai
    from tests.test_menu import fake_gemini
    seen = fake_gemini(monkeypatch, "Satay de pollo, 9 dólares.", {"keywords": ["Satay"]})
    speech, _ = ai.answer(SAMPLE_MENU, {"peanuts", "soy"}, "Describe the Chicken Satay", [],
                          dish="Chicken Satay", language="es")
    assert speech.startswith("Alerta de alergia: Chicken Satay contiene cacahuetes")
    assert speech.endswith("también puede contener soja, así que consulta con el personal.")
    assert "Always reply in Spanish" in seen["system"]


def test_routes_accept_a_language(monkeypatch):
    import app as app_module
    monkeypatch.setenv("GEMINI_API_KEY", "")  # mock mode
    client = app_module.app.test_client()
    from tests.test_menu import photo
    res = client.post("/api/parse", data={"images": (photo(), "m.jpg"), "language": "fr"})
    assert res.get_json()["overview_speech"].startswith("Sample Bistro. Ce menu compte 3 sections")
