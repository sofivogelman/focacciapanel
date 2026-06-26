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

  // ─── Recordatorio de masa (modelo pool) ──────────────────────────────────────
  const _PROMOS_JSON_URL = 'https://raw.githubusercontent.com/sofivogelman/focacciapanel/main/promos.json';
  let   _promosCache = [];
  (async () => {
    try {
      const d = await fetch(_PROMOS_JSON_URL + '?t=' + Date.now()).then(r => r.json());
      _promosCache = (d.promos || []).filter(p => p.active);
    } catch(e) {}
  })();

  function renderMasaReminder() {
    const MASA_G         = { grande: 900, mediana: 350, chica: 280 };
    const MASA_POR_BOLSA = 1910;

    function tieneRegalo(flavor) {
      const f = (flavor || '').toLowerCase();
      return f.includes('regalo') && !f.includes('sin individual') && !f.includes('romero');
    }

    function getMasaGrams(formatName) {
      const stored = Store.formats.where(f => f.name === formatName)[0];
      if (stored?.grams) return stored.grams;
      const n = (formatName || '').toLowerCase();
      if (n.includes('puglia') || n.includes('familiar') || n.includes('messi')) return MASA_G.grande;
      if (n.includes('amalfi') || n.includes('17')       || n.includes('dibu'))  return MASA_G.mediana;
      if (n.includes('capri')  || n.includes('individual') || n.includes('enzo')) return MASA_G.chica;
      return 0;
    }

    function getMasaParaItem(formatName) {
      const base = getMasaGrams(formatName);
      if (base) return base;
      const fn = (formatName || '').toLowerCase();
      const matchPromo = p => {
        const pn = (p.name || '').toLowerCase();
        return pn && (pn === fn || fn.startsWith(pn) || pn.startsWith(fn));
      };
      const promo = Store.promos.where(p => p.name === formatName)[0]
                 || _promosCache.find(p => p.name === formatName)
                 || Store.promos.all().find(matchPromo)
                 || _promosCache.find(matchPromo);
      if (!promo) return 0;
      if (promo.grams) return promo.grams;
      return (promo.items || []).reduce((s, pi) => s + getMasaGrams(pi.format) * (pi.qty || 1), 0);
    }

    function resolveFormatKey(item) {
      return (item.format || '').toLowerCase() === 'promo' ? (item.flavor || '') : (item.format || '');
    }

    function masaDeOrders(orders) {
      let g = 0;
      orders.forEach(o => {
        (o.items || []).forEach(item => {
          const qty = item.qty || 1;
          const key = resolveFormatKey(item);
          g += qty * getMasaParaItem(key);
          const n = (item.format || '').toLowerCase();
          if ((n.includes('puglia') || n.includes('familiar') || n.includes('messi')) && tieneRegalo(item.flavor)) {
            g += qty * MASA_G.chica;
          }
        });
      });
      return g;
    }

    const masaTotal = Store.masaLog.all().reduce((s, l) => s + (l.grams || 0), 0);
    const logs = Store.masaLog.all();
    let trackingStart = null;
    if (logs.length) {
      const earliest = logs.reduce((min, l) => Math.min(min, l.createdAt || 0), Infinity);
      const d = new Date(earliest);
      trackingStart = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    const masaConsumida = trackingStart
      ? masaDeOrders(Store.orders.where(o => o.status === 'entregado' && (o.deliveryDate || o.date || '') >= trackingStart))
      : 0;
    const masaEnStock      = masaTotal - masaConsumida;
    const masaComprometida = masaDeOrders(Store.orders.where(o => o.status !== 'cancelado' && o.status !== 'entregado'));
    const masaLibre        = masaEnStock - masaComprometida;

    if (masaLibre >= 0 || masaComprometida === 0) return '';

    const bolsasFaltan = Math.ceil(Math.abs(masaLibre) / MASA_POR_BOLSA);

    return `
      <div class="card" style="margin-bottom:var(--space-6);border-color:var(--color-danger)">
        <div class="card-header">
          <div>
            <div class="card-title" style="color:var(--color-danger)">Necesitás hacer masa</div>
            <div class="card-subtitle">No alcanza para cubrir los pedidos activos</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('produccion')">Ver producción</button>
        </div>
        <div style="background:var(--color-danger-bg);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4)">
          <div style="font-size:var(--text-sm)">
            Faltan <strong>${bolsasFaltan} bolsa${bolsasFaltan !== 1 ? 's' : ''}</strong> de 1kg ·
            En stock: ${masaEnStock}g · Comprometida: ${masaComprometida}g
          </div>
        </div>
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

    function daySection(date, orders) {
      // Aggregate items across all orders for this day
      const itemMap = {};
      orders.forEach(o => {
        (o.items || []).forEach(i => {
          const flavor = (i.flavor || '').trim();
          const k = (i.format || '').toLowerCase() + '||' + flavor.toLowerCase();
          if (!itemMap[k]) itemMap[k] = { format: i.format || '', flavor, qty: 0 };
          itemMap[k].qty += (i.qty || 1);
        });
      });
      const itemLines = Object.values(itemMap)
        .map(i => `${i.qty}× <strong>${i.format}</strong>${i.flavor ? ' — ' + i.flavor : ''}`)
        .join('<br>');

      return `
        <div style="margin-bottom:var(--space-5)">
          <div style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:var(--space-2);border-bottom:2px solid var(--color-border-light);margin-bottom:var(--space-3);text-transform:capitalize">
            ${fmtDate(date)}
          </div>
          <div class="text-sm" style="line-height:2;padding-bottom:var(--space-3);border-bottom:1px solid var(--color-border-light);margin-bottom:var(--space-2)">${itemLines}</div>
          ${orders.map(o => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-1) 0;gap:var(--space-3)">
              <div class="text-xs" style="color:var(--color-text-muted);flex:1">${o.clientName || 'Pedido #' + o.id}</div>
              <select class="form-select" style="flex-shrink:0;width:auto;min-width:130px;height:28px;font-size:var(--text-xs);padding:0 var(--space-2)"
                onchange="DashboardModule.setOrderStatus(${o.id}, this.value)">
                ${STATUS_OPTS.map(s => `<option value="${s.val}" ${o.status === s.val ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Pedidos activos</div>
            <div class="card-subtitle">${active.length} pedido${active.length !== 1 ? 's' : ''} sin entregar</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('orders')">Ver todos</button>
        </div>
        ${Object.entries(byDate).map(([date, orders]) => daySection(date, orders)).join('')}
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
            <h1 class="page-title">Buen día 🌿</h1>
            <p class="page-subtitle">Resumen del emprendimiento</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="FinancesModule.openWithReceipt()">Subir comprobante</button>
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
