'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join('/tmp', 'circl-mock-store.json');

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function makeUser(overrides = {}) {
  const base = {
    id: overrides.id || uid('user'),
    name: overrides.name || 'Demo User',
    handle: overrides.handle || 'demo',
    email: overrides.email || 'demo@circl.app',
    password: overrides.password || 'demo1234',
    headline: overrides.headline || 'Sharing what I notice.',
    bio: overrides.bio || 'Designing small moments.',
    avatarUrl: overrides.avatarUrl || '',
    bannerUrl: overrides.bannerUrl || '',
    verified: overrides.verified ?? true,
    createdAt: overrides.createdAt || new Date().toISOString(),
    permalink: overrides.permalink || `https://circl.app/@${overrides.handle || 'demo'}`
  };
  return { ...base, ...overrides };
}

function makePost(overrides = {}) {
  return {
    id: overrides.id || uid('post'),
    type: overrides.type || 'post',
    authorId: overrides.authorId || 'user-1',
    text: overrides.text || 'A little update from the orbit.',
    createdAt: overrides.createdAt || new Date().toISOString(),
    media: overrides.media || [],
    location: overrides.location || '',
    replyPolicy: overrides.replyPolicy || 'everyone',
    counts: {
      likes: overrides.likes || 0,
      comments: overrides.comments || 0,
      shares: overrides.shares || 0,
      saves: overrides.saves || 0,
      ...(overrides.counts || {})
    },
    viewer: {
      liked: !!overrides.viewerLiked,
      saved: !!overrides.viewerSaved,
      ...(overrides.viewer || {})
    },
    ...overrides
  };
}

function defaultStore() {
  const userA = makeUser({
    id: 'user-1',
    name: 'Ari Stone',
    handle: 'aristone',
    email: 'demo@circl.app',
    password: 'demo1234',
    headline: 'Designing stories',
    bio: 'Sharing what I notice in the everyday.',
    avatarUrl: '',
    bannerUrl: '',
    verified: true
  });

  const userB = makeUser({
    id: 'user-2',
    name: 'Mina Lee',
    handle: 'minalee',
    email: 'mina@circl.app',
    password: 'demo1234',
    headline: 'City notes',
    bio: 'Small rituals, small joys.',
    verified: false
  });

  const userC = makeUser({
    id: 'user-3',
    name: 'Noah Green',
    handle: 'noahgreen',
    email: 'noah@circl.app',
    password: 'demo1234',
    headline: 'Observations',
    bio: 'Collecting ideas from everyday life.',
    verified: true
  });

  const posts = [
    makePost({
      id: 'post-1',
      authorId: 'user-2',
      text: 'Coffee, playlists, and a slow walk before the city wakes up.',
      likes: 128,
      comments: 14,
      shares: 9,
      location: 'Brooklyn',
      viewerLiked: true,
      media: [{ url: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80', width: 1200, height: 800, alt: 'Coffee on a table' }]
    }),
    makePost({
      id: 'post-2',
      authorId: 'user-1',
      text: 'A tiny window of quiet before the afternoon rush. Noticing the light on the floor.',
      likes: 87,
      comments: 11,
      shares: 4,
      location: 'New York',
      viewerSaved: true,
      media: [{ url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', width: 1200, height: 800, alt: 'Bright room interior' }]
    }),
    makePost({
      id: 'post-3',
      authorId: 'user-3',
      text: 'There is a kind of calm in writing down the exact things you noticed today.',
      likes: 42,
      comments: 2,
      shares: 1,
      location: 'Portland'
    })
  ];

  const notifications = [
    {
      id: 'note-1',
      type: 'follow',
      actor: userB,
      message: '@minalee started following you',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      target: { circlId: 'circl-1', circlName: 'circl', joined: false }
    },
    {
      id: 'note-2',
      type: 'mention',
      actor: userC,
      message: '@noahgreen mentioned you in a post',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      target: { circlId: 'circl-2', circlName: 'studio', joined: false }
    }
  ];

  const stories = [
    { id: 'story-1', unseen: true, user: userA },
    { id: 'story-2', unseen: false, user: userB },
    { id: 'story-3', unseen: true, user: userC }
  ];

  const comments = {
    'post-1': [
      { id: 'comment-1', author: userA, createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(), text: 'This feels like a good morning.' }
    ],
    'post-2': [
      { id: 'comment-2', author: userB, createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), text: 'The light here is beautiful.' }
    ],
    'post-3': []
  };

  return {
    meId: userA.id,
    users: [userA, userB, userC],
    posts,
    notifications,
    stories,
    comments,
    trending: [
      { title: 'Design', color: '#E5D9C8', posts: 1230 },
      { title: 'Music', color: '#E0F2FE', posts: 980 },
      { title: 'Cities', color: '#FDE68A', posts: 1250 },
      { title: 'Slow living', color: '#DDD6FE', posts: 760 }
    ],
    discover: [
      { id: 'disc-1', thumbUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80', alt: 'Mountain view' },
      { id: 'disc-2', thumbUrl: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=900&q=80', alt: 'Desk scene' },
      { id: 'disc-3', thumbUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80', alt: 'Dog in sunlight' },
      { id: 'disc-4', thumbUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80', alt: 'Room interior' }
    ],
    follows: {
      'user-1': ['user-2'],
      'user-2': ['user-1']
    }
  };
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.posts)) return parsed;
      }
    }
  } catch (err) {
    // ignore and fall back to defaults
  }

  const store = defaultStore();
  saveStore(store);
  return store;
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    // ignore persistence failures
  }
}

function buildCounts(userId, store) {
  const posts = store.posts.filter(p => p.authorId === userId);
  const followers = store.users.filter(u => (store.follows?.[u.id] || []).includes(userId)).length;
  const following = (store.follows?.[userId] || []).length;
  return {
    posts: posts.length,
    followers,
    following,
    circls: 12
  };
}

function serializeUser(user, store, viewerId = store.meId) {
  if (!user) return null;
  const userPosts = store.posts.filter(p => p.authorId === user.id);
  const follows = store.follows?.[viewerId] || [];
  return {
    ...user,
    viewer: { following: !!(viewerId && viewerId !== user.id && follows.includes(user.id)) },
    counts: buildCounts(user.id, store),
    posts: userPosts.length,
    permalink: `https://circl.app/@${user.handle}`
  };
}

function serializePost(post, store, viewerId = store.meId) {
  const author = store.users.find(u => u.id === post.authorId) || store.users[0];
  const liked = !!(viewerId && post.viewer && post.viewer.liked);
  const saved = !!(viewerId && post.viewer && post.viewer.saved);
  const comments = store.comments?.[post.id] || [];
  return {
    ...post,
    author: serializeUser(author, store, viewerId),
    viewer: { liked, saved },
    counts: {
      likes: post.counts?.likes || 0,
      comments: comments.length,
      shares: post.counts?.shares || 0,
      saves: post.counts?.saves || 0
    },
    permalink: `https://circl.app/p/${post.id}`
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Accept,X-CSRF-Token,Idempotency-Key'
    },
    body: JSON.stringify(payload)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (err) {
    return {};
  }
}

function handleMockApi(event) {
  const store = loadStore();
  const rawPath = (event.path || '/').replace(/^https?:\/\/[^/]+/, '');
  const apiPath = rawPath
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api\/v1/, '')
    .replace(/^\/api/, '');

  const method = (event.httpMethod || 'GET').toUpperCase();
  const body = parseBody(event);
  const q = event.queryStringParameters || {};

  const me = store.users.find(u => u.id === store.meId) || null;
  const safeHandle = (h) => String(h || '').trim().toLowerCase();

  if (method === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (method === 'GET' && apiPath === '/me') {
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    return jsonResponse(200, { user: serializeUser(me, store, store.meId) });
  }

  if (method === 'POST' && apiPath === '/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = store.users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) return jsonResponse(401, { error: { message: 'Invalid email or password.', code: 'bad_credentials' } });
    store.meId = user.id;
    saveStore(store);
    return jsonResponse(200, { user: serializeUser(user, store, user.id) });
  }

  if (method === 'POST' && apiPath === '/auth/register') {
    const name = String(body.name || '').trim();
    const handle = safeHandle(body.handle || name || 'user');
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name || !email || !password) {
      return jsonResponse(400, { error: { message: 'Missing required fields.', code: 'validation', fields: { name: !name ? 'Name is required.' : undefined, email: !email ? 'Email is required.' : undefined, password: !password ? 'Password is required.' : undefined } } });
    }
    if (store.users.some(u => u.email.toLowerCase() === email || u.handle.toLowerCase() === handle)) {
      return jsonResponse(409, { error: { message: 'That account already exists.', code: 'duplicate_user' } });
    }
    const user = makeUser({ id: uid('user'), name, handle, email, password, headline: 'New to circl', bio: '' });
    store.users.push(user);
    store.meId = user.id;
    store.follows[user.id] = [];
    saveStore(store);
    return jsonResponse(200, { user: serializeUser(user, store, user.id) });
  }

  if (method === 'POST' && apiPath === '/auth/logout') {
    store.meId = null;
    saveStore(store);
    return jsonResponse(200, { ok: true });
  }

  if (method === 'GET' && apiPath === '/stories') {
    return jsonResponse(200, { items: (store.stories || []).map(s => ({ ...s, user: serializeUser(s.user, store, store.meId) })) });
  }

  if (method === 'GET' && apiPath === '/explore/trending') {
    return jsonResponse(200, { items: store.trending || [] });
  }

  if (method === 'GET' && apiPath === '/explore/discover') {
    const q = (q.q || '').trim().toLowerCase();
    const items = (store.discover || []).filter(item => !q || item.alt.toLowerCase().includes(q));
    return jsonResponse(200, { items, nextCursor: null });
  }

  if (method === 'GET' && apiPath === '/feed') {
    const items = [...store.posts].reverse().map(post => serializePost(post, store, store.meId));
    return jsonResponse(200, { items, nextCursor: null });
  }

  if (method === 'GET' && /^\/users\/.test(apiPath) && !apiPath.includes('/posts') && !apiPath.includes('/follow')) {
    const handle = safeHandle(apiPath.replace(/^\/users\//, ''));
    const user = store.users.find(u => safeHandle(u.handle) === handle);
    if (!user) return jsonResponse(404, { error: { message: 'User not found.', code: 'not_found' } });
    return jsonResponse(200, serializeUser(user, store, store.meId));
  }

  if (method === 'GET' && /^\/users\/.test(apiPath) && apiPath.includes('/posts')) {
    const handle = safeHandle(apiPath.split('/')[1] || '');
    const user = store.users.find(u => safeHandle(u.handle) === handle);
    if (!user) return jsonResponse(404, { error: { message: 'User not found.', code: 'not_found' } });
    const tab = (q.tab || 'media').toLowerCase();
    const posts = [...store.posts.filter(p => p.authorId === user.id)].reverse().map(post => serializePost(post, store, store.meId));
    const items = tab === 'media' ? posts.filter(p => p.media && p.media.length) : posts;
    return jsonResponse(200, { items, nextCursor: null });
  }

  if (method === 'POST' && apiPath === '/posts') {
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    const text = String(body.text || '').trim();
    const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds : [];
    const alt = String(body.alt || '').trim();
    const fileUrl = mediaIds[0] && global.__circlMockMedia && global.__circlMockMedia[mediaIds[0]] ? global.__circlMockMedia[mediaIds[0]] : null;
    const post = makePost({
      authorId: me.id,
      text,
      location: 'Your orbit',
      media: fileUrl ? [{ url: fileUrl, width: 1200, height: 800, alt }] : [],
      counts: { likes: 0, comments: 0, shares: 0, saves: 0 }
    });
    store.posts.unshift(post);
    saveStore(store);
    return jsonResponse(200, serializePost(post, store, me.id));
  }

  if (method === 'PUT' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/like')) {
    const id = apiPath.split('/')[1];
    const post = store.posts.find(p => p.id === id);
    if (!post) return jsonResponse(404, { error: { message: 'Post not found.', code: 'not_found' } });
    post.viewer = { ...(post.viewer || {}), liked: true };
    post.counts = { ...(post.counts || {}), likes: (post.counts?.likes || 0) + 1 };
    saveStore(store);
    return jsonResponse(200, { viewer: post.viewer, counts: post.counts });
  }

  if (method === 'DELETE' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/like')) {
    const id = apiPath.split('/')[1];
    const post = store.posts.find(p => p.id === id);
    if (!post) return jsonResponse(404, { error: { message: 'Post not found.', code: 'not_found' } });
    post.viewer = { ...(post.viewer || {}), liked: false };
    post.counts = { ...(post.counts || {}), likes: Math.max(0, (post.counts?.likes || 0) - 1) };
    saveStore(store);
    return jsonResponse(200, { viewer: post.viewer, counts: post.counts });
  }

  if (method === 'PUT' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/save')) {
    const id = apiPath.split('/')[1];
    const post = store.posts.find(p => p.id === id);
    if (!post) return jsonResponse(404, { error: { message: 'Post not found.', code: 'not_found' } });
    post.viewer = { ...(post.viewer || {}), saved: true };
    post.counts = { ...(post.counts || {}), saves: (post.counts?.saves || 0) + 1 };
    saveStore(store);
    return jsonResponse(200, { viewer: post.viewer, counts: post.counts });
  }

  if (method === 'DELETE' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/save')) {
    const id = apiPath.split('/')[1];
    const post = store.posts.find(p => p.id === id);
    if (!post) return jsonResponse(404, { error: { message: 'Post not found.', code: 'not_found' } });
    post.viewer = { ...(post.viewer || {}), saved: false };
    post.counts = { ...(post.counts || {}), saves: Math.max(0, (post.counts?.saves || 0) - 1) };
    saveStore(store);
    return jsonResponse(200, { viewer: post.viewer, counts: post.counts });
  }

  if (method === 'POST' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/share')) {
    const id = apiPath.split('/')[1];
    const post = store.posts.find(p => p.id === id);
    if (!post) return jsonResponse(404, { error: { message: 'Post not found.', code: 'not_found' } });
    post.counts = { ...(post.counts || {}), shares: (post.counts?.shares || 0) + 1 };
    saveStore(store);
    return jsonResponse(200, { counts: post.counts });
  }

  if (method === 'GET' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/comments')) {
    const id = apiPath.split('/')[1];
    const commentList = store.comments[id] || [];
    return jsonResponse(200, { items: commentList, nextCursor: null });
  }

  if (method === 'POST' && /^\/posts\/.test(apiPath) && apiPath.endsWith('/comments')) {
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    const id = apiPath.split('/')[1];
    const text = String(body.text || '').trim();
    if (!text) return jsonResponse(400, { error: { message: 'Comment cannot be empty.', code: 'validation' } });
    const comment = { id: uid('comment'), author: me, createdAt: new Date().toISOString(), text };
    if (!store.comments[id]) store.comments[id] = [];
    store.comments[id].push(comment);
    const post = store.posts.find(p => p.id === id);
    if (post) {
      post.counts = { ...(post.counts || {}), comments: (post.counts?.comments || 0) + 1 };
    }
    saveStore(store);
    return jsonResponse(200, comment);
  }

  if (method === 'PUT' && /^\/users\/.test(apiPath) && apiPath.endsWith('/follow')) {
    const id = apiPath.split('/')[1];
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    if (!store.follows[me.id]) store.follows[me.id] = [];
    if (!store.follows[me.id].includes(id)) store.follows[me.id].push(id);
    saveStore(store);
    return jsonResponse(200, { viewer: { following: true }, counts: { followers: (store.users.find(u => u.id === id)?.counts || 0) } });
  }

  if (method === 'DELETE' && /^\/users\/.test(apiPath) && apiPath.endsWith('/follow')) {
    const id = apiPath.split('/')[1];
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    store.follows[me.id] = (store.follows[me.id] || []).filter(uidVal => uidVal !== id);
    saveStore(store);
    return jsonResponse(200, { viewer: { following: false }, counts: { followers: 0 } });
  }

  if (method === 'GET' && apiPath === '/notifications') {
    return jsonResponse(200, { items: store.notifications || [], nextCursor: null });
  }

  if (method === 'GET' && apiPath === '/notifications/unread-count') {
    const count = (store.notifications || []).filter(n => !n.read).length;
    return jsonResponse(200, { count });
  }

  if (method === 'POST' && apiPath === '/notifications/read-all') {
    for (const note of store.notifications || []) note.read = true;
    saveStore(store);
    return jsonResponse(200, { ok: true });
  }

  if (method === 'POST' && /^\/circls\/.test(apiPath) && apiPath.includes('/join')) {
    return jsonResponse(200, { ok: true, joined: true });
  }

  if (method === 'PATCH' && apiPath === '/me') {
    if (!me) return jsonResponse(401, { error: { message: 'Not signed in.', code: 'unauthorized' } });
    me.name = String(body.name ?? me.name).trim();
    me.headline = String(body.headline ?? me.headline).trim();
    me.bio = String(body.bio ?? me.bio).trim();
    saveStore(store);
    return jsonResponse(200, serializeUser(me, store, me.id));
  }

  if (method === 'POST' && apiPath === '/uploads') {
    const id = uid('media');
    const uploadUrl = `/api/v1/uploads/${id}`;
    if (!global.__circlMockMedia) global.__circlMockMedia = {};
    global.__circlMockMedia[id] = null;
    return jsonResponse(200, { id, uploadUrl, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' } });
  }

  if (method === 'PUT' && /^\/uploads\//.test(apiPath)) {
    const id = apiPath.split('/')[2] || apiPath.split('/').pop();
    if (!global.__circlMockMedia) global.__circlMockMedia = {};
    global.__circlMockMedia[id] = 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80';
    return jsonResponse(200, { ok: true, id });
  }

  return jsonResponse(404, { error: { message: 'Not found.', code: 'not_found' } });
}

exports.handler = async (event) => {
  try {
    return handleMockApi(event);
  } catch (err) {
    return jsonResponse(500, { error: { message: err.message || 'Something went wrong.', code: 'server_error' } });
  }
};

module.exports = { handler: exports.handler };
