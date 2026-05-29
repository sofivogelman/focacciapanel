const DeliveriesModule = (() => {
  const FUEL_KEY = 'focaccia_fuel_config';

  // Distancias en km (triángulo superior, simétrico vía dist())
  const DIST = {
    casa:        { villa_nueva: 5.4, vila_terra: 4.5, nordelta: 5.0, lirios: 12.3, talar2: 12.3 },
    villa_nueva: { vila_terra: 0.9, nordelta: 7.5, lirios: 9.6, talar2: 9.6 },
    vila_terra:  { nordelta: 7.5, lirios: 9.6, talar2: 9.6 },
    nordelta:    { lirios: 9.2, talar2: 9.2 },
    lirios:      { talar2: 0.5 },
  };

  const ZONE_LABELS = {
    villa_nueva: 'San Marco',
    vila_terra:  'Vila Terra',
    nordelta:    'Nordelta CC',
    lirios:      'Lirios del Talar',
    talar2:      'Talar del Lago 2',
  };

  const ZONE_OPTIONS = [
    ['villa_nueva', 'San Marco / Villa Nueva'],
    ['vila_terra',  'Vila Terra'],
    ['nordelta',    'Centro Comercial Nordelta'],
    ['lirios',      'Lirios del Talar'],
    ['talar2',      'Talar del Lago 2'],
  ];

  let formStops = [];

  // ─── Config nafta ─────────────────────────────────────────────────────────────
  function loadFuelConfig() {
    try {
      const raw = localStorage.getItem(FUEL_KEY);
      return raw ? JSON.parse(raw) : { pricePerLiter: 1200, consumption: 10.5 };
    } catch { return { pricePerLiter: 1200, consumption: 10.5 }; }
  }

  function saveFuelConfig(cfg) {
    localStorage.setItem(FUEL_KEY, JSON.stringify(cfg));
  }

  // ─── Cálculo ──────────────────────────────────────────────────────────────────
  function dist(a, b) {
    if (a === b) return 0;
    return DIST[a]?.[b] ?? DIST[b]?.[a] ?? 0;
  }

  function calcKm(stops) {
    if (!stops.length) return 0;
    const route = ['casa', ...stops, 'casa'];
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) total += dist(route[i], route[i + 1]);
    return Math.round(total * 10) / 10;
  }

  function calcFuel(km, cfg) {
    const liters = Math.round(km * cfg.consumption / 100 * 100) / 100;
    const cost   = Math.round(liters * cfg.pricePerLiter);
    return { liters, cost };
  }

  // ─── Form dinámico (llamado desde onclick en el modal) ────────────────────────
  function addFormStop(key) {
    if (!key) return;
    formStops.push(key);
    updateFormPreview();
  }

  function removeFormStop(idx) {
    formStops.splice(idx, 1);
    updateFormPreview();
  }

  function updateFormPreview() {
    const listEl = document.getElementById('repStopsList');
    if (listEl) {
      listEl.innerHTML = formStops.length === 0
        ? '<div class="text-sm text-muted" style="padding:var(--space-2)">Sin paradas — agregá zonas abajo</div>'
        : formStops.map((s, i) => `
            <div class="d-flex items-center gap-2" style="padding:var(--space-1) var(--space-2)">
              <span class="text-xs text-muted" style="min-width:16px">${i + 1}.</span>
              <span class="text-sm font-medium flex-1">${ZONE_LABELS[s] || s}</span>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="DeliveriesModule.removeFormStop(${i})" style="width:24px;height:24px">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('');
    }

    const addSel = document.getElementById('repStopAdd');
    if (addSel) addSel.value = '';

    const cfg  = loadFuelConfig();
    const fpEl = document.getElementById('fRepFuelPrice');
    const fp   = fpEl ? (parseFloat(fpEl.value) || cfg.pricePerLiter) : cfg.pricePerLiter;
    const km   = calcKm(formStops);
    const { liters, cost } = calcFuel(km, { ...cfg, pricePerLiter: fp });

    const infoEl = document.getElementById('repKmInfo');
    if (infoEl) {
      if (formStops.length === 0) {
        infoEl.innerHTML = '<span class="text-muted text-sm">Seleccioná al menos una parada</span>';
      } else {
        const route = ['Casa', ...formStops.map(s => ZONE_LABELS[s] || s), 'Casa'].join(' → ');
        infoEl.innerHTML = `
          <div class="text-xs text-secondary" style="margin-bottom:var(--space-1)">${route}</div>
          <div class="font-semibold">${km} km &nbsp;·&nbsp; ${liters} L &nbsp;·&nbsp; $${cost.toLocaleString('es-AR')}</div>
        `;
      }
    }
  }

  // ─── Modal crear ──────────────────────────────────────────────────────────────
  function openCreateModal() {
    formStops = [];
    const cfg = loadFuelConfig();

    App.openModal({
      title: 'Registrar salida de reparto',
      body: buildRepForm(cfg),
      primaryLabel: 'Guardar salida',
      onConfirm: () => saveDelivery(null),
      onOpen: () => {
        document.getElementById('fRepFuelPrice')?.addEventListener('input', updateFormPreview);
      },
    });
  }

  function buildRepForm(cfg) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de salida</label>
          <input type="date" class="form-input" id="fRepDate" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Precio nafta ($/L)</label>
          <input type="number" class="form-input" id="fRepFuelPrice" value="${cfg.pricePerLiter}" min="0" step="50" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Paradas en orden</label>
        <div id="repStopsList" style="background:var(--color-bg);border-radius:var(--radius-sm);min-height:44px;margin-bottom:var(--space-2)">
          <div class="text-sm text-muted" style="padding:var(--space-2)">Sin paradas — agregá zonas abajo</div>
        </div>
        <select class="form-select" id="repStopAdd" onchange="DeliveriesModule.addFormStop(this.value)">
          <option value="">+ Agregar parada…</option>
          ${ZONE_OPTIONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
        </select>
      </div>

      <div id="repKmInfo" style="padding:var(--space-3);background:var(--color-primary-subtle);border-radius:var(--radius-sm);text-align:center;margin-bottom:var(--space-3)">
        <span class="text-muted text-sm">Seleccioná al menos una parada</span>
      </div>

      <div class="form-group">
        <label class="form-label">Notas <span>(opcional)</span></label>
        <input class="form-input" id="fRepNotes" placeholder="Ej: lluvia, tráfico, pedido extra…" />
      </div>
    `;
  }

  function saveDelivery(editId) {
    const date = document.getElementById('fRepDate')?.value;
    if (!date) { App.toast('error', 'Elegí una fecha'); return false; }
    if (formStops.length === 0) { App.toast('error', 'Agregá al menos una parada'); return false; }

    const cfg = loadFuelConfig();
    const fp  = parseFloat(document.getElementById('fRepFuelPrice')?.value) || cfg.pricePerLiter;
    const km  = calcKm(formStops);
    const { liters, cost } = calcFuel(km, { ...cfg, pricePerLiter: fp });

    saveFuelConfig({ ...cfg, pricePerLiter: fp });

    const data = {
      date,
      stops:     [...formStops],
      totalKm:   km,
      fuelPrice: fp,
      liters,
      fuelCost:  cost,
      notes:     document.getElementById('fRepNotes')?.value.trim() || '',
    };

    const routeLabel = data.stops.map(s => ZONE_LABELS[s] || s).join(', ');
    const expDesc = `Nafta — ${routeLabel} (${km} km)`;

    if (editId) {
      const existing = Store.deliveries.find(editId);
      if (existing?.expenseId) {
        Store.expenses.update(existing.expenseId, { amount: cost, description: expDesc, date: data.date });
      } else {
        const exp = Store.expenses.create({ description: expDesc, amount: cost, category: 'logistica', date: data.date });
        data.expenseId = exp.id;
      }
      Store.deliveries.update(editId, data);
      App.toast('success', 'Salida actualizada');
    } else {
      const exp = Store.expenses.create({ description: expDesc, amount: cost, category: 'logistica', date: data.date });
      data.expenseId = exp.id;
      Store.deliveries.create(data);
      App.toast('success', `Salida registrada · ${km} km · $${cost.toLocaleString('es-AR')}`);
    }

    render(document.getElementById('pageContent'));
    return true;
  }

  function remove(id) {
    if (!confirm('¿Eliminás esta salida?')) return;
    const d = Store.deliveries.find(id);
    if (d?.expenseId) Store.expenses.remove(d.expenseId);
    Store.deliveries.remove(id);
    App.toast('success', 'Salida eliminada');
    render(document.getElementById('pageContent'));
  }

  // ─── Config modal ─────────────────────────────────────────────────────────────
  function openFuelConfigModal() {
    const cfg = loadFuelConfig();
    App.openModal({
      title: 'Configuración de nafta',
      body: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Precio por litro ($)</label>
            <input type="number" class="form-input" id="fFuelPrice" value="${cfg.pricePerLiter}" min="0" step="50" />
          </div>
          <div class="form-group">
            <label class="form-label">Consumo del auto (L/100km)</label>
            <input type="number" class="form-input" id="fFuelConsumption" value="${cfg.consumption}" min="1" max="30" step="0.5" />
            <div class="form-hint">Gol Trend ciudad: ~10–11 L/100km</div>
          </div>
        </div>
      `,
      primaryLabel: 'Guardar',
      onConfirm: () => {
        saveFuelConfig({
          pricePerLiter: parseFloat(document.getElementById('fFuelPrice').value) || cfg.pricePerLiter,
          consumption:   parseFloat(document.getElementById('fFuelConsumption').value) || cfg.consumption,
        });
        App.toast('success', 'Configuración de nafta guardada');
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render(container) {
    const cfg        = loadFuelConfig();
    const deliveries = Store.deliveries.all().sort((a, b) => b.date.localeCompare(a.date));
    const thisMonth  = new Date().toISOString().slice(0, 7);
    const monthDels  = deliveries.filter(d => d.date.startsWith(thisMonth));
    const monthKm    = Math.round(monthDels.reduce((s, d) => s + d.totalKm, 0) * 10) / 10;
    const monthLit   = Math.round(monthDels.reduce((s, d) => s + d.liters,  0) * 10) / 10;
    const monthCost  = monthDels.reduce((s, d) => s + d.fuelCost, 0);

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between">
          <div>
            <h1 class="page-title">Repartos</h1>
            <p class="page-subtitle">Km y costo de nafta por salida · Gol Trend ${cfg.consumption} L/100km · $${cfg.pricePerLiter.toLocaleString('es-AR')}/L</p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="DeliveriesModule.openFuelConfigModal()">Configurar nafta</button>
        </div>

        <div class="grid-3" style="margin-bottom:var(--space-6)">
          <div class="stat-card" style="--stat-color:var(--color-primary)">
            <div class="stat-label">Km este mes</div>
            <div class="stat-value">${monthKm}</div>
            <div class="stat-meta">${monthDels.length} salida${monthDels.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-warning)">
            <div class="stat-label">Litros este mes</div>
            <div class="stat-value">${monthLit} L</div>
            <div class="stat-meta">Consumo estimado</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-accent)">
            <div class="stat-label">Costo nafta este mes</div>
            <div class="stat-value">$${monthCost.toLocaleString('es-AR')}</div>
            <div class="stat-meta">Costo de logística</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Salidas registradas</div>
          </div>
          <div class="table-wrapper" style="border:none;margin:calc(-1 * var(--space-4)) calc(-1 * var(--space-6));border-radius:0">
            <table class="table">
              <thead>
                <tr><th>Fecha</th><th>Recorrido</th><th>Km</th><th>Litros</th><th>Costo nafta</th><th></th></tr>
              </thead>
              <tbody>
                ${deliveries.length === 0 ? `
                  <tr><td colspan="6">
                    <div class="empty-state" style="padding:var(--space-8)">
                      <div class="empty-state-title">Sin salidas registradas</div>
                      <p class="empty-state-text">Registrá tu primera salida de reparto.</p>
                      <button class="btn btn-primary" onclick="DeliveriesModule.openCreateModal()">Registrar salida</button>
                    </div>
                  </td></tr>
                ` : deliveries.map(d => {
                  const route = ['Casa', ...d.stops.map(s => ZONE_LABELS[s] || s), 'Casa'].join(' → ');
                  return `
                    <tr>
                      <td class="text-sm">${d.date}</td>
                      <td class="text-sm text-secondary" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${route}">${route}</td>
                      <td class="font-medium">${d.totalKm} km</td>
                      <td class="text-sm text-secondary">${d.liters} L</td>
                      <td class="font-medium">$${d.fuelCost.toLocaleString('es-AR')}</td>
                      <td>
                        <button class="btn btn-ghost btn-icon btn-sm" onclick="DeliveriesModule.remove(${d.id})">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  return { render, openCreateModal, addFormStop, removeFormStop, remove, openFuelConfigModal };
})();
