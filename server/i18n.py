# Translations for the text the SERVER writes (never Gemini): allergen names,
# the allergy alerts, and the menu overview. These are safety-relevant, so
# they're fixed, reviewed strings, not left to an AI to translate on the fly.
#
# Internal data always uses the English keys ("peanuts"); only what's spoken
# or shown is translated. tests/test_i18n.py fails if any language is missing
# a word or template, so adding a language can't half-work.
#
# TODO before demo day: have a native speaker check each language, especially
# the allergy lines. Keep in sync with client/src/lib/languages.js.

LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "zh": "Simplified Chinese",
    "fr": "French",
    "ar": "Arabic",   # written right to left: the client sets dir="auto" on translated text
}
DEFAULT_LANGUAGE = "en"

ALLERGEN_NAMES = {
    "en": {"milk": "milk", "egg": "egg", "fish": "fish", "shellfish": "shellfish", "tree nuts": "tree nuts",
           "peanuts": "peanuts", "wheat": "wheat", "gluten": "gluten", "soy": "soy", "sesame": "sesame"},
    "es": {"milk": "leche", "egg": "huevo", "fish": "pescado", "shellfish": "mariscos", "tree nuts": "frutos secos",
           "peanuts": "cacahuetes", "wheat": "trigo", "gluten": "gluten", "soy": "soja", "sesame": "sésamo"},
    "zh": {"milk": "牛奶", "egg": "鸡蛋", "fish": "鱼", "shellfish": "贝类", "tree nuts": "坚果",
           "peanuts": "花生", "wheat": "小麦", "gluten": "麸质", "soy": "大豆", "sesame": "芝麻"},
    "fr": {"milk": "lait", "egg": "œuf", "fish": "poisson", "shellfish": "fruits de mer", "tree nuts": "fruits à coque",
           "peanuts": "arachides", "wheat": "blé", "gluten": "gluten", "soy": "soja", "sesame": "sésame"},
    "ar": {"milk": "الحليب", "egg": "البيض", "fish": "السمك", "shellfish": "المحار", "tree nuts": "المكسرات",
           "peanuts": "الفول السوداني", "wheat": "القمح", "gluten": "الغلوتين", "soy": "الصويا", "sesame": "السمسم"},
}

# {dish}, {items}, {count}, {sections}, {low}, {high} are filled in by code
TEMPLATES = {
    "en": {
        "and": " and ",
        "sep": ", ",
        "alert_contains": "Allergy alert: the {dish} contains {items}, which is on your allergy list.",
        "note_maybe": "Allergy note: it may contain {items}, so check with your server.",
        "note_maybe_also": "Allergy note: it may also contain {items}, so check with your server.",
        "overview": "This menu has {count} sections: {sections}. Tap Read, Describe or Ask on any dish.",
        "overview_prices": " Prices go from ${low} to ${high}.",
        "overview_empty": "I couldn't read any dishes. Try moving closer, holding steady, and adding more light.",
    },
    "es": {
        "and": " y ",
        "sep": ", ",
        "alert_contains": "Alerta de alergia: {dish} contiene {items}, que está en tu lista de alergias.",
        "note_maybe": "Nota de alergia: puede contener {items}, así que consulta con el personal.",
        "note_maybe_also": "Nota de alergia: también puede contener {items}, así que consulta con el personal.",
        "overview": "Este menú tiene {count} secciones: {sections}. Toca Leer, Describir o Preguntar en cualquier plato.",
        "overview_prices": " Los precios van de {low} a {high} dólares.",
        "overview_empty": "No pude leer ningún plato. Acércate, mantén el teléfono quieto y busca más luz.",
    },
    "zh": {
        "and": "和",
        "sep": "、",
        "alert_contains": "过敏警告：{dish}含有{items}，在您的过敏清单上。",
        "note_maybe": "过敏提示：可能含有{items}，请向服务员确认。",
        "note_maybe_also": "过敏提示：还可能含有{items}，请向服务员确认。",
        "overview": "这份菜单有{count}个部分：{sections}。点任何菜品上的朗读、描述或提问。",
        "overview_prices": "价格从{low}到{high}美元。",
        "overview_empty": "我没能读出任何菜品。请靠近一点，拿稳手机，并增加光线。",
    },
    "fr": {
        "and": " et ",
        "sep": ", ",
        "alert_contains": "Alerte allergie : {dish} contient {items}, qui figure dans votre liste d'allergies.",
        "note_maybe": "Note allergie : ce plat peut contenir {items}, vérifiez auprès du serveur.",
        "note_maybe_also": "Note allergie : ce plat peut aussi contenir {items}, vérifiez auprès du serveur.",
        "overview": "Ce menu compte {count} sections : {sections}. Touchez Lire, Décrire ou Demander sur un plat.",
        "overview_prices": " Les prix vont de {low} à {high} dollars.",
        "overview_empty": "Je n'ai pu lire aucun plat. Rapprochez-vous, restez immobile et ajoutez de la lumière.",
    },
    "ar": {
        "and": " و",
        "sep": "، ",
        "alert_contains": "تنبيه حساسية: {dish} يحتوي على {items}، وهو ضمن قائمة الحساسية لديك.",
        "note_maybe": "ملاحظة حساسية: قد يحتوي على {items}، لذا تأكد من النادل.",
        "note_maybe_also": "ملاحظة حساسية: قد يحتوي أيضًا على {items}، لذا تأكد من النادل.",
        "overview": "تحتوي هذه القائمة على {count} أقسام: {sections}. اضغط على قراءة أو وصف أو سؤال لأي طبق.",
        "overview_prices": " تتراوح الأسعار من {low} إلى {high} دولارًا.",
        "overview_empty": "لم أتمكن من قراءة أي طبق. اقترب أكثر وثبّت الهاتف وأضف المزيد من الإضاءة.",
    },
}


def clean_language(code) -> str:
    """Any value from the client -> a language we support (falls back to English)."""
    code = str(code or "").strip().lower()[:2]
    return code if code in LANGUAGES else DEFAULT_LANGUAGE


def t(language: str, key: str, **values) -> str:
    """Fill in one template: t("es", "note_maybe", items="gluten")"""
    return TEMPLATES[language][key].format(**values)


def allergen_list(language: str, allergens) -> str:
    """["peanuts", "gluten"] -> "cacahuetes y gluten" (in the given language)"""
    names = [ALLERGEN_NAMES[language].get(a, a) for a in allergens]
    if len(names) <= 1:
        return "".join(names)
    return TEMPLATES[language]["sep"].join(names[:-1]) + TEMPLATES[language]["and"] + names[-1]
