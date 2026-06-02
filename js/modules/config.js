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
      <div id="cfgRecipes" style="margin-top:var(--space-6)"></div>
      <div id="cfgFlavorRecipes" style="margin-top:var(--space-6)"></div>
      <div id="cfgPromoStats" style="margin-top:var(--space-6)"></div>

      <!-- Página de pedidos -->
      <div class="card" style="margin-top:var(--space-6)">
        <div class="card-header">
          <div>
            <div class="card-title">Página de pedidos</div>
            <div class="card-subtitle">Publicá las promos activas para que aparezcan automáticamente en tu página de pedidos</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ConfigModule.publishPromos()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            Publicar promos activas
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-4)">
          <div class="form-row" style="max-width:480px">
            <div class="form-group">
              <label class="form-label">GitHub token (con permiso <code>repo</code>)</label>
              <input type="password" class="form-input" id="cfgGhToken" value="${localStorage.getItem('focaccia_github_token') || ''}" placeholder="ghp_…" autocomplete="off" />
              <div class="form-hint">Crealo en github.com → Settings → Developer settings → Personal access tokens → scope <strong>repo</strong>. Se guarda solo en este dispositivo.</div>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="ConfigModule.saveGhToken()">Guardar token</button>
          </div>
          <div id="cfgPromoPublishStatus" style="display:none"></div>
          <div style="background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
            <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">URL pública de las promos</div>
            <code class="text-xs" style="word-break:break-all;color:var(--color-primary)">https://raw.githubusercontent.com/sofivogelman/focacciapanel/main/promos.json</code>
            <div class="form-hint" style="margin-top:var(--space-2)">Tu página de pedidos tiene que leer esta URL para mostrar las promos activas.</div>
          </div>
        </div>
      </div>

      <!-- IA para comprobantes -->
      <div class="card" style="margin-top:var(--space-6)">
        <div class="card-header">
          <div>
            <div class="card-title">Detección automática de comprobantes (IA)</div>
            <div class="card-subtitle">Usá Gemini para extraer el monto y descripción al subir un ticket o factura</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <div class="form-row" style="max-width:480px">
            <div class="form-group">
              <label class="form-label">Clave API de Gemini</label>
              <input type="password" class="form-input" id="cfgGeminiKey" value="${localStorage.getItem('focaccia_gemini_key') || ''}" placeholder="AIza…" autocomplete="off" />
              <div class="form-hint">Obtenela gratis en <strong>aistudio.google.com</strong> → Get API Key. Se guarda solo en este dispositivo.</div>
            </div>
          </div>
          <div>
            <button class="btn btn-primary btn-sm" onclick="ConfigModule.saveGeminiKey()">Guardar clave</button>
          </div>
        </div>
      </div>

      <!-- Sincronización Google Drive -->
      <div class="card" style="margin-top:var(--space-6)">
        <div class="card-header">
          <div>
            <div class="card-title">Sincronización entre dispositivos</div>
            <div class="card-subtitle">Guardá o cargá todos los datos vía Google Drive para usarlos desde cualquier dispositivo</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-primary" onclick="DriveSync.upload()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              Guardar en Drive
            </button>
            <button class="btn btn-secondary" onclick="DriveSync.download()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.11"/></svg>
              Cargar desde Drive
            </button>
          </div>
          <p class="text-xs text-muted">Al guardar se sube un archivo <code>focaccia-panel-data.json</code> a tu Google Drive. Al cargar se reemplaza toda la información local con la versión del Drive y la página se recarga.</p>
        </div>
      </div>
    `;
    renderFlavors();
    renderFormats();
    renderPromos();
    renderRecipes();
    renderFlavorRecipes();
    renderPromoStats();
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
          : `<div style="overflow-x:auto"><table class="table">
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
            </table></div>`
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
          : `<div style="overflow-x:auto"><table class="table">
              <thead><tr><th>Nombre</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${items.map(f => `
                  <tr>
                    <td class="font-medium">${escHtml(f.name)}</td>
                    <td class="text-sm">${f.price ? '$' + Number(f.price).toLocaleString('es-AR') : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                    <td><span class="badge ${f.active ? 'badge-success' : 'badge-default'}">${f.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="cfg-actions">
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editFormat(${f.id})">Editar</button>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.toggleFormat(${f.id})">${f.active ? 'Desactivar' : 'Activar'}</button>
                      <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deleteFormat(${f.id})">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
        }
      </div>
    `;
  }

  function formatModalBody(f) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-input" id="fFormatName" value="${escHtml(f?.name || '')}"
            placeholder="ej: Familiar" autofocus />
          <div class="form-hint">Igual que aparece en los pedidos.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input class="form-input" id="fFormatPrice" type="number" min="0"
            value="${f?.price || ''}" placeholder="ej: 3500" />
        </div>
      </div>
    `;
  }

  function openAddFormat() {
    App.openModal({
      title: 'Agregar formato',
      body: formatModalBody(null),
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name  = document.getElementById('fFormatName').value.trim();
        const price = parseFloat(document.getElementById('fFormatPrice').value) || 0;
        if (!name) { App.toast('error', 'Ingresá el nombre del formato'); return false; }
        Store.formats.create({ name, price, active: true });
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
      body: formatModalBody(f),
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const name  = document.getElementById('fFormatName').value.trim();
        const price = parseFloat(document.getElementById('fFormatPrice').value) || 0;
        if (!name) return false;
        Store.formats.update(id, { name, price });
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
          : `<div style="overflow-x:auto"><table class="table">
              <thead>
                <tr>
                  <th class="th-hide-mobile">Semana</th>
                  <th>Nombre en pedido</th>
                  <th class="th-hide-mobile">Tipo</th>
                  <th class="th-hide-mobile">Contenido</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${items.map(p => `
                  <tr>
                    <td class="text-sm td-hide-mobile" style="color:var(--color-text-muted);white-space:nowrap">${p.semana ? fmtWeek(p.semana) : '—'}</td>
                    <td class="font-medium">
                      ${escHtml(p.name)}
                      ${p.esFormato ? '<span class="badge badge-info" style="margin-left:4px;font-size:10px">Formato</span>' : ''}
                    </td>
                    <td class="text-sm td-hide-mobile">${p.tipo ? `<span class="badge badge-primary">${escHtml(p.tipo)}</span>` : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                    <td class="text-sm td-hide-mobile" style="color:var(--color-text-secondary)">
                      ${(p.items || []).length > 0
                        ? p.items.map(i => `${i.qty}× ${escHtml(i.format)}`).join(', ')
                        : '<span style="color:var(--color-text-muted)">—</span>'
                      }
                    </td>
                    <td class="text-sm">${p.price ? '$' + Number(p.price).toLocaleString('es-AR') : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                    <td><span class="badge ${p.active ? 'badge-success' : 'badge-default'}">${p.active ? 'Activa' : 'Inactiva'}</span></td>
                    <td class="cfg-actions">
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editPromo(${p.id})">Editar</button>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.togglePromo(${p.id})">${p.active ? 'Desactivar' : 'Activar'}</button>
                      <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deletePromo(${p.id})">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
        }
      </div>
    `;
  }

  function promoModalBody(p) {
    const formats = Store.formats.where(f => f.active);
    const existingItems = p?.items || [];
    const formatOptions = formats.map(f =>
      `<option value="${escHtml(f.name)}">${escHtml(f.name)}</option>`
    ).join('');

    const itemRows = existingItems.length > 0
      ? existingItems.map(i => promoItemRow(i.format, i.qty, formatOptions)).join('')
      : promoItemRow('', 1, formatOptions);

    return `
      <div class="form-group" style="background:var(--color-primary-subtle);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3)">
        <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;margin-bottom:0">
          <input type="checkbox" id="fPromoEsFormato" ${p?.esFormato ? 'checked' : ''} />
          <span class="text-sm font-semibold">Mostrar como formato en la página de pedidos</span>
        </label>
        <div class="form-hint" style="margin-top:var(--space-1);margin-bottom:0">Activalo si esta promo es un formato de compra propio (ej: Degustación). Al activarla aparece como opción en el dropdown de formato.</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre en el pedido *</label>
          <input class="form-input" id="fPromoName" value="${escHtml(p?.name || '')}"
            placeholder="ej: Promo25" />
          <div class="form-hint">Igual que aparece en la columna G de tus pedidos.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo (para agrupar) *</label>
          <input class="form-input" id="fPromoTipo" value="${escHtml(p?.tipo || '')}"
            placeholder="ej: 4 individuales" />
          <div class="form-hint">Agrupa promos del mismo concepto entre semanas.</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Contenido del combo</label>
        <div id="fPromoItems" style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${formats.length === 0
            ? '<p class="text-sm" style="color:var(--color-text-muted)">Configurá formatos primero.</p>'
            : itemRows
          }
        </div>
        ${formats.length > 0 ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top:var(--space-2)"
          onclick="ConfigModule.addPromoItemRow()">+ Agregar formato</button>` : ''}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Semana</label>
          <input class="form-input" id="fPromoSemana" type="date" value="${p?.semana || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Precio ($)</label>
          <input class="form-input" id="fPromoPrice" type="number" min="0"
            value="${p?.price || ''}" placeholder="ej: 4000" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción <span style="color:var(--color-text-muted);font-weight:400">(aparece en la página de pedidos si está marcada como formato)</span></label>
        <textarea class="form-input" id="fPromoNotes" rows="2" placeholder="ej: 4 focaccias individuales a elección · precio especial">${escHtml(p?.notes || '')}</textarea>
      </div>
    `;
  }

  function promoItemRow(format, qty, formatOptions) {
    return `
      <div class="d-flex gap-2 items-center promo-item-row">
        <select class="form-select flex-1" style="height:34px">
          ${Store.formats.where(f => f.active).map(f =>
            `<option value="${escHtml(f.name)}" ${f.name === format ? 'selected' : ''}>${escHtml(f.name)}</option>`
          ).join('')}
        </select>
        <input type="number" class="form-input" min="1" value="${qty || 1}" style="width:72px" placeholder="cant." />
        <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="this.parentElement.remove()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }

  function addPromoItemRow() {
    const container = document.getElementById('fPromoItems');
    if (!container) return;
    const div = document.createElement('div');
    div.innerHTML = promoItemRow('', 1, '');
    container.appendChild(div.firstElementChild);
  }

  function readPromoItems() {
    return [...document.querySelectorAll('.promo-item-row')].map(row => ({
      format: row.querySelector('select')?.value || '',
      qty:    parseInt(row.querySelector('input')?.value) || 1,
    })).filter(i => i.format);
  }

  function openAddPromo() {
    App.openModal({
      title: 'Agregar promoción',
      size: 'modal-lg',
      body: promoModalBody(null),
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name  = document.getElementById('fPromoName').value.trim();
        if (!name) { App.toast('error', 'Ingresá el nombre de la promo'); return false; }
        const tipo      = document.getElementById('fPromoTipo').value.trim();
        const price     = parseFloat(document.getElementById('fPromoPrice')?.value) || 0;
        const semana    = document.getElementById('fPromoSemana')?.value || '';
        const items     = readPromoItems();
        const notes     = (document.getElementById('fPromoNotes')?.value || '').trim();
        const esFormato = document.getElementById('fPromoEsFormato')?.checked || false;
        Store.promos.create({ name, tipo, price, semana, items, notes, active: true, esFormato });
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
        const name  = document.getElementById('fPromoName').value.trim();
        if (!name) return false;
        const tipo      = document.getElementById('fPromoTipo').value.trim();
        const price     = parseFloat(document.getElementById('fPromoPrice')?.value) || 0;
        const semana    = document.getElementById('fPromoSemana')?.value || '';
        const items     = readPromoItems();
        const notes     = (document.getElementById('fPromoNotes')?.value || '').trim();
        const esFormato = document.getElementById('fPromoEsFormato')?.checked || false;
        Store.promos.update(id, { name, tipo, price, semana, items, notes, esFormato });
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
    // Auto-publicar si hay token configurado
    if (localStorage.getItem('focaccia_github_token')) publishPromos();
  }

  function deletePromo(id) {
    if (!confirm('¿Eliminar esta promo?')) return;
    Store.promos.remove(id);
    renderPromos();
  }

  // ─── Recetas por formato ─────────────────────────────────────────────────────
  function renderRecipes() {
    const el = document.getElementById('cfgRecipes');
    if (!el) return;
    const recipes     = Store.recipes.all();
    const formats     = Store.formats.where(f => f.active);
    const ingredients = Store.ingredients.all();

    if (formats.length === 0 || ingredients.length === 0) {
      el.innerHTML = `
        <div class="card">
          <div class="card-header"><div class="card-title">Recetas (masa base)</div></div>
          <p class="text-sm text-center" style="color:var(--color-text-muted);padding:var(--space-6) 0">
            Cargá formatos e ingredientes primero.
          </p>
        </div>`;
      return;
    }

    const byFormat = {};
    formats.forEach(f => { byFormat[f.name] = []; });
    recipes.forEach(r => { if (byFormat[r.formatName] !== undefined) byFormat[r.formatName].push(r); });

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Recetas (masa base)</div>
            <div class="card-subtitle">Cantidad de cada ingrediente por unidad · se usa para calcular producción</div>
          </div>
        </div>
        ${formats.map(fmt => {
          const rows = byFormat[fmt.name] || [];
          return `
            <div style="margin-bottom:var(--space-5)">
              <div class="d-flex items-center gap-3" style="margin-bottom:var(--space-2)">
                <span class="font-semibold text-sm">${escHtml(fmt.name)}</span>
                <button class="btn btn-xs btn-ghost" onclick="ConfigModule.openAddRecipe('${escHtml(fmt.name)}')">+ Ingrediente</button>
              </div>
              ${rows.length === 0
                ? `<p class="text-sm" style="color:var(--color-text-muted);padding-left:var(--space-4)">Sin ingredientes cargados.</p>`
                : `<div style="overflow-x:auto"><table class="table">
                    <tbody>
                      ${rows.map(r => {
                        const ing = ingredients.find(i => i.id === r.ingredientId);
                        if (!ing) return '';
                        return `<tr>
                          <td class="text-sm font-medium">${escHtml(ing.name)}</td>
                          <td class="text-sm">${r.qty} ${ing.unit}</td>
                          <td class="cfg-actions">
                            <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editRecipe(${r.id})">Editar</button>
                            <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deleteRecipe(${r.id})">✕</button>
                          </td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table></div>`
              }
            </div>`;
        }).join('')}
      </div>
    `;
  }

  function openAddRecipe(formatName) {
    const ingredients = Store.ingredients.all();
    if (!ingredients.length) { App.toast('error', 'Cargá ingredientes primero'); return; }
    App.openModal({
      title: `Agregar ingrediente — ${formatName}`,
      body: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ingrediente *</label>
            <select class="form-select" id="fRecipeIng">
              ${ingredients.map(i => `<option value="${i.id}">${escHtml(i.name)} (${i.unit})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cantidad por unidad *</label>
            <input class="form-input" id="fRecipeQty" type="number" min="0" step="0.1" placeholder="ej: 472" autofocus />
          </div>
        </div>
      `,
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const ingId = parseInt(document.getElementById('fRecipeIng').value);
        const qty   = parseFloat(document.getElementById('fRecipeQty').value);
        if (!ingId || isNaN(qty) || qty <= 0) { App.toast('error', 'Completá los campos'); return false; }
        Store.recipes.create({ formatName, ingredientId: ingId, qty });
        renderRecipes();
        return true;
      },
    });
  }

  function editRecipe(id) {
    const r   = Store.recipes.find(id);
    if (!r) return;
    const ing = Store.ingredients.find(r.ingredientId);
    App.openModal({
      title: `Editar — ${r.formatName}`,
      body: `
        <div class="form-group">
          <label class="form-label">${ing ? escHtml(ing.name) : 'Ingrediente'}</label>
          <div class="d-flex gap-2 items-center">
            <input class="form-input" id="fRecipeQty" type="number" min="0" step="0.1" value="${r.qty}" autofocus />
            <span class="text-sm" style="color:var(--color-text-muted);white-space:nowrap">${ing?.unit || ''} por unidad</span>
          </div>
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const qty = parseFloat(document.getElementById('fRecipeQty').value);
        if (isNaN(qty) || qty <= 0) return false;
        Store.recipes.update(id, { qty });
        renderRecipes();
        return true;
      },
    });
  }

  function deleteRecipe(id) {
    if (!confirm('¿Eliminar este ingrediente de la receta?')) return;
    Store.recipes.remove(id);
    renderRecipes();
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

  // ─── Toppings por sabor × formato ────────────────────────────────────────────
  function renderFlavorRecipes() {
    const el      = document.getElementById('cfgFlavorRecipes');
    if (!el) return;
    const flavors  = Store.flavors.where(f => f.active);
    const formats  = Store.formats.where(f => f.active);
    const ings     = Store.ingredients.all();
    const recipes  = Store.flavorRecipes.all();

    if (flavors.length === 0) {
      el.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Toppings por sabor</div></div>
        <p class="text-sm text-center" style="color:var(--color-text-muted);padding:var(--space-6) 0">Cargá sabores primero.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Toppings por sabor</div>
            <div class="card-subtitle">Cantidad por unidad según formato · se descuenta al pasar el pedido a "En preparación"</div>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="ConfigModule.loadStandardToppings()">↺ Cargar estándar</button>
        </div>

        ${flavors.map(flv => `
          <div style="margin-bottom:var(--space-6)">
            <div class="font-semibold text-sm" style="margin-bottom:var(--space-3);color:var(--color-text)">${escHtml(flv.name)}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3)">
              ${formats.map(fmt => {
                const rows = recipes.filter(r => r.flavorName === flv.name && r.formatName === fmt.name);
                return `
                  <div style="background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-3)">
                    <div class="d-flex items-center justify-between" style="margin-bottom:var(--space-2)">
                      <span class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">${escHtml(fmt.name)}</span>
                      <button class="btn btn-xs btn-ghost" onclick="ConfigModule.openAddFlavorRecipe('${escHtml(flv.name)}','${escHtml(fmt.name)}')">+ Agregar</button>
                    </div>
                    ${rows.length === 0
                      ? `<p class="text-xs" style="color:var(--color-text-muted)">Sin toppings</p>`
                      : rows.map(r => {
                          const ing = ings.find(i => i.id === r.ingredientId);
                          if (!ing) return '';
                          return `<div class="d-flex items-center gap-1" style="padding:2px 0">
                            <span class="text-xs flex-1">${escHtml(ing.name)}</span>
                            <span class="text-xs" style="color:var(--color-text-muted);white-space:nowrap">${r.qty}${ing.unit}</span>
                            <button class="btn btn-xs btn-ghost" onclick="ConfigModule.editFlavorRecipe(${r.id})" style="padding:1px 4px;font-size:11px">✎</button>
                            <button class="btn btn-xs btn-ghost cfg-delete" onclick="ConfigModule.deleteFlavorRecipe(${r.id})" style="padding:1px 4px;font-size:11px">✕</button>
                          </div>`;
                        }).join('')
                    }
                  </div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function openAddFlavorRecipe(flavorName, formatName) {
    const ingredients = Store.ingredients.all().sort((a, b) => a.name.localeCompare(b.name));
    if (!ingredients.length) { App.toast('error', 'Cargá ingredientes primero'); return; }
    App.openModal({
      title: `Topping — ${flavorName} (${formatName})`,
      body: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ingrediente *</label>
            <select class="form-select" id="fFRIng">
              ${ingredients.map(i => `<option value="${i.id}">${escHtml(i.name)} (${i.unit})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cantidad por unidad *</label>
            <input class="form-input" id="fFRQty" type="number" min="0" step="0.1" placeholder="ej: 30" autofocus />
          </div>
        </div>
      `,
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const ingId = parseInt(document.getElementById('fFRIng').value);
        const qty   = parseFloat(document.getElementById('fFRQty').value);
        if (!ingId || isNaN(qty) || qty <= 0) { App.toast('error', 'Completá los campos'); return false; }
        Store.flavorRecipes.create({ flavorName, formatName, ingredientId: ingId, qty });
        renderFlavorRecipes();
        return true;
      },
    });
  }

  function editFlavorRecipe(id) {
    const r   = Store.flavorRecipes.find(id);
    if (!r) return;
    const ing = Store.ingredients.find(r.ingredientId);
    App.openModal({
      title: `Editar — ${r.flavorName} (${r.formatName || 'todos'})`,
      body: `
        <div class="form-group">
          <label class="form-label">${ing ? escHtml(ing.name) : 'Ingrediente'}</label>
          <div class="d-flex gap-2 items-center">
            <input class="form-input" id="fFRQty" type="number" min="0" step="0.1" value="${r.qty}" autofocus />
            <span class="text-sm" style="color:var(--color-text-muted);white-space:nowrap">${ing?.unit || ''} por unidad</span>
          </div>
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const qty = parseFloat(document.getElementById('fFRQty').value);
        if (isNaN(qty) || qty <= 0) return false;
        Store.flavorRecipes.update(id, { qty });
        renderFlavorRecipes();
        return true;
      },
    });
  }

  function deleteFlavorRecipe(id) {
    if (!confirm('¿Eliminar este topping de la receta?')) return;
    Store.flavorRecipes.remove(id);
    renderFlavorRecipes();
  }

  // Cantidades estándar provistas por la emprendedora
  function loadStandardToppings() {
    const STANDARD = [
      // Familiar
      { flvKey:'romero',    fmtKey:'familiar',   ingKey:'romero',    qty:5    },
      { flvKey:'romero',    fmtKey:'familiar',   ingKey:'sal',       qty:4    },
      { flvKey:'tomate',    fmtKey:'familiar',   ingKey:'tomate',    qty:120  },
      { flvKey:'tomate',    fmtKey:'familiar',   ingKey:'pesto',     qty:15   },
      { flvKey:'papa',      fmtKey:'familiar',   ingKey:'papa',      qty:150  },
      { flvKey:'papa',      fmtKey:'familiar',   ingKey:'parmesano', qty:35   },
      { flvKey:'aceituna',  fmtKey:'familiar',   ingKey:'aceituna',  qty:80   },
      // Individual
      { flvKey:'romero',    fmtKey:'individual', ingKey:'romero',    qty:2    },
      { flvKey:'romero',    fmtKey:'individual', ingKey:'sal',       qty:1.5  },
      { flvKey:'tomate',    fmtKey:'individual', ingKey:'tomate',    qty:50   },
      { flvKey:'tomate',    fmtKey:'individual', ingKey:'pesto',     qty:4    },
      { flvKey:'papa',      fmtKey:'individual', ingKey:'papa',      qty:50   },
      { flvKey:'papa',      fmtKey:'individual', ingKey:'parmesano', qty:12   },
      { flvKey:'aceituna',  fmtKey:'individual', ingKey:'aceituna',  qty:27   },
    ];

    const flavors = Store.flavors.where(f => f.active);
    const formats = Store.formats.where(f => f.active);
    const ings    = Store.ingredients.all();

    const findFlv = key => flavors.find(f => f.name.toLowerCase().includes(key));
    const findFmt = key => formats.find(f => f.name.toLowerCase().includes(key));
    const findIng = key => ings.find(i => i.name.toLowerCase().includes(key));

    let count = 0, skip = 0;
    STANDARD.forEach(s => {
      const flv = findFlv(s.flvKey);
      const fmt = findFmt(s.fmtKey);
      const ing = findIng(s.ingKey);
      if (!flv || !fmt || !ing) { skip++; return; }

      // Reemplazar si ya existe para esta combinación
      Store.flavorRecipes
        .where(r => r.flavorName === flv.name && r.formatName === fmt.name && r.ingredientId === ing.id)
        .forEach(r => Store.flavorRecipes.remove(r.id));

      Store.flavorRecipes.create({ flavorName: flv.name, formatName: fmt.name, ingredientId: ing.id, qty: s.qty });
      count++;
    });

    const msg = skip > 0 ? ` (${skip} no encontrados — verificá que los nombres de sabores, formatos e ingredientes coincidan)` : '';
    App.toast(count > 0 ? 'success' : 'error', `${count} toppings cargados${msg}`);
    renderFlavorRecipes();
  }

  // ─── Métricas históricas de promos ───────────────────────────────────────────
  function computePromoStats() {
    const orders = Store.orders.all();
    const promos = Store.promos.all();
    const tipoMap = {};

    // Inicializar una entrada por cada promo existente
    promos.forEach(promo => {
      const key = (promo.tipo || promo.name).toLowerCase();
      if (!tipoMap[key]) tipoMap[key] = { tipo: promo.tipo || promo.name, orderCount: 0, itemCount: 0, revenue: 0, formatCounts: {} };
    });

    function norm(s) { return (s || '').toLowerCase().normalize('NFC').trim(); }

    function findPromo(item) {
      const flavorN = norm(item.flavor);
      const nameN   = norm(item.name);
      const isPromoFmt = norm(item.format) === 'promo';

      // 1) Exact match por nombre/flavor
      let match = promos.find(p => {
        const pn = norm(p.name);
        return pn && (flavorN === pn || nameN === pn);
      });
      if (match) return match;

      // 2) Includes match (nombre largo dentro del texto del item)
      match = promos.find(p => {
        const pn = norm(p.name);
        return pn.length > 4 && (flavorN.includes(pn) || nameN.includes(pn));
      });
      if (match) return match;

      // 3) Si el formato es 'Promo', buscar por precio exacto
      if (isPromoFmt) {
        match = promos.find(p => p.price > 0 && item.price === p.price);
        if (match) return match;
      }

      return null;
    }

    // Recorrer pedido por pedido (cliente por cliente a través de sus pedidos)
    const clients = Store.clients.all();
    const processedOrders = new Set();

    // Primero los pedidos asociados a un cliente
    clients.forEach(client => {
      orders.filter(o => o.clientId === client.id).forEach(order => {
        processedOrders.add(order.id);
        processOrder(order);
      });
    });
    // Luego los que no tienen cliente asignado
    orders.filter(o => !processedOrders.has(o.id)).forEach(order => processOrder(order));

    function processOrder(order) {
      const matchedKeys = new Set();
      (order.items || []).forEach(item => {
        const promo = findPromo(item);
        if (!promo) return;
        const key = (promo.tipo || promo.name).toLowerCase();
        const entry = tipoMap[key];
        if (!entry) return;

        const qty = item.qty || 1;
        entry.itemCount += qty;
        entry.revenue   += qty * (item.price || promo.price || 0);
        const fmt = (item.format || '').trim();
        if (fmt && norm(fmt) !== 'promo') {
          entry.formatCounts[fmt] = (entry.formatCounts[fmt] || 0) + qty;
        }
        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          entry.orderCount++;
        }
      });
    }

    return Object.values(tipoMap).sort((a, b) => b.orderCount - a.orderCount);
  }

  function renderPromoStats() {
    const el = document.getElementById('cfgPromoStats');
    if (!el) return;
    const stats = computePromoStats();
    if (stats.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Comparativa de Promos</div>
            <div class="card-subtitle">Total acumulado · ordenado por pedidos</div>
          </div>
        </div>
        <div style="overflow-x:auto"><table class="table">
          <thead>
            <tr><th>Tipo</th><th>Pedidos</th><th class="th-hide-mobile">Unidades</th><th>Revenue</th><th class="th-hide-mobile">Formatos</th></tr>
          </thead>
          <tbody>
            ${stats.map(g => `
              <tr>
                <td class="font-medium">${escHtml(g.tipo)}</td>
                <td class="font-semibold">${g.orderCount}</td>
                <td class="text-sm td-hide-mobile">${g.itemCount || '—'}</td>
                <td class="text-sm">${g.revenue ? '$' + g.revenue.toLocaleString('es-AR') : '—'}</td>
                <td class="text-xs td-hide-mobile" style="color:var(--color-text-secondary)">
                  ${Object.entries(g.formatCounts).map(([fmt, qty]) => `${qty}× ${escHtml(fmt)}`).join(', ') || '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  // ─── Util ────────────────────────────────────────────────────────────────────
  function fmtWeek(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch { return dateStr; }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Publicación de promos a página de pedidos ───────────────────────────────
  function saveGhToken() {
    const val = document.getElementById('cfgGhToken')?.value.trim() || '';
    localStorage.setItem('focaccia_github_token', val);
    App.toast('success', val ? 'Token guardado' : 'Token eliminado');
  }

  async function publishPromos() {
    const token = localStorage.getItem('focaccia_github_token') || '';
    if (!token) {
      App.toast('error', 'Primero guardá tu GitHub token en esta sección');
      return;
    }

    const promos  = Store.promos.all();
    const payload = {
      updated: new Date().toISOString().slice(0, 10),
      promos:  promos.map(p => ({
        id:        p.id,
        name:      p.name,
        tipo:      p.tipo      || '',
        price:     p.price     || 0,
        semana:    p.semana    || '',
        items:     p.items     || [],
        notes:     p.notes     || '',
        active:    !!p.active,
        esFormato: !!p.esFormato,
      })),
    };

    const content = JSON.stringify(payload, null, 2);
    const b64     = btoa(unescape(encodeURIComponent(content)));
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' };
    const apiUrl  = 'https://api.github.com/repos/sofivogelman/focacciapanel/contents/promos.json';

    const statusEl = document.getElementById('cfgPromoPublishStatus');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '<span class="text-sm text-muted">Publicando…</span>'; }

    try {
      const existing = await fetch(apiUrl, { headers }).then(r => r.ok ? r.json() : null);
      const body     = { message: 'chore: update active promos', content: b64 };
      if (existing?.sha) body.sha = existing.sha;

      const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (res.ok) {
        const active = promos.filter(p => p.active).length;
        App.toast('success', `Promos publicadas — ${active} activa${active !== 1 ? 's' : ''}, ${promos.length - active} inactiva${promos.length - active !== 1 ? 's' : ''}`);
        if (statusEl) statusEl.innerHTML = `<span class="text-xs text-success">✓ Publicado ${new Date().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</span>`;
      } else {
        const err = await res.json().catch(() => ({}));
        App.toast('error', 'Error al publicar: ' + (err.message || res.status));
        if (statusEl) statusEl.innerHTML = `<span class="text-xs text-danger">✗ Error ${res.status}</span>`;
      }
    } catch (e) {
      App.toast('error', 'Error de red al publicar');
      if (statusEl) statusEl.innerHTML = `<span class="text-xs text-danger">✗ Error de red</span>`;
    }
  }

  function saveGeminiKey() {
    const key = document.getElementById('cfgGeminiKey')?.value.trim() || '';
    localStorage.setItem('focaccia_gemini_key', key);
    App.toast('success', key ? 'Clave Gemini guardada' : 'Clave Gemini eliminada');
  }

  return {
    render,
    openAddFlavor, editFlavor, toggleFlavor, deleteFlavor,
    openAddFormat, editFormat, toggleFormat, deleteFormat,
    openAddPromo,  editPromo,  togglePromo,  deletePromo, addPromoItemRow,
    openAddRecipe, editRecipe, deleteRecipe,
    openAddFlavorRecipe, editFlavorRecipe, deleteFlavorRecipe, loadStandardToppings,
    resolveFlavor, resolvePromo,
    saveGeminiKey,
    saveGhToken, publishPromos,
  };
})();
