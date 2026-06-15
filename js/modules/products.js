const ProductsModule = (() => {
  function fmt(n) { return '$' + Number(n).toLocaleString('es-AR'); }

  function render(container) {
    const formats       = Store.formats.all();
    const flavors       = Store.flavors.all();
    const promos        = Store.promos.all();
    const activeFormats = formats.filter(f => f.active);
    const activeFlavors = flavors.filter(f => f.active);
    const activePromos  = promos.filter(p => p.active);
    const totalCombos   = activeFormats.length * activeFlavors.length + activePromos.length;

    if (formats.length === 0 && flavors.length === 0 && promos.length === 0) {
      container.innerHTML = `
        <div class="fade-in">
          <div class="page-header">
            <h1 class="page-title">Catálogo</h1>
          </div>
          <div class="card">
            <div class="empty-state">
              <div class="empty-state-title">Sin productos</div>
              <p class="empty-state-text">El catálogo se genera desde Configuración.<br>Agregá sabores y formatos para verlo acá.</p>
              <button class="btn btn-primary" onclick="Router.navigate('config')">Ir a Configuración</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Catálogo</h1>
            <p class="page-subtitle">${totalCombos} combinación${totalCombos !== 1 ? 'es' : ''} disponible${totalCombos !== 1 ? 's' : ''} · se gestiona desde <a href="#" onclick="Router.navigate('config');return false" style="color:var(--color-primary)">Configuración</a></p>
          </div>
        </div>

        ${activeFormats.map(format => `
          <div style="margin-bottom:var(--space-6)">
            <div class="d-flex items-center gap-3" style="margin-bottom:var(--space-3)">
              <span class="font-semibold">${format.name}</span>
              ${format.price ? `<span class="badge badge-primary">${fmt(format.price)}</span>` : ''}
              ${format.grams ? `<span class="badge badge-default" style="color:var(--color-text-secondary)">${format.grams}g masa</span>` : ''}
              <div class="divider" style="flex:1;margin:0"></div>
            </div>
            <div class="card card-sm">
              <table class="table">
                <thead><tr><th>Sabor</th><th>Precio</th><th>Estado</th></tr></thead>
                <tbody>
                  ${activeFlavors.length === 0
                    ? `<tr><td colspan="3" class="text-center" style="color:var(--color-text-muted);padding:var(--space-4) 0">Sin sabores — agregalos en Configuración</td></tr>`
                    : activeFlavors.map(flavor => `
                        <tr>
                          <td class="font-medium">${flavor.name}</td>
                          <td class="text-sm">${format.price ? fmt(format.price) : '—'}</td>
                          <td><span class="badge badge-success">Activo</span></td>
                        </tr>
                      `).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}

        ${activePromos.length > 0 ? `
          <div style="margin-bottom:var(--space-6)">
            <div class="d-flex items-center gap-3" style="margin-bottom:var(--space-3)">
              <span class="font-semibold">Promociones activas</span>
              <div class="divider" style="flex:1;margin:0"></div>
            </div>
            <div class="card card-sm">
              <table class="table">
                <thead><tr><th>Promo</th><th>Incluye</th><th>Precio</th></tr></thead>
                <tbody>
                  ${activePromos.map(p => `
                    <tr>
                      <td class="font-medium">${p.name}</td>
                      <td class="text-sm" style="color:var(--color-text-secondary)">${(p.flavors || []).join(', ') || '—'}</td>
                      <td class="text-sm">${p.price ? fmt(p.price) : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${(formats.filter(f => !f.active).length > 0 || flavors.filter(f => !f.active).length > 0) ? `
          <div>
            <div class="d-flex items-center gap-3" style="margin-bottom:var(--space-3)">
              <span class="text-sm" style="color:var(--color-text-muted)">Inactivos</span>
              <div class="divider" style="flex:1;margin:0"></div>
            </div>
            <div class="card card-sm">
              <table class="table">
                <tbody>
                  ${formats.filter(f => !f.active).map(f => `
                    <tr style="opacity:0.55">
                      <td>${f.name}</td>
                      <td class="text-xs" style="color:var(--color-text-muted)">Formato</td>
                      <td><span class="badge badge-default">Inactivo</span></td>
                    </tr>
                  `).join('')}
                  ${flavors.filter(f => !f.active).map(f => `
                    <tr style="opacity:0.55">
                      <td>${f.name}</td>
                      <td class="text-xs" style="color:var(--color-text-muted)">Sabor</td>
                      <td><span class="badge badge-default">Inactivo</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Redirige a config si algo llama openCreateModal
  function openCreateModal() { Router.navigate('config'); }

  return { render, openCreateModal };
})();
