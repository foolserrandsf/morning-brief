# Brief JSON (one file per day → `tools/publish.py brief FILE.json`)

Every lesson section MUST end with `quiz`: 2–4 items `{"q": "...", "o": ["4 options"], "a": <index of right option>, "w": "one-line why"}`.
Wrong options should be real, plausible neighbours (other bottles on our shelves, other kanji, other terms) so recall actually trains discrimination.
Add `"img": "<url>"` to a bottle question to show the label (e.g. "Which bottle is this?").

```json
{
 "date": "YYYY-MM-DD", "edition": 2,
 "greeting": "short upbeat line (one emoji max)",
 "focus": {"one_thing": "the single most important thing today", "why": "...", "first_step": "a 2-minute first step"},
 "weather": {"place": "San Francisco", "now": "62°", "hi": 66, "lo": 55, "sky": "...", "rain": "10%", "wear": "what to wear + any alert"},
 "japan": {"active": true, "day": "Day 3 of 16 · Tokyo", "today": "plans for today", "phrase": {"jp": "", "romaji": "", "en": ""}, "tip": "..."} or null,
 "calendar": [{"time": "9:00 AM", "end": "10:00 AM", "title": "", "where": "", "note": ""}],
 "inbox": [{"account": "gmail" | "fe", "from": "", "subject": "", "ask": "what they need from her", "by": "deadline or ''", "url": "Gmail viewUrl"}],
 "inbox_note": "optional",
 "football": {"link": "https://foolserrandsf.github.io/football-brief/", "games": [{"league": "NFL|NCAA", "matchup": "Away @ Home", "kickoff": "Sat 4:30 PM PT", "tv": "", "spread": "Fav -3", "pick": "brief's Kalshi pick or ''", "your_bet": "her bet or ''"}]},
 "news": [{"source": "", "headline": "own words", "why": "one sentence", "url": ""}],
 "kanji": {"n": 2, "ref": "#2 二", "kanji": "二", "reading": "に · ni", "meaning": "two", "hook": "mnemonic", "example": "", "example_romaji": "", "example_en": "", "spot_it": "", "quiz": []},
 "bottle": {"ref": "<sheet ID e.g. b64>", "title": "Producer · Cuvée", "producer": "", "wine": "", "grapes": "", "place": "", "vintage": "", "price": "chalk price, digits only", "group": "taste group", "photo": "label photo URL (required)", "hook": "", "tasting": [], "terroir": "", "producer_notes": [], "pitch": "30-second guest pitch", "quiz": []},
 "wset": {"n": 2, "level": "WSET Level 2|Level 3|Blind tasting", "title": "", "body": ["2–4 short paragraphs"], "tie_in": "a bottle on our shelves that shows it", "try_it": "", "quiz": []},
 "stocks": {"n": 2, "title": "", "hook": "today's market/news tie-in with real numbers", "body": [], "key_terms": [{"term": "", "def": ""}], "quiz": []},
 "crypto": {"n": 2, "title": "", "hook": "", "body": [], "key_terms": [], "quiz": []},
 "filipino": {"n": 2, "lang": "Tagalog|Kapampangan", "phrase": "", "say_it": "pronunciation", "meaning": "", "breakdown": [{"word": "", "means": ""}], "use_it": "", "quiz": []},
 "sources": [{"title": "", "url": ""}]
}
```

# Recs JSON (`tools/publish.py recs FILE.json`)

```json
{"posted": "Tue Oct 13 · 6 PM", "title": "Tuesday bottle recs",
 "try":  [{"name": "Producer · Cuvée (vintage)", "price": "64", "why": "why she should taste it", "photo": "url"}],
 "push": [{"name": "", "pitch": "one-line guest pitch", "pair_with": "the guest it's for", "photo": "url"}]}
```

The app builds the recall quizzes itself (every other day from Oct 9, 2026), the "second chance" quiz (misses, every day) and the Sunday weekly kanji quiz from the encrypted pool — the writer never needs to.
