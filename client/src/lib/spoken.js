// What the Read button says, in each language. Read runs on the phone with no
// server call, so it needs its own copy of the allergen names; keep them in
// sync with ALLERGEN_NAMES in server/i18n.py.
//
// Allergies are always stored with their English keys ("peanuts"); these are
// only the words that get spoken.

const ALLERGEN_NAMES = {
  en: { milk: "milk", egg: "egg", fish: "fish", shellfish: "shellfish", "tree nuts": "tree nuts",
        peanuts: "peanuts", wheat: "wheat", gluten: "gluten", soy: "soy", sesame: "sesame" },
  es: { milk: "leche", egg: "huevo", fish: "pescado", shellfish: "mariscos", "tree nuts": "frutos secos",
        peanuts: "cacahuetes", wheat: "trigo", gluten: "gluten", soy: "soja", sesame: "sésamo" },
  fr: { milk: "lait", egg: "œuf", fish: "poisson", shellfish: "fruits de mer", "tree nuts": "fruits à coque",
        peanuts: "arachides", wheat: "blé", gluten: "gluten", soy: "soja", sesame: "sésame" },
  zh: { milk: "牛奶", egg: "鸡蛋", fish: "鱼", shellfish: "贝类", "tree nuts": "坚果",
        peanuts: "花生", wheat: "小麦", gluten: "麸质", soy: "大豆", sesame: "芝麻" },
  ar: { milk: "الحليب", egg: "البيض", fish: "السمك", shellfish: "المحار", "tree nuts": "المكسرات",
        peanuts: "الفول السوداني", wheat: "القمح", gluten: "الغلوتين", soy: "الصويا", sesame: "السمسم" },
}

// {name} {price} {text} {items} {original} are filled in below
const READ = {
  en: { sep: ", ", and: " and ", line: "{name}, {price}.", price: "{price} dollars", noPrice: "price not listed",
        desc: "{text}.", avoid: "Avoid: it contains {items}.", maybe: "It may contain {items}, so ask your server.",
        original: "On the menu it's called {original}." },
  es: { sep: ", ", and: " y ", line: "{name}, {price}.", price: "{price} dólares", noPrice: "precio no indicado",
        desc: "{text}.", avoid: "Evitar: contiene {items}.", maybe: "Puede contener {items}, así que pregunta al personal.",
        original: "En el menú aparece como {original}." },
  fr: { sep: ", ", and: " et ", line: "{name}, {price}.", price: "{price} dollars", noPrice: "prix non indiqué",
        desc: "{text}.", avoid: "À éviter : contient {items}.", maybe: "Peut contenir {items}, demandez au serveur.",
        original: "Sur le menu : {original}." },
  zh: { sep: "、", and: "和", line: "{name}，{price}。", price: "{price}美元", noPrice: "未标价格",
        desc: "{text}。", avoid: "请避免：含有{items}。", maybe: "可能含有{items}，请询问服务员。",
        original: "菜单上的名称是{original}。" },
  ar: { sep: "، ", and: " و", line: "{name}، {price}.", price: "{price} دولار", noPrice: "السعر غير مذكور",
        desc: "{text}.", avoid: "تجنّب: يحتوي على {items}.", maybe: "قد يحتوي على {items}، لذا اسأل النادل.",
        original: "اسمه في القائمة: {original}." },
}

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "")

function allergenList(language, allergens) {
  const words = allergens.map((a) => ALLERGEN_NAMES[language][a] ?? a)
  if (words.length <= 1) return words.join("")
  return words.slice(0, -1).join(READ[language].sep) + READ[language].and + words.at(-1)
}

// the whole Read sentence for one dish, in the reader's language
export function readAloudText(item, allergies, language = "en") {
  const r = READ[language] ?? READ.en
  const lang = READ[language] ? language : "en"
  const name = item.name_translated || item.name
  const price = item.price == null ? r.noPrice : fill(r.price, { price: item.price })
  const description = item.description_translated || item.description
  const avoid = item.contains.filter((a) => allergies.includes(a))
  const maybe = item.possibly_contains.filter((a) => allergies.includes(a) && !avoid.includes(a))

  return [
    fill(r.line, { name, price }),
    description && fill(r.desc, { text: description }),
    // translated to something different? also say the printed name, so they can order it
    name !== item.name && name.toLowerCase() !== item.name.toLowerCase() && fill(r.original, { original: item.name }),
    avoid.length > 0 && fill(r.avoid, { items: allergenList(lang, avoid) }),
    maybe.length > 0 && fill(r.maybe, { items: allergenList(lang, maybe) }),
  ].filter(Boolean).join(" ")
}
