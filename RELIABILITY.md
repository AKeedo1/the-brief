# Daymark reliability repair — 15 October 2026

The timing audit found avoidable audio recovery and repeated browser work. Three previous worker runs took 29:15, 16:05 and 21:27; audio recovery occupied 16:09 in the slowest run. This repair keeps the selected local Kokoro service, Michael voice, full story/history narration and existing publication.

## Implemented

- Narration uses short, reusable WAV sections and one final MP3 encoding step. This avoids the service's failing MP3 encoder path. Kokoro's completed responses contain unknown-length streaming WAV headers, which are finalized before validation. Missing/truncated ordinary WAV data fails validation.
- Transient failures retry at most three times per section. Successful sections survive failure and restart. A ten-minute processing budget and an OS lock bound recovery and prevent duplicate audio jobs. New recordings and the complete manifest are written atomically; failed generation keeps the previous manifest.
- One local release command renders, builds and checks audio/archive integrity. One live command checks the exact edition, deployed application assets and both byte-range ends of every recording. A generic HTTP 200 cannot count as success.
- The saved browser procedure retains real pre-publication playback/seek and archive navigation. Broader interface checks are required when the interface changes. Browser recovery is capped; unavailable required validation still blocks publication. Content-only releases use deterministic delivery verification after deployment instead of a second complete browser walkthrough.
- Audio attempts, cache use and validation stage durations are saved in ignored `.cache/daymark/` reports. The daily runbook records research/draft and overall worker times in automation memory.

## Verification

- 13 Python failure/recovery tests; 5 live-release verification tests; 7 existing audio/archive tests.
- Real current history narration: 244.37 seconds of audio generated from three sections in 36.234 seconds. Every section succeeded on its first attempt; the complete MP3 passed FFmpeg decoding. This integration used an isolated cache and did not replace today's published audio.
- Complete wrapper run against isolated copies of today's ten recordings: 3.75 seconds, all cache hits, output manifest identical to production.
- Live delivery check: ten recordings, exact current edition and assets, approximately 2.5 seconds before deployment of this repair.
- Root workspace's 41 existing tests and portability checks passed.

These are component measurements, not a new full-edition runtime benchmark. The next scheduled edition will establish actual end-to-end performance. Browser-tool transport reliability itself is outside this repair; the workflow now bounds its recovery and reports it distinctly. Generation still requires the PC and local services. No cloud migration, provider change or schedule change is part of this repair.
