# Daymark

Daily reading and recorded audio: https://akeedo1.github.io/the-brief/

The live site is static GitHub Pages. It remains available when the generating PC is off. The local Codex automation prepares and publishes a new edition daily; generation requires the PC, Codex and Docker to be running. The durable runbook is `AUTOMATION.md`.

## Audio

Michael is the current narrator. The opening recording is a separately written three-to-five-minute briefing. Each news story has its own short recording; the Long View is separate. One player supports pause, seeking and a readable transcript. No browser or device speech synthesis is used.

`content/audio-script.json` contains the spoken copy. `scripts/generate-audio.py` uses the existing local Kokoro service and measures the actual MP3 duration. `content/audio-manifest.json` binds every recording to the edition and script. A mismatched date, changed script, missing recording or overlong short briefing blocks the build. Character and duration limits are editorial constraints, not playback-speed tricks.

## Run locally

Requirements: Node 22+, Python 3, Docker and the existing `kokoro` container for audio generation. Rendering and validation use only Node built-ins; no dependency installation is needed for static publishing.

```text
python scripts/generate-audio.py --voices am_michael
node scripts/render-edition.mjs
npm test
npm run dev
```

Preview: http://127.0.0.1:8790

The build packages only the manifest's recordings into `dist/site`. GitHub Actions validates and deploys that directory. Never commit credentials or unused voice auditions. The old full-stack starter files are unused by the Pages site.
