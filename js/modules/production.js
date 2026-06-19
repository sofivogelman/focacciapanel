const ProductionModule = (() => {

  const MASA_G = { grande: 900, mediana: 350, chica: 280 };
  const MASA_POR_BOLSA   = 1910;
  const HARINA_POR_BOLSA = 1000;

  const _PROMOS_JSON = 'https://raw.githubusercontent.com/sofivogelman/focacciapanel/main/promos.json';
  let   _promosCache = [];
  (async () => {
    try {
      const d = await fetch(_PROMOS_JSON + '?t=' + Date.now()).then(r => r.json());
      _promosCache = (d.promos || []).filter(p => p.active);
    } catch(e) {}
  })();

  function tieneRegalo(flavor) {
    const f = (flavor || '').toLowerCase();
    return f.includes('regalo') && !f.includes('sin individual') && !f.includes('romero');
  }

  // Devuelve gramos para un nombre de formato — compatible con nombres viejos y nuevos
  function getMasaGrams(formatName) {
    const stored = Store.formats.where(f => f.name === formatName)[0];
    if (stored?.grams) return stored.grams;
    const n = (formatName || '').toLowerCase();
    if (n.includes('puglia') || n.includes('familiar') || n.includes('messi')) return MASA_G.grande;
    if (n.includes('amalfi') || n.includes('17')       || n.includes('dibu'))  return MASA_G.mediana;
    if (n.includes('capri')  || n.includes('individual') || n.includes('enzo')) return MASA_G.chica;
    return 0;
  }

  // Gramos para un ítem de pedido — maneja formatos normales Y promos
  function getMasaParaItem(formatName) {
    const base = getMasaGrams(formatName);
    if (base) return base;
    const promo = Store.promos.where(p => p.name === formatName)[0]
               || _promosCache.find(p => p.name === formatName);
    if (!promo) return 0;
    if (promo.grams) return promo.grams;
    return (promo.items || []).reduce((s, pi) => s + getMasaGrams(pi.format) * (pi.qty || 1), 0);
  }

  // ─── Masa total acumulada en el log ──────────────────────────────────────────
  function getMasaTotal() {
    return Store.masaLog.all().reduce((s, l) => s + (l.grams || 0), 0);
  }

  // Fecha local del registro más antiguo en masaLog (YYYY-MM-DD), o null si no hay registros
  function getTrackingStart() {
    const logs = Store.masaLog.all();
    if (!logs.length) return null;
    const earliest = logs.reduce((min, l) => Math.min(min, l.createdAt || 0), Infinity);
    const d = new Date(earliest);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Devuelve el nombre de formato o promo a usar para el cálculo de masa
  function resolveFormatKey(item) {
    return (item.format || '').toLowerCase() === 'promo' ? (item.flavor || '') : (item.format || '');
  }

  // ─── Gramos de masa para un conjunto de pedidos ───────────────────────────────
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

  // ─── Pedidos activos agrupados por fecha de entrega ──────────────────────────
  function getPedidosPorFecha() {
    const active = Store.orders.where(o =>
      o.status !== 'cancelado' && o.status !== 'entregado'
    );
    const byDate = {};
    active.forEach(order => {
      const date = order.deliveryDate || order.date || '—';
      if (!byDate[date]) byDate[date] = { pedidos: [], grams: 0 };
      byDate[date].pedidos.push(order);
      (order.items || []).forEach(item => {
        const qty = item.qty || 1;
        const key = resolveFormatKey(item);
        byDate[date].grams += qty * getMasaParaItem(key);
        const n = (item.format || '').toLowerCase();
        if ((n.includes('puglia') || n.includes('familiar') || n.includes('messi')) && tieneRegalo(item.flavor)) {
          byDate[date].grams += qty * MASA_G.chica;
        }
      });
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }));
  }

  function toBolsas(grams) { return Math.ceil(grams / MASA_POR_BOLSA); }

  function fmtDate(str) {
    if (!str || str === '—') return str;
    try {
      return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
    } catch { return str; }
  }

  // ─── Render principal ─────────────────────────────────────────────────────────
  function render(container) {
    const masaTotal     = getMasaTotal();
    const trackingStart = getTrackingStart();
    const masaConsumida = trackingStart
      ? masaDeOrders(Store.orders.where(o => o.status === 'entregado' && (o.deliveryDate || o.date || '') >= trackingStart))
      : 0;
    const masaComprometida = masaDeOrders(Store.orders.where(o => o.status !== 'cancelado' && o.status !== 'entregado'));
    const masaEnStock      = masaTotal - masaConsumida;   // lo que físicamente queda
    const masaLibre        = masaEnStock - masaComprometida; // libre para nuevos pedidos
    const deficit          = masaLibre < 0;
    const bolsasFaltan     = deficit ? toBolsas(Math.abs(masaLibre)) : 0;
    const porFecha         = getPedidosPorFecha();

    const fmtBolsas = g => {
      if (g <= 0) return '0';
      const b = g / MASA_POR_BOLSA;
      return b % 1 === 0 ? b.toString() : b.toFixed(1);
    };

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Producción</h1>
            <p class="page-subtitle">Stock de masa · bolsas de 1kg harina</p>
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary" onclick="ProductionModule.openAjusteModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Ajustar stock
            </button>
            <button class="btn btn-primary" onclick="ProductionModule.openMasaModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Registrar masa hecha
            </button>
          </div>
        </div>

        <!-- Resumen stock -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);padding:var(--space-2) 0">
            <div>
              <div class="stat-label">En stock</div>
              <div class="stat-value" style="font-size:var(--text-2xl)">${fmtBolsas(masaEnStock)} bolsas</div>
              <div class="stat-meta">${masaEnStock}g · ${fmtBolsas(masaConsumida)} usadas en entregas</div>
            </div>
            <div>
              <div class="stat-label">Comprometida</div>
              <div class="stat-value" style="font-size:var(--text-2xl)">${fmtBolsas(masaComprometida)} bolsas</div>
              <div class="stat-meta">${masaComprometida}g · ${porFecha.length} fecha${porFecha.length !== 1 ? 's' : ''} activa${porFecha.length !== 1 ? 's' : ''}</div>
            </div>
            <div>
              <div class="stat-label">Libre</div>
              <div class="stat-value" style="font-size:var(--text-2xl);color:${deficit ? 'var(--color-danger)' : masaLibre === 0 && masaEnStock > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">
                ${deficit ? '−' + fmtBolsas(Math.abs(masaLibre)) : fmtBolsas(masaLibre)} bolsas
              </div>
              <div class="stat-meta">${deficit ? Math.abs(masaLibre) + 'g de déficit' : masaLibre + 'g disponibles'}</div>
            </div>
          </div>

          ${deficit ? `
            <div style="margin-top:var(--space-4);background:var(--color-danger-bg);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-danger)">Necesitás hacer más masa</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">
                  Faltan <strong>${bolsasFaltan} bolsa${bolsasFaltan !== 1 ? 's' : ''}</strong> (${Math.abs(masaLibre)}g) para cubrir todos los pedidos activos
                </div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="ProductionModule.openMasaModal()">Registrar</button>
            </div>
          ` : masaEnStock > 0 ? `
            <div style="margin-top:var(--space-4);background:var(--color-success-bg,#edf5ea);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4)">
              <div style="font-size:var(--text-sm);font-weight:500;color:var(--color-success)">✓ Masa suficiente para todos los pedidos activos</div>
            </div>
          ` : `
            <div style="margin-top:var(--space-4);background:var(--color-bg);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4)">
              <div style="font-size:var(--text-sm);color:var(--color-text-muted)">Registrá la masa que hiciste para llevar el stock.</div>
            </div>
          `}
        </div>

        <!-- Pedidos que cuentan en "comprometida" -->
        ${renderPedidosComprometidos()}

        <!-- Historial de masa -->
        ${renderMasaLog()}
      </div>
    `;
  }

  // ─── Pedidos contados en masa comprometida ───────────────────────────────────
  function renderPedidosComprometidos() {
    const STATUS_LABEL = {
      pendiente:      ['badge-warning',  'Pendiente'],
      en_preparacion: ['badge-info',     'En preparación'],
      listo:          ['badge-primary',  'Listo'],
    };

    const activos = Store.orders
      .where(o => o.status !== 'cancelado' && o.status !== 'entregado')
      .sort((a, b) => (a.deliveryDate || a.date || '').localeCompare(b.deliveryDate || b.date || ''));

    if (!activos.length) return '';

    const rows = activos.map(o => {
      const masaO = masaDeOrders([o]);
      const [badgeCls, badgeLabel] = STATUS_LABEL[o.status] || ['badge-default', o.status];
      const itemsStr = (o.items || [])
        .map(i => {
          const key = resolveFormatKey(i);
          const g   = getMasaParaItem(key);
          return `${i.qty||1}× ${key || i.name || '?'} (${g * (i.qty||1)}g)`;
        })
        .join(', ') || '—';
      const entrega = o.deliveryDate
        ? new Date(o.deliveryDate + 'T12:00:00').toLocaleDateString('es-AR', { day:'numeric', month:'short' })
        : '—';

      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:var(--border-light)">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">
              <span style="font-size:var(--text-sm);font-weight:500">${o.clientName || '—'}</span>
              <span class="badge ${badgeCls}" style="font-size:10px">${badgeLabel}</span>
            </div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">
              Entrega: ${entrega} · ${itemsStr} · <strong>${masaO}g</strong>
            </div>
          </div>
          <button class="btn btn-xs btn-secondary" onclick="ProductionModule.marcarEntregado(${o.id})" title="Marcar como entregado">
            Entregado ✓
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header">
          <div>
            <div class="card-title">Pedidos contados en masa comprometida</div>
            <div class="card-subtitle">Estos ${activos.length} pedido${activos.length !== 1 ? 's' : ''} no están marcados como entregados ni cancelados</div>
          </div>
        </div>
        <div>${rows}</div>
      </div>
    `;
  }

  function renderMasaLog() {
    const logs = Store.masaLog.all()
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!logs.length) return '';

    const rows = logs.map(l => {
      const bolsas = l.bolsas != null ? l.bolsas : Math.round(l.grams / MASA_POR_BOLSA * 10) / 10;
      const fecha  = l.createdAt
        ? new Date(l.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
        : l.deliveryDate ? 'Para ' + fmtDate(l.deliveryDate) : '—';
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);background:var(--color-bg);border-radius:var(--radius-sm)">
          <div style="flex:1">
            <span style="font-size:var(--text-sm);font-weight:500">${bolsas} bolsa${bolsas !== 1 ? 's' : ''}</span>
            <span style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:var(--space-2)">${l.grams}g</span>
            ${l.notes ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:var(--space-2)">· ${l.notes}</span>` : ''}
          </div>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fecha}</span>
          <button class="btn btn-xs btn-ghost" style="color:var(--color-text-muted)" onclick="ProductionModule.removeLog(${l.id})" title="Eliminar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Historial de masa</div>
          <button class="btn btn-xs btn-ghost" style="color:var(--color-text-muted)" onclick="ProductionModule.clearAllMasa()">Limpiar todo</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">${rows}</div>
      </div>
    `;
  }

  // ─── Modal: registrar masa hecha ─────────────────────────────────────────────
  function openMasaModal() {
    App.openModal({
      title: 'Registrar masa hecha',
      body: `
        <div class="form-group">
          <label class="form-label">¿Cuántas bolsas de 1kg harina hiciste?</label>
          <input class="form-input" id="fMasaBolsas" type="number" min="0.5" step="0.5" value="1"
            style="font-size:var(--text-xl);text-align:center;height:52px" />
          <div class="form-hint">1 bolsa = ${HARINA_POR_BOLSA}g harina → ${MASA_POR_BOLSA}g masa</div>
        </div>
        <div class="form-group">
          <label class="form-label">Notas <span>opcional</span></label>
          <input class="form-input" id="fMasaNotes" type="text" placeholder="ej: masa de romero, lote especial…" />
        </div>
      `,
      primaryLabel: 'Registrar',
      onConfirm: () => {
        const bolsas = parseFloat(document.getElementById('fMasaBolsas').value) || 0;
        if (bolsas <= 0) { App.toast('error', 'Ingresá la cantidad de bolsas'); return false; }
        const notes = document.getElementById('fMasaNotes')?.value.trim() || '';
        Store.masaLog.create({
          bolsas,
          grams: Math.round(bolsas * MASA_POR_BOLSA),
          notes,
          createdAt: Date.now(),
        });
        App.toast('success', `${bolsas} bolsa${bolsas !== 1 ? 's' : ''} registrada${bolsas !== 1 ? 's' : ''} — stock actualizado`);
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────────
  function removeLog(id) {
    if (!confirm('¿Eliminar este registro de masa?')) return;
    Store.masaLog.remove(id);
    render(document.getElementById('pageContent'));
  }

  function clearAllMasa() {
    if (!confirm('¿Limpiar todo el historial de masa? El stock vuelve a cero.')) return;
    Store.masaLog.all().forEach(l => Store.masaLog.remove(l.id));
    render(document.getElementById('pageContent'));
  }

  // ─── Modal: ajuste manual de stock ───────────────────────────────────────────
  function openAjusteModal() {
    const masaTotal     = getMasaTotal();
    const trackingStart = getTrackingStart();
    const masaConsumida = trackingStart
      ? masaDeOrders(Store.orders.where(o => o.status === 'entregado' && (o.deliveryDate || o.date || '') >= trackingStart))
      : 0;
    const masaEnStock = masaTotal - masaConsumida;
    const stockActualBolsas = masaEnStock > 0 ? (masaEnStock / MASA_POR_BOLSA).toFixed(1) : '0';

    App.openModal({
      title: 'Ajustar stock de masa',
      body: `
        <div class="form-group">
          <div style="background:var(--color-bg);border-radius:var(--radius-sm);padding:var(--space-3);margin-bottom:var(--space-3);font-size:var(--text-sm);color:var(--color-text-secondary)">
            Stock calculado actualmente: <strong>${stockActualBolsas} bolsas</strong>
          </div>
          <label class="form-label">¿Cuántas bolsas de harina tenés físicamente ahora?</label>
          <input class="form-input" id="fAjusteBolsas" type="number" min="0" step="0.5" value="${stockActualBolsas}"
            style="font-size:var(--text-xl);text-align:center;height:52px" />
          <div class="form-hint">1 bolsa = ${HARINA_POR_BOLSA}g harina → ${MASA_POR_BOLSA}g masa. Se agrega una corrección al historial.</div>
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        const nuevasBolsas = parseFloat(document.getElementById('fAjusteBolsas').value);
        if (isNaN(nuevasBolsas) || nuevasBolsas < 0) { App.toast('error', 'Ingresá una cantidad válida'); return false; }
        const nuevoGrams  = Math.round(nuevasBolsas * MASA_POR_BOLSA);
        const corrGrams   = nuevoGrams - masaEnStock;
        if (corrGrams === 0) { App.toast('success', 'Sin cambios necesarios'); return true; }
        Store.masaLog.create({
          bolsas: corrGrams / MASA_POR_BOLSA,
          grams:  corrGrams,
          notes:  'Ajuste manual de stock',
          createdAt: Date.now(),
        });
        App.toast('success', 'Stock ajustado a ' + nuevasBolsas + ' bolsas');
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  function marcarEntregado(id) {
    Store.orders.update(id, { status: 'entregado' });
    App.toast('success', 'Pedido marcado como entregado');
    render(document.getElementById('pageContent'));
  }

  return { render, openMasaModal, openAjusteModal, removeLog, clearAllMasa, marcarEntregado, openCreateModal: openMasaModal };
})();
