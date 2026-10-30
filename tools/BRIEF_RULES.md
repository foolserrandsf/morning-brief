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
