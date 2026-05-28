const ProductsModule = (() => {
  function fmt(n) { return '$' + n.toLocaleString('es-AR'); }

  const CATEGORIES = { clasica: 'Clásica', especial: 'Especial', mini: 'Mini', otro: 'Otro' };

  function margin(p) {
    if (!p.cost || !p.price) return null;
    return Math.round(((p.price - p.cost) / p.price) * 100);
  }

  function renderCard(p) {
    const m = margin(p);
    return `
      <div class="card" style="position:relative; ${!p.active ? 'opacity:0.55;' : ''}">
        <div style="text-align:center; font-size: 48px; margin-bottom: var(--space-3); line-height: 1">${p.image || '🫓'}</div>
        <div class="d-flex justify-between items-start" style="margin-bottom: var(--space-2)">
          <div>
            <div class="font-semibold">${p.name}</div>
            <div class="text-xs text-secondary" style="margin-top: 2px">${CATEGORIES[p.category] || p.category}</div>
          </div>
          ${p.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-default">Inactivo</span>'}
        </div>
        <p class="text-sm text-secondary" style="margin-bottom: var(--space-4); min-height: 36px">${p.description}</p>
        <div class="divider"></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4)">
          <div>
            <div class="text-xs text-muted">Precio venta</div>
            <div class="font-semibold text-primary">${fmt(p.price)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Costo</div>
            <div class="font-medium">${p.cost ? fmt(p.cost) : '—'}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Margen</div>
            <div class="font-medium ${m !== null && m < 30 ? 'text-warning' : 'text-success'}">${m !== null ? m + '%' : '—'}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Unidad</div>
            <div class="font-medium">${p.unit}</div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm flex-1" onclick="ProductsModule.openEditModal(${p.id})">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="ProductsModule.toggleActive(${p.id})">${p.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="ProductsModule.remove(${p.id})" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function buildForm(p = null) {
    const isEdit = !!p;
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input class="form-input" id="fProdName" value="${isEdit ? p.name : ''}" placeholder="Focaccia de…" required />
        </div>
        <div class="form-group">
          <label class="form-label">Emoji / ícono</label>
          <input class="form-input" id="fProdImage" value="${isEdit ? p.image : '🫓'}" maxlength="4" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción <span>(opcional)</span></label>
        <textarea class="form-textarea" id="fProdDesc" placeholder="Ingredientes principales…">${isEdit ? p.description : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="fProdCat">
            ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${isEdit && p.category === k ? 'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Unidad</label>
          <input class="form-input" id="fProdUnit" value="${isEdit ? p.unit : 'entera'}" placeholder="entera, porción…" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Precio de venta *</label>
          <input type="number" class="form-input" id="fProdPrice" value="${isEdit ? p.price : ''}" min="0" step="50" required />
        </div>
        <div class="form-group">
          <label class="form-label">Costo de producción</label>
          <input type="number" class="form-input" id="fProdCost" value="${isEdit ? p.cost : ''}" min="0" step="10" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-select" id="fProdActive">
          <option value="si" ${!isEdit || p.active ? 'selected':''}>Activo (disponible para pedidos)</option>
          <option value="no" ${isEdit && !p.active ? 'selected':''}>Inactivo</option>
        </select>
      </div>
    `;
  }

  function saveProduct(editId) {
    const name  = document.getElementById('fProdName').value.trim();
    const price = parseFloat(document.getElementById('fProdPrice').value);
    if (!name || !price) { App.toast('error', 'Nombre y precio son obligatorios'); return false; }
    const data = {
      name,
      description: document.getElementById('fProdDesc').value.trim(),
      category:    document.getElementById('fProdCat').value,
      unit:        document.getElementById('fProdUnit').value.trim() || 'entera',
      price,
      cost:        parseFloat(document.getElementById('fProdCost').value) || 0,
      active:      document.getElementById('fProdActive').value === 'si',
      image:       document.getElementById('fProdImage').value || '🫓',
    };
    if (editId) { Store.products.update(editId, data); App.toast('success', 'Producto actualizado'); }
    else        { Store.products.create(data); App.toast('success', 'Producto creado'); }
    render(document.getElementById('pageContent'));
    return true;
  }

  function openCreateModal() {
    App.openModal({ title: 'Nuevo producto', body: buildForm(), primaryLabel: 'Crear producto', onConfirm: () => saveProduct(null) });
  }

  function openEditModal(id) {
    const p = Store.products.find(id);
    if (!p) return;
    App.openModal({ title: 'Editar producto', body: buildForm(p), primaryLabel: 'Guardar cambios', onConfirm: () => saveProduct(id) });
  }

  function toggleActive(id) {
    const p = Store.products.find(id);
    if (!p) return;
    Store.products.update(id, { active: !p.active });
    render(document.getElementById('pageContent'));
  }

  function remove(id) {
    if (!confirm('¿Eliminás este producto?')) return;
    Store.products.remove(id);
    App.toast('success', 'Producto eliminado');
    render(document.getElementById('pageContent'));
  }

  function render(container) {
    const products = Store.products.all();
    const active   = products.filter(p => p.active);
    const inactive = products.filter(p => !p.active);

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <h1 class="page-title">Productos</h1>
          <p class="page-subtitle">${products.length} producto${products.length !== 1 ? 's' : ''} en el catálogo · ${active.length} activos</p>
        </div>

        ${active.length > 0 ? `
          <div class="grid-3" style="margin-bottom: var(--space-8)">
            ${active.map(renderCard).join('')}
          </div>
        ` : ''}

        ${inactive.length > 0 ? `
          <div class="d-flex items-center gap-3" style="margin-bottom: var(--space-4)">
            <span class="text-sm font-medium text-secondary">Inactivos</span>
            <div class="divider" style="flex:1; margin: 0"></div>
          </div>
          <div class="grid-3">
            ${inactive.map(renderCard).join('')}
          </div>
        ` : ''}

        ${products.length === 0 ? `
          <div class="card">
            <div class="empty-state">
              <div class="empty-state-title">Sin productos</div>
              <p class="empty-state-text">Agregá tu primer focaccia al catálogo.</p>
              <button class="btn btn-primary" onclick="ProductsModule.openCreateModal()">Crear producto</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return { render, openCreateModal, openEditModal, toggleActive, remove };
})();
