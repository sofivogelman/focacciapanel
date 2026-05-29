const DashboardModule = (() => {
  function statusBadge(status) {
    const map = {
      pendiente:      ['badge-warning', 'Pendiente'],
      en_preparacion: ['badge-info',    'En preparación'],
      listo:          ['badge-primary', 'Listo'],
      entregado:      ['badge-success', 'Entregado'],
      cancelado:      ['badge-danger',  'Cancelado'],
    };
    const [cls, label] = map[status] || ['badge-default', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function fmt(n) { return '$' + n.toLocaleString('es-AR'); }

  // ─── Recordatorio de masa ────────────────────────────────────────────────────
  function renderMasaReminder() {
    const MASA_G           = { familiar: 900, individual: 280 };
    const MASA_POR_BOLSA   = 1910;
    const HARINA_POR_BOLSA = 1000;
    const MS_HOUR          = 60 * 60 * 1000;

    function tieneRegalo(flavor) {
      const f = (flavor || '').toLowerCase();
      return f.includes('regalo') && !f.includes('sin individual') && !f.includes('romero');
    }

    const pending = Store.orders.where(o => o.status === 'pendiente');
    if (pending.length === 0) return '';

    const byDate = {};
    pending.forEach(order => {
      // Solo usamos deliveryDate — no fallback a order.date (que es la fecha del pedido, no entrega)
      const date = order.deliveryDate || '';
      if (!date) return;
      if (!byDate[date]) byDate[date] = { familiares: 0, individuales: 0, regalo: 0 };
      (order.items || []).forEach(item => {
        const f = (item.format || '').toLowerCase();
        const qty = item.qty || 1;
        if (f === 'familiar') {
          byDate[date].familiares += qty;
          if (tieneRegalo(item.flavor)) byDate[date].regalo += qty;
        } else if (f === 'individual') {
          byDate[date].individuales += qty;
        }
      });
    });

    const now = new Date();
    let overflow = 0;

    const reminders = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, c]) => {
        const masaNeta     = c.familiares * MASA_G.familiar + (c.individuales + c.regalo) * MASA_G.individual;
        const bolsas       = Math.ceil(masaNeta / MASA_POR_BOLSA);
        const masaFinal    = bolsas * MASA_POR_BOLSA;
        const masaLograda  = Store.masaLog.where(l => l.deliveryDate === date).reduce((s, l) => s + (l.grams || 0), 0);
        const masaHecha    = masaLograda + overflow;
        overflow           = Math.max(0, masaHecha - masaFinal);
        const masaPendiente = Math.max(0, masaFinal - masaHecha);
        const bolsasPend   = Math.ceil(masaPendiente / MASA_POR_BOLSA);
        const completa     = masaHecha >= masaFinal && masaFinal > 0;

        // deadline = exactamente 48 horas antes del mediodía de entrega
        const deliveryD  = new Date(date + 'T12:00:00');
        const deadline   = new Date(deliveryD.getTime() - 48 * MS_HOUR);
        // horas hasta el deadline (positivo = todavía hay tiempo, negativo = ya pasó)
        const hoursLeft  = (deadline - now) / MS_HOUR;

        return { date, masaPendiente, bolsasPend, harinaFinal: bolsasPend * HARINA_POR_BOLSA, completa, deliveryD, deadline, hoursLeft };
      })
      // excluir completas, sin pendiente, y entregas ya pasadas
      .filter(r => !r.completa && r.masaPendiente > 0 && r.deliveryD > now);

    if (reminders.length === 0) return '';

    const fmtD = d => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    return `
      <div class="card" style="margin-bottom:var(--space-6); border-color:var(--color-primary)">
        <div class="card-header">
          <div>
            <div class="card-title">Próxima masa a preparar</div>
            <div class="card-subtitle">Planificá 48hs antes de cada entrega</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('produccion')">Ver producción</button>
        </div>
        ${reminders.slice(0, 3).map(r => {
          const overdue  = r.hoursLeft < 0;
          const todayDue = r.hoursLeft >= 0 && r.hoursLeft < 24;
          const tomorDue = r.hoursLeft >= 24 && r.hoursLeft < 48;
          const color = overdue ? 'var(--color-danger)' : todayDue ? 'var(--color-warning)' : 'var(--color-text-primary)';
          let label;
          if (overdue)       label = `Debería estar hecha — entrega ${fmtD(r.deliveryD)}`;
          else if (todayDue) label = `Hacerla hoy — entrega ${fmtD(r.deliveryD)}`;
          else if (tomorDue) label = `Hacerla mañana — entrega ${fmtD(r.deliveryD)}`;
          else               label = `Antes del ${fmtD(r.deadline)} — entrega ${fmtD(r.deliveryD)}`;

          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--color-border-light)">
              <div>
                <div class="text-sm font-semibold" style="color:${color};text-transform:capitalize">${label}</div>
                <div class="text-xs" style="color:var(--color-text-muted);margin-top:2px">
                  ${r.bolsasPend} bolsa${r.bolsasPend !== 1 ? 's' : ''} de 1kg · ${r.harinaFinal}g harina → ${r.masaPendiente}g masa
                </div>
              </div>
              ${overdue  ? '<span class="badge badge-danger">Urgente</span>' : ''}
              ${todayDue ? '<span class="badge badge-warning">Hoy</span>'   : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ─── Pedidos pendientes agrupados por día ─────────────────────────────────────
  const STATUS_OPTS = [
    { val: 'pendiente',      label: 'Pendiente' },
    { val: 'en_preparacion', label: 'En preparación' },
    { val: 'listo',          label: 'Listo' },
    { val: 'entregado',      label: 'Entregado' },
  ];

  function setOrderStatus(id, status) {
    Store.orders.update(id, { status });
    const badge = document.getElementById('pendingBadge');
    if (badge) badge.textContent = Store.orders.where(o => o.status === 'pendiente').length;
    render(document.getElementById('pageContent'));
  }

  function renderPendingByDay() {
    // Muestra pendiente + en preparación + listo (activos, no entregados/cancelados)
    const active = Store.orders
      .where(o => ['pendiente', 'en_preparacion', 'listo'].includes(o.status))
      .sort((a, b) => (a.deliveryDate || a.date || '').localeCompare(b.deliveryDate || b.date || ''));

    if (active.length === 0) {
      return `
        <div class="card">
          <div class="card-header"><div class="card-title">Pedidos activos</div></div>
          <div class="empty-state" style="padding:var(--space-8)">
            <div class="empty-state-title">Sin pedidos pendientes</div>
          </div>
        </div>
      `;
    }

    const byDate = {};
    active.forEach(o => {
      const key = o.deliveryDate || o.date || '—';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(o);
    });

    const fmtDate = str => {
      if (!str || str === '—') return 'Sin fecha';
      try { return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); }
      catch { return str; }
    };

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Pedidos activos</div>
            <div class="card-subtitle">${active.length} pedido${active.length !== 1 ? 's' : ''} sin entregar</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('orders')">Ver todos</button>
        </div>
        ${Object.entries(byDate).map(([date, orders]) => `
          <div style="margin-bottom:var(--space-5)">
            <div style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:var(--space-2);border-bottom:2px solid var(--color-border-light);margin-bottom:var(--space-2);text-transform:capitalize">
              ${fmtDate(date)}
            </div>
            ${orders.map(o => {
              const lines = (o.items || [])
                .map(i => `${i.qty}× <strong>${i.format || ''}</strong>${i.flavor ? ' — ' + i.flavor : ''}`)
                .join('<br>');
              return `
                <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light);gap:var(--space-3)">
                  <div class="text-sm" style="line-height:1.7;flex:1">${lines}</div>
                  <select class="form-select" style="flex-shrink:0;width:auto;min-width:130px;height:28px;font-size:var(--text-xs);padding:0 var(--space-2)"
                    onchange="DashboardModule.setOrderStatus(${o.id}, this.value)">
                    ${STATUS_OPTS.map(s => `<option value="${s.val}" ${o.status === s.val ? 'selected' : ''}>${s.label}</option>`).join('')}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── Render principal ────────────────────────────────────────────────────────
  function render(container) {
    const stats    = Store.stats();
    const lowStock = Store.ingredients.where(i => i.stock <= i.minStock * 1.3);
    const gasCount = Store.orders.where(o => o.fromGAS).length;

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Buen día</h1>
            <p class="page-subtitle">
              Resumen del emprendimiento
              ${gasCount > 0 ? `· <span class="text-primary font-medium">${gasCount} pedido${gasCount !== 1 ? 's' : ''} vía Google Sheets</span>` : ''}
            </p>
          </div>
        </div>

        <!-- Recordatorio de masa — primero -->
        ${renderMasaReminder()}

        <!-- KPI Cards -->
        <div class="grid-4" style="margin-bottom:var(--space-6)">
          <div class="stat-card" style="--stat-color:var(--color-primary)">
            <div class="stat-label">Ingresos del mes</div>
            <div class="stat-value">${fmt(stats.revenue)}</div>
            <div class="stat-meta">Pedidos cobrados</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-accent)">
            <div class="stat-label">Ganancia neta</div>
            <div class="stat-value">${fmt(stats.profit)}</div>
            <div class="stat-meta">Gastos: ${fmt(stats.monthExpenses)}</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-warning)">
            <div class="stat-label">Pedidos pendientes</div>
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-meta">De ${stats.totalOrders} este mes</div>
          </div>
          <div class="stat-card" style="--stat-color:${stats.lowStock > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">
            <div class="stat-label">Stock bajo</div>
            <div class="stat-value">${stats.lowStock}</div>
            <div class="stat-meta">${stats.lowStock === 0 ? 'Inventario OK' : 'Ingredientes por reponer'}</div>
          </div>
        </div>

        <!-- Pedidos activos + Alertas de stock -->
        <div class="grid-2" style="align-items:start">

          ${renderPendingByDay()}

          <!-- Alertas de stock -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Alertas de inventario</div>
                <div class="card-subtitle">Ingredientes a reponer</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('inventory')">Ver todo</button>
            </div>
            ${lowStock.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-8)">
                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div class="empty-state-title">Todo en orden</div>
                <p class="empty-state-text">No hay ingredientes con stock bajo.</p>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:var(--space-3)">
                ${lowStock.slice(0, 6).map(i => {
                  const pct   = Math.min(100, Math.round((i.stock / i.minStock) * 100));
                  const isLow = i.stock <= i.minStock;
                  return `
                    <div>
                      <div class="d-flex items-center justify-between" style="margin-bottom:var(--space-1)">
                        <span class="text-sm font-medium">${i.name}</span>
                        <span class="text-xs ${isLow ? 'text-danger' : 'text-warning'}">${i.stock} ${i.unit} / mín ${i.minStock}</span>
                      </div>
                      <div class="progress">
                        <div class="progress-bar" style="width:${pct}%;background:${isLow ? 'var(--color-danger)' : 'var(--color-warning)'}"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  return { render, setOrderStatus };
})();
