const ProductionModule = (() => {

  // ─── Constantes de receta ─────────────────────────────────────────────────────
  const MASA_G = { familiar: 900, individual: 280 };
  const MASA_POR_BOLSA  = 955;  // gramos de masa por cada bolsa de 500g harina
  const HARINA_POR_BOLSA = 500; // gramos de harina por bolsa (unidad de trabajo)

  // ─── Detección de individual de regalo ───────────────────────────────────────
  function tieneRegalo(flavor) {
    const f = (flavor || '').toLowerCase();
    return f.includes('regalo') && !f.includes('sin individual');
  }

  // ─── Cálculo del plan de producción ──────────────────────────────────────────
  function computePlan() {
    const pending = Store.orders.where(o => o.status === 'pendiente');
    const logs    = Store.masaLog.all();
    const byDate  = {};

    pending.forEach(order => {
      const date = order.deliveryDate || order.date || '—';
      if (!byDate[date]) byDate[date] = { familiares: 0, individuales: 0, regalo: 0, pedidos: 0 };
      byDate[date].pedidos++;

      (order.items || []).forEach(item => {
        const fmt = (item.format || '').toLowerCase();
        const qty = item.qty || 1;
        if (fmt === 'familiar') {
          byDate[date].familiares += qty;
          if (tieneRegalo(item.flavor)) byDate[date].regalo += qty;
        } else if (fmt === 'individual') {
          byDate[date].individuales += qty;
        }
      });
    });

    return Object.entries(byDate).map(([date, c]) => {
      const masaNeta    = c.familiares * MASA_G.familiar
                        + (c.individuales + c.regalo) * MASA_G.individual;
      const bolsas      = Math.ceil(masaNeta / MASA_POR_BOLSA);
      const masaFinal   = bolsas * MASA_POR_BOLSA;
      const harinaFinal = bolsas * HARINA_POR_BOLSA;

      const masaHecha = logs
        .filter(l => l.deliveryDate === date)
        .reduce((s, l) => s + (l.grams || 0), 0);

      const masaPendiente  = Math.max(0, masaFinal - masaHecha);
      const bolsasPendientes = Math.ceil(masaPendiente / MASA_POR_BOLSA);

      return {
        date, counts: c,
        masaNeta, bolsas, masaFinal, harinaFinal,
        masaHecha, masaPendiente, bolsasPendientes,
        completa: masaHecha >= masaFinal && masaFinal > 0,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ─── Formateo de fecha ────────────────────────────────────────────────────────
  function fmtDate(str) {
    if (!str || str === '—') return str;
    try {
      return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
    } catch { return str; }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render(container) {
    const plan = computePlan();

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Producción</h1>
            <p class="page-subtitle">Masa necesaria para pedidos pendientes · redondeado a bolsas de 500g</p>
          </div>
        </div>

        ${plan.length === 0 ? `
          <div class="card">
            <div class="empty-state">
              <div class="empty-state-title">Sin pedidos pendientes</div>
              <p class="empty-state-text">
                Cuando tengas pedidos en estado "pendiente", acá vas a ver cuánta masa preparar y para qué día.
              </p>
            </div>
          </div>
        ` : plan.map(p => renderDayCard(p)).join('')}
      </div>
    `;
  }

  function renderDayCard(p) {
    const c = p.counts;
    const detalleItems = [
      c.familiares  ? `${c.familiares}× Familiar`    : '',
      c.individuales ? `${c.individuales}× Individual` : '',
      c.regalo      ? `+ ${c.regalo}× Individual de regalo` : '',
    ].filter(Boolean);

    const summaryColor = p.completa
      ? 'var(--color-success)'
      : p.masaHecha > 0
        ? 'var(--color-warning)'
        : 'var(--color-primary-dark)';

    const summaryBg = p.completa
      ? 'var(--color-success-subtle, #f0faf0)'
      : 'var(--color-primary-subtle)';

    return `
      <div class="card" style="margin-bottom:var(--space-4)${p.completa ? ';opacity:0.65' : ''}">
        <div class="card-header">
          <div>
            <div class="card-title" style="text-transform:capitalize">${fmtDate(p.date)}</div>
            <div class="card-subtitle">
              ${p.counts.pedidos} pedido${p.counts.pedidos !== 1 ? 's' : ''}
              · ${c.familiares + c.individuales + c.regalo} unidad${(c.familiares + c.individuales + c.regalo) !== 1 ? 'es' : ''} a producir
            </div>
          </div>
          <div class="d-flex gap-2 items-center">
            ${p.completa
              ? `<span class="badge badge-success">Masa lista ✓</span>
                 <button class="btn btn-xs btn-ghost" onclick="ProductionModule.clearMasa('${p.date}')">Reiniciar</button>`
              : `<button class="btn btn-sm btn-primary" onclick="ProductionModule.logMasa('${p.date}', ${p.bolsasPendientes || p.bolsas})">Registrar masa hecha</button>`
            }
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);padding:var(--space-1) 0 var(--space-4)">
          <div>
            <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">Detalle</div>
            ${detalleItems.map((d, i) => `
              <div class="text-sm" style="${i === 2 ? 'color:var(--color-primary);font-weight:500' : ''}">${d}</div>
            `).join('')}
          </div>
          <div>
            <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">Masa</div>
            <div class="text-sm">Necesaria exacta: <strong>${p.masaNeta}g</strong></div>
            <div class="text-sm">Con margen (↑ bolsa): <strong>${p.masaFinal}g</strong> (${p.bolsas} bolsa${p.bolsas !== 1 ? 's' : ''} · ${p.harinaFinal}g harina)</div>
            ${p.masaHecha > 0 ? `
              <div class="text-sm" style="color:var(--color-success);margin-top:var(--space-1)">✓ Ya hecha: ${p.masaHecha}g (${Math.round(p.masaHecha / MASA_POR_BOLSA)} bolsa${Math.round(p.masaHecha / MASA_POR_BOLSA) !== 1 ? 's' : ''})</div>
            ` : ''}
            ${!p.completa && p.masaHecha > 0 ? `
              <div class="text-sm font-semibold" style="color:var(--color-warning)">Falta: ${p.masaPendiente}g (${p.bolsasPendientes} bolsa${p.bolsasPendientes !== 1 ? 's' : ''})</div>
            ` : ''}
          </div>
        </div>

        <div style="background:${summaryBg};border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);font-size:var(--text-sm);font-weight:600;color:${summaryColor}">
          ${p.completa
            ? `✓ Masa completa — todo listo para ${fmtDate(p.date)}`
            : p.masaHecha > 0
              ? `Todavía falta hacer: ${p.bolsasPendientes} bolsa${p.bolsasPendientes !== 1 ? 's' : ''} de harina (${p.bolsasPendientes * HARINA_POR_BOLSA}g harina → ${p.masaPendiente}g masa)`
              : `Preparar: ${p.bolsas} bolsa${p.bolsas !== 1 ? 's' : ''} de harina (${p.harinaFinal}g harina → ${p.masaFinal}g masa)`
          }
        </div>
      </div>
    `;
  }

  // ─── Registrar masa hecha ─────────────────────────────────────────────────────
  function logMasa(deliveryDate, bolsasSugeridas) {
    App.openModal({
      title: 'Registrar masa hecha',
      size: 'modal-sm',
      body: `
        <p class="text-sm" style="color:var(--color-text-secondary);margin-bottom:var(--space-4)">
          Fecha de entrega: <strong style="text-transform:capitalize">${fmtDate(deliveryDate)}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Bolsas de 500g harina usadas</label>
          <input class="form-input" id="fMasaBolsas" type="number" min="1" step="1"
            value="${bolsasSugeridas}"
            oninput="document.getElementById('fMasaCalc').textContent = (parseInt(this.value)||0) * ${MASA_POR_BOLSA} + 'g de masa · ' + (parseInt(this.value)||0) * ${HARINA_POR_BOLSA} + 'g harina'" />
          <div class="form-hint" id="fMasaCalc">${bolsasSugeridas * MASA_POR_BOLSA}g de masa · ${bolsasSugeridas * HARINA_POR_BOLSA}g harina</div>
        </div>
      `,
      primaryLabel: 'Registrar',
      onConfirm: () => {
        const bolsas = parseInt(document.getElementById('fMasaBolsas').value) || 0;
        if (bolsas <= 0) { App.toast('error', 'Ingresá la cantidad de bolsas'); return false; }
        const grams = bolsas * MASA_POR_BOLSA;
        Store.masaLog.create({ deliveryDate, grams, bolsas });
        App.toast('success', `${bolsas} bolsa${bolsas !== 1 ? 's' : ''} registrada${bolsas !== 1 ? 's' : ''} — ${grams}g de masa`);
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  // ─── Reiniciar masa de una fecha ──────────────────────────────────────────────
  function clearMasa(deliveryDate) {
    if (!confirm(`¿Reiniciar el registro de masa para ${fmtDate(deliveryDate)}?`)) return;
    Store.masaLog.where(l => l.deliveryDate === deliveryDate)
      .forEach(l => Store.masaLog.remove(l.id));
    render(document.getElementById('pageContent'));
  }

  return { render, logMasa, clearMasa };
})();
