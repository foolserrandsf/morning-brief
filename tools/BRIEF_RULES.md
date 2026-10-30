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
