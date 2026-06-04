const ProductionModule = (() => {

  const MASA_G = { familiar: 900, individual: 280 };
  const MASA_POR_BOLSA   = 1910;
  const HARINA_POR_BOLSA = 1000;

  function tieneRegalo(flavor) {
    const f = (flavor || '').toLowerCase();
    return f.includes('regalo') && !f.includes('sin individual') && !f.includes('romero');
  }

  // ─── Masa total acumulada en el log ──────────────────────────────────────────
  function getMasaTotal() {
    return Store.masaLog.all().reduce((s, l) => s + (l.grams || 0), 0);
  }

  // ─── Masa comprometida por pedidos activos (no entregados ni cancelados) ─────
  function getMasaNecesaria() {
    const active = Store.orders.where(o =>
      o.status !== 'cancelado' && o.status !== 'entregado'
    );
    let grams = 0;
    active.forEach(order => {
      (order.items || []).forEach(item => {
        const fmt = (item.format || '').toLowerCase();
        const qty = item.qty || 1;
        if (fmt === 'familiar') {
          grams += qty * MASA_G.familiar;
          if (tieneRegalo(item.flavor)) grams += qty * MASA_G.individual;
        } else if (fmt === 'individual') {
          grams += qty * MASA_G.individual;
        }
      });
    });
    return grams;
  }

  // ─── Pedidos activos agrupados por fecha de entrega ──────────────────────────
  function getPedidosPorFecha() {
    const active = Store.orders.where(o =>
      o.status !== 'cancelado' && o.status !== 'entregado'
    );
    const byDate = {};
    active.forEach(order => {
      const date = order.deliveryDate || order.date || '—';
      if (!byDate[date]) byDate[date] = { pedidos: [], grams: 0, familiares: 0, individuales: 0, regalo: 0 };
      byDate[date].pedidos.push(order);
      (order.items || []).forEach(item => {
        const fmt = (item.format || '').toLowerCase();
        const qty = item.qty || 1;
        if (fmt === 'familiar') {
          byDate[date].familiares += qty;
          byDate[date].grams += qty * MASA_G.familiar;
          if (tieneRegalo(item.flavor)) {
            byDate[date].regalo += qty;
            byDate[date].grams += qty * MASA_G.individual;
          }
        } else if (fmt === 'individual') {
          byDate[date].individuales += qty;
          byDate[date].grams += qty * MASA_G.individual;
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
    const masaNecesaria = getMasaNecesaria();
    const masaLibre     = masaTotal - masaNecesaria;
    const deficit       = masaLibre < 0;
    const bolsasFaltan  = deficit ? toBolsas(Math.abs(masaLibre)) : 0;
    const porFecha      = getPedidosPorFecha();

    const fmtBolsas = g => {
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
          <button class="btn btn-primary" onclick="ProductionModule.openMasaModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Registrar masa hecha
          </button>
        </div>

        <!-- Resumen stock -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);padding:var(--space-2) 0">
            <div>
              <div class="stat-label">Masa hecha</div>
              <div class="stat-value" style="font-size:var(--text-2xl)">${fmtBolsas(masaTotal)} bolsas</div>
              <div class="stat-meta">${masaTotal}g acumulados</div>
            </div>
            <div>
              <div class="stat-label">Comprometida</div>
              <div class="stat-value" style="font-size:var(--text-2xl)">${fmtBolsas(masaNecesaria)} bolsas</div>
              <div class="stat-meta">${masaNecesaria}g · ${porFecha.length} fecha${porFecha.length !== 1 ? 's' : ''} activa${porFecha.length !== 1 ? 's' : ''}</div>
            </div>
            <div>
              <div class="stat-label">Disponible</div>
              <div class="stat-value" style="font-size:var(--text-2xl);color:${deficit ? 'var(--color-danger)' : masaLibre === 0 && masaTotal > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">
                ${deficit ? '−' + fmtBolsas(Math.abs(masaLibre)) : fmtBolsas(masaLibre)} bolsas
              </div>
              <div class="stat-meta">${deficit ? Math.abs(masaLibre) + 'g de déficit' : masaLibre + 'g libres'}</div>
            </div>
          </div>

          ${deficit ? `
            <div style="margin-top:var(--space-4);background:var(--color-danger-bg);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)">
              <div>
                <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-danger)">Necesitás hacer más masa</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">
                  Falta masa para <strong>${bolsasFaltan} bolsa${bolsasFaltan !== 1 ? 's' : ''}</strong> (${Math.abs(masaLibre)}g) para cubrir todos los pedidos activos
                </div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="ProductionModule.openMasaModal()">Registrar</button>
            </div>
          ` : masaTotal > 0 ? `
            <div style="margin-top:var(--space-4);background:var(--color-success-bg,#edf5ea);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4)">
              <div style="font-size:var(--text-sm);font-weight:500;color:var(--color-success)">✓ Masa suficiente para todos los pedidos activos</div>
            </div>
          ` : `
            <div style="margin-top:var(--space-4);background:var(--color-bg);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4)">
              <div style="font-size:var(--text-sm);color:var(--color-text-muted)">Registrá la masa que hiciste para llevar el stock.</div>
            </div>
          `}
        </div>

        <!-- Pedidos por fecha -->
        ${porFecha.length > 0 ? `
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card-header"><div class="card-title">Pedidos activos por fecha</div></div>
            ${porFecha.map((d, i) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0${i < porFecha.length - 1 ? ';border-bottom:var(--border-light)' : ''}">
                <div>
                  <div style="font-size:var(--text-sm);font-weight:500;text-transform:capitalize">${fmtDate(d.date)}</div>
                  <div style="font-size:var(--text-xs);color:var(--color-text-muted)">
                    ${d.pedidos.length} pedido${d.pedidos.length !== 1 ? 's' : ''}
                    ${d.familiares ? ' · ' + d.familiares + '× Familiar' : ''}
                    ${d.individuales ? ' · ' + d.individuales + '× Individual' : ''}
                    ${d.regalo ? ' · ' + d.regalo + '× regalo' : ''}
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:var(--text-sm);font-weight:500">${toBolsas(d.grams)} bolsa${toBolsas(d.grams) !== 1 ? 's' : ''}</div>
                  <div style="font-size:var(--text-xs);color:var(--color-text-muted)">${d.grams}g · ${toBolsas(d.grams) * HARINA_POR_BOLSA}g harina</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Historial de masa -->
        ${renderMasaLog()}
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

  return { render, openMasaModal, removeLog, clearAllMasa, openCreateModal: openMasaModal };
})();
