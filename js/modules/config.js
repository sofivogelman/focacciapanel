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
      <div id="cfgPromoStats" style="margin-top:var(--space-6)"></div>

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
            </table>`
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
          : `<table class="table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Nombre en pedido</th>
                  <th>Tipo</th>
                  <th>Contenido</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${items.map(p => `
                  <tr>
                    <td class="text-sm" style="color:var(--color-text-muted);white-space:nowrap">${p.semana ? fmtWeek(p.semana) : '—'}</td>
                    <td class="font-medium">${escHtml(p.name)}</td>
                    <td class="text-sm">${p.tipo ? `<span class="badge badge-primary">${escHtml(p.tipo)}</span>` : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                    <td class="text-sm" style="color:var(--color-text-secondary)">
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
            </table>`
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
        <label class="form-label">Notas</label>
        <input class="form-input" id="fPromoNotes" value="${escHtml(p?.notes || '')}"
          placeholder="ej: Válida solo los sábados" />
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
        const tipo   = document.getElementById('fPromoTipo').value.trim();
        const price  = parseFloat(document.getElementById('fPromoPrice')?.value) || 0;
        const semana = document.getElementById('fPromoSemana')?.value || '';
        const items  = readPromoItems();
        const notes  = (document.getElementById('fPromoNotes')?.value || '').trim();
        Store.promos.create({ name, tipo, price, semana, items, notes, active: true });
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
        const tipo   = document.getElementById('fPromoTipo').value.trim();
        const price  = parseFloat(document.getElementById('fPromoPrice')?.value) || 0;
        const semana = document.getElementById('fPromoSemana')?.value || '';
        const items  = readPromoItems();
        const notes  = (document.getElementById('fPromoNotes')?.value || '').trim();
        Store.promos.update(id, { name, tipo, price, semana, items, notes });
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
                : `<table class="table">
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
                  </table>`
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

  // ─── Métricas históricas de promos ───────────────────────────────────────────
  function computePromoStats() {
    const orders = Store.orders.all();
    // Agrupar promos por tipo
    const tipoMap = {};
    Store.promos.all().forEach(promo => {
      const key = (promo.tipo || promo.name).toLowerCase();
      if (!tipoMap[key]) tipoMap[key] = { tipo: promo.tipo || promo.name, semanas: [] };

      let pool = orders;
      if (promo.semana) {
        const start = new Date(promo.semana + 'T00:00:00').getTime();
        const end   = start + 7 * 86400000;
        pool = orders.filter(o => {
          const t = new Date((o.date || '').slice(0,10) + 'T00:00:00').getTime();
          return t >= start && t < end;
        });
      }

      const promoLow = promo.name.toLowerCase();
      let orderCount = 0, revenue = 0;
      const formatCounts = {};

      pool.forEach(order => {
        const matching = (order.items || []).filter(item =>
          (item.flavor || item.name || '').toLowerCase().includes(promoLow)
        );
        if (matching.length > 0) {
          orderCount++;
          revenue += order.total || 0;
        }
      });

      // Contar unidades por formato del contenido definido
      (promo.items || []).forEach(pi => {
        formatCounts[pi.format] = (formatCounts[pi.format] || 0) + pi.qty * orderCount;
      });

      tipoMap[key].semanas.push({ promo, orderCount, revenue, formatCounts });
    });

    return Object.values(tipoMap).map(group => {
      const totalOrders  = group.semanas.reduce((s, w) => s + w.orderCount, 0);
      const totalRevenue = group.semanas.reduce((s, w) => s + w.revenue, 0);
      const allFormats   = {};
      group.semanas.forEach(w => {
        Object.entries(w.formatCounts).forEach(([fmt, qty]) => {
          allFormats[fmt] = (allFormats[fmt] || 0) + qty;
        });
      });
      return { tipo: group.tipo, semanas: group.semanas, totalOrders, totalRevenue, allFormats };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
  }

  function renderPromoStats() {
    const el = document.getElementById('cfgPromoStats');
    if (!el) return;
    const stats = computePromoStats().filter(s => s.semanas.length > 0);
    if (stats.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Comparativa de Promos</div>
            <div class="card-subtitle">Agrupado por tipo · ordenado por pedidos</div>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr><th>Tipo</th><th>Contenido</th><th>Semanas</th><th>Pedidos</th><th>Revenue</th><th>Desglose por semana</th></tr>
          </thead>
          <tbody>
            ${stats.map(g => `
              <tr>
                <td class="font-medium">${escHtml(g.tipo)}</td>
                <td class="text-sm" style="color:var(--color-text-secondary)">
                  ${Object.entries(g.allFormats).map(([fmt, qty]) => `${qty}× ${escHtml(fmt)}`).join(', ') || '—'}
                </td>
                <td class="text-sm">${g.semanas.length}</td>
                <td class="font-semibold">${g.totalOrders}</td>
                <td class="text-sm">${g.totalRevenue ? '$' + g.totalRevenue.toLocaleString('es-AR') : '—'}</td>
                <td class="text-xs" style="color:var(--color-text-muted)">
                  ${g.semanas.filter(w => w.orderCount > 0).map(w =>
                    `${w.promo.semana ? fmtWeek(w.promo.semana) : '?'}: ${w.orderCount} ped.`
                  ).join(' · ') || '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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

  return {
    render,
    openAddFlavor, editFlavor, toggleFlavor, deleteFlavor,
    openAddFormat, editFormat, toggleFormat, deleteFormat,
    openAddPromo,  editPromo,  togglePromo,  deletePromo, addPromoItemRow,
    openAddRecipe, editRecipe, deleteRecipe,
    resolveFlavor, resolvePromo,
  };
})();
