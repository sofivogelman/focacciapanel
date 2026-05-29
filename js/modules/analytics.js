const AnalyticsModule = (() => {

  // ─── Sabores canónicos ────────────────────────────────────────────────────────
  const FLAVORS_FIXED = [
    'Romero y Sal',
    'Papa y Parmesano',
    'Tomate Cherry y Pesto',
    'Aceitunas',
  ];

  function canonicalFlavor(s) {
    const f = (s || '').toLowerCase();
    if (f.includes('romero'))                                              return 'Romero y Sal';
    if (f.includes('papa') || f.includes('parmesano'))                    return 'Papa y Parmesano';
    if (f.includes('tomate') || f.includes('cherry') || f.includes('pesto')) return 'Tomate Cherry y Pesto';
    if (f.includes('aceitun'))                                             return 'Aceitunas';
    return null;
  }

  function isDegustacion(item) {
    const s = ((item.flavor || '') + ' ' + (item.name || '')).toLowerCase();
    return s.includes('degustac');
  }

  // Extrae el sabor de un item.
  // Formato esperado: "Familiar (Papa y Parmesano (Sin individual de regalo))"
  // → toma el primer bloque entre paréntesis, antes de sub-paréntesis.
  function getFlavorText(item) {
    const f = (item.flavor || '').trim();
    if (f) return f;
    const m = (item.name || '').match(/\(([^(]+)/);
    return m ? m[1].trim() : '';
  }

  // ─── Zonas fijas ──────────────────────────────────────────────────────────────
  const ZONES_FIXED = [
    'Barrio de Villa Nueva',
    'Vila Terra',
    'Centro Comercial Nordelta',
    'Lirios del Talar',
    'Terrazas/Casas de Santa Maria',
    'Talar del lago 2',
    'Otro',
  ];

  function normalizeZone(zone) {
    const z = (zone || '').trim();
    if (!z) return null;
    // Exact match first (when zone was set from the select)
    if (ZONES_FIXED.includes(z)) return z;
    // Fuzzy fallback for GAS free-text values
    const zl = z.toLowerCase();
    if (zl.includes('villa nueva'))                       return 'Barrio de Villa Nueva';
    if (zl.includes('terra') || zl.includes('vila'))      return 'Vila Terra';
    if (zl.includes('nordelta'))                          return 'Centro Comercial Nordelta';
    if (zl.includes('lirios'))                            return 'Lirios del Talar';
    if (zl.includes('santa maria') || zl.includes('terraza') || zl.includes('santa maría')) return 'Terrazas/Casas de Santa Maria';
    if (zl.includes('talar del lago'))                    return 'Talar del lago 2';
    return 'Otro';
  }

  // ─── Gráfico de barras ────────────────────────────────────────────────────────
  function barChart(entries, maxVal, colorVar) {
    return entries.map(([label, val]) => {
      const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <div style="width:160px;font-size:var(--text-xs);color:var(--color-text-secondary);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0" title="${label}">${label}</div>
          <div style="flex:1;height:10px;background:var(--color-border-light);border-radius:var(--radius-full);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${colorVar};border-radius:var(--radius-full);transition:width 0.4s ease"></div>
          </div>
          <div style="width:28px;font-size:var(--text-xs);font-weight:var(--font-semibold);color:${val > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'}">${val}</div>
        </div>
      `;
    }).join('');
  }

  // Extrae el barrio de Villa Nueva del campo zone.
  // Formato esperado: "Barrio de Villa Nueva - San Marco" o "Barrio de Villa Nueva - San Marco Lote 5"
  function extractBarrioFromZone(zone) {
    const z = (zone || '').trim();
    if (!z.toLowerCase().includes('villa nueva')) return null;
    const sep = z.indexOf(' - ');
    if (sep === -1) return null;
    const raw = z.substring(sep + 3).trim(); // "San Marco" o "San Marco Lote 5"
    if (!raw) return null;

    // Intenta hacer match con barrios conocidos primero
    const knownBarrios = Store.barriosVN.all();
    for (const b of knownBarrios) {
      if (raw.toLowerCase().startsWith(b.name.toLowerCase())) return b.name;
    }

    // Si no matchea ningún barrio conocido, no asumir — podría ser texto libre de entrega
    return null;
  }

  // ─── Cómputo ──────────────────────────────────────────────────────────────────
  function computeData() {
    const orders = Store.orders.all();

    // Sabores: normalización a los 4 canónicos
    // Usa getFlavorText para cubrir tanto item.flavor como item.name con " — "
    // Degustación cuenta como 1 de cada sabor × qty
    const flavorMap = { 'Romero y Sal': 0, 'Papa y Parmesano': 0, 'Tomate Cherry y Pesto': 0, 'Aceitunas': 0 };
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const qty = item.qty || 1;
        // Degustación antes del filtro de promos — puede venir con format 'Promo'
        if (isDegustacion(item)) {
          FLAVORS_FIXED.forEach(fl => { flavorMap[fl] += qty; });
          return;
        }
        // Saltear promos que no son degustación (Promo, Promo25, etc.)
        if ((item.format || '').toLowerCase().startsWith('promo')) return;
        const cf = canonicalFlavor(getFlavorText(item));
        if (cf) flavorMap[cf] += qty;
      });
    });
    const flavors = FLAVORS_FIXED
      .map(f => [f, flavorMap[f]])
      .sort((a, b) => b[1] - a[1]);

    // Zonas: siempre las 6 fijas con conteo
    const zoneMap = {};
    ZONES_FIXED.forEach(z => { zoneMap[z] = 0; });
    orders.forEach(o => {
      const norm = normalizeZone(o.zone);
      if (norm) zoneMap[norm] = (zoneMap[norm] || 0) + 1;
    });
    const zones = Object.entries(zoneMap).sort((a, b) => b[1] - a[1]);

    // Barrios: extrae desde o.barrio (campo manual) o desde o.zone para Villa Nueva
    const knownBarrios = Store.barriosVN.all();
    const barrioOrderMap = {};
    orders.forEach(o => {
      const b = (o.barrio || '').trim() || extractBarrioFromZone(o.zone) || '';
      if (b) barrioOrderMap[b] = (barrioOrderMap[b] || 0) + 1;
    });
    const barrios = knownBarrios.map(b => [b.name, b.id, barrioOrderMap[b.name] || 0]);

    // Clientes repetidos — clave por nombre; zona/barrio se toma del primer pedido que lo tenga
    const clientMap = {};
    orders.forEach(o => {
      const name = (o.clientName || '').trim();
      if (!name) return;
      const zone   = normalizeZone(o.zone) || '';
      const barrio = (o.barrio || '').trim() || extractBarrioFromZone(o.zone) || '';
      if (!clientMap[name]) clientMap[name] = { name, barrio: '', zone: '', count: 0 };
      clientMap[name].count++;
      if (!clientMap[name].barrio && barrio) clientMap[name].barrio = barrio;
      if (!clientMap[name].zone  && zone)   clientMap[name].zone   = zone;
    });
    const repeated = Object.values(clientMap)
      .filter(c => c.count > 1)
      .sort((a, b) => b.count - a.count)
      .map(c => [`${c.name} — ${c.barrio || c.zone || 'sin zona'}`, c.count]);

    return { flavors, zones, barrios, repeated, total: orders.length };
  }

  // ─── Agregar barrio ───────────────────────────────────────────────────────────
  function addBarrio() {
    App.openModal({
      title: 'Agregar barrio de Villa Nueva',
      size: 'modal-sm',
      body: `
        <div class="form-group">
          <label class="form-label">Nombre del barrio</label>
          <input class="form-input" id="fBarrioName" placeholder="Ej: Los Robles, El Lago…" autofocus />
        </div>
      `,
      primaryLabel: 'Agregar',
      onConfirm: () => {
        const name = document.getElementById('fBarrioName').value.trim();
        if (!name) { App.toast('error', 'Ingresá el nombre del barrio'); return false; }
        const exists = Store.barriosVN.where(b => b.name.toLowerCase() === name.toLowerCase()).length > 0;
        if (exists) { App.toast('error', 'Ese barrio ya existe'); return false; }
        Store.barriosVN.create({ name });
        App.toast('success', `Barrio "${name}" agregado`);
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  function removeBarrio(id) {
    if (!confirm('¿Eliminás este barrio?')) return;
    Store.barriosVN.remove(id);
    render(document.getElementById('pageContent'));
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render(container) {
    const { flavors, zones, barrios, repeated, total } = computeData();
    const maxFlavor = flavors[0]?.[1] || 1;
    const maxZone   = Math.max(...zones.map(([, v]) => v), 1);

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Análisis</h1>
            <p class="page-subtitle">Tendencias de sabores, zonas y clientes · ${total} pedido${total !== 1 ? 's' : ''} en total</p>
          </div>
        </div>

        <div class="grid-2" style="align-items:start; margin-bottom:var(--space-6)">

          <!-- Sabores -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Sabores más pedidos</div>
                <div class="card-subtitle">4 sabores · degustación = 1 de cada uno</div>
              </div>
              ${flavors[0]?.[1] > 0 ? `<span class="badge badge-primary">${flavors[0][0]}</span>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              ${flavors.map(([label, val]) => {
                const pct = maxFlavor > 0 ? Math.round((val / maxFlavor) * 100) : 0;
                return `
                  <div style="display:flex;align-items:center;gap:var(--space-3)">
                    <div style="width:170px;font-size:var(--text-xs);color:var(--color-text-secondary);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">${label}</div>
                    <div style="flex:1;height:10px;background:var(--color-border-light);border-radius:var(--radius-full);overflow:hidden">
                      <div style="height:100%;width:${pct}%;background:var(--color-primary);border-radius:var(--radius-full);transition:width .4s ease"></div>
                    </div>
                    <div style="width:28px;font-size:var(--text-xs);font-weight:600;color:${val > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'}">${val}</div>
                  </div>
                `;
              }).join('')}
            </div>
            ${flavors.some(([, v]) => v > 0) ? `
              <div class="divider"></div>
              <div class="d-flex gap-4 text-xs" style="color:var(--color-text-muted)">
                <div><span class="font-medium" style="color:var(--color-success)">↑ Más pedido:</span> ${flavors[0][0]} (${flavors[0][1]} u.)</div>
                <div><span class="font-medium">↓ Menos:</span> ${flavors[flavors.length - 1][0]} (${flavors[flavors.length - 1][1]} u.)</div>
              </div>
            ` : ''}
          </div>

          <!-- Zonas -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Zonas de entrega</div>
                <div class="card-subtitle">Pedidos por zona</div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              ${barChart(zones, maxZone, 'var(--color-accent)')}
            </div>
          </div>
        </div>

        <div class="grid-2" style="align-items:start">

          <!-- Barrios de Villa Nueva -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Barrios — Villa Nueva</div>
                <div class="card-subtitle">${barrios.length} barrio${barrios.length !== 1 ? 's' : ''} registrado${barrios.length !== 1 ? 's' : ''}</div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="AnalyticsModule.addBarrio()">+ Barrio</button>
            </div>
            ${barrios.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-4)">
                <div class="empty-state-title">Sin barrios todavía</div>
                <p class="empty-state-text">Usá "+ Barrio" para agregar barrios de Villa Nueva.</p>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:var(--space-2)">
                ${barrios.map(([name, id, count]) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-light)">
                    <div>
                      <div class="text-sm font-medium">${name}</div>
                      <div class="text-xs" style="color:var(--color-text-muted)">${count} pedido${count !== 1 ? 's' : ''}</div>
                    </div>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="AnalyticsModule.removeBarrio(${id})" title="Eliminar barrio">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                `).join('')}
              </div>
              <div class="form-hint mt-3">Asigná el barrio desde el detalle de cada pedido.</div>
            `}
          </div>

          <!-- Clientes repetidos -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Clientes repetidos</div>
                <div class="card-subtitle">Compraron más de una vez</div>
              </div>
              ${repeated.length > 0 ? `<span class="badge badge-success">${repeated.length}</span>` : ''}
            </div>
            ${repeated.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-6)">
                <div class="empty-state-title">Sin clientes repetidos aún</div>
              </div>
            ` : `
              <div style="margin:0 calc(-1 * var(--space-6)) calc(-1 * var(--space-6))">
                <table class="table">
                  <thead><tr><th>Cliente</th><th style="text-align:right">Pedidos</th></tr></thead>
                  <tbody>
                    ${repeated.map(([name, count]) => `
                      <tr>
                        <td class="font-medium">${name}</td>
                        <td style="text-align:right"><span class="badge badge-primary">${count}×</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  return { render, addBarrio, removeBarrio };
})();
