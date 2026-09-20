const configNode = document.querySelector('#edition-audio-data');
if (configNode) setupAudio(JSON.parse(configNode.textContent));

function setupAudio(config) {
  const player = document.querySelector('[data-recorded-audio]');
  const dock = document.querySelector('[data-audio-dock]');
  const title = document.querySelector('[data-audio-title]');
  const status = document.querySelector('[data-audio-status]');
  const transcript = document.querySelector('[data-audio-transcript]');
  const coverLabel = document.querySelector('[data-audio-label]');
  const coverIcon = document.querySelector('[data-audio-icon]');
  const voices = new Map(config.voices.map(voice => [voice.id, voice]));
  let voice = config.defaultVoice;
  try {
    const saved = localStorage.getItem('theBriefNarrator');
    if (voices.has(saved)) voice = saved;
  } catch { /* Narration works without storage. */ }
  let activeTrack = null;
  let activeSample = null;
  let requestId = 0;
  const clock = seconds => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;

  function refresh() {
    const playing = !player.paused && !player.ended;
    const briefing = activeTrack === 'briefing' && playing;
    coverLabel.textContent = briefing ? 'Pause short briefing' : 'Listen to the short briefing';
    coverIcon.textContent = briefing ? 'Ⅱ' : '▶';
    document.querySelector('[data-briefing-duration]').textContent = clock(config.tracks.briefing.recordings[voice].duration);
    document.querySelector('[data-narrator-name]').textContent = config.voices.length === 1 ? voices.get(voice).label.split(' · ')[0] : voices.get(voice).label;
    document.querySelectorAll('[name="narrator"]').forEach(input => { input.checked = input.value === voice; });
    document.querySelectorAll('[data-listen-story]').forEach(button => {
      const id = button.dataset.listenStory;
      const isPlaying = id === activeTrack && playing;
      button.textContent = `${isPlaying ? 'Ⅱ Pause' : '▶ Listen'} · ${clock(config.tracks[id].recordings[voice].duration)}`;
      button.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Listen to'} ${config.tracks[id].title}`);
    });
    document.querySelectorAll('[data-preview-voice]').forEach(button => {
      button.textContent = activeSample === button.dataset.previewVoice && playing ? 'Pause sample' : 'Preview voice';
    });
  }

  async function play(trackId, sampleVoice = null) {
    const same = activeTrack === trackId && activeSample === sampleVoice;
    if (same && !player.paused && !player.ended) { player.pause(); return; }
    const token = ++requestId;
    if (!same) {
      player.pause();
      activeTrack = trackId;
      activeSample = sampleVoice;
      const recording = sampleVoice ? voices.get(sampleVoice).sample : config.tracks[trackId].recordings[voice];
      player.src = recording.src;
      title.textContent = sampleVoice ? `Voice preview · ${voices.get(sampleVoice).label}` : config.tracks[trackId].title;
      transcript.textContent = sampleVoice ? config.sampleText : config.tracks[trackId].text;
      document.querySelector('[data-transcript-disclosure]').open = false;
      status.textContent = sampleVoice ? 'A short sample — your narrator choice has not changed.' : voices.get(voice).label;
    }
    if (player.ended) player.currentTime = 0;
    dock.hidden = false;
    document.body.classList.add('has-audio-player');
    try { await player.play(); }
    catch (error) {
      if (token !== requestId || error.name === 'AbortError') return;
      status.textContent = 'Playback could not start. Press play to retry.';
    }
    refresh();
  }

  document.querySelector('[data-audio-toggle]').addEventListener('click', () => play('briefing'));
  document.querySelectorAll('[data-listen-story]').forEach(button => button.addEventListener('click', () => play(button.dataset.listenStory)));
  document.querySelectorAll('[data-preview-voice]').forEach(button => button.addEventListener('click', () => play(null, button.dataset.previewVoice)));
  document.querySelectorAll('[name="narrator"]').forEach(input => input.addEventListener('change', () => {
    if (!voices.has(input.value)) return;
    const resumeTrack = activeTrack;
    const wasPlaying = !player.paused;
    ++requestId;
    player.pause();
    voice = input.value;
    activeTrack = activeSample = null;
    try { localStorage.setItem('theBriefNarrator', voice); } catch { /* Optional preference. */ }
    dock.hidden = true;
    document.body.classList.remove('has-audio-player');
    refresh();
    if (resumeTrack && wasPlaying) play(resumeTrack);
  }));
  document.querySelector('[data-close-audio]').addEventListener('click', () => {
    ++requestId;
    player.pause();
    dock.hidden = true;
    document.body.classList.remove('has-audio-player');
    document.querySelector(activeTrack && activeTrack !== 'briefing' ? `[data-listen-story="${activeTrack}"]` : '[data-audio-toggle]')?.focus({preventScroll:true});
  });
  player.addEventListener('error', () => { status.textContent = 'This recording could not load. Please try again.'; refresh(); });
  for (const event of ['play', 'pause', 'ended', 'loadedmetadata']) player.addEventListener(event, refresh);
  document.addEventListener('play', event => {
    if (event.target instanceof HTMLMediaElement && event.target !== player) player.pause();
  }, true);
  refresh();
}
