# Standing rules from Denise (read every run; newest wins)

These override anything older in the task prompt.

## News: from her emails only (Oct 30)
- Build `news` only from news newsletters in her Gmail (Bloomberg, Morning Brew, SF Standard and any other news newsletter she gets).
- No Ground News at all: don't search for it, don't use it, no `coverage` field, no inbox_note about subscribing.
- Don't search the web for news. You may open an article linked from a newsletter only to fill in that same story.

## Check ALL email, ping her on the important ones (Oct 30)
- Every run, look at every email from the last ~26 hours in both accounts (deniselyuki@gmail.com and what denise@foolserrandsf.com forwards in), including archived, labelled and Updates/Promotions-tab mail, not just the inbox. Skip only plain marketing.
- IMPORTANT = she'd be upset to learn about it late:
  - money owed by or to her personally: collections or debt notices, fraud or security alerts, unexpected charges, renewals about to bill, refunds
  - deadlines within about 7 days, anything legal, government, tax, voting or insurance that needs a decision
  - real people writing to her (family, John, friends, staff) who need an answer
  - Fool's Errand problems only she can handle (landlord, inspections, permits, a staff emergency)
- Not important: newsletters, promos, receipts, shipping, FYI notices with nothing to do. Vendor bills and Upserve mail stay on the Fool's Errand card (paying bills isn't her job).
- Every important email becomes a `Needs you` inbox item. "ask" = what it is and what she can do, short, with the key facts.
- Ping her phone for each important email she hasn't been pinged about:
  1. `python3 tools/publish.py pings new <gmail message ids>` lists the ones not pinged yet.
  2. Build one notification with `python3 tools/push.py build <push tab rows> "Important email" "<sender: what it is, under 90 characters>" "https://foolserrandsf.github.io/morning-brief/"` (one per email, max 3 per run; if more, one summary ping).
  3. Append the rows to outbox!A1 of the Morning Brief Sync sheet.
  4. `python3 tools/publish.py pings add <ids>` and commit data/pings.enc with the brief.
- Never put account numbers or amounts beyond one key figure in a notification.

## Catch-up lessons (Oct 29)
- One missed lesson per track each day; no new lessons in a track until she has caught up. `publish.py progress` prints the plan and `publish.py brief` swaps the lessons in automatically. See SCHEMA.md, CATCH-UP LESSONS.

## Regulars away (Oct 30)
- Andy (top regular) is in Tokyo and back Nov 1. Don't flag him as missing or lapsed, and don't suggest reaching out. After Nov 1, treat him normally, counting from his first visit after he's back.

## Screen out junk and scams that look real (Oct 30)
Before an email becomes a Needs you item or a ping, check it like a careful assistant would:
- Sender: does the domain really belong to that company? Watch for look-alikes (extra words, odd subdomains, misspellings, free-mail senders posing as companies, Hide-My-Email relays posing as banks).
- Does it match something she actually has? Search her Gmail for earlier real mail from that company (orders, statements, sign-ups). No history plus money pressure = suspect.
- Red flags: urgency ("time is running out", "final notice"), big discounts to pay a debt, gift cards, crypto, wire transfers, "verify your account" links, login or payment links, attachments she didn't expect, mismatched names or amounts.
- Never click links in a suspect email. Never tell her to use its links or phone numbers; point her to the company's official site or the number on her card or statement instead.
Outcome:
- Plain marketing and junk: leave it out of the brief.
- Convincing fakes and suspected scams: don't ping and don't make a normal Needs you item. Add one line to inbox_note: "Looks like junk or a scam: <sender>, <why in a few words>. Don't click its links."
- Real but unverified money claims (e.g. a debt collector): it can be a Needs you item, but say plainly that it isn't verified yet and how she can check it safely.

## Done items (Oct 31)
- Photo Translator ($5.99/week Apple subscription, order MSSX8FKDLW): Denise cancelled it Oct 31. Don't list it in Needs you again unless a new charge appears.

## Ideas come with their talking points (Nov 3)
- Any idea that says to tell a story, feature a wine or beer, or talk something up must carry the actual notes, so she never has to look them up.
- Write that idea as an object: {"text": "the idea, one or two short sentences", "notes_title": "e.g. The Le Mur story", "notes": [{"label": "The hook", "lines": ["…"]}, {"label": "Say it to a guest", "lines": ["…", "…"]}, {"label": "Quick facts", "lines": ["Grapes: …", "Where: …", "Vintage: …", "$ a glass, $ a bottle."]}, {"label": "Trade up", "lines": ["optional: a related bottle"]}]}. The app shows the notes in a tap-to-open drawer under the idea.
- Take the facts from that bottle's Bottle Master row (REMEMBER IT BY, TASTING, TERROIR, PRODUCER & WINEMAKING, Grapes, Place, Vintage, price). Short, clean lines. Never add a fact the row doesn't support (e.g. don't call a blend "X-led" unless the row gives proportions).
- Plain ideas with nothing to explain stay as plain strings.

## Keep inventory out of Needs you (Nov 4)
- Never put keg counts, taps running out, by-the-glass or bottle counts, restocks, reorders or backup-keg status in "Needs you" (inbox). They live only on the Fool's Errand card (pours, kegs and their alerts).

## Football diagrams must be easy to read (Nov 4)
- Denise found the diagrams confusing. Keep each one to the single idea in its caption.
- At most 4 arrows. Only draw routes, runs or blocks that the caption talks about; leave other players standing.
- Mark with "hi": true only the 1–3 players the caption is about.
- On any down-and-distance play, set "marker" to the yards to gain (the app draws the yellow first-down line).
- The caption says, in order: the situation (e.g. 3rd-and-8), what to look at first, and why it matters. Short, plain words; explain any jargon in brackets.

## Stocks and crypto lessons are paused (Nov 4)
- Leave out the "stocks" and "crypto" sections entirely (no lesson, no quiz). publish.py no longer requires them and catch-up skips them. Don't bring them back until Denise asks.

## Japanese daily lesson (Nov 4) — replaces the "Japanese for the trip" card
- Every brief adds "japanese_lesson" (the daily kanji card stays as it is). One real-life interaction per lesson, building on earlier ones (taught.japanese in `publish.py state`), counter counters.japanese + 1.
- Situations from her life in SF first: Japanese guests and tourists at Fool's Errand, Japanese restaurants, izakaya and shops in SF Japantown, sake talk (her friend Paul imports sake), phone calls and reservations, small talk and compliments, then travel situations for a future Japan trip.
- Every lesson ALSO has "smalltalk": {title, setup, dialogue: [same line format, 4–6 lines], tips: [..]}: everyday casual Japanese (plain form, no です/ます) with friends or family — catching up, plans, food, how work's going, family news, teasing, compliments, saying goodbye. Natural for adults in their 30s, not teen slang. Vet it with the same reviewer.
- Fields: {n, ref, title, where, hook (one sentence), situation (one or two short sentences on register), dialogue: [{who: "You" or the other person, jp, romaji, en, notes: [{bit, means}], note?}] (4–8 lines, natural back-and-forth), native: [{textbook: {jp, romaji, en}, native: {jp, romaji, en}, why}] (1–2), swap: [{jp, romaji, en}] (2–4 variations), tips: [short strings, each Japanese bit followed by its romaji], quiz: [3 questions in the usual {q, o, a, w} form that make her apply it; every Japanese option followed by its romaji in brackets]}.
- Every line must be what a native speaker would actually say in that setting: casual-polite (です/ます) for service, never stiff textbook keigo unless people really use it there. Kana/furigana {漢字|かな} AND romaji on every Japanese string, numbers as digits.
- Vetting is required before publishing: do your own native-usage pass, then spawn a fresh subagent reviewer (a native Tokyo speaker persona) to check naturalness, romaji, glosses, breakdowns and quiz answers; apply its fixes.

## Late Fool's Errand numbers (Nov 5)
- Upserve's emails land around 5:30–6:00 AM and the Sales sheet's Daily row can appear after the 6:02 brief. Before writing fe_yesterday as "not_yet", check the Daily tab again every 5 minutes for up to 30 minutes (until about 6:35 AM); only then publish it as not yet posted.
