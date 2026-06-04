const ProductionModule = (() => {

  // ─── Constantes de receta ─────────────────────────────────────────────────────
  const MASA_G = { familiar: 900, individual: 280 };
  const MASA_POR_BOLSA   = 1910; // gramos de masa por cada bolsa de 1kg harina
  const HARINA_POR_BOLSA = 1000; // gramos de harina por bolsa (unidad de trabajo)

  // ─── Detección de individual de regalo ───────────────────────────────────────
  function tieneRegalo(flavor) {
    const f = (flavor || '').toLowerCase();
    return f.includes('regalo') && !f.includes('sin individual') && !f.includes('romero');
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

    let overflow = 0;

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, c]) => {
        const masaNeta    = c.familiares * MASA_G.familiar
                          + (c.individuales + c.regalo) * MASA_G.individual;
        const bolsas      = Math.ceil(masaNeta / MASA_POR_BOLSA);
        const masaFinal   = bolsas * MASA_POR_BOLSA;
        const harinaFinal = bolsas * HARINA_POR_BOLSA;

        const masaLograda = logs
          .filter(l => l.deliveryDate === date)
          .reduce((s, l) => s + (l.grams || 0), 0);

        const masaHecha    = masaLograda + overflow;
        const masaSobrante = Math.max(0, masaHecha - masaFinal);
        overflow           = masaSobrante;

        const masaPendiente    = Math.max(0, masaFinal - masaHecha);
        const bolsasPendientes = Math.ceil(masaPendiente / MASA_POR_BOLSA);

        return {
          date, counts: c,
          masaNeta, bolsas, masaFinal, harinaFinal,
          masaLograda, masaHecha, masaSobrante, masaPendiente, bolsasPendientes,
          completa: masaHecha >= masaFinal && masaFinal > 0,
        };
      });
  }

  // ─── Distribución de bolsas a días ───────────────────────────────────────────
  function calcDistribution(totalBolsas, plan) {
    let remaining = totalBolsas * MASA_POR_BOLSA;
    return plan.map(day => {
      const needed = Math.max(0, day.masaFinal - day.masaHecha);
      if (needed <= 0 || day.completa) return { ...day, bolsasAsig: 0, cubierto: true };
      const bolsasAsig = Math.min(Math.ceil(needed / MASA_POR_BOLSA), Math.ceil(remaining / MASA_POR_BOLSA));
      const gramsAsig  = bolsasAsig * MASA_POR_BOLSA;
      remaining       -= gramsAsig;
      if (remaining < 0) remaining = 0;
      return { ...day, bolsasAsig, cubierto: gramsAsig >= needed };
    });
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
    const plan     = computePlan();
    const pending  = plan.filter(p => !p.completa);
    const totalNec = pending.reduce((s, p) => s + p.bolsasPendientes, 0);

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Producción</h1>
            <p class="page-subtitle">Masa necesaria para pedidos pendientes · bolsas de 1kg</p>
          </div>
            <button class="btn btn-primary" onclick="ProductionModule.openMasaModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Registrar masa hecha
          </button>
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
      c.familiares   ? `${c.familiares}× Familiar`           : '',
      c.individuales ? `${c.individuales}× Individual`        : '',
      c.regalo       ? `+ ${c.regalo}× Individual de regalo`  : '',
    ].filter(Boolean);

    const summaryColor = p.completa
      ? 'var(--color-success)'
      : p.masaHecha > 0
        ? 'var(--color-warning)'
        : 'var(--color-primary-dark)';

    const summaryBg = p.completa
      ? 'var(--color-success-subtle, #f0faf0)'
      : 'var(--color-primary-subtle)';

    const overflowUsed = p.masaHecha - p.masaLograda;

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
              : `<span class="badge badge-warning">Faltan ${p.bolsasPendientes} bolsa${p.bolsasPendientes !== 1 ? 's' : ''}</span>`
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
            <div class="text-sm">Necesaria: <strong>${p.bolsas} bolsa${p.bolsas !== 1 ? 's' : ''}</strong> (${p.masaFinal}g · ${p.harinaFinal}g harina)</div>
            ${p.masaHecha > 0 ? `
              <div class="text-sm" style="color:var(--color-success);margin-top:var(--space-1)">
                ✓ Disponible: ${p.masaHecha}g
                ${overflowUsed > 0 ? `<span style="color:var(--color-text-muted);font-weight:400"> (incluye ${overflowUsed}g de día anterior)</span>` : ''}
              </div>
            ` : ''}
            ${!p.completa && p.masaHecha > 0 ? `
              <div class="text-sm font-semibold" style="color:var(--color-warning)">Falta: ${p.masaPendiente}g (${p.bolsasPendientes} bolsa${p.bolsasPendientes !== 1 ? 's' : ''})</div>
            ` : ''}
            ${p.masaSobrante > 0 ? `
              <div class="text-sm" style="color:var(--color-text-muted)">Sobrante → siguiente día: ${p.masaSobrante}g</div>
            ` : ''}
          </div>
        </div>

        <div style="background:${summaryBg};border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);font-size:var(--text-sm);font-weight:600;color:${summaryColor}">
          ${p.completa
            ? `✓ Masa completa — todo listo para ${fmtDate(p.date)}`
            : p.masaHecha > 0
              ? `Todavía falta: ${p.bolsasPendientes} bolsa${p.bolsasPendientes !== 1 ? 's' : ''} de 1kg`
              : `Necesitás: ${p.bolsas} bolsa${p.bolsas !== 1 ? 's' : ''} de 1kg (${p.harinaFinal}g harina → ${p.masaFinal}g masa)`
          }
        </div>
      </div>
    `;
  }

  // ─── Modal global: cuántas bolsas hice hoy ───────────────────────────────────
  function openMasaModal() {
    const plan       = computePlan();
    const pending    = plan.filter(p => !p.completa);
    const hasPending = pending.length > 0;
    const totalNec   = hasPending ? pending.reduce((s, p) => s + p.bolsasPendientes, 0) : 1;
    const todayISO   = new Date().toISOString().split('T')[0];

    App.openModal({
      title: 'Registrar masa hecha',
      body: `
        <div class="form-group">
          <label class="form-label">¿Cuántas bolsas de 1kg harina hiciste?</label>
          <input class="form-input" id="fMasaBolsas" type="number" min="1" step="1" value="${totalNec}"
            style="font-size:var(--text-xl);text-align:center;height:48px"
            ${hasPending ? `oninput="ProductionModule.previewDist(parseInt(this.value)||0)"` : ''} />
          <div class="form-hint">${hasPending
            ? `${totalNec} bolsa${totalNec !== 1 ? 's' : ''} necesarias para cubrir todos los pedidos pendientes`
            : 'Sin pedidos pendientes — elegí para qué entrega es esta masa'
          }</div>
        </div>
        ${!hasPending ? `
          <div class="form-group">
            <label class="form-label">Fecha de entrega</label>
            <input class="form-input" id="fMasaDate" type="date" value="${todayISO}" />
          </div>
        ` : ''}
        ${hasPending ? `<div id="masaDistPreview" style="margin-top:var(--space-4)"></div>` : ''}
      `,
      primaryLabel: hasPending ? 'Registrar y distribuir' : 'Registrar',
      onOpen: hasPending ? () => previewDist(totalNec) : null,
      onConfirm: () => {
        const bolsas = parseInt(document.getElementById('fMasaBolsas').value) || 0;
        if (bolsas <= 0) { App.toast('error', 'Ingresá la cantidad de bolsas'); return false; }
        if (!hasPending) {
          const date = document.getElementById('fMasaDate')?.value;
          if (!date) { App.toast('error', 'Elegí una fecha de entrega'); return false; }
          Store.masaLog.create({ deliveryDate: date, grams: bolsas * MASA_POR_BOLSA, bolsas });
          App.toast('success', `${bolsas} bolsa${bolsas !== 1 ? 's' : ''} registrada${bolsas !== 1 ? 's' : ''} para ${fmtDate(date)}`);
          render(document.getElementById('pageContent'));
          return true;
        }
        commitDistribution(bolsas);
        return true;
      },
    });
  }

  function previewDist(totalBolsas) {
    const el = document.getElementById('masaDistPreview');
    if (!el) return;
    if (!totalBolsas) { el.innerHTML = ''; return; }

    const plan    = computePlan();
    const pending = plan.filter(p => !p.completa);
    const dist    = calcDistribution(totalBolsas, pending);
    const cubiertos = dist.filter(d => d.bolsasAsig > 0);

    if (!cubiertos.length) { el.innerHTML = '<div class="text-sm text-muted">No hay pedidos pendientes para cubrir.</div>'; return; }

    const rows = dist.map(d => {
      const icon  = d.completa || (d.bolsasAsig > 0 && d.cubierto) ? '✓' : d.bolsasAsig > 0 ? '~' : '✗';
      const color = d.completa || d.cubierto ? 'var(--color-success)' : d.bolsasAsig > 0 ? 'var(--color-warning)' : 'var(--color-danger)';
      const label = d.completa
        ? 'Ya completo'
        : d.cubierto
          ? `${d.bolsasAsig} bolsa${d.bolsasAsig !== 1 ? 's' : ''} → cubierto`
          : d.bolsasAsig > 0
            ? `${d.bolsasAsig} bolsa${d.bolsasAsig !== 1 ? 's' : ''} parcial — falta masa`
            : `Sin masa — faltan ${d.bolsasPendientes} bolsa${d.bolsasPendientes !== 1 ? 's' : ''}`;
      return `
        <div class="d-flex items-center gap-3" style="padding:var(--space-2) 0;border-bottom:var(--border-light)">
          <span style="font-size:16px;color:${color};min-width:20px;text-align:center">${icon}</span>
          <div class="flex-1">
            <div class="text-sm font-medium" style="text-transform:capitalize">${fmtDate(d.date)}</div>
            <div class="text-xs text-muted">${d.counts.pedidos} pedido${d.counts.pedidos !== 1 ? 's' : ''} · ${d.bolsas} bolsa${d.bolsas !== 1 ? 's' : ''} necesarias</div>
          </div>
          <div class="text-sm" style="color:${color};font-weight:500;text-align:right">${label}</div>
        </div>
      `;
    }).join('');

    const sobranteTotal = totalBolsas * MASA_POR_BOLSA - dist.reduce((s, d) => s + d.bolsasAsig * MASA_POR_BOLSA, 0);

    el.innerHTML = `
      <div style="background:var(--color-bg);border-radius:var(--radius-sm);border:var(--border-light);padding:var(--space-3) var(--space-4)">
        <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">Distribución</div>
        ${rows}
        ${sobranteTotal > 0 ? `
          <div class="text-xs text-muted" style="margin-top:var(--space-3)">Sobrante después de distribuir: ${Math.round(sobranteTotal)}g</div>
        ` : ''}
      </div>
    `;
  }

  function commitDistribution(totalBolsas) {
    const plan    = computePlan();
    const pending = plan.filter(p => !p.completa);
    const dist    = calcDistribution(totalBolsas, pending);

    dist.forEach(d => {
      if (d.bolsasAsig > 0) {
        Store.masaLog.create({ deliveryDate: d.date, grams: d.bolsasAsig * MASA_POR_BOLSA, bolsas: d.bolsasAsig });
      }
    });

    // Descontar TODOS los ingredientes de masa según las unidades reales de cada día
    const totalNeeded = {};
    dist.forEach(d => {
      if (d.bolsasAsig <= 0) return;
      const day = plan.find(p => p.date === d.date);
      if (!day) return;
      const { familiares, individuales, regalo } = day.counts;
      ['familiar', 'individual'].forEach(fmt => {
        const units = fmt === 'familiar' ? familiares : (individuales + regalo);
        if (!units) return;
        Store.recipes.where(r => r.formatName.toLowerCase() === fmt).forEach(r => {
          totalNeeded[r.ingredientId] = (totalNeeded[r.ingredientId] || 0) + r.qty * units;
        });
      });
    });

    Object.entries(totalNeeded).forEach(([ingId, qty]) => {
      const ing = Store.ingredients.find(parseInt(ingId));
      if (!ing) return;
      const newStock = Math.max(0, Math.round((ing.stock - qty) * 100) / 100);
      Store.ingredients.update(ing.id, { stock: newStock });
    });

    const cubiertos = dist.filter(d => d.cubierto && d.bolsasAsig > 0).length;
    App.toast('success', `${totalBolsas} bolsa${totalBolsas !== 1 ? 's' : ''} distribuida${totalBolsas !== 1 ? 's' : ''} · ${cubiertos} día${cubiertos !== 1 ? 's' : ''} cubierto${cubiertos !== 1 ? 's' : ''}`);
    render(document.getElementById('pageContent'));
  }

  // ─── Reiniciar masa de una fecha ──────────────────────────────────────────────
  function clearMasa(deliveryDate) {
    if (!confirm(`¿Reiniciar el registro de masa para ${fmtDate(deliveryDate)}?`)) return;
    Store.masaLog.where(l => l.deliveryDate === deliveryDate)
      .forEach(l => Store.masaLog.remove(l.id));
    render(document.getElementById('pageContent'));
  }

  return { render, openMasaModal, previewDist, clearMasa, openCreateModal: openMasaModal };
})();
