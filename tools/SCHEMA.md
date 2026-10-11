# Brief JSON (one file per day → `tools/publish.py brief FILE.json`)

READABILITY: she reads this half-awake. Every section leads with the takeaway, then 3–4 short
points that carry the real substance (numbers, names, the why), and the full explanation sits one
tap away in a "more" drawer. So for news items give `points`, for wset/stocks/crypto give `points`
(the drawer shows `body`), for weather put alerts in `alerts`, for japan give `headline` + `facts`.
Points are full, specific sentences of at most ~22 words each — never vague teasers.

Every lesson section MUST end with `quiz`: 2–4 items `{"q": "...", "o": ["4 options"], "a": <index of right option>, "w": "one-line why"}`.
Wrong options should be real, plausible neighbours (other bottles on our shelves, other kanji, other terms) so recall actually trains discrimination.
FURIGANA: every kanji she hasn't learned yet needs a reading, written as `{漢字|かんじ}` (kana only) anywhere it appears — phrase, notes, tip, inbox subjects, kanji examples, quiz text. Learned = number kanji + every kanji taught so far (`python3 tools/publish.py state` → taught.kanji) + today's kanji. Mark whole words, not single characters inside a word (`{特大|とくだい}`, `{予約|よやく}`; okurigana stays outside: `{届|とど}いたら`). When a quiz question or option is testing that very reading (or a reading would give the answer away), write `{今日|-}` to keep it bare on purpose. The publisher rejects any unlearned kanji without markup.

Add `"img": "<url>"` to a bottle question to show the label (e.g. "Which bottle is this?").

```json
{
 "date": "YYYY-MM-DD", "edition": 2,
 "greeting": "short warm line, no emoji",
 "focus": {"one_thing": "the single most important thing today", "why": "...", "first_step": "a 2-minute first step"},
 "weather": {"place": "San Francisco", "now": "62°", "hi": 66, "lo": 55, "sky": "...", "rain": "10%", "wear": "ONE sentence: what to wear", "alerts": [{"title": "Coastal flood advisory", "detail": "one sentence: when + what it means for her"}], "japan": [{"city": "Tokyo", "when": "Oct 14–16, Oct 21–28", "hi": 22, "lo": 15, "sky": "Partly sunny", "rain": "10%", "days": [{"day": "Wed 14", "hi": 21, "lo": 14, "sky": "Showers", "rain": "60%"}], "note": "one line: what to pack or wear there"}] (Oct 9–28 only; always °F)},
 "japan": {"active": true, "day": "Day 3 of 16 · Tokyo", "headline": "Japan in 2 days" or "Day 3 of 16 in Tokyo", "facts": [{"icon": "✈️", "label": "Flight", "value": "UA7949 Tue Oct 13, SFO 12:15 PM → Narita 3:25 PM Wed"}, {"icon": "🎟️", "label": "Koshien tickets", "value": "..."}, {"icon": "🏨", "label": "Tonight", "value": "..."}], "today": "fallback prose if no facts", "phrase": {"jp": "", "romaji": "", "en": "", "notes": [{"bit": "grammar/vocab chunk", "means": "what it does"}]}, "tip": "what staff will likely say back"} or null,
 "calendar": [{"time": "9:00 AM", "end": "10:00 AM", "title": "", "where": "", "note": ""}],
 "inbox": [{"account": "gmail" | "fe", "from": "", "subject": "", "ask": "what they need from her", "by": "deadline or ''", "url": "Gmail viewUrl"}],
 "inbox_note": "optional",
 "football": {"link": "https://foolserrandsf.github.io/football-brief/", "games": [{"league": "NFL|NCAA", "matchup": "Away @ Home", "kickoff": "Sat 4:30 PM PT", "tv": "", "spread": "Fav -3", "pick": "brief's Kalshi pick or ''", "your_bet": "her bet or ''"}]},
 "fe_yesterday": {"date": "YYYY-MM-DD (yesterday)", "status": "ok" | "closed" | "not_yet", "note": "only for closed/not_yet: one plain sentence", "guests": 186, "avg_check": 31.23, "net": 5808.78, "tips": 1005.64, "tip_pct": 17.3, "tips_real": true, "mtd": {"net": 41341.16, "prev_net": 39000, "prev_label": "Sep 1–10", "pct": 6.0}, "expenses": {"month": "October", "owed": 16260.23, "owed_count": 17, "past_due": 3275.8, "paid_month": 10119.22, "invoices_month": 8506.75, "fixed_month": 29110, "total_month": 37616.75, "sales_month": 41341.16, "note": "one line on what is counted"}, "weekly_tips": {"week": "Oct 5–11", "people": [{"name": "Simi", "tips": 812.4, "shifts": 4, "paid": 600, "balance": 212.4, "paid_through": "Oct 7", "last_paid": {"date": "Oct 7", "amount": 600}}], "total": 0, "paid_total": 600, "since": "2026-10-09", "unmatched": [{"name": "as written on Tips paid", "amount": 0, "date": "2026-10-07"}], "note": "one or two lines: the tip rule used and anything that is a placeholder or missing. Take every number from the Tip balances tab of the Sales sheet (its project owns the tip rule); tips = earned since tracking began, paid = paid out since then, balance = still owed (negative = paid more than earned, which the app flags in red)"} (Mondays only), "bills": {"due_soon": [{"vendor": "", "amount": 0, "due": "Oct 14"}], "overdue": [{"vendor": "", "amount": 0, "due": "Sep 18"}]}, "vs_last_week": {"date": "YYYY-MM-DD", "net": 8310.18, "diff": -2501.40, "pct": -30.1}, "shifts": [{"shift": "AM only", "hours": "2 to 6 pm", "who": "bartender(s) from the Tips by shift tab", "tips": 335.02}] (the app shows these right under the tips total), "regulars_label": "plain words for what makes them regulars, e.g. Back again (came both Friday and Saturday)", "regulars": [{"name": "exactly as the Regulars tab writes it, or a first name the card shows", "visits": 2, "note": "one specific line: when they came, what they spent, anything notable"}], "trend": {from tools/fe_trend.py}, "forecast": {from tools/fe_trend.py}, "analysis": "1–2 sentences: are sales rising or falling and why, citing the trend numbers", "ideas": ["2–3 concrete ideas for the week — varied, never food upsells"], "connections": [{"title": "one plain finding, under 8 words", "detail": "1–2 sentences with the numbers behind it"}], "connections_basis": "one line: what data these come from"} — from the "Fool's Errand Sales 2025-2026" sheet (read only),
 "upserve": {the JSON object from the "upserve" tab of the Morning Brief Sync sheet for the latest night, unchanged (date, net, checks, tips, avg_check, vs_last_week_pct, tips_by_shift, top_items, categories, regulars, newcomers, lapsed, top_spenders_30d, ledger_since), plus "headline": "one plain sentence on how the night went", "insight": "one concrete thing to do on the next shift", "spending": {"wtd": 0, "sales_wtd": 0, "mtd": 0, "sales_mtd": 0, "new": [{"vendor": "", "amount": 0, "due": "Oct 24", "what": "short description"}], "due_soon": [{"vendor": "", "amount": 0, "due": ""}], "overdue": [{"vendor": "", "amount": 0, "due": "", "note": "e.g. 2nd notice; orders on hold"}], "note": "one line on coverage, e.g. only invoices forwarded so far"} (leave spending out until invoices arrive)} or omit,
 "news": [{"source": "", "headline": "own words", "points": ["3 specific sentences: what happened with numbers, the context, what happens next"], "summary": ["2 short paragraphs, 4–6 sentences total, own words: what happened, key numbers, who is involved, background, what happens next — enough that she never needs to open the link"], "why": "one sentence on why it matters to her (the bar, SF, her investing lessons, Japan, football)", "coverage": "Ground News stories only: e.g. \"38 sources · 45% left, 40% center, 15% right · blindspot for the right\"", "url": ""}],
 "kanji": {"n": 2, "ref": "#2 二", "kanji": "二", "reading": "に · ni", "meaning": "two", "hook": "mnemonic", "example": "", "example_romaji": "", "example_en": "", "spot_it": "", "quiz": []},
 "bottle": {"ref": "<sheet ID e.g. b64>", "title": "Producer · Cuvée", "producer": "", "wine": "", "grapes": "", "place": "", "vintage": "", "price": "chalk price, digits only", "group": "taste group", "photo": "label photo URL (required)", "hook": "", "tasting": [], "terroir": "", "producer_notes": [], "story": ["3–4 unique producer/place story highlights that are NOT already on the booklet page (the sheet columns): one specific, sourced sentence each — family history, a vineyard quirk, a winemaking choice, a name origin"], "pitch": "30-second guest pitch built on one of the stories", "quiz": []},
 "wset": {"n": 2, "level": "WSET Level 2|Level 3|Blind tasting", "title": "", "lead": "the concept in one sentence", "points": ["3–4 key takeaways"], "body": ["2–4 short paragraphs (shown when she taps 'Explain it fully')"], "tie_in": "a bottle on our shelves that shows it", "try_it": "", "quiz": []},
 "stocks": {"n": 2, "title": "", "hook": "today's market/news tie-in with real numbers", "points": ["3–4 key takeaways"], "body": [], "key_terms": [{"term": "", "def": ""}], "quiz": []},
 "crypto": {"n": 2, "title": "", "hook": "", "points": [], "body": [], "key_terms": [], "quiz": []},
 "filipino": {"n": 2, "lang": "Tagalog|Kapampangan", "phrase": "", "say_it": "pronunciation", "meaning": "", "breakdown": [{"word": "", "means": ""}], "use_it": "", "quiz": []},
 "recs": {see Recs below — Tuesdays and Saturdays only; leave it out on other days},
 "sources": [{"title": "", "url": ""}]
}
```

# Recs (the brief's "recs" field, Tuesdays and Saturdays)

```json
{"posted": "for tonight's shift", "title": "Tuesday bottle recs",
 "try":  [{"name": "Producer · Cuvée (vintage)", "price": "64", "why": "why she should taste it", "story": "one unique producer story line not on the booklet page", "photo": "url"}],
 "push": [{"name": "", "pitch": "one-line guest pitch", "pair_with": "the guest it's for", "story": "one unique producer story line not on the booklet page", "photo": "url"}]}
```

The app builds the recall quizzes itself (every other day from Oct 9, 2026), the "second chance" quiz (misses, every day) and the Sunday weekly kanji quiz from the encrypted pool — the writer never needs to.
