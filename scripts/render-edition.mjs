import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const data = JSON.parse(await readFile(resolve(root, "content", "edition.json"), "utf8"));
const htmlPath = resolve(root, "public", "edition", "index.html");
let html = await readFile(htmlPath, "utf8");

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Could not find ${label} in edition shell.`);
  html = html.replace(pattern, replacement);
}

function sourceLinks(sources = []) {
  return sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.label)} ↗</a>`).join("");
}

function storyHeader(story) {
  if (!story.group) return "";
  return `<header class="story-section-heading${story.group.break ? " story-section-heading--break" : ""}"><p class="micro-label">${esc(story.group.label)}</p><h2>${esc(story.group.title)}</h2><span>${esc(story.group.note)}</span></header>`;
}

function storyArticle(story) {
  const background = story.background ? `<div class="briefing-layer briefing-copy"><h3>${esc(story.background.title)}</h3><p>${esc(story.background.text)}</p>${story.background.known || story.background.new ? `<div class="known-new"><div><span>You already know</span><p>${esc(story.background.known)}</p></div><div><span>New now</span><p>${esc(story.background.new)}</p></div></div>` : ""}</div>` : "";
  const evidence = story.evidence ? `<div class="dossier-layer evidence-row"><div><span>${esc(story.evidence.left.label)}</span><p>${esc(story.evidence.left.text)}</p></div><div><span>${esc(story.evidence.right.label)}</span><p>${esc(story.evidence.right.text)}</p></div></div>` : "";
  return `${storyHeader(story)}
          <article class="story${story.lead ? " story--lead" : ""}" data-story-id="${esc(story.id)}">
            <div class="story-meta"><span><b>${esc(story.number)}</b> · <em>${esc(story.category)}</em></span><span>${esc(story.sourceNote)}</span></div>
            <h2>${esc(story.title)}</h2>
            <div class="scan-grid">
              <div><span>What changed</span><p>${esc(story.changed)}</p></div>
              <div><span>${story.personal ? "Why it matters to Abdulla" : "Why it matters"}</span><p>${esc(story.matters)}</p></div>
              <div><span>Watch next</span><p>${esc(story.watch)}</p></div>
            </div>
            ${background}
            ${evidence}
            <footer class="story-footer"><div class="source-links">${sourceLinks(story.sources)}</div><div class="story-actions"><button type="button" data-save="${esc(story.id)}">＋ Save</button>${story.lead ? '<button type="button" class="primary-action" data-open-dossier>Open living dossier →</button>' : ""}</div></footer>
          </article>`;
}

const cover = `<section class="cover reveal">
          <p class="kicker">The world in one sentence</p>
          <h1>${esc(data.worldSentence)}</h1>
          <p class="standfirst">${esc(data.standfirst)}</p>
          <div class="cover__actions">
            <button class="listen-button" type="button" data-audio-toggle>
              <span class="listen-button__icon" data-audio-icon>▶</span>
              <span><strong data-audio-label>Listen to today’s edition</strong><small>${esc(data.listenTime)} · narrated on your device</small></span>
            </button>
          </div>
        </section>`;

const coverage = `<section class="coverage-map" aria-label="Today’s coverage">
          <div><p class="micro-label">Today’s coverage</p><strong>Broad first. Deep by choice.</strong></div>
          <ul>${data.coverage.map((item) => `<li><span>${esc(item.count)}</span>${esc(item.label)}</li>`).join("")}</ul>
        </section>`;

const connected = `<section class="connected-picture" data-reading-zone>
          <header class="section-heading"><p class="micro-label">The connected picture</p><h2>${esc(data.connected.title)}</h2></header>
          <div class="signal-strip">${data.connected.signals.map((signal) => `<article><span>${esc(signal.label)}</span><strong>${esc(signal.value)}</strong><p>${esc(signal.text)}</p></article>`).join("")}</div>
          <p class="connection-note briefing-layer"><strong>The mechanism:</strong> ${esc(data.connected.note)}</p>
        </section>`;

const stories = `<section class="story-list" aria-label="Today’s consequential developments">
          ${data.stories.map(storyArticle).join("\n")}
        </section>`;

const radar = `<section class="radar-section">
          <header><p class="micro-label">On the radar</p><h2>Useful, not headline-worthy.</h2></header>
          <div class="radar-grid">${data.radar.map((item) => `<article><span>${esc(item.label)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><a href="${esc(item.url)}" target="_blank" rel="noreferrer">Source ↗</a></article>`).join("")}</div>
        </section>`;

const history = `<article class="history-piece" data-story-id="${esc(data.history.id)}">
          <header class="history-piece__header"><div><p class="micro-label">The Long View · Daily history</p><span class="history-piece__time">${esc(data.history.readTime)}</span></div><p class="history-piece__era">${esc(data.history.era).replaceAll("\n", "<br>")}</p></header>
          <div class="history-piece__hero"><p class="history-piece__number">${esc(data.history.number)}</p><div><h2>${esc(data.history.title)}</h2><p class="history-piece__deck">${esc(data.history.deck)}</p></div></div>
          <div class="history-piece__body"><aside><p class="micro-label">Why remember this?</p><blockquote>${esc(data.history.thesis)}</blockquote></aside><div class="history-piece__copy">${data.history.sections.map((section, index) => `<section><span>${index + 1} · ${esc(section.title)}</span><p>${esc(section.text)}</p></section>`).join("")}</div></div>
          <div class="history-timeline" aria-label="Historical timeline">${data.history.timeline.map((item) => `<div><strong>${esc(item.date)}</strong><span>${esc(item.text)}</span></div>`).join("")}</div>
          <footer class="story-footer history-piece__footer"><div class="source-links">${sourceLinks(data.history.sources)}</div><div class="story-actions"><button type="button" data-save="${esc(data.history.id)}">＋ Save</button></div></footer>
        </article>`;

const attention = `<section class="attention-grid">
          <article><p class="micro-label">Worth your attention</p><h2>${esc(data.attention.title)}</h2><p>${esc(data.attention.text)}</p><a href="${esc(data.attention.url)}" target="_blank" rel="noreferrer">Open the article →</a></article>
          <article><p class="micro-label">You can safely ignore</p><h2>${esc(data.ignore.title)}</h2><p>${esc(data.ignore.text)}</p></article>
        </section>`;

const threads = `<div class="thread-grid">${data.threads.map((thread, index) => `<article class="thread-card${index === 0 ? " thread-card--feature" : ""}"><span>${esc(thread.status)}</span><h2>${esc(thread.title)}</h2><p>${esc(thread.text)}</p><div class="thread-line"><i style="width:${esc(thread.progress)}%"></i></div>${index === 0 ? '<button type="button" data-open-dossier>Open thread →</button>' : ""}</article>`).join("")}</div>`;

replaceRequired(/<title>[\s\S]*?<\/title>/, `<title>The Brief — ${esc(data.date.display)}</title>`, "document title");
replaceRequired(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Abdulla's layered daily intelligence edition for ${esc(data.date.display)}.">`, "description");
replaceRequired(/<body[^>]*>/, `<body data-depth="scan" data-edition-date="${esc(data.date.display)}" data-story-count="${data.stories.length}">`, "body");
replaceRequired(/<div class="edition-line wrap">[\s\S]*?<\/div>/, `<div class="edition-line wrap"><span>${esc(data.date.display.toUpperCase())}</span><span>DOHA · EDITION ${esc(data.date.edition)}</span><span class="status"><i></i> UPDATED ${esc(data.date.updated)}</span></div>`, "edition line");
replaceRequired(/<section class="cover reveal">[\s\S]*?<\/section>/, cover, "cover");
replaceRequired(/<p data-depth-caption>[\s\S]*?<\/p>/, `<p data-depth-caption>${data.stories.length} developments. The essential change, relevance and next watchpoint.</p>`, "depth caption");
replaceRequired(/<section class="coverage-map"[\s\S]*?<\/section>/, coverage, "coverage map");
replaceRequired(/<section class="connected-picture"[\s\S]*?<\/section>/, connected, "connected picture");
replaceRequired(/<section class="story-list"[\s\S]*?<\/section>/, stories, "story list");
replaceRequired(/<section class="radar-section">[\s\S]*?<\/section>/, radar, "radar");
replaceRequired(/<article class="history-piece"[\s\S]*?<\/article>/, history, "history");
replaceRequired(/<section class="attention-grid">[\s\S]*?<\/section>/, attention, "attention");
replaceRequired(/<div class="thread-grid">[\s\S]*?<\/div>\s*<\/section>/, `${threads}\n    </section>`, "living threads");

await writeFile(htmlPath, html);
console.log(`Rendered ${data.date.display}: ${data.stories.length} stories + The Long View.`);
