const OrdersModule = (() => {
  const STATUS_MAP = {
    pendiente:      { badge: 'badge-warning',  label: 'Pendiente' },
    en_preparacion: { badge: 'badge-info',     label: 'En preparación' },
    listo:          { badge: 'badge-primary',  label: 'Listo' },
    entregado:      { badge: 'badge-success',  label: 'Entregado' },
    cancelado:      { badge: 'badge-danger',   label: 'Cancelado' },
  };

  function fmt(n) { return '$' + n.toLocaleString('es-AR'); }

  const ZONE_OPTS = ['Barrio de Villa Nueva','Vila Terra','Centro Comercial Nordelta','Lirios del Talar','Terrazas/Casas de Santa Maria','Talar del lago 2','Otro'];
  function normalizeZoneSelect(raw) {
    const z = (raw || '').trim();
    if (!z) return '';
    if (ZONE_OPTS.includes(z)) return z;
    const zl = z.toLowerCase();
    if (zl.includes('villa nueva'))                                                        return 'Barrio de Villa Nueva';
    if (zl.includes('terra') || zl.includes('vila'))                                       return 'Vila Terra';
    if (zl.includes('nordelta'))                                                            return 'Centro Comercial Nordelta';
    if (zl.includes('lirios'))                                                              return 'Lirios del Talar';
    if (zl.includes('santa maria') || zl.includes('terraza') || zl.includes('santa maría')) return 'Terrazas/Casas de Santa Maria';
    if (zl.includes('talar del lago'))                                                      return 'Talar del lago 2';
    return 'Otro';
  }
  function statusBadge(s) {
    const { badge, label } = STATUS_MAP[s] || { badge: 'badge-default', label: s };
    return `<span class="badge ${badge}">${label}</span>`;
  }

  let activeFilter = 'pendiente';
  let searchQuery = '';

  function filteredOrders() {
    let orders = Store.orders.all().sort((a, b) => b.id - a.id);
    if (activeFilter === 'por_cobrar') {
      orders = orders.filter(o => !o.paid && o.status !== 'cancelado');
    } else if (activeFilter !== 'all') {
      orders = orders.filter(o => o.status === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(o => o.clientName.toLowerCase().includes(q) || String(o.id).includes(q));
    }
    return orders;
  }

  function renderOrderRow(o) {
    const itemSummary = o.items.map(i => `${i.qty}x ${i.name}`).join(', ');
    return `
      <tr>
        <td class="td-hide-mobile"><span class="text-muted text-xs">#</span><span class="font-medium">${o.id}</span></td>
        <td>
          <div class="font-medium">${o.clientName}</div>
          <div class="text-xs text-secondary">${itemSummary.length > 40 ? itemSummary.slice(0,40)+'…' : itemSummary}</div>
        </td>
        <td class="text-secondary text-sm">${o.deliveryDate}${o.deliveryTime ? ' ' + o.deliveryTime : ''}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="font-medium">${fmt(o.total)}</td>
        <td class="td-hide-mobile">
          <span class="badge ${o.paid ? 'badge-success' : 'badge-default'}">${o.paid ? 'Cobrado' : 'Pendiente'}</span>
        </td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-ghost btn-icon btn-sm" title="Ver detalle" onclick="OrdersModule.openDetail(${o.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="OrdersModule.openEditModal(${o.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" title="${o.calendarEventId ? 'Ya en Google Calendar' : 'Agregar al Google Calendar'}" onclick="CalendarModule.addToCalendar(${o.id})" style="${o.calendarEventId ? 'color:var(--color-success)' : ''}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar" onclick="OrdersModule.remove(${o.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function refreshTable() {
    const tbody = document.getElementById('ordersTableBody');
    const empty = document.getElementById('ordersEmpty');
    if (!tbody) return;
    const orders = filteredOrders();
    if (orders.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      tbody.innerHTML = orders.map(renderOrderRow).join('');
    }
    // Update pending badge
    const badge = document.getElementById('pendingBadge');
    if (badge) badge.textContent = Store.orders.where(o => o.status === 'pendiente').length;
  }

  function buildFormHTML(o = null) {
    const clients = Store.clients.all();
    const products = Store.products.where(p => p.active);
    const isEdit = !!o;

    const clientOptions = clients.map(c =>
      `<option value="${c.id}" ${isEdit && o.clientId === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const itemsValue = isEdit ? JSON.stringify(o.items) : '[]';

    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cliente *</label>
          <select class="form-select" id="fOrderClient" required>
            <option value="">Seleccionar cliente…</option>
            ${clientOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de pedido *</label>
          <input type="date" class="form-input" id="fOrderDate" value="${isEdit ? o.date : new Date().toISOString().slice(0,10)}" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de entrega *</label>
          <div style="display:flex;gap:var(--space-2)">
            <input type="date" class="form-input" id="fOrderDelivery" value="${isEdit ? o.deliveryDate : ''}" required style="flex:1" />
            <input type="time" class="form-input" id="fOrderDeliveryTime" value="${isEdit ? (o.deliveryTime || '') : ''}" style="width:116px" title="Hora de entrega (opcional)" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-select" id="fOrderStatus">
            ${Object.entries(STATUS_MAP).map(([k,v]) =>
              `<option value="${k}" ${isEdit && o.status === k ? 'selected' : ''}>${v.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Zona de entrega</label>
          <select class="form-select" id="fOrderZone">
            <option value="">Sin zona</option>
            ${ZONE_OPTS.map(z => `<option value="${z}" ${isEdit && normalizeZoneSelect(o.zone) === z ? 'selected' : ''}>${z}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Lote <span>(opcional)</span></label>
          <input type="text" class="form-input" id="fOrderLote" placeholder="Ej: 257" value="${isEdit ? (o.lote || '') : ''}" />
        </div>
      </div>

      <!-- Items -->
      <div class="form-group">
        <label class="form-label">Productos del pedido *</label>
        <div id="orderItemsContainer" style="display: flex; flex-direction: column; gap: var(--space-2)">
          <!-- Dynamic rows -->
        </div>
        <button type="button" class="btn btn-secondary btn-sm mt-2" id="addItemBtn">+ Agregar producto</button>
      </div>

      <div class="divider"></div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Método de pago</label>
          <select class="form-select" id="fOrderPayment">
            <option value="efectivo" ${isEdit && o.paymentMethod === 'efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="transferencia" ${isEdit && o.paymentMethod === 'transferencia' ? 'selected' : ''}>Transferencia</option>
            <option value="debito" ${isEdit && o.paymentMethod === 'debito' ? 'selected' : ''}>Débito</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">¿Cobrado?</label>
          <select class="form-select" id="fOrderPaid">
            <option value="no" ${isEdit && !o.paid ? 'selected' : ''}>No cobrado</option>
            <option value="si" ${isEdit && o.paid ? 'selected' : ''}>Cobrado</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas <span>(opcional)</span></label>
        <textarea class="form-textarea" id="fOrderNotes" placeholder="Indicaciones especiales…">${isEdit ? o.notes : ''}</textarea>
      </div>
      <div style="padding: var(--space-3) var(--space-4); background: var(--color-primary-subtle); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
        <span class="text-sm font-medium text-primary">Total del pedido</span>
        <span class="text-xl font-semibold text-primary" id="orderTotal">${isEdit ? '$' + o.total.toLocaleString('es-AR') : '$0'}</span>
      </div>
      <input type="hidden" id="fOrderItems" value='${itemsValue.replace(/'/g, "&apos;")}' />
    `;
  }

  function initFormLogic(existingItems = []) {
    const container = document.getElementById('orderItemsContainer');
    const totalEl   = document.getElementById('orderTotal');
    const hiddenEl  = document.getElementById('fOrderItems');

    // Catálogo derivado de config: formato × sabor + promos
    const formats = Store.formats.where(f => f.active);
    const flavors = Store.flavors.where(f => f.active);
    const promos  = Store.promos.where(p => p.active);
    const catalog = [];
    formats.forEach(fmt => {
      flavors.forEach(flv => {
        catalog.push({ key: `f${fmt.id}v${flv.id}`, name: `${fmt.name} — ${flv.name}`, price: fmt.price || 0, format: fmt.name, flavor: flv.name });
      });
    });
    promos.forEach(p => {
      catalog.push({ key: `promo${p.id}`, name: p.name, price: p.price || 0, format: 'Promo', flavor: p.name });
    });

    function findKey(item) {
      if (!item) return '';
      const fmtLow = (item.format || '').toLowerCase();
      const flvLow = (item.flavor || item.name || '').toLowerCase();
      return (
        catalog.find(c => c.format.toLowerCase() === fmtLow && c.flavor.toLowerCase() === flvLow) ||
        catalog.find(c => flvLow && c.flavor.toLowerCase().includes(flvLow.slice(0, 8)))
      )?.key || '';
    }

    function productOptions(selectedKey) {
      if (catalog.length === 0) return '<option value="">— Configurá sabores y formatos primero —</option>';
      return catalog.map(c =>
        `<option value="${c.key}" data-price="${c.price}" data-format="${c.format}" data-flavor="${c.flavor}" ${c.key === selectedKey ? 'selected' : ''}>${c.name}${c.price ? ' — $' + c.price.toLocaleString('es-AR') : ''}</option>`
      ).join('');
    }

    function recalc() {
      let total = 0;
      const rows = [];
      container.querySelectorAll('.order-item-row').forEach(row => {
        const sel   = row.querySelector('select');
        const qty   = parseFloat(row.querySelector('input').value) || 0;
        const opt   = sel.options[sel.selectedIndex];
        const price = parseFloat(opt?.dataset.price || 0);
        total += qty * price;
        if (opt?.value && qty > 0) {
          rows.push({ productId: null, name: opt.text.split(' — ')[0], qty, price, format: opt.dataset.format || '', flavor: opt.dataset.flavor || '' });
        }
      });
      totalEl.textContent = '$' + total.toLocaleString('es-AR');
      hiddenEl.value = JSON.stringify(rows);
    }

    function addRow(item = null) {
      const row = document.createElement('div');
      row.className = 'order-item-row d-flex gap-2 items-center';
      row.innerHTML = `
        <select class="form-select flex-1" style="height:36px">
          ${productOptions(item ? findKey(item) : '')}
        </select>
        <input type="number" class="form-input" min="1" value="${item?.qty || 1}" style="width:72px" />
        <button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="this.parentElement.remove();window.recalcOrder()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      row.querySelector('select').addEventListener('change', recalc);
      row.querySelector('input').addEventListener('input', recalc);
      container.appendChild(row);
      recalc();
    }

    window.recalcOrder = recalc;
    existingItems.forEach(i => addRow(i));
    if (existingItems.length === 0) addRow();
    document.getElementById('addItemBtn').onclick = () => addRow();
  }

  function openCreateModal() {
    App.openModal({
      title: 'Nuevo pedido',
      size: 'modal-lg',
      body: buildFormHTML(),
      primaryLabel: 'Crear pedido',
      onOpen: () => initFormLogic([]),
      onConfirm: () => saveOrder(null),
    });
  }

  function openEditModal(id) {
    const o = Store.orders.find(id);
    if (!o) return;
    App.openModal({
      title: `Editar pedido #${id}`,
      size: 'modal-lg',
      body: buildFormHTML(o),
      primaryLabel: 'Guardar cambios',
      onOpen: () => initFormLogic(o.items),
      onConfirm: () => saveOrder(id),
    });
  }

  function saveOrder(editId) {
    const clientId = parseInt(document.getElementById('fOrderClient').value);
    const date     = document.getElementById('fOrderDate').value;
    const delivery = document.getElementById('fOrderDelivery').value;
    const status   = document.getElementById('fOrderStatus').value;
    const payment  = document.getElementById('fOrderPayment').value;
    const paid     = document.getElementById('fOrderPaid').value === 'si';
    const notes    = document.getElementById('fOrderNotes').value.trim();
    const items    = JSON.parse(document.getElementById('fOrderItems').value || '[]');
    const client   = Store.clients.find(clientId);

    if (!clientId || !date || !delivery) { App.toast('error', 'Completá los campos obligatorios'); return false; }
    if (items.length === 0) { App.toast('error', 'Agregá al menos un producto'); return false; }

    const zone         = document.getElementById('fOrderZone').value;
    const lote         = document.getElementById('fOrderLote').value.trim();
    const deliveryTime = document.getElementById('fOrderDeliveryTime')?.value || '';
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    const data  = { clientId, clientName: client?.name || '', date, deliveryDate: delivery, deliveryTime, status, items, total, paymentMethod: payment, paid, notes, zone, lote };

    if (editId) {
      Store.orders.update(editId, data);
      App.toast('success', 'Pedido actualizado');
    } else {
      Store.orders.create(data);
      App.toast('success', 'Pedido creado');
    }
    refreshTable();
    return true;
  }

  function openDetail(id) {
    const o = Store.orders.find(id);
    if (!o) return;
    const _loteMatch  = (o.zone || '').match(/lote\s*(\d+)/i);
    const loteDefault = o.lote || (_loteMatch ? _loteMatch[1] : '');
    App.openModal({
      title: `Pedido #${o.id}`,
      body: `
        <div style="display:flex;flex-direction:column;gap:var(--space-4)">

          <div class="d-flex justify-between items-start">
            <div>
              <div class="text-xs text-muted">Cliente</div>
              <div class="font-semibold">${o.clientName}</div>
                ${o.zone ? `<div class="text-xs text-muted" style="margin-top:2px">${o.zone}</div>` : ''}
            </div>
            <div class="text-xs text-muted text-right">Pedido ${o.date}</div>
          </div>

          <div class="divider"></div>

          <!-- Zona / Barrio / Lote -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Zona de entrega</label>
              <select class="form-select" id="dOrderZone">
                <option value="">Sin zona</option>
                ${ZONE_OPTS.map(z =>
                  `<option value="${z}" ${normalizeZoneSelect(o.zone) === z ? 'selected' : ''}>${z}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Barrio <span style="color:var(--color-text-muted);font-weight:400">(Villa Nueva)</span></label>
              <select class="form-select" id="dOrderBarrio">
                <option value="">Sin barrio</option>
                ${Store.barriosVN.all().map(b =>
                  `<option value="${b.name}" ${o.barrio === b.name ? 'selected' : ''}>${b.name}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="form-group" style="max-width:180px">
            <label class="form-label">Lote <span style="color:var(--color-text-muted);font-weight:400">(opcional)</span></label>
            <input type="text" class="form-input" id="dOrderLote" placeholder="Ej: 257" value="${loteDefault}" />
          </div>

          <div class="divider"></div>

          <!-- Campos editables -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Estado</label>
              <select class="form-select" id="dOrderStatus">
                ${Object.entries(STATUS_MAP).map(([k,v]) =>
                  `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v.label}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de entrega</label>
              <div class="d-flex gap-2">
                <input type="date" class="form-input" id="dOrderDelivery" value="${o.deliveryDate || ''}" style="flex:1" />
                <input type="time" class="form-input" id="dOrderDeliveryTime" value="${o.deliveryTime || ''}" style="width:110px" />
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Método de pago</label>
              <select class="form-select" id="dOrderPayment">
                <option value="indefinido"    ${(o.paymentMethod === 'indefinido' || !o.paymentMethod) ? 'selected' : ''}>Indefinido</option>
                <option value="efectivo"      ${o.paymentMethod === 'efectivo'      ? 'selected' : ''}>Efectivo</option>
                <option value="transferencia" ${o.paymentMethod === 'transferencia' ? 'selected' : ''}>Transferencia</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">¿Cobrado?</label>
              <select class="form-select" id="dOrderPaid">
                <option value="no" ${!o.paid ? 'selected' : ''}>No cobrado</option>
                <option value="si" ${ o.paid ? 'selected' : ''}>Cobrado</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Items (solo lectura) -->
          <div>
            <div class="text-xs text-muted" style="margin-bottom:var(--space-2)">Productos</div>
            ${o.items.map(i => `
              <div class="d-flex justify-between items-center" style="padding:var(--space-2) 0;border-bottom:var(--border-light)">
                <span class="text-sm">${i.name}</span>
                <div class="d-flex gap-4">
                  <span class="text-sm text-secondary">${i.qty} × $${i.price.toLocaleString('es-AR')}</span>
                  <span class="text-sm font-medium">$${(i.qty * i.price).toLocaleString('es-AR')}</span>
                </div>
              </div>
            `).join('')}
            <div class="d-flex justify-between items-center" style="margin-top:var(--space-3)">
              <span class="font-semibold">Total</span>
              <span class="font-semibold" style="color:var(--color-primary)">$${o.total.toLocaleString('es-AR')}</span>
            </div>
          </div>

          ${o.notes ? `<div><div class="text-xs text-muted">Notas</div><div class="text-sm">${o.notes}</div></div>` : ''}
        </div>
      `,
      primaryLabel: 'Guardar cambios',
      onConfirm: () => {
        const newStatus = document.getElementById('dOrderStatus').value;
        Store.orders.update(id, {
          status:        newStatus,
          deliveryDate:  document.getElementById('dOrderDelivery').value,
          deliveryTime:  document.getElementById('dOrderDeliveryTime').value,
          paymentMethod: document.getElementById('dOrderPayment').value,
          paid:          document.getElementById('dOrderPaid').value === 'si',
          zone:          document.getElementById('dOrderZone').value.trim(),
          barrio:        document.getElementById('dOrderBarrio').value.trim(),
          lote:          document.getElementById('dOrderLote').value.trim(),
        });

        if (newStatus === 'en_preparacion' && !o.inventoryDeducted) {
          const updated  = Store.orders.find(id);
          const deducted = deductToppings(updated);
          if (deducted.length > 0) {
            App.toast('success', `Toppings descontados: ${deducted.join(', ')}`);
          } else if (Store.flavorRecipes.count() === 0) {
            App.toast('error', 'No hay recetas de toppings definidas — configuralas en Configuración');
          }
        }

        refreshTable();
        App.toast('success', 'Pedido actualizado');
        return true;
      },
    });
  }

  function deductToppings(order) {
    if (order.inventoryDeducted) return [];
    const flavorRecipes = Store.flavorRecipes.all();
    if (!flavorRecipes.length) return [];

    const totalNeeded = {};
    (order.items || []).forEach(item => {
      const flavorName = (item.flavor || '').trim().toLowerCase();
      const formatName = (item.format || '').trim().toLowerCase();
      const qty        = item.qty || 1;
      flavorRecipes
        .filter(r => {
          const rFlv = (r.flavorName || '').toLowerCase();
          const rFmt = (r.formatName || '').toLowerCase();
          return rFlv === flavorName && (!rFmt || rFmt === formatName);
        })
        .forEach(r => { totalNeeded[r.ingredientId] = (totalNeeded[r.ingredientId] || 0) + r.qty * qty; });
    });

    const deducted = [];
    Object.entries(totalNeeded).forEach(([ingId, qty]) => {
      const ing = Store.ingredients.find(parseInt(ingId));
      if (!ing) return;
      const newStock = Math.max(0, Math.round((ing.stock - qty) * 100) / 100);
      Store.ingredients.update(ing.id, { stock: newStock });
      deducted.push(`${ing.name} −${qty}${ing.unit}`);
    });

    if (deducted.length > 0) Store.orders.update(order.id, { inventoryDeducted: true });
    return deducted;
  }

  function remove(id) {
    if (!confirm('¿Eliminás este pedido?')) return;
    Store.orders.remove(id);
    App.toast('success', 'Pedido eliminado');
    refreshTable();
  }

  function render(container) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Pedidos</h1>
            <p class="page-subtitle">Gestioná todos tus pedidos desde acá.</p>
          </div>
        </div>

        <!-- Filters -->
        <div id="ordersFilterBar" class="d-flex gap-3 items-center" style="margin-bottom: var(--space-6); flex-wrap: wrap">
          <div class="tabs" style="margin-bottom: 0; border-bottom: none; gap: var(--space-1)">
            ${[['all','Todos'], ['pendiente','Pendientes'], ['por_cobrar','Por cobrar'], ['en_preparacion','En preparación'], ['listo','Listos'], ['entregado','Entregados']].map(([val, lbl]) => `
              <div class="tab-item ${activeFilter === val ? 'active' : ''}" onclick="OrdersModule.setFilter('${val}')">${lbl}</div>
            `).join('')}
          </div>
          <div class="search-wrapper ml-auto" style="width: 220px">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="ordersSearch" placeholder="Buscar por cliente…" value="${searchQuery}" />
          </div>
        </div>

        <!-- Table -->
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th class="th-hide-mobile">#</th>
                <th>Cliente / Productos</th>
                <th>Entrega</th>
                <th>Estado</th>
                <th>Total</th>
                <th class="th-hide-mobile">Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ordersTableBody"></tbody>
          </table>
          <div id="ordersEmpty" class="empty-state" style="display:none">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <div class="empty-state-title">Sin pedidos</div>
            <p class="empty-state-text">No hay pedidos con ese filtro.</p>
            <button class="btn btn-primary" onclick="OrdersModule.openCreateModal()">Crear primer pedido</button>
          </div>
        </div>
      </div>
    `;

    refreshTable();
    document.getElementById('ordersSearch').addEventListener('input', e => {
      searchQuery = e.target.value;
      refreshTable();
    });
  }

  function setFilter(f) {
    activeFilter = f;
    render(document.getElementById('pageContent'));
  }

  return { render, openCreateModal, openEditModal, openDetail, remove, setFilter };
})();
