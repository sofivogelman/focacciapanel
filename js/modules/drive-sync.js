const DriveSync = (() => {
  const CLIENT_ID  = '733992786485-hfh0q4g69pimubj4g9mriggdjul3p1au.apps.googleusercontent.com';
  const SCOPE      = 'https://www.googleapis.com/auth/drive.file';
  const FILE_NAME  = 'focaccia-panel-data.json';
  const FILE_ID_KEY = 'focaccia_drive_file_id';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry  = 0;
  let pendingFn    = null;

  // ─── Colecciones a sincronizar ────────────────────────────────────────────────
  const COLLECTIONS = [
    'clients','orders','products','ingredients','expenses',
    'deliveries','flavors','formats','promos','barriosVN','masaLog','recipes',
  ];

  // ─── localStorage helpers ─────────────────────────────────────────────────────
  function getFileId() { return localStorage.getItem(FILE_ID_KEY); }
  function setFileId(id) { localStorage.setItem(FILE_ID_KEY, id); }

  // ─── Exportar / importar datos ────────────────────────────────────────────────
  function exportData() {
    const out = { exportedAt: new Date().toISOString() };
    COLLECTIONS.forEach(name => { out[name] = Store[name].all(); });
    return JSON.stringify(out);
  }

  function importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    COLLECTIONS.forEach(name => {
      if (Array.isArray(data[name])) {
        localStorage.setItem('focaccia_' + name, JSON.stringify(data[name]));
      }
    });
  }

  // ─── Drive API helpers ────────────────────────────────────────────────────────
  async function findFile() {
    const cached = getFileId();
    if (cached) return cached;

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'${FILE_NAME}'%20and%20trashed%3Dfalse&spaces=drive&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    if (data.files?.length) {
      setFileId(data.files[0].id);
      return data.files[0].id;
    }
    return null;
  }

  async function uploadToDrive() {
    const content = exportData();
    let fid = await findFile();

    if (fid) {
      // Actualizar archivo existente
      const resp = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fid}?uploadType=media`,
        {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body:    content,
        }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
    } else {
      // Crear archivo nuevo
      const meta = new Blob([JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' })], { type: 'application/json' });
      const body = new Blob([content], { type: 'application/json' });
      const form = new FormData();
      form.append('metadata', meta);
      form.append('file', body);

      const resp = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
      );
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
      if (data.id) setFileId(data.id);
    }

    App.toast('success', 'Datos guardados en Google Drive');
  }

  async function downloadFromDrive() {
    const fid = await findFile();
    if (!fid) {
      App.toast('warning', 'No hay backup en Drive. Guardá primero desde la compu.');
      return;
    }

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fid}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    importData(text);
    App.toast('success', 'Datos cargados desde Drive. Recargando…');
    setTimeout(() => location.reload(), 1800);
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────────
  function ensureTokenClient() {
    if (tokenClient) return true;
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      App.toast('error', 'Google Identity Services no disponible.');
      return false;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (resp) => {
        if (resp.error) {
          App.toast('error', `Error Google: ${resp.error}`);
          pendingFn = null;
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
        if (pendingFn) {
          try { await pendingFn(); }
          catch (err) { App.toast('error', `Error Drive: ${err.message}`); }
          pendingFn = null;
        }
      },
    });
    return true;
  }

  function withAuth(fn) {
    if (!ensureTokenClient()) return;
    if (accessToken && Date.now() < tokenExpiry) {
      fn().catch(err => App.toast('error', `Error Drive: ${err.message}`));
    } else {
      pendingFn = fn;
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  // ─── API pública ──────────────────────────────────────────────────────────────
  return {
    upload:   () => withAuth(uploadToDrive),
    download: () => withAuth(downloadFromDrive),
  };
})();
