# Circl API contract (v1)

The front end (`app.js`) talks to `{apiBase}` (default `/api/v1`). Everything below is exactly what it sends and expects.

## Conventions

- **Auth:** httpOnly, `Secure`, `SameSite=Lax` session cookie. The client never stores tokens. All requests use `credentials: 'include'`.
- **CSRF:** double-submit. Server sets a readable `csrf_token` cookie (on any GET, including a 401 from `GET /me`). The client echoes it as `X-CSRF-Token` on every non-GET. Reject mismatches with 403.
- **Errors:** non-2xx returns `{ "error": { "code": "string", "message": "user-safe text", "fields": { "email": "Already in use." } } }`. `fields` is optional. 401 anywhere (except `/auth/*` and `/me` at boot) sends the user to sign-in. 429 should include `Retry-After`.
- **Pagination:** cursor-based. `GET ...?limit=10&cursor=abc` returns `{ "items": [...], "nextCursor": "string|null" }`. Items must have a stable unique `id`.
- **Idempotency:** `POST /posts` and `POST /posts/{id}/comments` send an `Idempotency-Key` header. Store key+user for 24h and return the original response on replay.
- **Timestamps:** ISO 8601 UTC. IDs: opaque strings.
- **Safety:** the client HTML-escapes all text and only renders `http(s)` URLs, but you must still validate/sanitize server-side and never trust client limits.

## Types

```
UserMini  { id, handle, name, avatarUrl|null, verified?:bool, viewer?:{ following:bool } }
User      UserMini + { headline, bio, bannerUrl|null, permalink, counts:{ posts, followers, following, circls } }
Media     { url, thumbUrl?, width, height, alt }
Post      { id, author:UserMini, text, media:Media[], location|null, createdAt, permalink,
            counts:{ likes, comments, shares }, viewer:{ liked:bool, saved:bool } }
Note      { id, type:"note", kicker, title, imageUrl|null, url|null }          // editorial card in feed
Comment   { id, author:UserMini, text, createdAt }
Notification { id, type:"like"|"comment"|"mention"|"follow"|"invite", actor:UserMini, message, createdAt, read:bool,
               target?:{ postId?, circlId?, circlName?, joined?:bool } }
```

## Endpoints

| Method & path | Body / query | Returns |
|---|---|---|
| `POST /auth/register` | `{name, handle, email, password}` (handle `[a-z0-9_.]{3,20}`, password ≥ 8) | `{user: User}` + sets cookies. 409/422 with `fields` |
| `POST /auth/login` | `{email, password}` | `{user: User}` + sets cookies. 401 on bad creds (generic message) |
| `POST /auth/logout` | – | 204, clears cookies |
| `GET /me` | – | `User` (401 if signed out) |
| `PATCH /me` | `{name, headline, bio}` (50/80/160 chars) | `User` |
| `GET /users/{handle}` | – | `User` (404 if missing; includes `viewer.following`) |
| `GET /users/{handle}/posts` | `tab=media\|posts\|saved`, paging | page of `Post`. `saved` only for self (else 403) |
| `PUT /users/{id}/follow` / `DELETE` | – | `{viewer:{following}, counts:{followers}}` (idempotent) |
| `GET /feed` | paging | page of `Post \| Note` |
| `GET /stories` | – | `{items:[{user:UserMini, unseen:bool}]}` |
| `PUT /posts/{id}/like` / `DELETE` | – | `{viewer:{liked}, counts:{likes}}` (idempotent) |
| `PUT /posts/{id}/save` / `DELETE` | – | `{viewer:{saved}}` (idempotent) |
| `POST /posts/{id}/share` | – | `{counts:{shares}}` |
| `GET /posts/{id}/comments` | paging, oldest first | page of `Comment` |
| `POST /posts/{id}/comments` | `{text}` (≤ 300) + `Idempotency-Key` | `Comment` |
| `POST /uploads` | `{filename, contentType, size}` (jpeg/png/webp/gif, ≤ 10 MB) | `{id, uploadUrl, method?:"PUT", headers?:{}}` (pre-signed object-storage URL) |
| `POST /posts` | `{text ≤500, mediaIds:string[], alt?, replyPolicy:"everyone"\|"followers"\|"mentioned"}` + `Idempotency-Key` | `Post`. Require text or media. Verify the upload exists, belongs to the caller, and passes content checks before attaching |
| `GET /explore/trending` | – | `{items:[{id, title, postCount, color:"#RRGGBB"}]}` |
| `GET /explore/discover` | `q?`, paging | page of `{id, thumbUrl, alt}` |
| `GET /notifications` | `type=all\|mention\|follow`, paging, newest first | page of `Notification` |
| `GET /notifications/unread-count` | – | `{count}` (polled every 60s while tab visible, so keep it cheap) |
| `POST /notifications/read-all` | – | 204 |
| `POST /circls/{id}/join` | – | 204 (idempotent) |

## Server-side requirements the UI assumes

- **Authorization on every route** (e.g. a user must not read another user's `saved`, or attach someone else's `mediaId`).
- **Rate limits:** auth endpoints (per IP + per account), writes (per user), search. Return 429 + `Retry-After`.
- **Password storage:** Argon2id/bcrypt, never log credentials, uniform login errors.
- **Upload bucket CORS:** allow `PUT` from your web origin with the `Content-Type` header. Serve uploads from a separate domain or with `Content-Disposition`/`X-Content-Type-Options: nosniff`.
- **CORS** (only if API is on another origin): explicit origin (no `*`), `Access-Control-Allow-Credentials: true`, allow headers `Content-Type, X-CSRF-Token, Idempotency-Key`.
- **Security headers** on the static host: the CSP in `index.html` as a header too (adjust `connect-src` / `img-src` to your API and CDN hosts), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS.
- **Permalinks:** `Post.permalink` / `User.permalink` must resolve to something shareable (server-rendered or SPA route + OG tags).
- **Indexes:** feed by `(user_id, created_at desc, id)`, notifications by `(user_id, created_at desc)` and a partial index on unread, likes/saves/follows by unique `(user_id, target_id)`.

## Deploying the front end

Static hosting is enough: serve `index.html`, `styles.css`, `app.js`, `config.js` (cache-bust with a hash or version query in production). Swap `config.js` per environment. Route `/api/*` to the backend on the same origin to avoid CORS entirely.
