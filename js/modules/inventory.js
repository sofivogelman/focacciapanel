const InventoryModule = (() => {
  const CATS = { base: 'Base', condimento: 'Condimento', hierba: 'Hierba', topping: 'Topping', otro: 'Otro' };

  function stockStatus(i) {
    if (i.stock <= i.minStock)        return { cls: 'badge-danger',  label: 'Stock bajo' };
    if (i.stock <= i.minStock * 1.5)  return { cls: 'badge-warning', label: 'Stock justo' };
    return { cls: 'badge-success', label: 'OK' };
  }

  function renderRow(i) {
    const st  = stockStatus(i);
    const pct = Math.min(100, Math.round((i.stock / (i.minStock * 2)) * 100));
    return `
      <tr>
        <td class="font-medium">${i.name}</td>
        <td class="td-hide-mobile"><span class="badge badge-default">${CATS[i.category] || i.category}</span></td>
        <td>
          <div class="d-flex items-center gap-3">
            <div class="progress" style="width: 80px">
              <div class="progress-bar" style="width:${pct}%; background: ${st.cls === 'badge-danger' ? 'var(--color-danger)' : st.cls === 'badge-warning' ? 'var(--color-warning)' : 'var(--color-success)'}"></div>
            </div>
            <span class="text-sm font-medium">${i.stock} ${i.unit}</span>
          </div>
        </td>
        <td class="td-hide-mobile text-secondary text-sm">${i.minStock} ${i.unit}</td>
        <td class="td-hide-mobile text-secondary text-sm">$${i.cost.toLocaleString('es-AR')} / ${i.unit}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="InventoryModule.openStockModal(${i.id})" title="Ajustar stock">+ Stock</button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="InventoryModule.openEditModal(${i.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="InventoryModule.remove(${i.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function buildForm(i = null) {
    const isEdit = !!i;
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Ingrediente *</label>
          <input class="form-input" id="fIngName" value="${isEdit ? i.name : ''}" placeholder="Harina, aceite…" required />
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="fIngCat">
            ${Object.entries(CATS).map(([k,v]) => `<option value="${k}" ${isEdit && i.category===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Unidad de medida *</label>
          <input class="form-input" id="fIngUnit" value="${isEdit ? i.unit : ''}" placeholder="kg, g, litro, unidad…" required />
        </div>
        <div class="form-group">
          <label class="form-label">Costo por unidad ($)</label>
          <input type="number" class="form-input" id="fIngCost" value="${isEdit ? i.cost : ''}" min="0" step="0.01" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Stock actual *</label>
          <input type="number" class="form-input" id="fIngStock" value="${isEdit ? i.stock : 0}" min="0" step="0.01" required />
        </div>
        <div class="form-group">
          <label class="form-label">Stock mínimo (alerta)</label>
          <input type="number" class="form-input" id="fIngMin" value="${isEdit ? i.minStock : 0}" min="0" step="0.01" />
        </div>
      </div>
    `;
  }

  function saveIngredient(editId) {
    const name  = document.getElementById('fIngName').value.trim();
    const unit  = document.getElementById('fIngUnit').value.trim();
    if (!name || !unit) { App.toast('error', 'Nombre y unidad son obligatorios'); return false; }
    const data = {
      name,
      category: document.getElementById('fIngCat').value,
      unit,
      cost:     parseFloat(document.getElementById('fIngCost').value) || 0,
      stock:    parseFloat(document.getElementById('fIngStock').value) || 0,
      minStock: parseFloat(document.getElementById('fIngMin').value) || 0,
    };
    if (editId) { Store.ingredients.update(editId, data); App.toast('success', 'Ingrediente actualizado'); }
    else        { Store.ingredients.create(data); App.toast('success', 'Ingrediente creado'); }
    render(document.getElementById('pageContent'));
    return true;
  }

  function openCreateModal() {
    App.openModal({ title: 'Nuevo ingrediente', body: buildForm(), primaryLabel: 'Agregar', onConfirm: () => saveIngredient(null) });
  }

  function openEditModal(id) {
    const i = Store.ingredients.find(id);
    if (!i) return;
    App.openModal({ title: 'Editar ingrediente', body: buildForm(i), primaryLabel: 'Guardar', onConfirm: () => saveIngredient(id) });
  }

  function openStockModal(id) {
    const i = Store.ingredients.find(id);
    if (!i) return;
    App.openModal({
      title: `Ajustar stock — ${i.name}`,
      body: `
        <p class="text-sm text-secondary">Stock actual: <strong>${i.stock} ${i.unit}</strong></p>
        <div class="form-group mt-4">
          <label class="form-label">Tipo de ajuste</label>
          <select class="form-select" id="fStockType">
            <option value="add">Agregar stock (compra)</option>
            <option value="set">Establecer stock exacto</option>
            <option value="sub">Descontar stock (uso)</option>
          </select>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Cantidad (${i.unit}) *</label>
          <input type="number" class="form-input" id="fStockQty" min="0" step="0.01" placeholder="0" />
        </div>
      `,
      primaryLabel: 'Aplicar',
      onConfirm: () => {
        const type = document.getElementById('fStockType').value;
        const qty  = parseFloat(document.getElementById('fStockQty').value);
        if (isNaN(qty) || qty < 0) { App.toast('error', 'Cantidad inválida'); return false; }
        let newStock = i.stock;
        if (type === 'add') newStock += qty;
        else if (type === 'sub') newStock = Math.max(0, newStock - qty);
        else newStock = qty;
        Store.ingredients.update(id, { stock: Math.round(newStock * 100) / 100 });
        App.toast('success', 'Stock actualizado');
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  function remove(id) {
    if (!confirm('¿Eliminás este ingrediente?')) return;
    Store.ingredients.remove(id);
    App.toast('success', 'Ingrediente eliminado');
    render(document.getElementById('pageContent'));
  }

  function render(container) {
    const ingredients = Store.ingredients.all();
    const low = ingredients.filter(i => i.stock <= i.minStock).length;

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <h1 class="page-title">Inventario</h1>
          <p class="page-subtitle">${ingredients.length} ingredientes · ${low > 0 ? `<span class="text-danger">${low} con stock bajo</span>` : 'todo el stock OK'}</p>
        </div>

        ${low > 0 ? `
          <div style="background: var(--color-danger-bg); border: 1px solid var(--color-danger); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-6); display: flex; align-items: center; gap: var(--space-3)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span class="text-sm text-danger"><strong>${low} ingrediente${low>1?'s':''}</strong> con stock por debajo del mínimo. Reponer antes de cocinar.</span>
          </div>
        ` : ''}

        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th class="th-hide-mobile">Categoría</th>
                <th>Stock actual</th>
                <th class="th-hide-mobile">Mínimo</th>
                <th class="th-hide-mobile">Costo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${ingredients.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-title">Sin ingredientes</div></div></td></tr>` : ingredients.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return { render, openCreateModal, openEditModal, openStockModal, remove };
})();
