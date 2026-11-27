---
name: charjew-translation
description: Use when writing, adding, reviewing or fixing any value in src/i18n/ch.json — the Chärjew (Çärjow / Charjou / Chardzhou) Turkmen dialect locale `ch` — including every new i18n key, since a new key must land in all five locale files. Also use when a `ch` string reads as standard Turkmen (identical to tk.json) or when someone asks for "Çärjowça" text.
---

# Chärjew (`ch`) translations

## Overview

`ch` is the **Chärjew dialect of Turkmen** (Lebap / Türkmenabat), not Chinese.
It is how people in Türkmenabat actually talk: Turkmen grammar, Russian
loanwords for commerce and tech terms, its own verb endings, and a casual
spoken register. **`src/i18n/ch.json` is the only reference**. Every rule
below is extracted from it, and when a rule and the file disagree, the file wins.

**Core principle:** start from the _meaning_ (read `ru` and `en`), then say it
the way a Türkmenabat shop assistant would. Never transliterate `tk` word by word.

**Default to the dialect.** The project owner wants `ch` to be _mostly_
Chärjew. When a word has both a dialect form and a standard-Turkmen form,
pick the dialect one. Keep the standard form only when the dialect has no
alternative (`surat`, `reňk`, `ak`, `sary`) or the string is a proper noun,
number or code.

## The trap: about 40% of ch.json is not dialect

`scripts/translations/add-translation-row.mjs` maps `ch → tk` before calling
Google Translate, so every key added through it got **standard Turkmen**
in `ch.json`. Those entries are byte-identical to `tk.json` and are _not_
precedent. Only entries that **differ from tk** show the real dialect.

So:

- After running `add-translation-row.mjs`, **overwrite the `ch` value by hand**.
- When looking for precedent, use the comparison script (below), which marks
  machine entries `[= tk]`. Ignore those.
- Leaving a `ch` value equal to the `tk` value is a bug unless the string has
  nothing to dialectise (`Email`, `TMT`, `7 gün`, brand names).

## Workflow

1. **Read the meaning** from `ru.json` / `en.json` for the key.
2. **Find precedent** for each content word:
   `node .claude/skills/charjew-translation/compare.mjs "<regex>" --dialect`
   (matches keys and tk/ch/ru values; `--dialect` hides the `[= tk]` machine entries).
3. **Apply the three layers, in order:** lexicon → verb grammar → sound shifts.
4. **Keep the mechanics exact:** `{placeholders}`, ICU `{count, plural, ...}`
   blocks, `<link>` tags, `«»` quotes, `·` separators, trailing punctuation.
   `ch` does not need Russian-style plural branches. Mirror the `tk` structure.
5. **Check:** the value parses as JSON, contains no Cyrillic, and differs from `tk`
   (see the exception above).

## Layer 1: Lexicon (strongest signal)

Commerce, account and app vocabulary uses **Russian loans written in Turkmen
Latin script**. The most frequent swaps are below; [glossary.md](glossary.md)
has the full list.

| Meaning                 | tk (don't)         | ch (do)                                     |
| ----------------------- | ------------------ | ------------------------------------------- |
| product                 | haryt              | **towar**                                   |
| order                   | sargyt             | **zakaz**                                   |
| cart                    | sebet              | **korzina**                                 |
| add                     | goş                | **koş**                                     |
| delete                  | poz                | **öçür** (also `udalit et`)                 |
| new / update            | täze / täzele      | **taza / tazala**                           |
| account                 | hasap              | **akkaunt** (`akkaundyňyz`, `akkaunda gir`) |
| password                | gizlin söz         | **parol**                                   |
| user                    | ulanyjy            | **polzowatel**                              |
| delivery                | eltip bermek       | **dostawka**                                |
| download / upload       | ýükläp al / ýükle  | **skaçat et / zagruzit et**                 |
| save                    | ýatda sakla        | **sohranit (et)**                           |
| cancel (order)          | ýatyr              | **otmenit et**                              |
| status                  | ýagdaý             | **status**                                  |
| already                 | eýýäm              | **uže**                                     |
| total                   | jemi               | **opşi**                                    |
| phone number            | telefon belgi      | **nomer**                                   |
| main / home page        | esasy / baş sahypa | **osnownoý / glawny stranisa**              |
| app                     | programma          | **priloženiýa**                             |
| notifications           | bildiriş           | **uwedomleniýa**                            |
| settings                | sazlamalar         | **nastroýka**                               |
| discount                | arzanladyş         | **skidka**                                  |
| in stock / out of stock | bar / elýeter däl  | **skladda bar / skladda ýok**               |
| admin, staff            | dolandyryjy, işgär | **admin**                                   |
| customer                | müşderi            | **klient / polzowatel**                     |
| shop                    | dükan              | **magazin**                                 |
| search                  | gözle              | **ahtar**                                   |
| fast                    | çalt               | **tez**                                     |
| great, best             | gowy               | **zor**, `ýagşy`                            |
| create                  | döret              | **ýasa** (`ýasalan`) or `dörät`             |
| yes / sure              | hawa               | **owwa**, `koneçno`                         |
| cancel (button)         | reddet             | **izä**                                     |
| capital letter          | baş harp           | **kette harp**                              |
| yet, still              | entek              | **haly**                                    |
| try again               | täzeden synanyşyň  | **tazadan / kaýtadan barlap görüň**         |

Stays native: `surat`, `reňk`, `baha` (shopper-facing price; admin price records use `praýs`), `at/ady`, `saýla`, `ýaz`, `aç`, `ýap`, `bar/ýok`, `maslahat`, `bellik`, `kömäk`, `habarlaş`, `myhman`, `mugt`, `brend`, `kategoriýa`.

**Transliterating Russian loans:** в→w, ж→ž, ш/щ→ş, ч→ç, ц→s, й→ý, ы→y, х→h,
я→ýa, ю→ýu, -ие→-iýe (уведомление→uwedomleniýe, страница→stranisa,
поддержка→podderžka, настройка→nastroýka). **Never write Cyrillic.** The few
Cyrillic colour names in ch.json are mistakes, not precedent.

## Layer 2: Verb grammar

| Function                        | tk                                    | ch                                                                    | ch.json examples                                                           |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| present continuous ("is doing") | -ýar / -ýär                           | **-otran / -ýotran**                                                  | karaşylotran, ulanylotran, baglanotran, açylotran (loading), dowam edotran |
| participle ("which is being …") | -ýan / -ýän                           | **-dron**                                                             | beriledron (recommended), soraladron, gorkaziladron, ýaşydron              |
| general statement, 3rd person   | -ýar / -ar                            | **-ady / -edi / -idi**                                                | ulanylady, aýrylady, kesiledi, bolady, habarlaşady, göredi                 |
| negative of that                | -maýar / -meýär                       | **-midi / -maýady**                                                   | görkezilmidi, bilmidi, alynmaýady                                          |
| "you can" (polite)              | bilersiňiz                            | **bilesiz / biläsiz**                                                 | koşup bilesiz, zakaz edip bilesiz                                          |
| "you will get"                  | alarsyňyz                             | **alasyz**                                                            |                                                                            |
| "we do / we can"                | edýäris / bileris                     | **edämiz / bilämiz, -amyz**                                           | haýyş edämiz, habarlaşamyz, alamyz                                         |
| "are you sure you want to X?"   | X-mak isleýändigiňize ynanýarsyňyzmy? | **Toçno X-jakmy? / X-jaksyzmy?** or **X-mäk islotranyňyza uwerenmi?** | Toçno öçürjakmy? · Bu zakazy toçno otmenit etjaksyzmy?                     |
| "do you want to X?"             | isleýärsiňizmi                        | **islisizmi**                                                         | Bu reňki öçürmek islisizmi?                                                |
| not (copula)                    | däl                                   | **ämäz / emez**                                                       | Hökman ämäz · Hazyr emez!                                                  |
| as (a guest)                    | hökmünde                              | **bolup**                                                             | myhman bolup girdiňiz                                                      |
| saying "…"                      | diýip                                 | **dep**                                                               | okalan dep bellä                                                           |
| counting                        | 8 nyşan                               | **8-tä simwol**, `neçitä`, `{count}-ta`                               |                                                                            |

## Layer 3: Sound and spelling shifts (apply by default)

- **g → k** at word start: goş→koş, gara→kara, gyzyl→kyzyl, gymmat→kymmat, garaş→karaş, gaýtadan→kaýtadan.
- **ä → a** in _täze/häzir_ words: täze→taza, täzele→tazala, häzir→hazyr, häzirlikçe→hazyrlykça.
- **e → ä** in suffixes and second syllables of front-vowel words (always in short UI strings; in long sentences keep it to the common words below): üýtget→üýtgät, bilen→bilän, görkez→görkäz, töleg→töläg, gerek→gäräk, şäher→şähär, hemme→hämmä, kömek→kömäk, -çe→-çä (Iňlisçä, Türkmänçä).
- **b → p**: tabşyr→tapşyr.

## Register

Spoken and shorter than tk. Drop the bureaucratic padding:

- "üstünlikli täzelendi" → **"tazalandy!"** (or `Uspeşno tazalandy!`)
- "…haýyş edýäris" → put **`Haýyş`** first: _"Haýyş adminler bilen habarlaşyň."_
- Questions get direct: _"Toçno öçürjakmy?"_. Friendly exclamations are fine: _"Boldy!"_, _"Spasibo!"_, _"Salamaleýkum"_.
- SEO/meta strings may use the plural imperative **-ňlar**: _satyn alyňlar_.

## Worked example

|       |                                                 |
| ----- | ----------------------------------------------- |
| ru    | Не удалось обновить цены. Попробуйте ещё раз.   |
| tk    | Bahalary täzeläp bolmady. Täzeden synanyşyň.    |
| ✅ ch | Bahalary tazalap bolmady. Tazadan barlap görüň. |

|       |                                                                    |
| ----- | ------------------------------------------------------------------ |
| ru    | Вы уверены, что хотите удалить этот товар? Он исчезнет из корзины. |
| ✅ ch | Bu towary toçno öçürjakmy? Korzinadan hem aýrylady.                |

## Common mistakes

- **Copying tk** (or the `[= tk]` entries) as the dialect. This is the #1 failure.
- **Copying typos from ch.json**: `Parolyňzyda`, `informasiay`, `Filtileri`, `Uytgedilen` (missing ý/ü). Follow the pattern, spell it correctly.
- **Writing Cyrillic** (`Коричневый`). Transliterate: `Koriçnewyý`.
- **Russifying everything.** Native words like `surat`, `reňk`, `saýla` and `maslahat` stay. Check precedent before swapping.
- **Breaking placeholders**: translating `{count}` or `{businessName}`, or dropping `<link>…</link>`.
- **Mixing layers half-way** (`Täze towar koş` keeps tk `täze`). Pick the dialect form for every word that has one.
