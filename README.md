# Morning Brief ☕

Denise's daily morning brief as a phone app (GitHub Pages). Add it to the iPhone home screen from Safari: Share → Add to Home Screen.

- Every personal file in `data/` is encrypted (AES-256-GCM, key from a passphrase via PBKDF2). The passphrase is typed once per phone and is never stored in this repo.
- A scheduled task writes the day's brief as JSON and runs `MB_KEY=… python3 tools/publish.py brief brief.json`, which validates it, adds its quiz questions to the recall pool and encrypts everything.
- Bottle recs (Tue 6 PM, Sat 1:30 PM) go through `tools/publish.py recs recs.json`.
- Quiz progress (mastery, misses to re-quiz) lives on the phone; recall quizzes run every other day, misses come back daily until answered right three times.
- `./bump.sh` before committing app changes so phones pick them up.
