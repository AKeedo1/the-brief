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
8. Run `node scripts/render-edition.mjs`, then `npm run build`.
9. Validate the date, story count, links, Long View, depth controls, save controls, discussion handoffs and narration. If anything fails, leave the currently published edition untouched.
10. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-server.ps1` and confirm `http://127.0.0.1:8789/` returns the new edition.
11. The live reading surface is the stable private Tailscale URL `http://100.108.16.61:8789/`; the server reads the rendered files directly, so a successful render updates that URL immediately. When Sites source publishing is available, also use the Sites build and hosting skills to privately deploy the same validated build. Reuse the project ID in `.openai/hosting.json`; never create a second site. A Sites publishing failure must not invalidate a successful Tailscale edition.

Do not redesign during a scheduled run. Do not post the edition into a conversation or Telegram. Report only the date, success or failure, and the private reading URL.
