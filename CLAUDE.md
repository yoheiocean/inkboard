# CLAUDE.md — Inkboard

Context for Claude Code (and humans) working on this project. Personal or deployment-specific notes for a checkout go in `CLAUDE.local.md`, which is gitignored; Claude Code reads it automatically when present.

## What this is

Inkboard is a self-hosted, browser-based sketching app inspired by the *feature set* of the Concepts app (infinite canvas, pressure brushes, layers, shapes, export). It is an original implementation — do not copy code, assets, icons or branding from Concepts or any other commercial app.

Typical deployment: Docker Compose on an always-on home server behind a reverse proxy (e.g. Nginx Proxy Manager, Cloudflare), app on host port 19410 and the PocketBase admin on LAN-only 19411. Used from tablets with a stylus (iPad + Apple Pencil is the main target), laptops and phones. A handful of accounts created by the admin; every library is private to its user. The repository is public (MIT).

## Hard constraints

- **No build step, no npm dependencies, no CDNs.** Plain HTML/CSS/JS served as static files by nginx. Keep it that way unless the maintainer explicitly decides otherwise. Everything must work offline on a LAN. The one exception is vendored, unmodified third-party code in `app/vendor/` (currently pdf.js 6.3.289, loaded lazily via dynamic `import()` on first PDF import).
- **CSP is strict** (`nginx/headers.conf`): `script-src 'self'` — no inline `<script>`, no `eval`, no external scripts. Inline *styles* are allowed. `connect-src 'self'` also blocks `fetch()` of `data:` URLs (use `dataURLToBlob`).
- Must work with touch, mouse **and** stylus via Pointer Events. Test pressure paths (`pointerType === 'pen'`).
- **Two modes**, chosen at start-up by `InkAPI.detect()` (`GET api/health`): **server mode** when PocketBase answers (sign-in, library, sync), **local mode** when `/api/health` is 404 (plain static hosting such as `python -m http.server`: one drawing in IndexedDB, no sign-in). Keep both working.

## Layout

```
app/
  index.html            UI markup; icons injected from JS via data-icon attributes
  styles.css            all styling; CSS custom properties at :root
  api.js                window.InkAPI: PocketBase REST client (auth token, records, protected files)
  library.js            window.InkLibrary: sign-in, offline and library screens; editor hooks via init()
  app.js                the editor (single IIFE, ~2,600 lines) + server sync; loaded after the two above
  vendor/pdfjs/         pdf.js (pdf.min.mjs + worker, cmaps, standard_fonts, wasm); see VERSION.txt
  sw.js                 service worker, network-first with cache fallback, never touches /api/; bump CACHE on changes
  manifest.webmanifest  PWA manifest
  icons/                icon.svg, icon-192.png, icon-512.png
nginx/
  default.conf          static files + /api/ proxy to pocketbase:8090; blocks /_/ and superuser/admin APIs
  headers.conf          security headers, included in every location block
backend/
  Dockerfile            alpine + PocketBase 0.40.4 (sha256-pinned), runs as uid 10001 via su-exec
  entrypoint.sh         chowns /pb_data, drops root; `pb <cmd>` wrapper for admin commands
  pb_migrations/        schema + settings (JS migrations, applied on start)
  pb_hooks/             server-side checks (folder ownership, folder cycles, revision conflicts)
Dockerfile              nginx:1.27-alpine + config + app/
docker-compose.yml      inkboard (19410 -> 80, read-only fs) + pocketbase (19411 -> 8090, ./data/pb_data)
README.md               user-facing docs: screenshots, deployment, accounts, NPM/Cloudflare, backups
docs/screenshots/       README images (excluded from the Docker build context)
```

Note: nginx `add_header` in a `location` block discards server-level headers, which is why `headers.conf` is included in each location. Keep that pattern when adding locations. `/api/` uses `^~` so the `.js`/`.css` regex location can't capture API paths; blocked admin paths are longer `^~` prefixes, which win.

## app.js architecture (read this before editing)

Sections are marked with `// ----- name` comments, in this order: constants, helpers, DOM, prefs, document state, stroke geometry, images, drawing, coordinates, history, persistence, server mode (library + sync), pointer input, selection, move/up, import/export, layers UI, tools & props UI, wiring, init (`init`, `startUI`, `initLocal`).

**Data model** (the drawing JSON stored on the server, and the `.inkb` project file format):

```js
doc = { version: 1, paper: 'warm'|'white'|'blueprint'|'slate', active: layerId,
        layers: [{ id, name, visible, opacity, items: [...] }] }   // array order = bottom → top
stroke = { type:'stroke', id, brush:'pen'|'pencil'|'marker', color:'#rrggbb', size, opacity, noTaper, noTaperStart?, noTaperEnd?, points:[[x,y,pressure], ...] }
         // noTaperStart/End: this end was cut (partial eraser / cut-through select), so it keeps full width
fill   = { type:'fill', id, color:'#rrggbb', opacity, points:[[x,y], ...], clip? }   // closed outline, smoothed with quadratic curves (fillGeom)
image  = { type:'image', id, x, y, w, h, clip?, src:'data:image/...;base64,...' }  // local mode, .inkb files, not-yet-uploaded imports
       | { type:'image', id, x, y, w, h, clip?, asset:'<recordId>/<filename>' }    // server mode: a record in the `assets` collection
clip   = [{ out: bool, pts: [[x,y], ...] }]   // world-space polygons, even-odd; keep inside (out:false) or outside (out:true)
```

World coordinates; `view = {x, y, scale}` maps world → screen as `screen = world*scale + {x,y}`. Brush size is chosen in screen px and stored in world units (`size / view.scale`), so zooming in lets you draw finer detail.

**Key invariants:**

- **Items are immutable.** Never mutate an item in place. Create a new object (`{...it, color}`) and replace it in `layer.items`. The geometry cache is a `WeakMap` keyed by item identity, and undo snapshots share item references.
- **All document edits go through `commit(fn)`.** It snapshots the layers (shallow copies of layer objects plus item arrays), runs `fn`, then calls `changed()` (render, layers panel, undo buttons, autosave). Inside `fn`, reassign `layer.items = ...` rather than pushing into the array. (The one non-edit exception: `convertImages()` swaps `src` items for `asset` items without a history entry.)
- `normalizeDoc()` / `normItem()` sanitise everything loaded from IndexedDB, the server or project files: hex colours only, base64 data-URL images or `id/filename` asset refs only. Keep them strict, because colours and srcs are interpolated into SVG export markup.
- **All image access goes through `imgKey(it)` → `getImage(key)`.** Asset images are fetched with a short-lived file token (`InkAPI.fetchFile`) and shown as blob URLs; grey placeholders are drawn on screen until they load.

**Stroke rendering:** each stroke is a single SVG path string made of a disc at every sample point plus a quad between neighbours, all with positive winding and filled nonzero. That string feeds both the canvas (`new Path2D(d)`) and SVG export, so the two always match. Pressure → radius is set in `radiusAt()`. Opacity is uniform within a stroke because it is one fill.

**Rendering:** `render()` runs on requestAnimationFrame via `requestRender()`. Each frame `drawScene()` draws:
- the paper,
- the grid,
- each visible layer into a shared `scratch` canvas, composited with the layer's opacity (marker uses `multiply` within its layer),
- an overlay with the marquee/lasso, selection box, scale handle and eraser cursor.

The full scene is redrawn every frame, culling items by bounding box against the viewport.

**Input:** `pointers` Map plus a single active `gesture` object. Gesture `kind` is one of `draw | shape | fill | erase | pan | pinch | move | scale | marquee | lasso`.
- Two touches always start a pinch, aborting any touch-started drawing.
- "Stylus only" mode (`prefs.pencilOnly`) turns on automatically the first time a pen is seen; after that, fingers only pan and zoom.
- Two- and three-finger taps trigger undo and redo (the `tap` tracker).
- Ruler toggle (`prefs.ruler`, R key, button in the props bar): pen/pencil/marker strokes are straight lines from the first point (`gesture.straight`). Shift does the same for one stroke. There is no hold-to-straighten.
- The per-brush Straight slider (`prefs.straight`) is baked into the points by `straighten()` in `buildLive`.
- Select tool: lasso (default) or rectangle (`prefs.selectMode`). Clipboard is in-memory (`clip`); keyboard copy also writes JSON (`{app:'inkboard-clip'}`) to the system clipboard. Tapping empty canvas with something copied shows the Paste callout.
- PDF import (`importPdf`) renders chosen pages with pdf.js into PNG/JPEG data URLs and adds ordinary `image` items (uploaded as assets on the next server save).
- Keyboard and clipboard handlers ignore events while a full-screen panel or dialog is open (`overlayOpen()`).
- **Partial eraser** (`prefs.eraseMode`, default `'partial'`): `eraseAlongPartial` cuts strokes along each eraser segment with `eraseStroke` (removes centreline within eraser radius + stroke radius) on a copy of the layer kept in `gesture.items` (drawn live, committed on pointer-up). Fills the eraser touches are removed whole, unless the same gesture touched a stroke (so erasing ink on a fill keeps the fill). `'whole'` mode removes whole strokes and fills. Images/PDF pages are never erased in either mode (by design: protects imported PDFs).
- **Cut-through selection** (`prefs.selectCut`, default `'partial'`; lasso and rectangle): `cutSelect` splits strokes at the polygon (`cutStrokeByPoly`/`splitRuns`) and turns crossed images/fills into an outside + inside copy with opposite `clip` entries (`coverage` samples the visible area). The split is tentative (`pendingCut`): `pushHistory` makes it permanent and folds it into the next edit's undo step; `dropPendingCut` restores the original items when the selection is dropped (tap elsewhere, Escape, tool/layer change, undo).
- Clipped items: `drawItem` applies `clipPath(c)` per clip (even-odd); `hitItem`/`visibleAt` honour clips; `itemBBox` shrinks to the visible area (sampled when there are holes). SVG export emits nested `<clipPath>` groups.

**Persistence, local mode:**
- The doc is saved to IndexedDB (`inkboard` DB, `kv` store, key `doc`) 700 ms after the last change, and at most 3 s after the first unsaved one. If the saved doc can't be read, it's copied to `doc-unreadable-<ts>` first; if storage can't be opened, autosave turns off (`autosaveOff`).
- The view and preferences (including saved colours and per-tool colours: `prefs.colors` for pen, pencil, marker, shape and fill; `prefs.color` is the active colour, used for recolouring selections) live in localStorage (`inkboard.view`, `inkboard.prefs`). `inkboard.mode` remembers the last detected mode so an offline start in local mode stays local.

**Persistence, server mode** (section "server mode"):
- `current = { id, title, folder, revision }` is the open drawing. `editSeq` counts edits, `syncedSeq` the edits covered by the last successful upload.
- Same debounce as local mode, but `saveNow()` writes a **draft** to IndexedDB (`draft:<userId>:<drawingId>` with `doc`, `revision`, `dirty`, `view`) and then `schedulePush()` (at most one upload per ~4 s). `doPush()` uploads pending images (`convertImages`), then PATCHes `data` (JSON file), `thumbnail` (480×360 webp) and `revision: current.revision + 1`.
- The server (`pb_hooks/inkboard_lib.js`) accepts a content save only if `revision === stored + 1`; otherwise 409 → `resolveConflict()` dialog: save mine as a copy / keep mine / load theirs.
- Network errors and 5xx keep the dirty draft and retry with backoff (5 s → 60 s) and on the `online` event. Dirty drafts from earlier sessions upload after sign-in (`syncDirtyDrafts`) if the server revision still matches. If the server is unreachable at start-up, `showOffline()` lets the user keep working on a recent draft.
- Opening a drawing uses a clean draft with the same revision as a cache; a dirty draft is loaded and pushed (the server decides whether it's still current).
- Auth: PocketBase token in localStorage (`inkboard.auth`), refreshed on every start (30-day tokens). A 401 mid-session shows the sign-in screen without losing the open drawing. Sign-out deletes that user's drafts.

**Debug hook:** `window.__inkboard` exposes `doc`, `view`, `selection`, `mode`, `current` (with `synced`), `flush`, `exportSVG` (async), `renderExport` and `buildPdf`. Tests use it. Note: Playwright's `wait_for_function` uses `eval`, which the CSP blocks; poll with `evaluate` instead. Start-up is async (server detection), so wait for `window.__inkboard` to exist.

**Export:**
- PNG: drawing bounds plus padding, rendered at 2×, capped at 8192 px per side and about 36 MP.
- SVG: vector paths, with images embedded (`portableDoc()` inlines server assets).
- PDF: a hand-built single-page PDF wrapping a JPEG of the PNG render, so it is a raster PDF.
- `.inkb` download is always self-contained (assets inlined as data URLs). Importing one in server mode creates a new library drawing.

## Backend (PocketBase 0.40.4)

Collections (`backend/pb_migrations/1760300000_inkboard_init.js`):
- `users` (auth): no public sign-up (`createRule = null`), no self-delete, `username` field (login with username or email; email optional), 30-day tokens, auth alerts/OTP/MFA/OAuth off.
- `folders { name, owner, parent→folders }`. Deleting a folder cascades to subfolders and their drawings.
- `drawings { title, owner, folder→folders, data (protected JSON file, 50 MB), thumbnail (protected image, 2 MB), revision }`.
- `assets { owner, file (protected image, 30 MB) }`. Not tied to a drawing, so copy/paste between drawings works; nothing deletes unreferenced assets yet.
- All rules are `owner = @request.auth.id`. The hooks also check that folder/parent relations point at the caller's own folders, prevent folder cycles, and force `revision = 0` on create.
- Settings: rate limiting on (default `*:auth` 2 per 3 s per IP), trusted proxy header `X-Real-IP` (nginx sets it from `CF-Connecting-IP` or the remote address).
- PocketBase writes `pb_data/types.d.ts` on first start: the authoritative reference for the migration/hook JS API of this version.

## Current status

Verified in headless Chromium (Playwright) with the real CSP, no console errors:
- Editor: pen, pencil, marker, shapes, fill, straightness, lasso/rect select (cut-through and whole), copy/cut/paste, partial and whole eraser, image/fill clipping, layers, undo/redo, saved colours, image and PDF import, PNG/SVG/PDF/.inkb export, local autosave and recovery.
- Server mode (PocketBase 0.40.4 Windows binary + nginx 1.27.5 for Windows running a copy of `nginx/default.conf`): 32 API permission checks (no sign-up, per-user isolation, folder cycles, 409 on stale saves, protected files, rate limiting) and a 31-step two-device browser test (sign-in, folders, sync, thumbnails, assets, reload, conflict dialog, offline then reconnect, importing the old local drawing, move, cascade delete, sign-out, second user sees nothing).

**Deployment verified:** `docker compose up -d --build` on Ubuntu (Docker 29, Compose v5): both images build, both containers are healthy, the read-only nginx container and the Docker DNS resolver work, and the entrypoint hands `/pb_data` to uid 10001. Checked from outside through Cloudflare + Nginx Proxy Manager: valid TLS, security headers intact, admin paths 404, sign-up 403, and NPM's *Block Common Exploits* doesn't interfere with library queries. Behind Cloudflare, add a Cache Rule (Browser TTL: respect origin): its default Browser Cache TTL rewrites `no-cache` on .js/.css to `max-age=14400`. NPM's *Cache Assets* must stay off for the same reason.

**Not yet verified:**
- Real iPad / Apple Pencil / Safari / iOS PWA, and Firefox.
- Large uploads through Cloudflare (free plan caps requests at 100 MB; Inkboard's limit is 60 MB).

## Known limitations / ideas for next steps

Roughly in priority order; confirm priorities with the maintainer.

1. **Test on the iPad** (see "Not yet verified").
2. **Asset garbage collection**: a cron hook that deletes `assets` no drawing references (needs to scan drawing JSON files).
3. **Change-password screen** for users (currently the admin resets passwords in the PocketBase UI).
4. **Performance with large drawings.** Every frame re-fills every visible stroke. Options: per-layer offscreen bitmaps, a spatial index, incremental live-stroke geometry. Uploads send the full JSON every save; consider compression or diffs if drawings get big.
5. **Partial erasing of fills and images** (strokes are done). Needs per-item erase masks or polygon boolean ops.
6. Rotate handle, multi-layer selection, bucket fill (tap inside a closed area), text tool, brush stabiliser, pencil grain.
7. **Revision history** (keep the last N versions per drawing) and optional read-only share links. Libraries are private-only for now.
8. Store original PDFs as assets (currently only rendered page images are stored).
9. **Vector PDF export** by converting the SVG path data into PDF path operators.

## Workflow

- Local mode without Docker: `cd app && python3 -m http.server 8765`, then open http://localhost:8765. The service worker only registers on localhost or HTTPS.
- Server mode without Docker: run the PocketBase binary with `--migrationsDir backend/pb_migrations --hooksDir backend/pb_hooks`, and put nginx (or any proxy) in front that serves `app/` and forwards `/api/` to it on the same origin.
- After changing anything in `app/`, bump `CACHE` in `app/sw.js` so installed clients pick up the update.
- Syntax check: `node --check app/app.js && node --check app/api.js && node --check app/library.js && node --check app/sw.js`.
- Prefer Playwright tests that drive the canvas with mouse events and assert on `window.__inkboard`.
- **Deploying** without giving the server GitHub access: ship the committed tree with `git archive HEAD | ssh <server> 'cd <stack dir> && tar -xf -'` and run `docker compose up -d --build` there. Only committed code is deployed, and the server's `data/` folder is never touched. The specific server and steps for a checkout belong in `CLAUDE.local.md`. PocketBase admin and user accounts are created by the admin, not by tooling.
- README screenshots were taken with Playwright against local test servers (local mode and a throwaway PocketBase with a `demo` account), drawing sample content through the real tools. Never use real user data for them.
