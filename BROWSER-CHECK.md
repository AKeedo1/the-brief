# Daymark browser verification

Use the host's supported browser tool. These steps verify a real reader can use the edition without rediscovering the interface each day.

## Daily smoke check

1. Use the successful `npm run verify:edition` result from the preceding runbook step. Run it only if it has not already passed for the current files. It builds the static preview.
2. Reuse or start the existing preview. On this host, `http://100.108.16.61:8789/` worked when in-app localhost failed; `scripts/ensure-server.ps1` starts this existing private fallback. Check HTTP availability first and prefer it only when available. Otherwise use the standard preview at `http://127.0.0.1:8790/`. Do not change listening interfaces, firewall rules or network permissions.
3. Open one hidden tab (visible tabs are unsupported in workers). Read the current DOM. Confirm today's date, a current headline, the distinct Curiosity Corner item and Long View.
4. Click `[data-audio-toggle]`. Read `[data-recorded-audio]` properties: currentSrc, finite positive duration, no media error, not paused, and currentTime advancing. Exercise seeking through supported UI interaction with the native audio control, then confirm changed currentTime. Close via `[data-close-audio]`. HTTP byte ranges alone do not prove playback.
5. Open `[data-view="library"]`; follow the newest dated `.archive-card` link observed in the DOM, confirm its date/headlines and return using the observed Today link.
6. Reuse the tab and close it after validation. Batch observations/actions into a small number of supported calls. Reconcile a selector mismatch against a fresh DOM once; do not guess successive alternatives.

## Recovery limit

At most two navigation/access attempts total and 90 seconds of browser transport recovery per check. If the first target fails, use the already HTTP-verified alternative once. Retrying the same focus-emulation failure through getTab, snapshots, screenshots and new tabs is not a new diagnosis.

If transport still fails, stop and report `browser validation unavailable` with the independently completed checks. Do not claim playback passed, waive the pre-publication gate, restart the user's browser or change app/runtime settings.

## Application changes

When renderer, browser JS or CSS changes, also verify Scan/Briefing/Dossier, the dossier drawer, save/un-save, discussion handoff and mobile width. Source-backed selectors, to use after observing the page:

- Depth: the observed Scan/Briefing/Dossier tab roles.
- Dossier: `[data-open-dossier]`, `[data-dossier]`, `[data-close-dossier]`.
- Save: `[data-save]`; observe the toggled state and undo the test.
- Discussion: observed discussion button, then `[data-close-discuss]`.
- Mobile: 390 px viewport; compare scrollWidth with innerWidth and reset afterward.

After deployment, `npm run verify:live` verifies the same edition, application assets and all audio delivery. Content-only releases do not repeat the live browser walkthrough; code changes require one live smoke check within the same recovery limit.
