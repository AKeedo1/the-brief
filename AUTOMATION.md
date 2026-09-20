# Daily Edition Automation

This file is the durable runbook for `Personal Morning News Brief`.

## Run

1. Read `../daily-edition/EDITORIAL-SPEC.md` completely.
2. Read `content/edition.json` for the schema and previous-edition timestamp.
3. Browse the live web. Research every coverage beat in the editorial contract and select only developments since the previous edition that clear the consequence or explanatory-value threshold.
4. Normally select 7–10 developments, but publish fewer when little changed. Do not let one lead narrative crowd out unrelated important news.
5. Research one sourced 5–8 minute Long View history piece. Rotate regions, eras and fields; avoid trivia and forced analogy.
6. Archive the previous JSON to `content/archive/YYYY-MM-DD.json` if it has not been archived.
7. Update `content/edition.json` without changing its schema. Use direct source URLs and distinguish facts, inference and uncertainty.
8. Write `content/audio-script.json` for this exact edition number and display date. Narrator: `am_michael` (Michael), using the existing local Kokoro service. Write a separate 500–600-word conversational briefing covering the main developments, preserving attribution and uncertainty; it must sound written for listening. Write a roughly 130–180-word spoken explanation for every news story keyed by its exact story ID. Keep the written edition intact. The Long View is narrated separately, never appended to the short briefing. Maintain the script schema and one short sample passage. No voice auditions during daily runs.
9. Confirm the existing Kokoro service is available at `http://127.0.0.1:8880/health`. If it is unavailable, start the existing `kokoro` Docker container; do not install another provider or change the voice. Run `python scripts/generate-audio.py --voices am_michael`. It caches recordings by text and narrator and publishes a manifest only after generation completes. The measured short briefing must be 180–300 seconds; revise only the spoken script if it falls outside that range. Never estimate or invent the duration, fall back to the device voice, or reuse a previous edition's recording. Generation failure blocks publication and must be reported.
10. Run `node scripts/render-edition.mjs`, then `npm run build`, then `node --test tests/audio.test.mjs`. The build validates matching edition/script hashes and packages only the recordings referenced by the current manifest.
11. Validate the date, story count, links, Long View, depth controls, save controls, discussion handoffs and narration. Check a real audio URL and playback/seek in the browser. If anything fails, leave the currently published edition untouched.
12. Commit the validated edition, archive, spoken script, audio manifest, generated HTML and only MP3 files referenced by the manifest. Never add rejected voice auditions, credentials, unreferenced recordings or unrelated work. Push `main` to the GitHub `origin`. The Pages workflow publishes the validated static build at `https://akeedo1.github.io/the-brief/`.
13. Poll the Pages deployment until it succeeds, then confirm the live page contains the new edition date and that its short audio recording responds successfully. Do not report success before both are current.
14. Optionally run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-server.ps1` to retain the private Tailscale fallback at `http://100.108.16.61:8789/`. The GitHub Pages edition is the primary surface and remains online when the PC is off.

Do not redesign during a scheduled run. Do not post the edition into a conversation or Telegram. Report only the date, success or failure, and `https://akeedo1.github.io/the-brief/`.
