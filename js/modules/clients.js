const ClientsModule = (() => {
  let searchQuery = '';

  const ZONE_OPTS = ['Barrio de Villa Nueva','Vila Terra','Centro Comercial Nordelta','Lirios del Talar','Terrazas/Casas de Santa Maria','Talar del lago 2','Otro'];

  function initials(name) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function clientStats(id) {
    const orders = Store.orders.where(o => o.clientId === id);
    const total  = orders.reduce((s, o) => s + o.total, 0);
    return { orders: orders.length, total };
  }

  function renderCard(c) {
    const st = clientStats(c.id);
    return `
      <div class="card">
        <div class="d-flex gap-3 items-start" style="margin-bottom: var(--space-4)">
          <div class="avatar" style="width:44px;height:44px;font-size:var(--text-sm);flex-shrink:0">${initials(c.name)}</div>
          <div class="flex-1 overflow-hidden">
            <div class="font-semibold truncate">${c.name}</div>
            ${c.phone ? `<div class="text-xs text-secondary mt-1">${c.phone}</div>` : ''}
            ${c.email ? `<div class="text-xs text-secondary truncate">${c.email}</div>` : ''}
            ${(c.barrio || c.zone) ? `<div class="text-xs mt-1" style="color:var(--color-primary)">${c.barrio || c.zone}</div>` : ''}
          </div>
        </div>
        ${c.address ? `<div class="d-flex gap-2 items-center text-xs text-secondary" style="margin-bottom: var(--space-3)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${c.address}
        </div>` : ''}
        ${c.notes ? `<div class="text-xs text-secondary" style="padding: var(--space-2) var(--space-3); background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: var(--space-3); border-left: 2px solid var(--color-primary-muted)">${c.notes}</div>` : ''}
        <div class="divider"></div>
        <div class="d-flex justify-between" style="margin-bottom: var(--space-4)">
          <div>
            <div class="text-xs text-muted">Pedidos</div>
            <div class="font-semibold">${st.orders}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Total acumulado</div>
            <div class="font-semibold">$${st.total.toLocaleString('es-AR')}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Cliente desde</div>
            <div class="font-semibold text-sm">${c.createdAt || '—'}</div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm flex-1" onclick="ClientsModule.openEditModal(${c.id})">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="ClientsModule.viewOrders(${c.id})">Ver pedidos</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="ClientsModule.remove(${c.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function buildForm(c = null) {
    const isEdit = !!c;
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre completo *</label>
          <input class="form-input" id="fCliName" value="${isEdit ? c.name : ''}" placeholder="Nombre del cliente o local…" required />
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input class="form-input" id="fCliPhone" value="${isEdit ? c.phone : ''}" placeholder="11-xxxx-xxxx" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Email <span>(opcional)</span></label>
        <input type="email" class="form-input" id="fCliEmail" value="${isEdit ? c.email : ''}" placeholder="correo@ejemplo.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Dirección <span>(opcional)</span></label>
        <input class="form-input" id="fCliAddress" value="${isEdit ? c.address : ''}" placeholder="Barrio, Ciudad…" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Zona de entrega</label>
          <select class="form-select" id="fCliZone">
            <option value="">Sin zona</option>
            ${ZONE_OPTS.map(z => `<option value="${z}" ${isEdit && c.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Barrio <span>(Villa Nueva)</span></label>
          <select class="form-select" id="fCliBarrio">
            <option value="">Sin barrio</option>
            ${Store.barriosVN.all().map(b => `<option value="${b.name}" ${isEdit && c.barrio === b.name ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas internas <span>(opcional)</span></label>
        <textarea class="form-textarea" id="fCliNotes" placeholder="Preferencias, descuentos, días de entrega…">${isEdit ? c.notes : ''}</textarea>
      </div>
    `;
  }

  function saveClient(editId) {
    const name = document.getElementById('fCliName').value.trim();
    if (!name) { App.toast('error', 'El nombre es obligatorio'); return false; }
    const data = {
      name,
      phone:   document.getElementById('fCliPhone').value.trim(),
      email:   document.getElementById('fCliEmail').value.trim(),
      address: document.getElementById('fCliAddress').value.trim(),
      zone:    document.getElementById('fCliZone').value,
      barrio:  document.getElementById('fCliBarrio').value,
      notes:   document.getElementById('fCliNotes').value.trim(),
    };
    if (editId) { Store.clients.update(editId, data); App.toast('success', 'Cliente actualizado'); }
    else        { Store.clients.create(data); App.toast('success', 'Cliente creado'); }
    render(document.getElementById('pageContent'));
    return true;
  }

  function openCreateModal() {
    App.openModal({ title: 'Nuevo cliente', body: buildForm(), primaryLabel: 'Crear cliente', onConfirm: () => saveClient(null) });
  }

  function openEditModal(id) {
    const c = Store.clients.find(id);
    if (!c) return;
    App.openModal({ title: 'Editar cliente', body: buildForm(c), primaryLabel: 'Guardar cambios', onConfirm: () => saveClient(id) });
  }

  function viewOrders(id) {
    const c = Store.clients.find(id);
    const orders = Store.orders.where(o => o.clientId === id).sort((a, b) => b.id - a.id);
    const STATUS_MAP = {
      pendiente: 'Pendiente', en_preparacion: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado',
    };
    App.openModal({
      title: `Pedidos de ${c?.name}`,
      size: 'modal-lg',
      body: orders.length === 0
        ? '<div class="empty-state"><div class="empty-state-title">Sin pedidos</div></div>'
        : `<div class="table-wrapper" style="border:none">
            <table class="table">
              <thead><tr><th>#</th><th>Fecha entrega</th><th>Estado</th><th>Total</th><th>Pago</th></tr></thead>
              <tbody>
                ${orders.map(o => `
                  <tr>
                    <td>#${o.id}</td>
                    <td>${o.deliveryDate}</td>
                    <td>${STATUS_MAP[o.status] || o.status}</td>
                    <td class="font-medium">$${o.total.toLocaleString('es-AR')}</td>
                    <td>${o.paid ? '✓ Cobrado' : '⏳ Pendiente'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`,
      primaryLabel: 'Cerrar',
      hideCancelBtn: true,
      onConfirm: () => true,
    });
  }

  function openBulkZoneModal() {
    const clients = Store.clients.all().sort((a, b) => a.name.localeCompare(b.name));
    const barrioOpts = Store.barriosVN.all();
    App.openModal({
      title: 'Asignar zonas en masa',
      size: 'modal-lg',
      primaryLabel: 'Guardar todo',
      body: `
        <p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Completá la zona de cada cliente. Solo guardá los que cambiaste.</p>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${clients.map(c => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2);align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light)">
              <div class="text-sm font-medium">${c.name}</div>
              <select class="form-select" data-client-id="${c.id}" data-field="zone" style="height:32px;font-size:var(--text-xs)">
                <option value="">Sin zona</option>
                ${ZONE_OPTS.map(z => `<option value="${z}" ${c.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
              </select>
              <select class="form-select" data-client-id="${c.id}" data-field="barrio" style="height:32px;font-size:var(--text-xs)">
                <option value="">Sin barrio</option>
                ${barrioOpts.map(b => `<option value="${b.name}" ${c.barrio === b.name ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      `,
      onConfirm: () => {
        document.querySelectorAll('[data-client-id][data-field="zone"]').forEach(sel => {
          const id     = parseInt(sel.dataset.clientId);
          const zone   = sel.value;
          const barrio = sel.closest('div').querySelector('[data-field="barrio"]').value;
          Store.clients.update(id, { zone, barrio });
        });
        App.toast('success', 'Zonas actualizadas');
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  function remove(id) {
    const st = clientStats(id);
    if (st.orders > 0 && !confirm(`Este cliente tiene ${st.orders} pedido(s). ¿Igual lo eliminás?`)) return;
    else if (st.orders === 0 && !confirm('¿Eliminás este cliente?')) return;
    Store.clients.remove(id);
    App.toast('success', 'Cliente eliminado');
    render(document.getElementById('pageContent'));
  }

  function render(container) {
    let clients = Store.clients.all();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      clients = clients.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q));
    }

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Clientes</h1>
            <p class="page-subtitle">${Store.clients.count()} clientes en total</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="ClientsModule.openBulkZoneModal()">Asignar zonas</button>
        </div>

        <div class="d-flex gap-3" style="margin-bottom: var(--space-6)">
          <div class="search-wrapper flex-1" style="max-width: 320px">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="clientsSearch" placeholder="Buscar cliente…" value="${searchQuery}" />
          </div>
        </div>

        ${clients.length === 0 ? `
          <div class="card"><div class="empty-state">
            <div class="empty-state-title">${searchQuery ? 'Sin resultados' : 'Sin clientes'}</div>
            <p class="empty-state-text">Agregá tu primera clientela.</p>
            <button class="btn btn-primary" onclick="ClientsModule.openCreateModal()">Agregar cliente</button>
          </div></div>
        ` : `
          <div class="grid-3">
            ${clients.map(renderCard).join('')}
          </div>
        `}
      </div>
    `;

    document.getElementById('clientsSearch')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      render(document.getElementById('pageContent'));
    });
  }

  return { render, openCreateModal, openEditModal, viewOrders, remove, openBulkZoneModal };
})();
