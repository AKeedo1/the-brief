# Daymark Daily Edition Automation

This file is the durable runbook for `personal-morning-news-brief`, displayed as `Daymark — Daily Edition`. It is the sole intended publisher. The accidental Bold & Curious task is not a separate editorial product. The consolidated editorial contract takes precedence over older conversation proposals and automation-memory entries saying preferences are unconfirmed.

## Run

1. Read `../daily-edition/EDITORIAL-SPEC.md` completely.
2. Read `content/edition.json` for the schema and previous-edition timestamp.
3. Browse the live web. Research every coverage beat in the editorial contract and select only developments since the previous edition that clear the consequence or explanatory-value threshold.
4. Build a broad, concise headline sweep. Expand only a small number of personally relevant or genuinely interesting stories (working default: at most three). Omit optional background/evidence on ordinary news instead of manufacturing depth. Research all the confirmed beats in the editorial contract; no fixed story quota and no geopolitical monoculture.
5. Research both a sourced Long View history piece and a separate Curiosity Corner discovery. Put the latter in `radar` with label `Curiosity Corner`, a useful explanation and a verified direct source URL. Keep the existing schema. Rotate regions, eras and fields; avoid forced analogy. Never copy unverified claims from earlier chat newsletters.
6. Archive the previous JSON to `content/archive/YYYY-MM-DD.json` if it has not been archived.
7. Update `content/edition.json` without changing its schema. Use direct source URLs and distinguish facts, inference and uncertainty.
8. Write `content/audio-script.json` for this exact edition number and display date. Narrator: `am_michael` (Michael), using the existing local Kokoro service. Write a separate 500–600-word conversational briefing covering the main developments, preserving attribution and uncertainty; it must sound written for listening. Write a roughly 130–180-word spoken explanation for every news story keyed by its exact story ID. Keep the written edition intact. The Long View is narrated separately, never appended to the short briefing. Maintain the script schema and one short sample passage. No voice auditions during daily runs.
9. Confirm Kokoro is healthy at `http://127.0.0.1:8880/health`. If the existing container is stopped, start it once; do not repeatedly restart a shared healthy service or install another provider. Run `python scripts/generate-audio.py --voices am_michael` once. It reuses validated recordings, caches short WAV sections, retries transient section failures up to three times, then encodes the complete recording to MP3. It has a ten-minute budget and an OS lock against duplicate jobs. The manifest changes only after all required recordings succeed. Do not manually relaunch eight times, raise the budget or write an edition-specific workaround: report the failed stage and retain caches. The short briefing must measure 180–300 seconds; revise only its spoken script if needed. Never estimate duration, use device speech or omit story/history narration.
10. Run `npm run verify:edition` once after content/audio is final. This renders, builds and runs the audio/archive tests with fail-fast handling and phase timings. It validates edition/script hashes, packages referenced recordings and renders every archive. Repeat only after an actual change or resolved failure, not before and after each Git command.
11. Use `BROWSER-CHECK.md` for pre-publication validation. Content-only updates require the short playback/seek, current-content and archive-navigation smoke check. Full depth/save/discussion/mobile regression is required when renderer, styles or browser code changed. A failed required pre-publication check blocks publication. Report browser transport failures separately from content failures and apply the explicit retry cap.
12. Commit the validated edition, archive, spoken script, audio manifest, generated HTML and only MP3 files referenced by the manifest. Never add rejected voice auditions, credentials, unreferenced recordings or unrelated work. Push `main` to the GitHub `origin`. The Pages workflow publishes the validated static build at `https://akeedo1.github.io/the-brief/`.
13. Wait for the exact pushed commit's Pages deployment to succeed (one bounded watch, at most five minutes). Then run `npm run verify:live`. It verifies edition hashes/date/headlines/history/curiosity, exact application/style assets (normalizing Git line endings), and byte ranges at both ends of every recording. This is delivery verification, not a claim of browser playback. Pre-publication browser playback remains required; content-only releases do not need another identical live browser walkthrough. On live-check failure allow one retry after 15 seconds for CDN propagation, then report failure. Never mark success from a generic HTTP 200. If application code changed, also perform one live browser smoke check within the recovery cap.
14. Optionally run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-server.ps1` to retain the private Tailscale fallback at `http://100.108.16.61:8789/`. The GitHub Pages edition is the primary surface and remains online when the PC is off.

Do not redesign during a scheduled run. Do not post the edition into a conversation or Telegram. Report only the date, success or failure, and `https://akeedo1.github.io/the-brief/`.

## Reliability and timing

- Preserve full content, all story recordings, the short briefing and separate Long View. Abdulla accepted the inherent work and asked to remove avoidable failure/retry overhead.
- Audio metrics: `.cache/daymark/audio-timing.json` records cache hits, segment attempts, errors and elapsed times. Release metrics: `validation-local.json` and `validation-live.json` in the same directory. These are ignored local diagnostics.
- Record research/drafting start and finish plus final worker elapsed time in automation memory. Use command reports for audio/check durations. Distinguish composition, successful processing, recovery and deployment waiting.
- A crash or failed section must leave the previous complete manifest untouched. Do not clear caches to troubleshoot.
- Put durable recovery in shared scripts/runbook, never an ephemeral one-edition repair. Cloud migration and new providers remain separate decisions.

## Brand

The publication is Daymark. Keep the Daymark masthead, application metadata, manifest and icon references intact when rendering each edition. Use Daymark in briefing audio track titles. The existing GitHub repository and public URL remain unchanged.
