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

  // ─── Gráfico de barras horizontales ─────────────────────────────────────────
  function barChart(entries, maxVal, colorVar, emptyMsg) {
    if (entries.length === 0) {
      return `<div class="empty-state" style="padding:var(--space-8)">
                <div class="empty-state-title">${emptyMsg}</div>
              </div>`;
    }
    return entries.map(([label, val]) => {
      const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
      return `
        <div style="display:flex; align-items:center; gap:var(--space-3)">
          <div style="width:120px; font-size:var(--text-xs); color:var(--color-text-secondary); text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0"
               title="${label}">${label}</div>
          <div style="flex:1; height:10px; background:var(--color-border-light); border-radius:var(--radius-full); overflow:hidden">
            <div style="height:100%; width:${pct}%; background:${colorVar}; border-radius:var(--radius-full); transition:width 0.4s ease"></div>
          </div>
          <div style="width:28px; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--color-text-secondary)">${val}</div>
        </div>
      `;
    }).join('');
  }

  // ─── Calcular tendencias ─────────────────────────────────────────────────────
  function computeTrends() {
    const allOrders = Store.orders.all();

    // Sabores: suma de qty por nombre de item
    const flavorMap = {};
    allOrders.forEach(o => {
      (o.items || []).forEach(i => {
        const name = i.name || 'Desconocido';
        flavorMap[name] = (flavorMap[name] || 0) + (i.qty || 1);
      });
    });
    const flavors = Object.entries(flavorMap).sort((a, b) => b[1] - a[1]);

    // Zonas: conteo de pedidos por zona/barrio
    const zoneMap = {};
    allOrders.forEach(o => {
      let zone = o.zone || '';
      if (!zone && o.clientId) {
        const c = Store.clients.find(o.clientId);
        zone = c?.address || '';
      }
      if (zone) {
        const zoneKey = zone.split(',')[0].trim();
        if (zoneKey) zoneMap[zoneKey] = (zoneMap[zoneKey] || 0) + 1;
      }
    });
    const zones = Object.entries(zoneMap).sort((a, b) => b[1] - a[1]);

    return { flavors, zones };
  }

  // ─── Sección de impacto en stock ─────────────────────────────────────────────
  function renderStockImpact() {
    const toProduceStatuses = ['pendiente', 'en_preparacion'];
    const pendingOrders     = Store.orders.where(o => toProduceStatuses.includes(o.status));
    const impact            = Store.computeStockImpact(pendingOrders);

    // Resumen: total de unidades a producir
    const totalUnits  = pendingOrders.reduce((s, o) =>
      s + (o.items || []).reduce((ss, i) => ss + (i.qty || 1), 0), 0);
    const totalCost   = impact.reduce((s, i) => s + i.costNeeded, 0);
    const deficits    = impact.filter(i => i.deficit).length;

    if (pendingOrders.length === 0) {
      return `
        <div class="card mt-6 mb-6" style="border-style:dashed; opacity:0.6">
          <div class="card-header">
            <div class="card-title">Producción pendiente</div>
          </div>
          <div class="empty-state" style="padding:var(--space-6)">
            <div class="empty-state-title">Sin pedidos pendientes para producir</div>
            <p class="empty-state-text">Cuando haya pedidos en estado "Pendiente" o "En preparación",
              acá aparecerá el impacto de cada receta sobre el stock de ingredientes.</p>
          </div>
        </div>
      `;
    }

    // Pill resumen arriba de la tabla
    const summaryPills = `
      <div class="d-flex gap-3 flex-wrap" style="margin-bottom:var(--space-4)">
        <div style="background:var(--color-primary-subtle); border-radius:var(--radius-md); padding:var(--space-2) var(--space-4); text-align:center">
          <div class="text-xs text-muted">Pedidos a producir</div>
          <div class="font-semibold text-primary">${pendingOrders.length}</div>
        </div>
        <div style="background:var(--color-surface-alt); border-radius:var(--radius-md); padding:var(--space-2) var(--space-4); text-align:center">
          <div class="text-xs text-muted">Unidades totales</div>
          <div class="font-semibold">${totalUnits}</div>
        </div>
        <div style="background:var(--color-accent-subtle); border-radius:var(--radius-md); padding:var(--space-2) var(--space-4); text-align:center">
          <div class="text-xs text-muted">Costo estimado de ingredientes</div>
          <div class="font-semibold" style="color:var(--color-accent)">${fmt(totalCost)}</div>
        </div>
        ${deficits > 0 ? `
          <div style="background:var(--color-danger-bg); border-radius:var(--radius-md); padding:var(--space-2) var(--space-4); text-align:center">
            <div class="text-xs" style="color:var(--color-danger)">Ingredientes con déficit</div>
            <div class="font-semibold" style="color:var(--color-danger)">${deficits}</div>
          </div>
        ` : `
          <div style="background:var(--color-success-bg); border-radius:var(--radius-md); padding:var(--space-2) var(--space-4); text-align:center">
            <div class="text-xs" style="color:var(--color-success)">Stock suficiente</div>
            <div class="font-semibold" style="color:var(--color-success)">Todo OK</div>
          </div>
        `}
      </div>
    `;

    const tableRows = impact.length === 0
      ? `<tr><td colspan="6">
           <div class="empty-state" style="padding:var(--space-6)">
             <div class="empty-state-title">Sin recetas configuradas aún</div>
             <p class="empty-state-text">Los pedidos no tienen productos del catálogo asignados,
               por lo que no se puede calcular el impacto en stock.</p>
           </div>
         </td></tr>`
      : impact.map(i => {
          const afterFormatted = i.after >= 0
            ? `${i.after} ${i.unit}`
            : `<span style="color:var(--color-danger);font-weight:var(--font-semibold)">${i.after} ${i.unit} ⚠</span>`;
          const statusBadge = i.deficit
            ? `<span class="badge badge-danger">Falta ${Math.abs(i.after)} ${i.unit}</span>`
            : `<span class="badge badge-success">OK</span>`;
          const rowBg = i.deficit ? 'background:var(--color-danger-bg)' : '';
          return `
            <tr style="${rowBg}">
              <td class="font-medium">${i.name}</td>
              <td class="text-sm">${i.needed} ${i.unit}</td>
              <td class="text-sm">${i.stock} ${i.unit}</td>
              <td class="text-sm">${afterFormatted}</td>
              <td class="text-sm text-secondary">${fmt(i.costNeeded)}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join('');

    return `
      <div class="card mt-6 mb-6" style="${deficits > 0 ? 'border-color: var(--color-danger)' : ''}">
        <div class="card-header">
          <div>
            <div class="card-title">Producción pendiente — Impacto en stock</div>
            <div class="card-subtitle">
              Cruce de recetas con ${pendingOrders.length} pedido${pendingOrders.length !== 1 ? 's' : ''}
              en estado Pendiente / En preparación
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('inventory')">Ver inventario</button>
        </div>

        ${summaryPills}

        <div class="table-wrapper" style="border:none; margin:0 calc(-1 * var(--space-6)) calc(-1 * var(--space-6)); border-radius:0">
          <table class="table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Necesario</th>
                <th>Stock actual</th>
                <th>Tras producción</th>
                <th>Costo estimado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ─── Render principal ────────────────────────────────────────────────────────
  function render(container) {
    const stats       = Store.stats();
    const allOrders   = Store.orders.all().sort((a, b) => b.id - a.id);
    const recentOrders = allOrders.slice(0, 5);
    const lowStock    = Store.ingredients.where(i => i.stock <= i.minStock * 1.3);
    const gasCount    = Store.orders.where(o => o.fromGAS).length;
    const { flavors, zones } = computeTrends();
    const maxFlavor   = flavors[0]?.[1] || 1;
    const maxZone     = zones[0]?.[1]   || 1;

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Buen día 👋</h1>
            <p class="page-subtitle">
              Resumen del emprendimiento
              ${gasCount > 0 ? `· <span class="text-primary font-medium">${gasCount} pedido${gasCount !== 1 ? 's' : ''} vía Google Sheets</span>` : ''}
            </p>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid-4" style="margin-bottom:var(--space-8)">
          <div class="stat-card" style="--stat-color:var(--color-primary)">
            <div class="stat-label">Ingresos del mes</div>
            <div class="stat-value">${fmt(stats.revenue)}</div>
            <div class="stat-meta">Pedidos cobrados</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-accent)">
            <div class="stat-label">Ganancia neta</div>
            <div class="stat-value">${fmt(stats.profit)}</div>
            <div class="stat-meta">Después de gastos: ${fmt(stats.monthExpenses)}</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-warning)">
            <div class="stat-label">Pedidos pendientes</div>
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-meta">De ${stats.totalOrders} pedidos este mes</div>
          </div>
          <div class="stat-card" style="--stat-color:${stats.lowStock > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">
            <div class="stat-label">Stock bajo</div>
            <div class="stat-value">${stats.lowStock}</div>
            <div class="stat-meta">${stats.lowStock === 0 ? 'Todo el inventario OK' : 'Ingredientes por reponer'}</div>
          </div>
        </div>

        <!-- Pedidos recientes + Alertas de stock -->
        <div class="grid-2" style="align-items:start; margin-bottom:var(--space-8)">

          <!-- Pedidos recientes -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Pedidos recientes</div>
                <div class="card-subtitle">Últimas 5 actividades</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="Router.navigate('orders')">Ver todos</button>
            </div>
            ${recentOrders.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-8)">
                <div class="empty-state-title">Sin pedidos aún</div>
              </div>
            ` : `
              <div style="margin:calc(-1 * var(--space-4)) calc(-1 * var(--space-6)) calc(-1 * var(--space-6)); overflow:auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Entrega</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentOrders.map(o => `
                      <tr>
                        <td>
                          <div class="font-medium">${o.clientName}</div>
                          ${o.fromGAS ? '<div class="text-xs" style="color:var(--color-primary);opacity:0.7">vía Sheets</div>' : ''}
                        </td>
                        <td class="text-secondary text-sm">${o.deliveryDate || '—'}</td>
                        <td class="font-medium">${fmt(o.total)}</td>
                        <td>${statusBadge(o.status)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

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
              <div style="display:flex; flex-direction:column; gap:var(--space-3)">
                ${lowStock.slice(0, 6).map(i => {
                  const pct   = Math.min(100, Math.round((i.stock / i.minStock) * 100));
                  const isLow = i.stock <= i.minStock;
                  return `
                    <div>
                      <div class="d-flex items-center justify-between" style="margin-bottom:var(--space-1)">
                        <span class="text-sm font-medium">${i.name}</span>
                        <span class="text-xs ${isLow ? 'text-danger' : 'text-warning'}">
                          ${i.stock} ${i.unit} / mín ${i.minStock}
                        </span>
                      </div>
                      <div class="progress">
                        <div class="progress-bar" style="width:${pct}%; background:${isLow ? 'var(--color-danger)' : 'var(--color-warning)'}"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Tendencias -->
        <div class="grid-2" style="align-items:start; margin-bottom:var(--space-8)">

          <!-- Sabores más pedidos -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Sabores más pedidos</div>
                <div class="card-subtitle">Por unidades totales</div>
              </div>
              ${flavors.length > 0 ? `
                <span class="badge badge-primary">${flavors[0][0].split(' ').slice(0, 2).join(' ')}</span>
              ` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:var(--space-3)">
              ${barChart(flavors.slice(0, 8), maxFlavor, 'var(--color-primary)', 'Aún no hay pedidos')}
            </div>
            ${flavors.length > 0 ? `
              <div class="divider"></div>
              <div class="d-flex gap-4 text-xs text-muted">
                <div>
                  <span class="font-medium text-success">↑ Más pedido:</span>
                  ${flavors[0]?.[0] || '—'} (${flavors[0]?.[1] || 0} u.)
                </div>
                ${flavors.length > 1 ? `
                  <div>
                    <span class="font-medium text-secondary">↓ Menos pedido:</span>
                    ${flavors[flavors.length - 1]?.[0] || '—'} (${flavors[flavors.length - 1]?.[1] || 0} u.)
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Zonas de entrega -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Zonas de entrega</div>
                <div class="card-subtitle">Pedidos por barrio / zona</div>
              </div>
              ${zones.length > 0 ? `
                <span class="badge badge-accent">${zones[0][0].split(' ').slice(0, 2).join(' ')}</span>
              ` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:var(--space-3)">
              ${barChart(zones.slice(0, 8), maxZone, 'var(--color-accent)', 'Sin datos de zona aún')}
            </div>
            ${zones.length > 0 ? `
              <div class="divider"></div>
              <div class="text-xs text-muted">
                <span class="font-medium text-primary">Zona principal:</span>
                ${zones[0][0]} — ${zones[0][1]} pedido${zones[0][1] !== 1 ? 's' : ''}
              </div>
            ` : `
              <div class="form-hint mt-2">
                Las zonas se completan automáticamente desde los pedidos de Google Sheets o desde la dirección del cliente.
              </div>
            `}
          </div>
        </div>

        <!-- Producción pendiente → Impacto en stock y costos -->
        ${renderStockImpact()}

        <!-- Catálogo activo -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Productos activos</div>
              <div class="card-subtitle">Tu catálogo actual</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('products')">Gestionar</button>
          </div>
          <div style="display:flex; gap:var(--space-3); flex-wrap:wrap">
            ${Store.products.where(p => p.active).map(p => `
              <div style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3) var(--space-4); background:var(--color-bg); border:var(--border); border-radius:var(--radius-lg); min-width:200px;">
                <span style="font-size:24px">${p.image}</span>
                <div>
                  <div class="text-sm font-medium">${p.name}</div>
                  <div class="text-xs text-secondary">${fmt(p.price)} / ${p.unit}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  return { render };
})();
