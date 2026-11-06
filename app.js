/* Leinster Futsal — Training Hub
 * Loads videos.json and renders a filterable list of embedded YouTube/Instagram videos.
 * No build step. To add a video, add an entry to videos.json.
 */

const NEW_DAYS = 7;
const WATCHED_KEY = "lf-watched-v1";

/* ---------- URL parsing (pure functions, unit-testable in Node) ---------- */

function parseVideoUrl(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // YouTube
  if (host === "youtu.be" && parts[0]) {
    return { source: "youtube", id: parts[0], vertical: false };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (parts[0] === "shorts" && parts[1]) return { source: "youtube", id: parts[1], vertical: true };
    if ((parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") && parts[1]) {
      return { source: "youtube", id: parts[1], vertical: false };
    }
    const v = url.searchParams.get("v");
    if (v) return { source: "youtube", id: v, vertical: false };
  }

  // Instagram: /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE, also /username/p/CODE
  if (host === "instagram.com") {
    const idx = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    if (idx !== -1 && parts[idx + 1]) {
      const kind = parts[idx] === "reels" ? "reel" : parts[idx];
      return { source: "instagram", id: parts[idx + 1], kind, vertical: kind === "reel" };
    }
  }
  return null;
}

/** Start time in seconds from YouTube t= / start= params ("90", "1m30s", "90s"). */
function parseStart(raw) {
  try {
    const u = new URL(raw);
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (!t) return 0;
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return 0;
    return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
  } catch { return 0; }
}

function isNew(added, now = new Date()) {
  const d = new Date(added + "T00:00:00");
  if (isNaN(d)) return false;
  return (now - d) / 86400000 < NEW_DAYS;
}

if (typeof module !== "undefined") {
  module.exports = { parseVideoUrl, parseStart, isNew };
}

/* ---------- App (browser only) ---------- */

if (typeof document !== "undefined") {
  const state = {
    videos: [],
    tags: [],
    activeTags: new Set(),
    query: "",
    hideWatched: false,
    watched: loadWatched(),
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    search: $("search"), chips: $("tag-chips"), hideWatched: $("hide-watched"),
    count: $("count"), grid: $("grid"), featuredSection: $("featured-section"),
    featuredGrid: $("featured-grid"), empty: $("empty"), allTitle: $("all-title"),
  };

  function loadWatched() {
    try { return new Set(JSON.parse(localStorage.getItem(WATCHED_KEY) || "[]")); }
    catch { return new Set(); }
  }
  function saveWatched() {
    try { localStorage.setItem(WATCHED_KEY, JSON.stringify([...state.watched])); } catch {}
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  }

  /* --- Embeds (lazy) --- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { mountInstagram(e.target); io.unobserve(e.target); }
        });
      }, { rootMargin: "400px 0px" })
    : null;

  function mountInstagram(mediaEl) {
    if (mediaEl.querySelector("iframe")) return;
    const { igKind, igId } = mediaEl.dataset;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.instagram.com/${igKind}/${encodeURIComponent(igId)}/embed/`;
    iframe.title = "Instagram video";
    iframe.loading = "lazy";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; clipboard-write";
    iframe.setAttribute("allowfullscreen", "");
    mediaEl.appendChild(iframe);
  }

  function playYouTube(btn) {
    const media = btn.closest(".media");
    const { ytId, ytStart } = media.dataset;
    const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", modestbranding: "1" });
    if (Number(ytStart) > 0) params.set("start", ytStart);
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?${params}`;
    iframe.title = "YouTube video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.setAttribute("allowfullscreen", "");
    btn.replaceWith(iframe);
  }

  function mediaHtml(v) {
    const p = v._parsed;
    const badges = [
      v._new ? `<span class="badge">NEW</span>` : "",
      `<span class="badge source">${p ? (p.source === "youtube" ? "YouTube" : "Instagram") : "Link"}</span>`,
    ].join("");

    if (!p) {
      return `<div class="media"><div class="badges">${badges}</div>
        <a class="facade" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="play"></span></a></div>`;
    }
    if (p.source === "youtube") {
      const thumb = `https://i.ytimg.com/vi/${encodeURIComponent(p.id)}/hqdefault.jpg`;
      return `<div class="media${p.vertical ? " vertical" : ""}" data-yt-id="${esc(p.id)}" data-yt-start="${parseStart(v.url)}">
        <div class="badges">${badges}</div>
        <button class="facade" type="button" aria-label="Play: ${esc(v.title)}">
          <img class="poster" src="${thumb}" alt="" loading="lazy" />
          <span class="play"></span>
        </button></div>`;
    }
    return `<div class="media instagram" data-ig-kind="${esc(p.kind)}" data-ig-id="${esc(p.id)}">
      <div class="badges">${badges}</div></div>`;
  }

  function cardHtml(v) {
    const watched = state.watched.has(v.id);
    return `<article class="card${v.featured ? " is-featured" : ""}${watched ? " is-watched" : ""}" id="v-${esc(v.id)}" data-id="${esc(v.id)}">
      ${mediaHtml(v)}
      <div class="card-body">
        <h3 class="card-title">${esc(v.title || "Untitled clip")}</h3>
        ${v.note ? `<p class="note"><strong>Watch for:</strong> ${esc(v.note)}</p>` : ""}
        ${v.tags?.length ? `<div class="tags">${v.tags.map((t) => `<button class="tag" type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
        <div class="card-foot">
          <span>${esc(formatDate(v.added))}</span>
          <div class="actions">
            <button class="btn${watched ? " watched-on" : ""}" type="button" data-action="watched" aria-pressed="${watched}">${watched ? "✓ Watched" : "Mark watched"}</button>
            <button class="btn" type="button" data-action="share" title="Copy link to this video">Share</button>
            <a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">Open original ↗</a>
          </div>
        </div>
      </div>
    </article>`;
  }

  /* --- Filtering & rendering --- */
  function matches(v) {
    if (state.hideWatched && state.watched.has(v.id)) return false;
    if (state.activeTags.size && !(v.tags || []).some((t) => state.activeTags.has(t))) return false;
    if (state.query) {
      const hay = [v.title, v.note, ...(v.tags || [])].join(" ").toLowerCase();
      if (!state.query.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function render() {
    const filtering = state.activeTags.size || state.query || state.hideWatched;
    const visible = state.videos.filter(matches);
    const featured = filtering ? [] : visible.filter((v) => v.featured);

    els.featuredSection.hidden = featured.length === 0;
    els.featuredGrid.innerHTML = featured.map(cardHtml).join("");
    // Featured videos are only shown once: in Must-watch when unfiltered.
    const rest = filtering ? visible : visible.filter((v) => !v.featured);
    els.grid.innerHTML = rest.map(cardHtml).join("");
    els.allTitle.textContent = filtering ? "Results" : "All videos";
    els.allTitle.hidden = !filtering && rest.length === 0 && featured.length > 0;

    els.count.textContent = `${visible.length} of ${state.videos.length} video${state.videos.length === 1 ? "" : "s"}`;
    els.empty.hidden = visible.length > 0;
    els.empty.textContent = state.videos.length === 0
      ? "Videos coming soon. Check back shortly!"
      : "No videos match. Try a different search or category.";

    renderChips();
    document.querySelectorAll(".media.instagram").forEach((m) => (io ? io.observe(m) : mountInstagram(m)));
  }

  function renderChips() {
    const all = `<button class="chip" type="button" data-chip="" aria-pressed="${state.activeTags.size === 0}">All</button>`;
    els.chips.innerHTML = all + state.tags.map((t) =>
      `<button class="chip" type="button" data-chip="${esc(t)}" aria-pressed="${state.activeTags.has(t)}">${esc(t)}</button>`
    ).join("");
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  async function share(v) {
    const link = `${location.origin}${location.pathname}#v-${v.id}`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: v.title, text: `Leinster Futsal: ${v.title}`, url: link }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(link); toast("Link copied"); }
    catch { prompt("Copy this link:", link); }
  }

  function focusFromHash() {
    const m = location.hash.match(/^#v-(.+)$/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    if (!state.videos.some((v) => v.id === id)) return;
    // Make sure the target is visible: clear filters if needed.
    if (!document.getElementById(`v-${id}`)) {
      state.activeTags.clear(); state.query = ""; state.hideWatched = false;
      els.search.value = ""; els.hideWatched.checked = false;
      render();
    }
    const el = document.getElementById(`v-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 3500);
  }

  /* --- Events --- */
  els.search.addEventListener("input", () => {
    state.query = els.search.value.trim().toLowerCase();
    render();
  });
  els.hideWatched.addEventListener("change", () => {
    state.hideWatched = els.hideWatched.checked;
    render();
  });
  els.chips.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    const tag = chip.dataset.chip;
    if (!tag) state.activeTags.clear();
    else state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag);
    render();
  });
  document.addEventListener("click", (e) => {
    const facade = e.target.closest("button.facade");
    if (facade) return playYouTube(facade);

    const tagBtn = e.target.closest(".tag[data-tag]");
    if (tagBtn) {
      state.activeTags = new Set([tagBtn.dataset.tag]);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const action = e.target.closest("[data-action]");
    if (!action) return;
    const card = action.closest(".card");
    const v = state.videos.find((x) => x.id === card.dataset.id);
    if (!v) return;
    if (action.dataset.action === "share") share(v);
    if (action.dataset.action === "watched") {
      const on = !state.watched.has(v.id);
      on ? state.watched.add(v.id) : state.watched.delete(v.id);
      saveWatched();
      // Update in place so playing videos aren't interrupted
      card.classList.toggle("is-watched", on);
      action.classList.toggle("watched-on", on);
      action.setAttribute("aria-pressed", on);
      action.textContent = on ? "✓ Watched" : "Mark watched";
      if (state.hideWatched && on) setTimeout(render, 400);
    }
  });
  window.addEventListener("hashchange", focusFromHash);

  /* --- Boot --- */
  (async function init() {
    try {
      const res = await fetch("/videos.json", { cache: "no-cache" });
      const data = await res.json();
      const now = new Date();
      state.videos = (data.videos || [])
        .map((v) => ({ ...v, id: String(v.id), _parsed: parseVideoUrl(v.url), _new: isNew(v.added, now) }))
        // Newest date first; videos added on the same day keep their order from the file (stable sort).
        .sort((a, b) => (b.added || "").localeCompare(a.added || ""));
      // Tag list: configured order first, then any extra tags used on videos.
      const used = new Set(state.videos.flatMap((v) => v.tags || []));
      state.tags = [...(data.tags || []), ...[...used].filter((t) => !(data.tags || []).includes(t))];
    } catch (err) {
      console.error(err);
      els.empty.hidden = false;
      els.empty.textContent = "Couldn't load videos. Please refresh.";
      return;
    }
    render();
    focusFromHash();
  })();
}
