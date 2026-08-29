const body = document.body;
const editionDate = body.dataset.editionDate || "today";
const storyCount = body.dataset.storyCount || document.querySelectorAll(".story-list [data-story-id]").length;
const depths = {
  scan: {
    label: "SCAN MODE",
    caption: `${storyCount} developments. The essential change, relevance and next watchpoint.`,
    copy: "Headlines are compressed, but the logic is intact."
  },
  briefing: {
    label: "BRIEFING MODE",
    caption: "Context, mechanisms and what is genuinely new are now visible.",
    copy: "Background and interpretation added beneath every story."
  },
  dossier: {
    label: "DOSSIER MODE",
    caption: "Evidence, uncertainty, scenarios and a full living thread are open.",
    copy: "The complete intelligence layer—not just longer summaries."
  }
};

const dossier = document.querySelector("[data-dossier]");
const backdrop = document.querySelector("[data-drawer-backdrop]");

function openDossier() {
  body.classList.add("drawer-open");
  dossier.setAttribute("aria-hidden", "false");
  dossier.querySelector("[data-close-dossier]")?.focus({ preventScroll: true });
}

function closeDossier() {
  body.classList.remove("drawer-open");
  dossier.setAttribute("aria-hidden", "true");
}

function setDepth(depth, fromUser = true) {
  if (!depths[depth]) return;
  body.dataset.depth = depth;
  document.querySelectorAll("[data-depth]").forEach((button) => {
    const active = button.dataset.depth === depth;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelector("[data-depth-caption]").textContent = depths[depth].caption;
  document.querySelector("[data-depth-state-label]").textContent = depths[depth].label;
  document.querySelector("[data-depth-state-copy]").textContent = depths[depth].copy;
  const bar = document.querySelector(".depth-bar");
  bar.classList.remove("mode-flash");
  void bar.offsetWidth;
  bar.classList.add("mode-flash");
  const url = new URL(location.href);
  url.searchParams.set("depth", depth);
  history.replaceState(null, "", url);
  if (fromUser && depth === "briefing") {
    document.querySelector("[data-reading-zone]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (fromUser && depth === "dossier") openDossier();
}

document.querySelectorAll("[data-depth]").forEach((button) => {
  button.addEventListener("click", () => setDepth(button.dataset.depth));
});
document.querySelectorAll("[data-open-dossier]").forEach((button) => button.addEventListener("click", openDossier));
document.querySelectorAll("[data-close-dossier]").forEach((button) => button.addEventListener("click", closeDossier));
backdrop.addEventListener("click", closeDossier);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDossier(); closeDiscuss(); } });

function showView(view) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));

const storyTitles = Object.fromEntries(
  [...document.querySelectorAll("[data-story-id]")].map((story) => [story.dataset.storyId, story.querySelector("h2").textContent])
);

const discussSheet = document.querySelector("[data-discuss-sheet]");
const discussBackdrop = document.querySelector("[data-discuss-backdrop]");
const discussPrompt = document.querySelector("[data-discuss-prompt]");
let activeStory = null;

document.querySelectorAll("[data-story-id]").forEach((story) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "discuss-action";
  button.dataset.discuss = story.dataset.storyId;
  button.textContent = "Discuss with Codex ↗";
  const target = story.querySelector(".story-actions") || story.querySelector(".story-footer");
  target.appendChild(button);
});

function discussionText(question = "Explain why this matters beyond the headline.") {
  const story = document.querySelector(`[data-story-id="${activeStory}"]`);
  const changed = story?.querySelector(".scan-grid div:first-child p")?.textContent || story?.querySelector(".history-piece__deck")?.textContent || "";
  const contextLabel = story?.classList.contains("history-piece") ? "Historical thesis" : "What changed";
  return `From The Brief for ${editionDate}: “${storyTitles[activeStory]}”\n\n${contextLabel}: ${changed}\n\n${question} Use the linked reporting, distinguish confirmed facts from interpretation, and talk this through with me rather than giving me another summary.`;
}

function openDiscuss(id) {
  activeStory = id;
  document.querySelector("[data-discuss-title]").textContent = storyTitles[id];
  discussPrompt.value = discussionText();
  body.classList.add("discuss-open");
  discussSheet.setAttribute("aria-hidden", "false");
}

function closeDiscuss() {
  body.classList.remove("discuss-open");
  discussSheet.setAttribute("aria-hidden", "true");
}

async function copyDiscussion() {
  const text = discussPrompt.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    discussPrompt.select();
    document.execCommand("copy");
  }
  document.querySelector("[data-handoff-note]").textContent = "Copied. Return to this Codex chat, paste and send.";
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-discuss]");
  if (button) openDiscuss(button.dataset.discuss);
});
document.querySelectorAll("[data-close-discuss]").forEach((button) => button.addEventListener("click", closeDiscuss));
discussBackdrop.addEventListener("click", closeDiscuss);
document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => {
  discussPrompt.value = discussionText(button.dataset.question);
}));
document.querySelector("[data-copy-discuss]").addEventListener("click", copyDiscussion);
document.querySelector("[data-share-discuss]").addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: `Discuss: ${storyTitles[activeStory]}`, text: discussPrompt.value });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await copyDiscussion();
  document.querySelector("[data-handoff-note]").textContent = "Direct sharing is unavailable here. The question is copied—return to Codex and paste it.";
});

const storage = (() => {
  try { return globalThis.localStorage || null; } catch { return null; }
})();

let saved = (() => {
  try { return JSON.parse(storage?.getItem("theBriefSaved") || "[]").filter((id) => storyTitles[id]); }
  catch { return []; }
})();

function renderLibrary() {
  try { storage?.setItem("theBriefSaved", JSON.stringify(saved)); } catch {}
  document.querySelectorAll("[data-library-count]").forEach((node) => { node.textContent = saved.length; });
  document.querySelectorAll("[data-save]").forEach((button) => {
    const active = saved.includes(button.dataset.save);
    button.classList.toggle("is-saved", active);
    button.textContent = active ? "✓ Saved" : "＋ Save";
  });
  const grid = document.querySelector("[data-saved-grid]");
  const empty = document.querySelector("[data-library-empty]");
  empty.hidden = saved.length > 0;
  grid.innerHTML = saved.map((id) => `<article><p class="micro-label">Saved · ${editionDate}</p><h2>${storyTitles[id]}</h2><button type="button" data-remove="${id}">Remove</button></article>`).join("");
  grid.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    saved = saved.filter((id) => id !== button.dataset.remove);
    renderLibrary();
  }));
}
document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
  const id = button.dataset.save;
  saved = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
  renderLibrary();
}));
renderLibrary();

const audio = document.querySelector("[data-audio]");
const audioButton = document.querySelector("[data-audio-toggle]");
const audioIcon = document.querySelector("[data-audio-icon]");
const audioLabel = document.querySelector("[data-audio-label]");
const progress = document.querySelector("[data-audio-progress] span");
const speech = window.speechSynthesis;
let narration = null;

function showAudioError() {
  body.classList.remove("audio-playing");
  audioIcon.textContent = "!";
  audioLabel.textContent = "Audio could not load";
}
if (audio) {
  audioButton.addEventListener("click", async () => {
    if (audio.paused) {
      try { await audio.play(); } catch { showAudioError(); }
    } else { audio.pause(); }
  });
  audio.addEventListener("play", () => {
    body.classList.add("audio-playing");
    audioIcon.textContent = "Ⅱ";
    audioLabel.textContent = "Pause today’s edition";
  });
  audio.addEventListener("pause", () => {
    body.classList.remove("audio-playing");
    audioIcon.textContent = "▶";
    audioLabel.textContent = audio.ended ? "Replay today’s edition" : "Resume today’s edition";
  });
  audio.addEventListener("timeupdate", () => {
    if (progress) progress.style.width = audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : "0%";
  });
  audio.addEventListener("error", showAudioError);
} else if (speech && "SpeechSynthesisUtterance" in window) {
  const narrationText = [
    document.querySelector(".cover h1")?.textContent,
    document.querySelector(".standfirst")?.textContent,
    ...[...document.querySelectorAll(".story-list .story")].flatMap((story) => [
      story.querySelector("h2")?.textContent,
      story.querySelector(".scan-grid div:nth-child(1) p")?.textContent,
      story.querySelector(".scan-grid div:nth-child(2) p")?.textContent,
      story.querySelector(".scan-grid div:nth-child(3) p")?.textContent
    ])
  ].filter(Boolean).join(". ");

  audioButton.addEventListener("click", () => {
    if (speech.speaking && !speech.paused) {
      speech.pause();
      body.classList.remove("audio-playing");
      audioIcon.textContent = "▶";
      audioLabel.textContent = "Resume today’s edition";
      return;
    }
    if (speech.paused) {
      speech.resume();
    } else {
      narration = new SpeechSynthesisUtterance(narrationText);
      narration.lang = "en-GB";
      narration.rate = 1.02;
      narration.onend = () => {
        body.classList.remove("audio-playing");
        audioIcon.textContent = "▶";
        audioLabel.textContent = "Replay today’s edition";
      };
      narration.onerror = showAudioError;
      speech.cancel();
      speech.speak(narration);
    }
    body.classList.add("audio-playing");
    audioIcon.textContent = "Ⅱ";
    audioLabel.textContent = "Pause today’s edition";
  });
} else {
  audioButton.addEventListener("click", showAudioError);
}

document.querySelectorAll("[data-feedback]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-feedback]").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelector("[data-feedback-note]").textContent = button.dataset.feedback === "useful" ? "Good. Tomorrow stays this selective." : button.dataset.feedback === "irrelevant" ? "Noted. Tomorrow will cut harder." : "Noted. Tell me what was absent in Codex.";
}));

const requestedDepth = new URL(location.href).searchParams.get("depth");
setDepth(depths[requestedDepth] ? requestedDepth : "scan", false);
