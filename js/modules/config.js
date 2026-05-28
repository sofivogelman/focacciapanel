const ConfigModule = (() => {

  // ─── Render principal ────────────────────────────────────────────────────────
  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Configuración de Negocio</h1>
          <p class="page-subtitle">Sabores, formatos y promociones que usa el Dashboard para clasificar pedidos.</p>
        </div>
      </div>

      <div class="config-grid">
        <div id="cfgFlavors"></div>
        <div id="cfgFormats"></div>
      </div>

      <div id="cfgPromos" style="margin-top:var(--space-6)"></div>
    `;
    renderFlavors();
    renderFormats();
    renderPromos();
  }

  // ─── Sabores ─────────────────────────────────────────────────────────────────
  function renderFlavors() {
    const el = document.getElementById('cfgFlavors');
    if (!el) return;
    const items = Store.flavors.all();
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Sabores y Variedades</div>
            <div class="card-subtitle">${items.length} sabor${items.length !== 1 ? 'es' : ''} cargado${items.length !== 1 ? 's' : ''}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="ConfigModule.openAddFlavor()">+ Agregar</button>
        </div>
        ${items.length === 0
          ? `<p class="text-sm text-center" style="color:var(--color-text-muted);padding:var(--space-6) 0">Sin sabores cargados todavía.</p>`
          : `<table class="table">
              <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${items.map(f => `
                  <tr>
                    <td class="font-medium">${escHtml(f.name)}</td>
                    <td><span class="badge ${f.active ? 'badge-success' : 'badge-default'}">${f.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="cfg-actions">
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editFlavor(${f.id})">Editar</button>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.toggleFlavor(${f.id})">${f.active ? 'Desactivar' : 'Activar'}</button>
                      <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deleteFlavor(${f.id})">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  }

  function openAddFlavor() {
    App.openModal({
      title: 'Agregar sabor',
      body: `
        <div class="form-group">
          <label class="form-label">Nombre del sabor *</label>
          <input class="form-input" id="fFlavorName" placeholder="ej: Clásica (Romero y Sal)" autofocus />
        </div>
      `,
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name = document.getElementById('fFlavorName').value.trim();
        if (!name) { App.toast('error', 'Ingresá el nombre del sabor'); return false; }
        Store.flavors.create({ name, active: true });
        renderFlavors();
        return true;
      },
    });
  }

  function editFlavor(id) {
    const f = Store.flavors.find(id);
    if (!f) return;
    App.openModal({
      title: 'Editar sabor',
      body: `
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="fFlavorName" value="${escHtml(f.name)}" />
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const name = document.getElementById('fFlavorName').value.trim();
        if (!name) return false;
        Store.flavors.update(id, { name });
        renderFlavors();
        renderPromos();
        return true;
      },
    });
  }

  function toggleFlavor(id) {
    const f = Store.flavors.find(id);
    if (!f) return;
    Store.flavors.update(id, { active: !f.active });
    renderFlavors();
  }

  function deleteFlavor(id) {
    if (!confirm('¿Eliminar este sabor?')) return;
    Store.flavors.remove(id);
    renderFlavors();
  }

  // ─── Formatos ────────────────────────────────────────────────────────────────
  function renderFormats() {
    const el = document.getElementById('cfgFormats');
    if (!el) return;
    const items = Store.formats.all();
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Formatos / Tamaños</div>
            <div class="card-subtitle">${items.length} formato${items.length !== 1 ? 's' : ''} cargado${items.length !== 1 ? 's' : ''}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="ConfigModule.openAddFormat()">+ Agregar</button>
        </div>
        ${items.length === 0
          ? `<p class="text-sm text-center" style="color:var(--color-text-muted);padding:var(--space-6) 0">Sin formatos cargados todavía.</p>`
          : `<table class="table">
              <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${items.map(f => `
                  <tr>
                    <td class="font-medium">${escHtml(f.name)}</td>
                    <td><span class="badge ${f.active ? 'badge-success' : 'badge-default'}">${f.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="cfg-actions">
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editFormat(${f.id})">Editar</button>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.toggleFormat(${f.id})">${f.active ? 'Desactivar' : 'Activar'}</button>
                      <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deleteFormat(${f.id})">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  }

  function openAddFormat() {
    App.openModal({
      title: 'Agregar formato',
      body: `
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-input" id="fFormatName" placeholder="ej: Familiar" autofocus />
          <div class="form-hint">Nombre exacto tal como aparece en los pedidos (ej: Familiar, Mediana, Promo).</div>
        </div>
      `,
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name = document.getElementById('fFormatName').value.trim();
        if (!name) { App.toast('error', 'Ingresá el nombre del formato'); return false; }
        Store.formats.create({ name, active: true });
        renderFormats();
        return true;
      },
    });
  }

  function editFormat(id) {
    const f = Store.formats.find(id);
    if (!f) return;
    App.openModal({
      title: 'Editar formato',
      body: `
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="fFormatName" value="${escHtml(f.name)}" />
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const name = document.getElementById('fFormatName').value.trim();
        if (!name) return false;
        Store.formats.update(id, { name });
        renderFormats();
        return true;
      },
    });
  }

  function toggleFormat(id) {
    const f = Store.formats.find(id);
    if (!f) return;
    Store.formats.update(id, { active: !f.active });
    renderFormats();
  }

  function deleteFormat(id) {
    if (!confirm('¿Eliminar este formato?')) return;
    Store.formats.remove(id);
    renderFormats();
  }

  // ─── Promociones ─────────────────────────────────────────────────────────────
  function renderPromos() {
    const el = document.getElementById('cfgPromos');
    if (!el) return;
    const items = Store.promos.all();
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Promociones de la Semana</div>
            <div class="card-subtitle">El Dashboard expande estas promos al importar pedidos desde Sheets.</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="ConfigModule.openAddPromo()">+ Agregar promo</button>
        </div>
        ${items.length === 0
          ? `<p class="text-sm text-center" style="color:var(--color-text-muted);padding:var(--space-6) 0">
               Sin promos configuradas. Agregá una para clasificar combos que aparecen en tus pedidos.
             </p>`
          : `<table class="table">
              <thead>
                <tr>
                  <th>Nombre de la promo</th>
                  <th>Sabores que incluye</th>
                  <th>Notas</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${items.map(p => `
                  <tr>
                    <td class="font-medium">${escHtml(p.name)}</td>
                    <td class="text-sm" style="color:var(--color-text-secondary)">
                      ${(p.flavors || []).length > 0
                        ? p.flavors.map(f => `<span class="badge badge-primary" style="margin-right:2px;margin-bottom:2px">${escHtml(f)}</span>`).join('')
                        : '<span style="color:var(--color-text-muted)">—</span>'
                      }
                    </td>
                    <td class="text-sm" style="color:var(--color-text-muted)">${escHtml(p.notes || '—')}</td>
                    <td><span class="badge ${p.active ? 'badge-success' : 'badge-default'}">${p.active ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="cfg-actions">
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editPromo(${p.id})">Editar</button>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.togglePromo(${p.id})">${p.active ? 'Desactivar' : 'Activar'}</button>
                      <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deletePromo(${p.id})">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  }

  function promoModalBody(p) {
    const flavors = Store.flavors.where(f => f.active);
    const selected = p?.flavors || [];
    return `
      <div class="form-group">
        <label class="form-label">Nombre de la promo *</label>
        <input class="form-input" id="fPromoName" value="${escHtml(p?.name || '')}"
          placeholder="ej: Promo (Los 4 sabores)" />
        <div class="form-hint">Escribilo igual que aparece en la columna G de tus pedidos.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Sabores incluidos</label>
        ${flavors.length === 0
          ? '<p class="text-sm" style="color:var(--color-text-muted)">Primero cargá sabores en la sección de arriba.</p>'
          : `<div class="checkbox-grid">
              ${flavors.map(f => `
                <label class="checkbox-item">
                  <input type="checkbox" value="${escHtml(f.name)}" ${selected.includes(f.name) ? 'checked' : ''} />
                  <span>${escHtml(f.name)}</span>
                </label>
              `).join('')}
            </div>`
        }
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <input class="form-input" id="fPromoNotes" value="${escHtml(p?.notes || '')}"
          placeholder="ej: Válida solo los sábados" />
      </div>
    `;
  }

  function openAddPromo() {
    App.openModal({
      title: 'Agregar promoción',
      size: 'modal-lg',
      body: promoModalBody(null),
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name = document.getElementById('fPromoName').value.trim();
        if (!name) { App.toast('error', 'Ingresá el nombre de la promo'); return false; }
        const flavors = [...document.querySelectorAll('.checkbox-item input:checked')].map(cb => cb.value);
        const notes   = (document.getElementById('fPromoNotes')?.value || '').trim();
        Store.promos.create({ name, flavors, notes, active: true });
        renderPromos();
        return true;
      },
    });
  }

  function editPromo(id) {
    const p = Store.promos.find(id);
    if (!p) return;
    App.openModal({
      title: 'Editar promoción',
      size: 'modal-lg',
      body: promoModalBody(p),
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const name = document.getElementById('fPromoName').value.trim();
        if (!name) return false;
        const flavors = [...document.querySelectorAll('.checkbox-item input:checked')].map(cb => cb.value);
        const notes   = (document.getElementById('fPromoNotes')?.value || '').trim();
        Store.promos.update(id, { name, flavors, notes });
        renderPromos();
        return true;
      },
    });
  }

  function togglePromo(id) {
    const p = Store.promos.find(id);
    if (!p) return;
    Store.promos.update(id, { active: !p.active });
    renderPromos();
  }

  function deletePromo(id) {
    if (!confirm('¿Eliminar esta promo?')) return;
    Store.promos.remove(id);
    renderPromos();
  }

  // ─── Helpers para sync.js ────────────────────────────────────────────────────
  // Busca si un texto de sabor coincide con un sabor configurado.
  function resolveFlavor(text) {
    if (!text) return null;
    const flavors = Store.flavors.where(f => f.active);
    const lower   = text.toLowerCase();
    const exact   = flavors.find(f => f.name.toLowerCase() === lower);
    if (exact) return exact;
    const words   = lower.split(/[\s,()y\+&]+/).filter(w => w.length > 2);
    const scored  = flavors
      .map(f => ({ f, hits: words.filter(w => f.name.toLowerCase().includes(w)).length }))
      .filter(s => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return scored[0]?.f || null;
  }

  // Busca si un texto de sabor corresponde a una promo activa.
  // Devuelve { promo, flavors[] } o null.
  function resolvePromo(text) {
    if (!text) return null;
    const promos = Store.promos.where(p => p.active);
    const lower  = text.toLowerCase();
    const match  = promos.find(p => lower.includes(p.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim().toLowerCase()));
    if (!match) return null;
    return { promo: match, flavors: match.flavors || [] };
  }

  // ─── Util ────────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    render,
    openAddFlavor, editFlavor, toggleFlavor, deleteFlavor,
    openAddFormat, editFormat, toggleFormat, deleteFormat,
    openAddPromo,  editPromo,  togglePromo,  deletePromo,
    resolveFlavor, resolvePromo,
  };
})();
