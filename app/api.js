/* Inkboard server client: a thin wrapper over the PocketBase REST API. No dependencies.
   Paths are relative ("api/...") so the app also works when proxied under a sub-path. */
'use strict';
window.InkAPI = (() => {
  const AUTH_KEY = 'inkboard.auth';
  const ID = /^[a-z0-9]{15}$/;
  let auth = loadAuth();            // { token, user: { id, username, name, email } }
  let fileTok = null;               // { token, until }
  let onUnauthorized = null;

  class ApiError extends Error {
    // status 0 means the request never got an HTTP response (offline / server down).
    constructor(status, message, data) { super(message); this.status = status; this.data = data; }
  }

  function loadAuth() {
    try {
      const a = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      return a && typeof a.token === 'string' && a.user && ID.test(a.user.id) ? a : null;
    } catch (_) { return null; }
  }
  function saveAuth(token, rec) {
    auth = token ? { token, user: { id: rec.id, username: rec.username || '', name: rec.name || '', email: rec.email || '' } } : null;
    fileTok = null;
    try {
      if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); else localStorage.removeItem(AUTH_KEY);
    } catch (_) { /* private mode: stays signed in for this tab only */ }
  }

  async function request(method, path, { body, form, raw } = {}) {
    const headers = {};
    if (auth) headers.Authorization = auth.token;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(path, { method, headers, body: payload, cache: 'no-store' });
    } catch (_) {
      throw new ApiError(0, 'Can’t reach the Inkboard server');
    }
    if (!res.ok) {
      let j = null;
      try { j = await res.json(); } catch (_) { /* not JSON (e.g. proxy error page) */ }
      const err = new ApiError(res.status, (j && j.message) || res.statusText || 'Request failed', j && j.data);
      if (res.status === 401 && auth && onUnauthorized) onUnauthorized(err);
      throw err;
    }
    if (raw) return res;
    return res.status === 204 ? null : res.json();
  }
  const records = (c) => `api/collections/${c}/records`;
  const id = (v) => { if (!ID.test(v)) throw new ApiError(400, 'Bad id'); return v; };

  // 'server' when PocketBase answers, 'local' when there is no backend (plain static hosting),
  // 'unreachable' when a backend should be there but isn't answering. With no network at all,
  // fall back to whatever this browser saw last time.
  const MODE_KEY = 'inkboard.mode';
  async function detect() {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    let mode;
    try {
      const res = await fetch('api/health', { cache: 'no-store', signal: ac.signal });
      if (res.status === 404) mode = 'local';
      else if (!res.ok) return 'unreachable';
      else {
        const j = await res.json().catch(() => null);
        mode = j && j.code === 200 ? 'server' : 'local';
      }
    } catch (_) {
      let last = null;
      try { last = localStorage.getItem(MODE_KEY); } catch (_e) { /* ignore */ }
      return last === 'local' ? 'local' : 'unreachable';
    } finally {
      clearTimeout(timer);
    }
    try { localStorage.setItem(MODE_KEY, mode); } catch (_) { /* ignore */ }
    return mode;
  }

  async function login(identity, password) {
    const r = await request('POST', 'api/collections/users/auth-with-password', { body: { identity, password } });
    saveAuth(r.token, r.record);
    return auth.user;
  }
  async function refresh() {
    const r = await request('POST', 'api/collections/users/auth-refresh');
    saveAuth(r.token, r.record);
    return auth.user;
  }
  function logout() { saveAuth(null); }

  // Protected files need a short-lived file token in the URL.
  async function fileToken() {
    if (fileTok && fileTok.until > Date.now()) return fileTok.token;
    const r = await request('POST', 'api/files/token');
    fileTok = { token: r.token, until: Date.now() + 120e3 };
    return r.token;
  }
  async function fileURL(collection, recordId, filename) {
    return `api/files/${collection}/${id(recordId)}/${encodeURIComponent(filename)}?token=${encodeURIComponent(await fileToken())}`;
  }
  async function fetchFile(collection, recordId, filename) {
    const url = await fileURL(collection, recordId, filename);
    let res;
    try { res = await fetch(url, { cache: 'no-store' }); } catch (_) { throw new ApiError(0, 'Can’t reach the Inkboard server'); }
    if (!res.ok) throw new ApiError(res.status, 'File not available');
    return res.blob();
  }

  async function listAll(collection, params) {
    const out = [];
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ perPage: '500', page: String(page), skipTotal: '1', ...params });
      const r = await request('GET', `${records(collection)}?${q}`);
      out.push(...r.items);
      if (r.items.length < 500) return out;
    }
  }
  const toForm = (fields) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      if (v instanceof Blob) f.append(k, v, k === 'data' ? 'drawing.json' : v.name || `${k}.${(v.type.split('/')[1] || 'bin')}`);
      else f.append(k, v === null ? '' : String(v));
    }
    return f;
  };
  const me = () => auth.user.id;

  return {
    ApiError,
    get user() { return auth ? auth.user : null; },
    set onUnauthorized(fn) { onUnauthorized = fn; },
    detect, login, refresh, logout, fileURL, fetchFile,

    listFolders: () => listAll('folders', { sort: 'name', fields: 'id,name,parent,updated' }),
    createFolder: (name, parent) => request('POST', records('folders'), { body: { name, parent: parent || '', owner: me() } }),
    updateFolder: (fid, fields) => request('PATCH', `${records('folders')}/${id(fid)}`, { body: fields }),
    deleteFolder: (fid) => request('DELETE', `${records('folders')}/${id(fid)}`),

    listDrawings: (folder) => listAll('drawings', {
      filter: folder ? `folder = "${id(folder)}"` : 'folder = ""',
      sort: '-updated',
      fields: 'id,title,folder,thumbnail,revision,updated',
    }),
    listUntitled: () => listAll('drawings', { filter: 'title = "Untitled drawing"', sort: 'created', fields: 'id,created' }),
    getDrawing: (did) => request('GET', `${records('drawings')}/${id(did)}`),
    createDrawing: (fields) => request('POST', records('drawings'), { form: toForm({ ...fields, owner: me() }) }),
    updateDrawing: (did, fields) => request('PATCH', `${records('drawings')}/${id(did)}`, { form: toForm(fields) }),
    deleteDrawing: (did) => request('DELETE', `${records('drawings')}/${id(did)}`),

    uploadAsset: (blob) => request('POST', records('assets'), { form: toForm({ owner: me(), file: blob }) }),
  };
})();
