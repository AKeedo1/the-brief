if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const stories = {
  hormuz: { tag: "Qatar & Gulf", title: "Qatar warns Gulf energy exports could stop within days" },
  oil: { tag: "Markets", title: "Oil is pricing prolonged disruption" },
  starlink: { tag: "Aviation", title: "Qatar Airways reaches 150 Starlink widebodies" },
  anthropic: { tag: "AI & Technology", title: "Anthropic may soften enterprise retention" },
  micron: { tag: "AI & Technology", title: "Micron puts $10bn behind AI’s memory bottleneck" },
  walmart: { tag: "Consumer", title: "Walmart flashes a consumer warning" }
};

const captions = {
  scan: "See the essential signal in under two minutes.",
  briefing: "Add context, personal relevance and the next thing to watch.",
  dossier: "Expose evidence, uncertainty, data and competing interpretations."
};

const state = {
  depth: localStorage.getItem("brief-depth") || "scan",
  saved: JSON.parse(localStorage.getItem("brief-saved") || "[]")
};

function setDepth(depth) {
  state.depth = depth;
  localStorage.setItem("brief-depth", depth);
  document.body.dataset.depth = depth;
  document.querySelectorAll("[data-depth]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.depth === depth);
  });
  document.querySelector("[data-depth-caption]").textContent = captions[depth];
}

function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach(panel => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "library") renderLibrary();
}

function toggleSaved(id) {
  const index = state.saved.indexOf(id);
  if (index >= 0) state.saved.splice(index, 1);
  else state.saved.push(id);
  localStorage.setItem("brief-saved", JSON.stringify(state.saved));
  syncSavedButtons();
}

function syncSavedButtons() {
  document.querySelectorAll("[data-save]").forEach(button => {
    const saved = state.saved.includes(button.dataset.save);
    button.classList.toggle("is-saved", saved);
    button.innerHTML = saved ? "<span>✓</span> Saved" : "<span>＋</span> Save";
  });
  document.querySelector("[data-saved-count]").textContent = `${state.saved.length} saved`;
}

function renderLibrary() {
  const empty = document.querySelector("[data-library-empty]");
  const grid = document.querySelector("[data-saved-grid]");
  empty.hidden = state.saved.length > 0;
  grid.innerHTML = state.saved.map(id => {
    const story = stories[id];
    return `<article class="saved-item"><span>${story.tag}</span><h3>${story.title}</h3><button data-remove-saved="${id}">Remove from library</button></article>`;
  }).join("");
}

function openDossier() {
  const drawer = document.querySelector("[data-dossier]");
  const backdrop = document.querySelector("[data-drawer-backdrop]");
  drawer.classList.add("is-open");
  backdrop.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDossier() {
  const drawer = document.querySelector("[data-dossier]");
  const backdrop = document.querySelector("[data-drawer-backdrop]");
  drawer.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.addEventListener("click", event => {
  const depth = event.target.closest("[data-depth]");
  if (depth) setDepth(depth.dataset.depth);

  const view = event.target.closest("[data-view]");
  if (view) setView(view.dataset.view);

  const save = event.target.closest("[data-save]");
  if (save) toggleSaved(save.dataset.save);

  const remove = event.target.closest("[data-remove-saved]");
  if (remove) { toggleSaved(remove.dataset.removeSaved); renderLibrary(); }

  const story = event.target.closest("[data-open-story]");
  if (story) openDossier();

  if (event.target.closest("[data-close-dossier]") || event.target.matches("[data-drawer-backdrop]")) closeDossier();

  const feedback = event.target.closest("[data-feedback]");
  if (feedback) {
    document.querySelectorAll("[data-feedback]").forEach(button => button.classList.remove("is-active"));
    feedback.classList.add("is-active");
    document.querySelector("[data-feedback-note]").textContent = "Noted. Tomorrow’s edition will learn from this.";
  }

  const listen = event.target.closest("[data-action='listen']");
  if (listen) {
    const cover = listen.closest(".cover");
    const active = cover.classList.toggle("is-listening");
    listen.querySelector(".listen-button__icon").textContent = active ? "Ⅱ" : "▶";
    listen.querySelector("strong").textContent = active ? "Playing today’s edition" : "Listen to today";
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDossier();
});

const demoParams = new URLSearchParams(window.location.search);
const linkedDepth = demoParams.get("depth");
const linkedView = demoParams.get("view");

setDepth(["scan", "briefing", "dossier"].includes(linkedDepth) ? linkedDepth : state.depth);
syncSavedButtons();
renderLibrary();
if (["today", "threads", "library"].includes(linkedView)) setView(linkedView);
if (demoParams.has("story")) openDossier();
