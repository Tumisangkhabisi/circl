'use strict';
(() => {
/* ============================================================
   Config & helpers
   ============================================================ */
const CFG = Object.assign({ apiBase: '/api/v1', timeoutMs: 15000, uploadTimeoutMs: 120000, pageSize: 10, maxText: 500, maxUploadMB: 10, notifPollMs: 60000 }, window.CIRCL_CONFIG || {});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const enc = encodeURIComponent;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
const nf = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const num = n => nf.format(+n || 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#E6DFD1');

function ago(iso) {
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if (isNaN(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' hr';
  if (s < 604800) return Math.floor(s / 86400) + ' d';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const hue = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 32% 40%)`; };
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICON = {
  home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alerts: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4ZM10 21h4"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.5 4-6 8-6s7.3 1.5 8 6"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  send: '<path d="m22 3-9 18-2-8-8-2Z"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
};
const svg = (p, c = 'ic') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

/* ============================================================
   API client
   ============================================================ */
class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields || null; }
}
const msg = e => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
const csrf = () => { const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };

async function api(path, { method = 'GET', body, query, signal, idempotent, noAuth = false } = {}) {
  const url = new URL(CFG.apiBase + path, location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, v);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf();
  if (idempotent) headers['Idempotency-Key'] = idempotent;
  const attempts = method === 'GET' ? 2 : 1; // only safe reads are auto-retried
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    const to = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
    let res;
    try {
      res = await fetch(url, { method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    } catch (e) {
      if (signal?.aborted) throw e; // caller cancelled
      if (i + 1 < attempts) { await sleep(400); continue; }
      throw new ApiError(0, 'network', 'Can’t reach the server. Check your connection.');
    } finally { clearTimeout(to); signal?.removeEventListener('abort', onAbort); }
    if (res.status >= 502 && res.status <= 504 && i + 1 < attempts) { await sleep(400); continue; }
    let data = null;
    if (res.status !== 204) { const t = await res.text(); if (t) { try { data = JSON.parse(t); } catch { /* non-JSON body */ } } }
    if (!res.ok) {
      const er = (data && data.error) || {};
      if (res.status === 401 && !noAuth) sessionExpired();
      let m = er.message;
      if (res.status === 429) { const ra = +res.headers.get('Retry-After'); m = 'Too many requests. ' + (ra ? `Try again in ${ra}s.` : 'Slow down a moment.'); }
      throw new ApiError(res.status, er.code || 'http_' + res.status, m || (res.status >= 500 ? 'The server had a problem. Please try again.' : 'Request failed.'), er.fields);
    }
    return data;
  }
}

/* ============================================================
   State
   ============================================================ */
const S = { me: null, posts: new Map(), users: new Map(), stories: [], q: '', filter: 'all', stamp: {} };
const canonPost = p => { if (!p || p.type === 'note') return p; const o = S.posts.get(p.id); if (o) { Object.assign(o, p); return o; } S.posts.set(p.id, p); return p; };
const canonUser = u => { if (!u || !u.id) return u; const o = S.users.get(u.id); if (o) { Object.assign(o, u); return o; } S.users.set(u.id, u); return u; };

function pager(path, query = () => ({}), adapt = x => x) {
  return { path, query, adapt, items: [], cursor: null, loading: false, done: false, error: null, ctrl: null };
}
async function more(pg, render, { fresh = false } = {}) {
  if (fresh) { pg.ctrl?.abort(); Object.assign(pg, { items: [], cursor: null, done: false, error: null, loading: false }); }
  if (pg.loading || pg.done) return;
  pg.loading = true; pg.error = null; render();
  const ctrl = pg.ctrl = new AbortController();
  try {
    const path = typeof pg.path === 'function' ? pg.path() : pg.path;
    const r = await api(path, { query: { limit: CFG.pageSize, cursor: pg.cursor, ...pg.query() }, signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    const seen = new Set(pg.items.map(i => i.id));
    pg.items.push(...(r.items || []).filter(i => !seen.has(i.id)).map(pg.adapt));
    pg.cursor = r.nextCursor || null; pg.done = !r.nextCursor;
  } catch (e) { if (e.name === 'AbortError') return; pg.error = e; }
  finally { if (pg.ctrl === ctrl) { pg.loading = false; render(); } }
}
const resetPager = pg => { pg.ctrl?.abort(); Object.assign(pg, { items: [], cursor: null, done: false, error: null, loading: false }); };

/* Append-only DOM painting so images don't reload when a new page arrives */
function paint(pg, el, fn) {
  if (el._n == null || el._n > pg.items.length || !pg.items.length) { el.innerHTML = ''; el._n = 0; }
  el.insertAdjacentHTML('beforeend', pg.items.slice(el._n).map(fn).join(''));
  el._n = pg.items.length;
}
function stateHTML(pg, key, empty, skel = '') {
  if (pg.error) return `<div class="state" role="alert"><p>${esc(msg(pg.error))}</p><button type="button" class="chip" data-retry="${key}">Try again</button></div>`;
  if (pg.loading) return pg.items.length ? '<div class="state">Loading…</div>' : skel;
  if (pg.done && !pg.items.length) return `<div class="state">${esc(empty)}</div>`;
  return '';
}
const skelCard = '<div class="card"><div class="sk" style="height:36px;width:60%"></div><div class="sk" style="height:200px;margin-top:12px"></div></div>'.repeat(2);
const skelRow = '<div class="sk" style="height:56px;margin-top:10px"></div>'.repeat(4);

const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target._cb && e.target._cb()), { root: $('#main'), rootMargin: '400px' });
const watch = (el, cb) => { el._cb = cb; io.observe(el); };
const rewatch = el => { io.unobserve(el); io.observe(el); };

/* ============================================================
   Toast, dialogs, theme
   ============================================================ */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); }
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme; }
try { applyTheme(localStorage.getItem('circl.theme')); } catch { /* storage blocked */ }
$('#theme').addEventListener('change', e => { applyTheme(e.target.value); try { localStorage.setItem('circl.theme', e.target.value); } catch { /* ignore */ } });

/* ============================================================
   Components
   ============================================================ */
function avatar(u, size, extra = '') {
  u = u || {};
  const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px`;
  const src = safeUrl(u.avatarUrl);
  if (src) return `<img class="av ${extra}" src="${esc(src)}" alt="" style="${s}" loading="lazy" decoding="async">`;
  return `<div class="av ${extra}" style="${s};background:${hue(u.id || u.handle)}" aria-hidden="true">${esc(initials(u.name))}</div>`;
}
function followBtn(u) {
  const f = !!(u.viewer && u.viewer.following);
  return `<button type="button" class="pill ${f ? 'done' : ''}" data-act="follow" data-uid="${esc(u.id)}" aria-pressed="${f}">${f ? 'Following' : 'Follow'}</button>`;
}
function postHTML(p) {
  const a = p.author || {}, v = p.viewer || {}, c = p.counts || {}, m = p.media && p.media[0];
  const ar = m && +m.width > 0 && +m.height > 0 ? `aspect-ratio:${+m.width}/${+m.height}` : 'aspect-ratio:4/3';
  return `<article class="card" data-post="${esc(p.id)}">
<div class="row g8">${avatar(a, 36)}<div style="flex:1;min-width:0"><a class="name" href="#/u/${enc(a.handle)}">${esc(a.name)}</a><div class="meta">${p.location ? esc(p.location) + ' · ' : ''}${esc(ago(p.createdAt))}</div></div></div>
${p.text ? `<p class="ptext">${esc(p.text)}</p>` : ''}
${m ? `<div class="ph" style="${ar}"><img src="${esc(safeUrl(m.url))}" alt="${esc(m.alt || '')}" loading="lazy" decoding="async"></div>` : ''}
<div class="acts">
<button type="button" data-act="like" class="${v.liked ? 'liked' : ''}" aria-pressed="${!!v.liked}" aria-label="Like">${svg(ICON.heart)}<span>${num(c.likes)}</span></button>
<button type="button" data-act="comment" aria-label="Comments">${svg(ICON.comment)}<span>${num(c.comments)}</span></button>
<button type="button" data-act="share" aria-label="Share">${svg(ICON.send)}<span>${num(c.shares)}</span></button>
<button type="button" style="margin-left:auto" data-act="save" class="${v.saved ? 'saved' : ''}" aria-pressed="${!!v.saved}" aria-label="Save">${svg(ICON.save)}</button>
</div></article>`;
}
function noteHTML(n) {
  const href = safeUrl(n.url), img = safeUrl(n.imageUrl);
  const tag = href ? `a href="${esc(href)}" rel="noopener"` : 'div';
  return `<${tag} class="note"><div><small>${esc(n.kicker)}</small><b>${esc(n.title)}</b></div>${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</${href ? 'a' : 'div'}>`;
}
const replacePost = p => $$(`[data-post="${CSS.escape(String(p.id))}"]`).forEach(el => { el.outerHTML = postHTML(p); });

/* ============================================================
   Routing & shell
   ============================================================ */
const TABS = [['home', 'Home'], ['explore', 'Explore'], ['create', ''], ['alerts', 'Alerts'], ['profile', 'Profile']];
const ROUTES = TABS.map(t => t[0]);
function renderNav() {
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button type="button" data-nav="${k}" ${k === 'create' ? 'class="plus" aria-label="New post"' : ''}>${svg(ICON[k === 'create' ? 'plus' : k], '')}${l}${k === 'alerts' ? '<span class="badge" id="badge" hidden></span>' : ''}</button>`).join('');
}
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $$('#nav button').forEach(b => { const on = b.dataset.nav === id; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  $('#main').scrollTop = 0;
}
function route() {
  if (!S.me) return;
  const [, seg, arg] = location.hash.split('/');
  const id = seg === 'u' ? 'profile' : ROUTES.includes(seg) ? seg : 'home';
  show(id);
  if (id === 'home') onHome(); else if (id === 'explore') onExplore(); else if (id === 'create') onCreate();
  else if (id === 'alerts') onAlerts(); else onProfile(seg === 'u' ? decodeURIComponent(arg || '') : '');
}
window.addEventListener('hashchange', route);
const stale = (k, ms) => !S.stamp[k] || Date.now() - S.stamp[k] > ms;

/* ============================================================
   Auth
   ============================================================ */
let mode = 'login';
function setMode(m) {
  mode = m;
  $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $$('.reg').forEach(l => { l.hidden = m === 'login'; $('input', l).disabled = m === 'login'; });
  $('#authBtn').textContent = m === 'login' ? 'Sign in' : 'Create account';
  $('input[name=password]', $('#authForm')).autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('#authErr').textContent = '';
}
function showAuth(note = '') {
  $('#fatal').hidden = true; $('#auth').hidden = false; $('#nav').hidden = true; $('#main').hidden = true;
  $('#authErr').textContent = note; setMode('login');
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), btn = $('#authBtn');
  const body = mode === 'login'
    ? { email: f.get('email').trim(), password: f.get('password') }
    : { name: f.get('name').trim(), handle: f.get('handle').trim().toLowerCase(), email: f.get('email').trim(), password: f.get('password') };
  btn.disabled = true; $('#authErr').textContent = '';
  try {
    const r = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body, noAuth: true });
    e.target.reset(); S.me = canonUser(r.user); startApp();
  } catch (er) {
    $('#authErr').textContent = er.fields ? Object.values(er.fields).join(' ') : msg(er);
  } finally { btn.disabled = false; }
});
function sessionExpired() { if (!S.me) return; resetAll(); showAuth('Your session expired. Please sign in again.'); }
async function logout() {
  try { await api('/auth/logout', { method: 'POST', noAuth: true }); } catch { /* clear locally regardless */ }
  resetAll(); showAuth();
}

/* ============================================================
   Boot
   ============================================================ */
async function boot() {
  $('#fatal').hidden = true;
  try { S.me = canonUser(await api('/me', { noAuth: true })); startApp(); }
  catch (e) {
    if (e.status === 401) showAuth();
    else { $('#fatalMsg').textContent = msg(e); $('#fatal').hidden = false; }
  }
}
$('#fatalRetry').addEventListener('click', boot);
function startApp() {
  $('#auth').hidden = true; $('#main').hidden = false; $('#nav').hidden = false;
  $('#whoami').textContent = `Signed in as @${S.me.handle}`;
  loadStories(); startPoll();
  if (!location.hash || location.hash === '#') location.hash = '#/home'; else route();
}
function resetAll() {
  S.me = null; S.posts.clear(); S.users.clear(); S.stories = []; S.stamp = {}; S.q = ''; S.filter = 'all';
  [feedPg, discPg, notesPg, P.pg, cm.pg].forEach(pg => pg && resetPager(pg));
  ['#feed', '#orbit', '#acts', '#pList', '#cmList'].forEach(s => { const el = $(s); el.innerHTML = ''; el._n = 0; });
  ['#feedState', '#orbitState', '#actsState', '#pState', '#pHead', '#stories', '#trend'].forEach(s => { $(s).innerHTML = ''; });
  trendLoaded = false; P.handle = null; P.user = null; P.pg = null; clearInterval(pollT);
  $$('dialog[open]').forEach(d => d.close());
  history.replaceState(null, '', location.pathname);
}

/* ============================================================
   Home: stories + feed
   ============================================================ */
const feedPg = pager('/feed', () => ({}), canonPost);
async function loadStories() {
  try { const r = await api('/stories'); S.stories = (r.items || []).map(s => ({ ...s, user: canonUser(s.user) })); } catch { S.stories = []; }
  const el = $('#stories'); el.hidden = !S.stories.length;
  el.innerHTML = S.stories.map(s => `<a class="st" href="#/u/${enc(s.user.handle)}"><div class="ring ${s.unseen ? '' : 'seen'}">${avatar(s.user, 52)}</div>${esc(s.user.id === S.me.id ? 'Your story' : s.user.name.split(' ')[0])}</a>`).join('');
}
function renderFeed() {
  paint(feedPg, $('#feed'), i => (i.type === 'note' ? noteHTML(i) : postHTML(i)));
  $('#feedState').innerHTML = stateHTML(feedPg, 'feed', 'Nothing here yet. Follow people to fill your feed.', skelCard);
  rewatch($('#feedEnd'));
}
function onHome() { if (!S.stamp.feed) { S.stamp.feed = Date.now(); more(feedPg, renderFeed); } }
function reloadHome() { S.stamp.feed = Date.now(); loadStories(); more(feedPg, renderFeed, { fresh: true }); }
watch($('#feedEnd'), () => { if (!feedPg.error) more(feedPg, renderFeed); });

/* post actions */
const busy = new Set();
async function toggle(p, kind) {
  const k = p.id + kind; if (busy.has(k)) return; busy.add(k);
  p.viewer = p.viewer || {}; p.counts = p.counts || {};
  const snap = JSON.stringify({ v: p.viewer, c: p.counts }), key = kind === 'like' ? 'liked' : 'saved', on = !p.viewer[key];
  p.viewer[key] = on; if (kind === 'like') p.counts.likes = (p.counts.likes || 0) + (on ? 1 : -1);
  replacePost(p);
  try {
    const r = await api(`/posts/${enc(p.id)}/${kind}`, { method: on ? 'PUT' : 'DELETE' });
    if (r) { r.viewer && Object.assign(p.viewer, r.viewer); r.counts && Object.assign(p.counts, r.counts); }
    if (kind === 'save') toast(on ? 'Saved' : 'Removed from saved');
  } catch (e) { const o = JSON.parse(snap); p.viewer = o.v; p.counts = o.c; toast(msg(e)); }
  finally { busy.delete(k); replacePost(p); }
}
async function sharePost(p) {
  const url = p.permalink || location.href;
  try {
    if (navigator.share) await navigator.share({ url, text: p.text ? p.text.slice(0, 100) : 'Check this out on circl' });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch (e) { if (e.name === 'AbortError') return; toast('Couldn’t share this post'); return; }
  api(`/posts/${enc(p.id)}/share`, { method: 'POST' }).then(r => { if (r && r.counts) { Object.assign(p.counts, r.counts); replacePost(p); } }).catch(() => {});
}
async function toggleFollow(u) {
  const k = 'f' + u.id; if (busy.has(k)) return; busy.add(k);
  u.viewer = u.viewer || {}; u.counts = u.counts || {};
  const was = !!u.viewer.following, on = !was;
  const apply = f => { u.viewer.following = f; u.counts.followers = Math.max(0, (u.counts.followers || 0) + (f ? 1 : -1)); syncFollow(u); };
  apply(on);
  try {
    const r = await api(`/users/${enc(u.id)}/follow`, { method: on ? 'PUT' : 'DELETE' });
    if (r) { r.viewer && Object.assign(u.viewer, r.viewer); r.counts && Object.assign(u.counts, r.counts); syncFollow(u); }
  } catch (e) { apply(was); toast(msg(e)); }
  finally { busy.delete(k); }
}
function syncFollow(u) {
  $$(`[data-act="follow"][data-uid="${CSS.escape(String(u.id))}"]`).forEach(b => {
    const f = !!u.viewer.following; b.textContent = f ? 'Following' : 'Follow'; b.classList.toggle('done', f); b.setAttribute('aria-pressed', f);
  });
  if (P.user && P.user.id === u.id) renderProfileHead();
}

/* comments */
const cm = { post: null, pg: null, key: null };
function openComments(p) {
  cm.post = p; cm.key = null; cm.pg = pager(`/posts/${enc(p.id)}/comments`);
  const l = $('#cmList'); l.innerHTML = ''; l._n = 0; $('#cmIn').value = '';
  $('#cmDlg').showModal(); more(cm.pg, renderComments);
}
function renderComments() {
  paint(cm.pg, $('#cmList'), c => `<div class="cmt">${avatar(c.author, 32)}<div style="min-width:0"><b>${esc(c.author && c.author.name)}</b> <span class="meta">${esc(ago(c.createdAt))}</span><p>${esc(c.text)}</p></div></div>`);
  const st = stateHTML(cm.pg, 'cm', 'No comments yet. Start the conversation.', '<div class="sk" style="height:48px;margin-top:10px"></div>');
  $('#cmState').innerHTML = st || (!cm.pg.done ? '<div class="state"><button type="button" class="chip" data-act="cm-more">Load more</button></div>' : '');
}
$('#cmForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#cmIn').value.trim(); if (!text || !cm.post) return;
  const btn = $('#cmBtn'); btn.disabled = true; cm.key = cm.key || uuid();
  try {
    const c = await api(`/posts/${enc(cm.post.id)}/comments`, { method: 'POST', body: { text }, idempotent: cm.key });
    cm.pg.items.push(c); cm.key = null; $('#cmIn').value = '';
    cm.post.counts.comments = (cm.post.counts.comments || 0) + 1; replacePost(cm.post); renderComments();
    $('#cmDlg .dbox').scrollTop = 1e6;
  } catch (er) { toast(msg(er)); } finally { btn.disabled = false; }
});

/* ============================================================
   Explore
   ============================================================ */
const discPg = pager('/explore/discover', () => ({ q: S.q }));
let trendLoaded = false;
async function loadTrending() {
  trendLoaded = true;
  try {
    const r = await api('/explore/trending');
    const items = r.items || [];
    $('#trendWrap').hidden = !items.length;
    $('#trend').innerHTML = items.map(t => `<button type="button" class="tr" style="background:${safeColor(t.color)}" data-act="trend" data-q="${esc(t.title)}">${esc(t.title)}<small>${esc(num(t.postCount))} posts</small></button>`).join('');
  } catch { trendLoaded = false; $('#trendWrap').hidden = true; }
}
function renderDisc() {
  paint(discPg, $('#orbit'), t => `<div>${safeUrl(t.thumbUrl) ? `<img src="${esc(safeUrl(t.thumbUrl))}" alt="${esc(t.alt || '')}" loading="lazy">` : ''}</div>`);
  $('#discTitle').textContent = S.q ? `Results for “${S.q}”` : 'Made for your orbit';
  $('#orbitState').innerHTML = stateHTML(discPg, 'disc', S.q ? 'Nothing matches that yet. Try a different word.' : 'Nothing to show yet.', '<div class="sk" style="height:160px"></div>');
  rewatch($('#orbitEnd'));
}
function onExplore() {
  if (!trendLoaded) loadTrending();
  if (!S.stamp.disc) { S.stamp.disc = Date.now(); more(discPg, renderDisc); }
}
watch($('#orbitEnd'), () => { if (!discPg.error) more(discPg, renderDisc); });
const runSearch = debounce(() => { const q = $('#q').value.trim(); if (q === S.q) return; S.q = q; more(discPg, renderDisc, { fresh: true }); }, 300);
$('#q').addEventListener('input', runSearch);

/* ============================================================
   Create
   ============================================================ */
const C = { file: null, mediaId: null, mediaFor: null, key: null, busy: false };
const draftKey = () => `circl.draft.${S.me.id}`;
const saveDraft = debounce(() => { try { const v = $('#txt').value; v ? localStorage.setItem(draftKey(), v) : localStorage.removeItem(draftKey()); } catch { /* ignore */ } }, 400);
function syncCreate() {
  const t = $('#txt');
  $('#cnt').textContent = t.value.length;
  $('#share').disabled = C.busy || !(t.value.trim() || C.file);
  $('#altWrap').hidden = !C.file;
}
function onCreate() {
  $('#cAuthor').innerHTML = `${avatar(S.me, 36)}<div><div class="name">${esc(S.me.name)}</div><div class="meta" style="color:var(--acc)">@${esc(S.me.handle)}</div></div>`;
  if (!$('#txt').value) { try { $('#txt').value = localStorage.getItem(draftKey()) || ''; } catch { /* ignore */ } }
  $('#cErr').textContent = ''; syncCreate(); $('#txt').focus();
}
function setFile(f) {
  const img = $('#pvImg');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  C.file = f; C.mediaId = null; C.mediaFor = null;
  if (f) { img.src = URL.createObjectURL(f); $('#pv').hidden = false; } else { img.removeAttribute('src'); $('#pv').hidden = true; $('#alt').value = ''; }
  syncCreate();
}
function pick(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return void ($('#cErr').textContent = 'Choose a JPG, PNG, WebP or GIF image.');
  if (f.size > CFG.maxUploadMB * 1048576) return void ($('#cErr').textContent = `Image must be under ${CFG.maxUploadMB} MB.`);
  $('#cErr').textContent = ''; setFile(f);
}
$('#fLib').addEventListener('change', pick); $('#fCam').addEventListener('change', pick);
$('#pvX').addEventListener('click', () => setFile(null));
$('#txt').addEventListener('input', () => { syncCreate(); saveDraft(); });
$('#clearDraft').addEventListener('click', () => { $('#txt').value = ''; setFile(null); C.key = null; try { localStorage.removeItem(draftKey()); } catch { /* ignore */ } $('#cErr').textContent = ''; syncCreate(); });

async function putFile(up, file) {
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), CFG.uploadTimeoutMs);
  try {
    const r = await fetch(up.uploadUrl, { method: up.method || 'PUT', headers: { 'Content-Type': file.type, ...(up.headers || {}) }, body: file, signal: ctrl.signal });
    if (!r.ok) throw new ApiError(r.status, 'upload_failed', 'Upload failed. Please try again.');
  } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(0, 'network', 'Upload failed. Check your connection.'); }
  finally { clearTimeout(to); }
}
$('#share').addEventListener('click', async () => {
  if (C.busy) return;
  const text = $('#txt').value.trim(), btn = $('#share');
  C.busy = true; syncCreate(); btn.textContent = 'Posting…'; $('#cErr').textContent = '';
  try {
    if (C.file && C.mediaFor !== C.file) { // upload once; a retry after a failed POST reuses it
      const up = await api('/uploads', { method: 'POST', body: { filename: C.file.name, contentType: C.file.type, size: C.file.size } });
      await putFile(up, C.file); C.mediaId = up.id; C.mediaFor = C.file;
    }
    C.key = C.key || uuid(); // same key on retry => server dedupes, no double posts
    const post = canonPost(await api('/posts', { method: 'POST', idempotent: C.key, body: { text, mediaIds: C.file ? [C.mediaId] : [], alt: C.file ? $('#alt').value.trim() : undefined, replyPolicy: $('#reply').value } }));
    feedPg.items.unshift(post); $('#feed').innerHTML = ''; $('#feed')._n = 0; renderFeed();
    S.me.counts = S.me.counts || {}; S.me.counts.posts = (S.me.counts.posts || 0) + 1;
    $('#txt').value = ''; setFile(null); C.key = null; try { localStorage.removeItem(draftKey()); } catch { /* ignore */ }
    location.hash = '#/home'; toast('Shared with your circl');
  } catch (e) {
    $('#cErr').textContent = e.fields ? Object.values(e.fields).join(' ') : msg(e);
  } finally { C.busy = false; btn.textContent = 'Share with your circl'; syncCreate(); }
});

/* ============================================================
   Activity
   ============================================================ */
const notesPg = pager('/notifications', () => ({ type: S.filter }), x => { if (x.actor) x.actor = canonUser(x.actor); return x; });
const FILTERS = [['all', 'All'], ['mention', 'Mentions'], ['follow', 'Follows']];
$('#fchips').innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="chip ${k === 'all' ? 'on' : ''}" data-filter="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('');
const dayBucket = iso => { const d = new Date(iso), n = new Date(); if (d.toDateString() === n.toDateString()) return 'Today'; return n - d < 6048e5 ? 'This week' : 'Earlier'; };
function noteRow(n) {
  const a = n.actor || {}, unread = !n.read, joined = n.target && n.target.joined;
  const btn = n.type === 'follow' ? followBtn(a) : n.type === 'invite' ? `<button type="button" class="pill ${joined ? 'done' : ''}" data-act="join" data-nid="${esc(n.id)}" ${joined ? 'disabled' : ''}>${joined ? 'Joined' : 'Join'}</button>` : '';
  return `<div class="act ${unread ? 'unread' : ''}">${avatar(a, 40)}<div class="txt">${esc(n.message)}<small style="${unread ? '' : 'color:var(--mute)'}">${esc(ago(n.createdAt))}</small></div>${btn}</div>`;
}
function renderNotes() {
  let last = '', h = '';
  notesPg.items.forEach(n => {
    const b = dayBucket(n.createdAt);
    if (b !== last) { last = b; h += `<div class="day"><span>${b}</span>${b === 'Today' && notesPg.items.some(x => !x.read) ? '<button type="button" class="link" data-act="markread">Mark as read</button>' : ''}</div>`; }
    h += noteRow(n);
  });
  $('#acts').innerHTML = h;
  $('#actsState').innerHTML = stateHTML(notesPg, 'notes', 'No activity here yet.', skelRow);
  rewatch($('#actsEnd'));
}
function onAlerts() { if (stale('notes', 20000)) { S.stamp.notes = Date.now(); more(notesPg, renderNotes, { fresh: true }); pollUnread(); } }
watch($('#actsEnd'), () => { if (!notesPg.error) more(notesPg, renderNotes); });
$('#fchips').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]'); if (!b || b.dataset.filter === S.filter) return;
  S.filter = b.dataset.filter; $$('#fchips .chip').forEach(c => { const on = c === b; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  more(notesPg, renderNotes, { fresh: true });
});
async function markAllRead() {
  const prev = notesPg.items.map(n => n.read);
  notesPg.items.forEach(n => { n.read = true; }); renderNotes(); setBadge(0);
  try { await api('/notifications/read-all', { method: 'POST' }); toast('All caught up'); }
  catch (e) { notesPg.items.forEach((n, i) => { n.read = prev[i]; }); renderNotes(); pollUnread(); toast(msg(e)); }
}
async function joinCircl(nid) {
  const n = notesPg.items.find(x => x.id === nid); if (!n || !n.target) return;
  try { await api(`/circls/${enc(n.target.circlId)}/join`, { method: 'POST' }); n.target.joined = true; renderNotes(); toast(`Joined ${n.target.circlName || 'circl'}`); }
  catch (e) { toast(msg(e)); }
}
let pollT;
function setBadge(n) { const b = $('#badge'); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; b.setAttribute('aria-label', `${n} unread`); }
async function pollUnread() { if (!S.me || document.hidden) return; try { const r = await api('/notifications/unread-count'); setBadge(r.count || 0); } catch { /* transient */ } }
function startPoll() { clearInterval(pollT); pollUnread(); pollT = setInterval(pollUnread, CFG.notifPollMs); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUnread(); });

/* ============================================================
   Profile
   ============================================================ */
const P = { handle: null, user: null, tab: 'media', pg: null, err: null, ctrl: null };
const isOwn = () => P.user && S.me && P.user.id === S.me.id;
async function onProfile(arg) {
  const handle = arg || S.me.handle;
  if (P.handle !== handle) { P.handle = handle; P.user = handle === S.me.handle ? S.me : null; P.tab = 'media'; P.pg = null; }
  P.err = null; renderProfileHead();
  P.ctrl?.abort(); const ctrl = P.ctrl = new AbortController();
  try {
    const u = canonUser(await api(`/users/${enc(handle)}`, { signal: ctrl.signal }));
    if (u.id === S.me.id) S.me = Object.assign(S.me, u);
    P.user = canonUser(u); renderProfileHead();
    if (!P.pg) setTab(P.tab);
  } catch (e) { if (e.name === 'AbortError') return; P.err = e; renderProfileHead(); }
}
function setTab(t) {
  P.tab = t;
  P.pg = pager(() => `/users/${enc(P.handle)}/posts`, () => ({ tab: P.tab }), canonPost);
  const l = $('#pList'); l.innerHTML = ''; l._n = 0; l.className = t === 'media' ? 'grid' : '';
  renderProfileHead(); more(P.pg, renderPList);
}
function renderPList() {
  if (!P.pg) return;
  paint(P.pg, $('#pList'), P.tab === 'media'
    ? p => { const m = p.media && p.media[0]; const u = m && safeUrl(m.thumbUrl || m.url); return `<div>${u ? `<img src="${esc(u)}" alt="${esc(m.alt || '')}" loading="lazy">` : ''}</div>`; }
    : postHTML);
  const empty = { media: 'No photos yet.', posts: 'No posts yet.', saved: 'Nothing saved yet.' }[P.tab];
  $('#pState').innerHTML = stateHTML(P.pg, 'prof', empty, '<div class="sk" style="height:160px"></div>');
  rewatch($('#pEnd'));
}
watch($('#pEnd'), () => { if (P.pg && !P.pg.error) more(P.pg, renderPList); });
function renderProfileHead() {
  const el = $('#pHead');
  if (P.err) { el.innerHTML = `<div class="state" role="alert"><p>${esc(P.err.status === 404 ? 'This profile doesn’t exist.' : msg(P.err))}</p>${P.err.status === 404 ? '' : '<button type="button" class="chip" data-retry="profhead">Try again</button>'}</div>`; return; }
  const u = P.user;
  if (!u) { el.innerHTML = '<div class="sk" style="height:96px"></div><div class="sk" style="height:120px;margin-top:14px"></div>'; return; }
  const c = u.counts || {}, own = isOwn(), banner = safeUrl(u.bannerUrl);
  const tabs = [['media', 'Media'], ['posts', 'Posts']].concat(own ? [['saved', 'Saved']] : []);
  el.innerHTML = `<div class="row sp" style="margin-bottom:12px"><b style="font-size:16px">@${esc(u.handle)} ${u.verified ? '<span style="color:var(--acc)" role="img" aria-label="Verified">✔</span>' : ''}</b>
<div class="row g8"><button type="button" class="ib" aria-label="Share profile" data-act="shareprofile">${svg(ICON.send)}</button>${own ? `<button type="button" class="ib" aria-label="Settings" data-act="settings">${svg(ICON.gear)}</button>` : ''}</div></div>
<div class="banner">${banner ? `<img src="${esc(banner)}" alt="">` : ''}</div>
<div class="row g12">${avatar(u, 82, 'pav')}<div style="margin-top:6px;min-width:0"><div style="font-size:20px;font-weight:500">${esc(u.name)}</div><div class="meta">${esc(u.headline || '')}</div></div></div>
${u.bio ? `<p class="ptext" style="font-size:14px">${esc(u.bio)}</p>` : ''}
<div class="stats"><div>${num(c.posts)}<small>Posts</small></div><div>${num(c.followers)}<small>Followers</small></div><div>${num(c.following)}<small>Following</small></div><div>${num(c.circls)}<small>Circls</small></div></div>
<div class="btns one">${own ? '<button type="button" class="btn d" data-act="editprofile">Edit profile</button>' : `<button type="button" class="btn ${u.viewer && u.viewer.following ? 'l' : 'd'}" data-act="follow" data-uid="${esc(u.id)}" aria-pressed="${!!(u.viewer && u.viewer.following)}">${u.viewer && u.viewer.following ? 'Following' : 'Follow'}</button>`}</div>
<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ptab" data-tab="${k}" aria-selected="${P.tab === k}" class="${P.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function openEdit() {
  const f = $('#editForm'), u = S.me;
  f.name.value = u.name || ''; f.headline.value = u.headline || ''; f.bio.value = u.bio || ''; $('#editErr').textContent = '';
  $('#editDlg').showModal();
}
$('#editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = $('#editBtn'); btn.disabled = true; $('#editErr').textContent = '';
  try {
    const u = await api('/me', { method: 'PATCH', body: { name: f.name.value.trim(), headline: f.headline.value.trim(), bio: f.bio.value.trim() } });
    Object.assign(S.me, u); if (P.user === S.me) renderProfileHead();
    $('#editDlg').close(); toast('Profile updated');
  } catch (er) { $('#editErr').textContent = er.fields ? Object.values(er.fields).join(' ') : msg(er); }
  finally { btn.disabled = false; }
});

/* ============================================================
   Global event delegation
   ============================================================ */
const RETRY = {
  feed: () => more(feedPg, renderFeed), disc: () => more(discPg, renderDisc), notes: () => more(notesPg, renderNotes),
  prof: () => P.pg && more(P.pg, renderPList), profhead: () => onProfile(P.handle === S.me.handle ? '' : P.handle),
  cm: () => cm.pg && more(cm.pg, renderComments)
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-go],[data-retry],[data-nav],[data-close]'); if (!t) return;
  if (t.dataset.close !== undefined) return void t.closest('dialog').close();
  if (t.dataset.go) { location.hash = '#/' + t.dataset.go; if (t.dataset.go === 'explore') setTimeout(() => $('#q').focus(), 50); return; }
  if (t.dataset.nav) {
    const target = '#/' + t.dataset.nav;
    if (location.hash === target) { if (t.dataset.nav === 'home') reloadHome(); $('#main').scrollTo({ top: 0, behavior: 'smooth' }); }
    else location.hash = target;
    return;
  }
  if (t.dataset.retry) return void (RETRY[t.dataset.retry] && RETRY[t.dataset.retry]());
  const act = t.dataset.act, postEl = t.closest('[data-post]'), p = postEl && S.posts.get(postEl.dataset.post);
  switch (act) {
    case 'like': case 'save': p && toggle(p, act); break;
    case 'comment': p && openComments(p); break;
    case 'share': p && sharePost(p); break;
    case 'cm-more': more(cm.pg, renderComments); break;
    case 'follow': { const u = S.users.get(t.dataset.uid); u && toggleFollow(u); break; }
    case 'join': joinCircl(t.dataset.nid); break;
    case 'markread': markAllRead(); break;
    case 'trend': $('#q').value = t.dataset.q; S.q = t.dataset.q; more(discPg, renderDisc, { fresh: true }); break;
    case 'ptab': if (t.dataset.tab !== P.tab) setTab(t.dataset.tab); break;
    case 'editprofile': openEdit(); break;
    case 'settings': $('#theme').value = (() => { try { return localStorage.getItem('circl.theme') || 'system'; } catch { return 'system'; } })(); $('#setDlg').showModal(); break;
    case 'logout': logout(); break;
    case 'shareprofile': {
      const url = (P.user && P.user.permalink) || location.href;
      (navigator.share ? navigator.share({ url }) : navigator.clipboard.writeText(url).then(() => toast('Profile link copied'))).catch(e2 => { if (e2.name !== 'AbortError') toast('Couldn’t share this profile'); });
      break;
    }
  }
});

/* static icons */
$$('[data-icon]').forEach(el => { el.innerHTML = svg(ICON[el.dataset.icon], el.classList.contains('ib') ? '' : 'ic'); });
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.name === 'AbortError') return; console.error(e.reason); toast('Something went wrong. Please try again.'); });

renderNav();
boot();
})();
