const AnalyticsModule = (() => {

  function barChart(entries, maxVal, colorVar, emptyMsg) {
    if (entries.length === 0) {
      return `<div class="empty-state" style="padding:var(--space-6)"><div class="empty-state-title">${emptyMsg}</div></div>`;
    }
    return entries.map(([label, val]) => {
      const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
      return `
        <div style="display:flex; align-items:center; gap:var(--space-3)">
          <div style="width:140px; font-size:var(--text-xs); color:var(--color-text-secondary); text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0" title="${label}">${label}</div>
          <div style="flex:1; height:10px; background:var(--color-border-light); border-radius:var(--radius-full); overflow:hidden">
            <div style="height:100%; width:${pct}%; background:${colorVar}; border-radius:var(--radius-full); transition:width 0.4s ease"></div>
          </div>
          <div style="width:28px; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--color-text-secondary)">${val}</div>
        </div>
      `;
    }).join('');
  }

  function computeData() {
    const orders = Store.orders.all();

    // Sabores: solo el campo flavor, sin formato ni promos
    const flavorMap = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        if ((item.format || '').toLowerCase() === 'promo') return;
        const flavor = (item.flavor || '').trim();
        if (!flavor) return;
        flavorMap[flavor] = (flavorMap[flavor] || 0) + (item.qty || 1);
      });
    });
    const flavors = Object.entries(flavorMap).sort((a, b) => b[1] - a[1]);

    // Zonas
    const zoneMap = {};
    orders.forEach(o => {
      const zone = (o.zone || '').trim();
      if (zone) zoneMap[zone] = (zoneMap[zone] || 0) + 1;
    });
    const zones = Object.entries(zoneMap).sort((a, b) => b[1] - a[1]);

    // Barrios
    const barrioMap = {};
    orders.forEach(o => {
      const barrio = (o.barrio || '').trim();
      if (barrio) barrioMap[barrio] = (barrioMap[barrio] || 0) + 1;
    });
    const barrios = Object.entries(barrioMap).sort((a, b) => b[1] - a[1]);

    // Clientes repetidos
    const clientMap = {};
    orders.forEach(o => {
      const name = (o.clientName || '').trim();
      if (name) clientMap[name] = (clientMap[name] || 0) + 1;
    });
    const repeated = Object.entries(clientMap)
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1]);

    return { flavors, zones, barrios, repeated, total: orders.length };
  }

  function render(container) {
    const { flavors, zones, barrios, repeated, total } = computeData();
    const maxFlavor  = flavors[0]?.[1]  || 1;
    const maxZone    = zones[0]?.[1]    || 1;
    const maxBarrio  = barrios[0]?.[1]  || 1;

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
                <div class="card-subtitle">Por unidades · solo sabores, sin formato ni promos</div>
              </div>
              ${flavors[0] ? `<span class="badge badge-primary">${flavors[0][0].split(' ').slice(0, 3).join(' ')}</span>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:var(--space-3)">
              ${barChart(flavors.slice(0, 12), maxFlavor, 'var(--color-primary)', 'Aún no hay datos de sabores')}
            </div>
            ${flavors.length > 1 ? `
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
              ${zones[0] ? `<span class="badge badge-accent">${zones[0][0]}</span>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:var(--space-3)">
              ${barChart(zones.slice(0, 12), maxZone, 'var(--color-accent)', 'Sin datos de zona aún')}
            </div>
            ${zones.length === 0 ? `
              <div class="form-hint mt-2">Las zonas se cargan desde el detalle de cada pedido o desde Google Sheets.</div>
            ` : ''}
          </div>
        </div>

        <div class="grid-2" style="align-items:start">

          <!-- Barrios -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Barrios</div>
                <div class="card-subtitle">Distribución por barrio dentro de la zona</div>
              </div>
            </div>
            ${barrios.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-6)">
                <div class="empty-state-title">Sin barrios registrados aún</div>
                <p class="empty-state-text">Asigná el barrio desde el detalle de cada pedido (campo "Barrio").</p>
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:var(--space-3)">
                ${barChart(barrios.slice(0, 12), maxBarrio, 'var(--color-warning)', 'Sin datos')}
              </div>
            `}
          </div>

          <!-- Clientes repetidos -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Clientes repetidos</div>
                <div class="card-subtitle">Compraron más de una vez</div>
              </div>
              ${repeated.length > 0 ? `<span class="badge badge-success">${repeated.length} cliente${repeated.length !== 1 ? 's' : ''}</span>` : ''}
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

  return { render };
})();
