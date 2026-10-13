/* Inkboard library + sign-in screens (server mode). Talks to the server through InkAPI and
   to the editor through the callbacks passed to init(). Loaded before app.js. */
'use strict';
window.InkLibrary = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  let o = null;               // options from init()
  let folderId = null;        // folder being shown ('' / null = top level)
  let folders = [];
  let drawings = [];
  let loadSeq = 0;

  const byId = (fid) => folders.find((f) => f.id === fid);
  const childFolders = (pid) => folders.filter((f) => (f.parent || null) === (pid || null)).sort((a, b) => a.name.localeCompare(b.name));
  function pathTo(fid) {
    const out = [];
    for (let f = byId(fid), guard = 0; f && guard < 200; f = byId(f.parent), guard++) out.unshift(f);
    return out;
  }
  const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
  function ago(iso) {
    const t = Date.parse(String(iso).replace(' ', 'T'));
    if (!Number.isFinite(t)) return '';
    const s = (t - Date.now()) / 1000;
    const steps = [[60, 'second'], [3600, 'minute', 60], [86400, 'hour', 3600], [604800, 'day', 86400], [2629800, 'week', 604800], [31557600, 'month', 2629800], [Infinity, 'year', 31557600]];
    for (const [lim, unit, div = 1] of steps) {
      if (Math.abs(s) < lim) return rtf ? `Edited ${rtf.format(Math.round(s / div), unit)}` : new Date(t).toLocaleString();
    }
    return '';
  }
  function errorText(err) {
    if (!err) return 'Something went wrong';
    if (err.status === 0) return 'Can’t reach the Inkboard server. Check your connection.';
    return err.message || 'Something went wrong';
  }

  // ---------------------------------------------------------------- library
  function init(options) {
    o = options;
    $('#libNewDrawing').addEventListener('click', () => o.newDrawing(folderId));
    $('#libNewFolder').addEventListener('click', newFolder);
    $('#libBack').addEventListener('click', () => { if (o.currentId()) hide(); });
    $('#libUser').addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(e.currentTarget, [['Sign out', () => o.signOut()]]);
    });
    $('#libRetry').addEventListener('click', () => show());
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#libMenu, .lib-more, #libUser')) closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen()) return;
      if (!$('#libMenu').hidden) closeMenu();
      else if (!$('#moveDialog').hidden) $('#moveDialog').hidden = true;
      else if (o.currentId()) hide();
    });
  }
  const isOpen = () => !$('#library').hidden;

  async function show(fid) {
    if (fid !== undefined) folderId = fid || null;
    const lib = $('#library');
    lib.hidden = false;
    document.body.classList.add('lib-open');
    $('#libBack').hidden = !o.currentId();
    $('#libUserName').textContent = o.userName();
    $('#libError').hidden = true;
    const seq = ++loadSeq;
    lib.classList.add('loading');
    try {
      const [fs, ds] = await Promise.all([InkAPI.listFolders(), InkAPI.listDrawings(folderId)]);
      if (seq !== loadSeq) return;
      folders = fs;
      if (folderId && !byId(folderId)) { folderId = null; show(); return; }
      drawings = ds;
      render();
    } catch (err) {
      if (seq !== loadSeq) return;
      console.warn(err);
      $('#libGrid').textContent = '';
      $('#libEmpty').hidden = true;
      $('#libErrorText').textContent = errorText(err);
      $('#libError').hidden = false;
    } finally {
      if (seq === loadSeq) lib.classList.remove('loading');
    }
  }
  function hide() {
    $('#library').hidden = true;
    document.body.classList.remove('lib-open');
    closeMenu();
  }
  function refresh() { if (isOpen()) show(); }

  function render() {
    const crumbs = $('#libCrumbs');
    crumbs.textContent = '';
    const trail = [{ id: null, name: 'My Library' }, ...pathTo(folderId)];
    trail.forEach((f, i) => {
      if (i) crumbs.appendChild(Object.assign(document.createElement('span'), { className: 'crumb-sep', textContent: '›' }));
      const b = document.createElement('button');
      b.className = 'crumb';
      b.textContent = f.name;
      if (i === trail.length - 1) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => show(f.id));
      crumbs.appendChild(b);
    });

    const grid = $('#libGrid');
    grid.textContent = '';
    for (const f of childFolders(folderId)) grid.appendChild(folderCard(f));
    for (const d of drawings) grid.appendChild(drawingCard(d));
    const empty = !grid.children.length;
    $('#libEmpty').hidden = !empty;
    $('#libEmpty').textContent = folderId ? 'This folder is empty.' : 'No drawings yet. Start one with New drawing.';
  }

  function card(kind, title, sub, onOpen, onMore) {
    const c = document.createElement('div');
    c.className = `lib-card ${kind}`;
    c.innerHTML = '<button class="lib-open"><span class="lib-thumb"></span><span class="lib-meta"><span class="lib-name"></span><span class="lib-sub"></span></span></button>'
      + `<button class="lib-more" title="More actions" aria-label="More actions for ${kind}">${o.icon('more')}</button>`;
    c.querySelector('.lib-name').textContent = title;
    c.querySelector('.lib-sub').textContent = sub;
    c.querySelector('.lib-open').addEventListener('click', onOpen);
    c.querySelector('.lib-more').addEventListener('click', (e) => { e.stopPropagation(); onMore(e.currentTarget); });
    return c;
  }
  function folderCard(f) {
    const n = childFolders(f.id).length;
    const c = card('folder', f.name, n ? `${n} folder${n > 1 ? 's' : ''}` : 'Folder', () => show(f.id), (btn) => openMenu(btn, [
      ['Open', () => show(f.id)],
      ['Rename…', () => renameFolder(f)],
      ['Move to…', () => moveItem('folder', f)],
      ['Delete…', () => deleteFolder(f), true],
    ]));
    c.querySelector('.lib-thumb').innerHTML = o.icon('folder');
    return c;
  }
  function drawingCard(d) {
    const c = card('drawing', d.title, ago(d.updated), () => o.openDrawing(d.id), (btn) => openMenu(btn, [
      ['Open', () => o.openDrawing(d.id)],
      ['Rename…', () => renameDrawing(d)],
      ['Duplicate', () => duplicateDrawing(d)],
      ['Move to…', () => moveItem('drawing', d)],
      ['Delete…', () => deleteDrawing(d), true],
    ]));
    if (d.id === o.currentId()) c.classList.add('current');
    const thumb = c.querySelector('.lib-thumb');
    if (d.thumbnail) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      InkAPI.fileURL('drawings', d.id, d.thumbnail).then((u) => { img.src = u; }).catch(() => {});
      thumb.appendChild(img);
    }
    return c;
  }

  function openMenu(anchor, entries) {
    const m = $('#libMenu');
    m.textContent = '';
    for (const [label, fn, danger] of entries) {
      const b = document.createElement('button');
      b.textContent = label;
      if (danger) b.className = 'danger';
      b.addEventListener('click', () => { closeMenu(); fn(); });
      m.appendChild(b);
    }
    m.hidden = false;
    const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = `${Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw))}px`;
    m.style.top = `${r.bottom + mh + 8 > window.innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4}px`;
  }
  function closeMenu() { $('#libMenu').hidden = true; }

  // Each action reports failures with a toast and reloads the view.
  async function act(fn, done) {
    try { await fn(); if (done) o.toast(done); } catch (err) { console.warn(err); o.toast(errorText(err)); }
    refresh();
  }
  function askName(label, value) {
    const v = prompt(label, value || '');
    return v && v.trim() ? v.trim().slice(0, 120) : null;
  }
  function newFolder() {
    const name = askName('New folder name');
    if (name) act(() => InkAPI.createFolder(name, folderId));
  }
  function renameFolder(f) {
    const name = askName('Rename folder', f.name);
    if (name && name !== f.name) act(() => InkAPI.updateFolder(f.id, { name }));
  }
  function deleteFolder(f) {
    if (!confirm(`Delete the folder “${f.name}” and everything in it? This can’t be undone.`)) return;
    act(async () => { await InkAPI.deleteFolder(f.id); await o.checkCurrent(); }, 'Folder deleted');
  }
  function renameDrawing(d) {
    const title = askName('Rename drawing', d.title);
    if (title && title !== d.title) act(async () => { await InkAPI.updateDrawing(d.id, { title }); o.renamed(d.id, title); });
  }
  function deleteDrawing(d) {
    if (!confirm(`Delete “${d.title}”? This can’t be undone.`)) return;
    act(async () => { await InkAPI.deleteDrawing(d.id); o.deleted(d.id); }, 'Drawing deleted');
  }
  function duplicateDrawing(d) {
    act(async () => {
      const rec = await InkAPI.getDrawing(d.id);
      const data = rec.data ? await InkAPI.fetchFile('drawings', rec.id, rec.data) : undefined;
      const thumbnail = rec.thumbnail ? await InkAPI.fetchFile('drawings', rec.id, rec.thumbnail) : undefined;
      await InkAPI.createDrawing({
        title: `${rec.title} copy`.slice(0, 200), folder: rec.folder || '',
        data: data && new Blob([data], { type: 'application/json' }), thumbnail,
      });
    }, 'Duplicated');
  }

  // Move dialog: pick a destination from the folder tree.
  function moveItem(kind, item) {
    const from = kind === 'folder' ? (item.parent || null) : (item.folder || null);
    const banned = new Set();
    if (kind === 'folder') {
      const walk = (fid) => { banned.add(fid); for (const c of childFolders(fid)) walk(c.id); };
      walk(item.id);
    }
    const list = $('#moveList');
    list.textContent = '';
    const row = (fid, name, depth) => {
      const b = document.createElement('button');
      b.className = 'move-row';
      b.style.paddingLeft = `${12 + depth * 18}px`;
      b.innerHTML = o.icon(fid ? 'folder' : 'library');
      b.appendChild(document.createTextNode(name));
      if (banned.has(fid) || fid === from) b.disabled = true;
      b.addEventListener('click', () => {
        $('#moveDialog').hidden = true;
        act(() => (kind === 'folder' ? InkAPI.updateFolder(item.id, { parent: fid || '' }) : InkAPI.updateDrawing(item.id, { folder: fid || '' })), 'Moved');
      });
      list.appendChild(b);
      if (fid !== null && banned.has(fid)) return;
      for (const c of childFolders(fid)) row(c.id, c.name, depth + 1);
    };
    row(null, 'My Library', 0);
    $('#moveTitle').textContent = `Move “${kind === 'folder' ? item.name : item.title}” to…`;
    $('#moveDialog').hidden = false;
  }

  // ---------------------------------------------------------------- sign-in / offline screens
  function showLogin(message) {
    return new Promise((resolve) => {
      const screen = $('#login'), form = $('#loginForm'), err = $('#loginError'), btn = form.querySelector('button[type=submit]');
      screen.hidden = false;
      $('#offlinePanel').hidden = true;
      form.hidden = false;
      err.textContent = message || '';
      setTimeout(() => $('#loginUser').focus(), 50);
      const onSubmit = async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          const user = await InkAPI.login($('#loginUser').value.trim(), $('#loginPass').value);
          $('#loginPass').value = '';
          form.removeEventListener('submit', onSubmit);
          screen.hidden = true;
          resolve(user);
        } catch (ex) {
          err.textContent = ex.status === 400 ? 'Wrong username or password.'
            : ex.status === 429 ? 'Too many attempts. Wait a few seconds and try again.' : errorText(ex);
        } finally {
          btn.disabled = false;
        }
      };
      form.addEventListener('submit', onSubmit);
    });
  }
  // Shown when the server can't be reached at start-up: retry, or keep working on a local copy.
  function showOffline(drafts) {
    return new Promise((resolve) => {
      const screen = $('#login'), list = $('#offlineDrafts');
      screen.hidden = false;
      $('#loginForm').hidden = true;
      $('#offlinePanel').hidden = false;
      list.textContent = '';
      for (const d of drafts) {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = `Keep working on “${d.title}”${d.dirty ? ' (unsynced changes)' : ''}`;
        b.addEventListener('click', () => { screen.hidden = true; resolve({ draft: d }); });
        list.appendChild(b);
      }
      $('#offlineRetry').onclick = () => { screen.hidden = true; resolve({ retry: true }); };
    });
  }

  return { init, show, hide, refresh, isOpen, showLogin, showOffline };
})();
