const FinancesModule = (() => {
  const EXP_CATS = { ingredientes: 'Ingredientes', equipamiento: 'Equipamiento/Utensilios', servicios: 'Servicios', packaging: 'Packaging', logistica: 'Logística', marketing: 'Marketing', otro: 'Otro' };

  function fmt(n) { return '$' + n.toLocaleString('es-AR'); }

  function currentMonth() { return new Date().toISOString().slice(0, 7); }

  function getMonthData(month) {
    const orders   = Store.orders.where(o => o.date.startsWith(month));
    const expenses = Store.expenses.where(e => e.date.startsWith(month));
    const revenue  = orders.filter(o => o.paid).reduce((s, o) => s + o.total, 0);
    const pending  = orders.filter(o => !o.paid).reduce((s, o) => s + o.total, 0);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    return { orders, expenses, revenue, pending, totalExp, profit: revenue - totalExp };
  }

  function renderExpRow(e) {
    return `
      <tr>
        <td class="text-secondary text-sm">${e.date}</td>
        <td class="font-medium">${e.description}</td>
        <td><span class="badge badge-default">${EXP_CATS[e.category] || e.category}</span></td>
        <td class="font-medium text-danger">${fmt(e.amount)}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="FinancesModule.openEditExpense(${e.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="FinancesModule.removeExpense(${e.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function buildExpenseForm(e = null) {
    const isEdit = !!e;
    return `
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <input class="form-input" id="fExpDesc" value="${isEdit ? e.description : ''}" placeholder="Compra de harina, gas, etc." list="expIngredientsList" autocomplete="off" required />
        <datalist id="expIngredientsList">
          ${Store.ingredients.all().map(i => `<option value="${i.name}">`).join('')}
        </datalist>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Monto *</label>
          <input type="number" class="form-input" id="fExpAmount" value="${isEdit ? e.amount : ''}" min="0" step="1" placeholder="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="fExpCat">
            ${Object.entries(EXP_CATS).map(([k,v]) => `<option value="${k}" ${isEdit && e.category===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" class="form-input" id="fExpDate" value="${isEdit ? e.date : new Date().toISOString().slice(0,10)}" />
        </div>
        ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">Cuotas</label>
          <select class="form-select" id="fExpInstallments">
            <option value="1">Contado</option>
            <option value="2">2 cuotas</option>
            <option value="3">3 cuotas</option>
            <option value="6">6 cuotas</option>
            <option value="9">9 cuotas</option>
            <option value="12">12 cuotas</option>
            <option value="18">18 cuotas</option>
            <option value="24">24 cuotas</option>
          </select>
        </div>
        ` : ''}
      </div>
    `;
  }

  function saveExpense(editId) {
    const desc   = document.getElementById('fExpDesc').value.trim();
    const amount = parseFloat(document.getElementById('fExpAmount').value);
    if (!desc || !amount || amount <= 0) { App.toast('error', 'Completá descripción y monto'); return false; }
    const base = { description: desc, amount, category: document.getElementById('fExpCat').value, date: document.getElementById('fExpDate').value };
    if (editId) {
      Store.expenses.update(editId, base);
      App.toast('success', 'Gasto actualizado');
    } else {
      const installments = parseInt(document.getElementById('fExpInstallments')?.value || '1') || 1;
      createInstallments(base, installments);
      App.toast('success', installments > 1 ? `Gasto en ${installments} cuotas registrado` : 'Gasto registrado');
    }
    render(document.getElementById('pageContent'));
    return true;
  }

  function createInstallments(base, installments) {
    const monthly = Math.floor(base.amount / installments);
    for (let i = 0; i < installments; i++) {
      const d = new Date(base.date + 'T12:00:00');
      d.setMonth(d.getMonth() + i);
      const isLast = i === installments - 1;
      const amt = isLast ? base.amount - monthly * (installments - 1) : monthly;
      const desc = installments > 1 ? `${base.description} (cuota ${i + 1}/${installments})` : base.description;
      Store.expenses.create({ ...base, date: d.toISOString().slice(0, 10), description: desc, amount: amt });
    }
  }

  function openCreateModal() {
    App.openModal({ title: 'Registrar gasto', body: buildExpenseForm(), primaryLabel: 'Registrar', onConfirm: () => saveExpense(null) });
  }

  function openEditExpense(id) {
    const e = Store.expenses.find(id);
    if (!e) return;
    App.openModal({ title: 'Editar gasto', body: buildExpenseForm(e), primaryLabel: 'Guardar', onConfirm: () => saveExpense(id) });
  }

  function removeExpense(id) {
    if (!confirm('¿Eliminás este gasto?')) return;
    Store.expenses.remove(id);
    App.toast('success', 'Gasto eliminado');
    render(document.getElementById('pageContent'));
  }

  // ─── Import Excel ─────────────────────────────────────────────────────────────
  function parseDate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return '';
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  function importFromExcel() {
    if (typeof XLSX === 'undefined') { App.toast('error', 'Librería no disponible, revisá tu conexión'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // raw:true → números como número JS, fechas como Date; evita reformateo por locale
          const rows = XLSX.utils.sheet_to_json(ws, { raw: true, cellDates: true });
          if (!rows.length) { App.toast('error', 'El archivo está vacío'); return; }

          // Normaliza nombre de columna: minúsculas, sin BOM, sin caracteres especiales
          const nk = k => String(k).replace(/^﻿/, '').toLowerCase().trim();
          const colKeys = Object.keys(rows[0]);
          const findCol = (...names) => {
            for (const n of names) {
              const k = colKeys.find(k => nk(k).includes(n));
              if (k) return k;
            }
            return null;
          };

          const colFecha   = findCol('fecha');
          const colTotal   = findCol('total');
          const colProduct = findCol('producto', 'descripcion', 'detalle');
          const colCuotas  = findCol('cuota', 'contado');

          if (!colFecha || !colTotal) {
            App.toast('error', `Columnas detectadas: ${colKeys.join(', ')} — falta "Fecha" o "Total"`);
            return;
          }

          const parseDateVal = v => {
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return parseDate(v);
          };

          // Maneja formato argentino: "1.500,00" → 1500; números raw pasan directo
          const parseAmount = v => {
            if (typeof v === 'number') return v;
            let s = String(v || '').replace(/[^\d,.]/g, '');
            if (!s) return 0;
            if (s.includes(',')) {
              s = s.replace(/\./g, '').replace(',', '.'); // puntos = miles, coma = decimal
            } else {
              s = s.replace(/\./g, ''); // puntos = separadores de miles
            }
            return parseFloat(s) || 0;
          };

          const mapped = rows.map(r => ({
            date:        parseDateVal(r[colFecha]),
            description: colProduct ? String(r[colProduct] || '').trim() : '',
            amount:      parseAmount(r[colTotal]),
            paymentType: colCuotas ? String(r[colCuotas] || '').trim() : '',
          })).filter(r => r.date && r.amount > 0);

          if (!mapped.length) {
            App.toast('error', 'Filas encontradas pero ninguna tiene fecha y monto válidos');
            return;
          }
          showImportPreview(mapped);
        } catch (err) {
          App.toast('error', 'No se pudo leer el archivo: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  function parseInstallments(s) {
    if (!s) return 1;
    const str = String(s).toLowerCase().trim();
    if (!str || str === 'contado') return 1;
    const m = str.match(/(\d+)/);
    const n = m ? parseInt(m[1]) : 1;
    return n > 1 ? n : 1;
  }

  function showImportPreview(rows) {
    const tableRows = rows.slice(0, 60).map(r => `
      <tr>
        <td class="text-sm">${r.date}</td>
        <td class="text-sm font-medium">${r.description || '—'}</td>
        <td class="text-sm" style="color:var(--color-text-muted)">${r.paymentType || '—'}</td>
        <td class="text-sm font-medium" style="color:var(--color-danger)">${fmt(r.amount)}</td>
      </tr>
    `).join('');
    const extra = rows.length > 60 ? `<div class="form-hint" style="margin-top:var(--space-2)">+${rows.length - 60} filas más…</div>` : '';
    const total = rows.reduce((s, r) => s + r.amount, 0);

    App.openModal({
      title: `Importar ${rows.length} gastos — ${fmt(total)} total`,
      size: 'modal-lg',
      body: `
        <div class="form-group" style="margin-bottom:var(--space-4)">
          <label class="form-label">Categoría para todos</label>
          <select class="form-select" id="fImportCat">
            ${Object.entries(EXP_CATS).map(([k, v]) => `<option value="${k}" ${k === 'ingredientes' ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <div class="form-hint">Podés editar gastos individualmente después de importar.</div>
        </div>
        <div style="max-height:340px;overflow-y:auto;border:1px solid var(--color-border-light);border-radius:var(--radius-sm)">
          <table class="table" style="margin:0">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Pago</th><th>Total</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        ${extra}
      `,
      primaryLabel: `Importar ${rows.length} gastos`,
      onConfirm: () => {
        const cat = document.getElementById('fImportCat').value;
        let count = 0;
        rows.forEach(r => {
          const n = parseInstallments(r.paymentType);
          createInstallments({ date: r.date, description: r.description || 'Sin descripción', amount: r.amount, category: cat }, n);
          count += n;
        });
        App.toast('success', `${rows.length} compra${rows.length !== 1 ? 's' : ''} → ${count} registro${count !== 1 ? 's' : ''} importado${count !== 1 ? 's' : ''}`);
        render(document.getElementById('pageContent'));
        return true;
      },
    });
  }

  // ─── Comprobante (imagen / PDF) ───────────────────────────────────────────────
  function openWithReceipt() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const isPDF = file.type === 'application/pdf';
      App.openModal({
        title: 'Cargar comprobante',
        size: 'modal-lg',
        body: `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);align-items:start">
            <div style="background:var(--color-border-light);border-radius:var(--radius-sm);overflow:hidden;min-height:200px;display:flex;align-items:center;justify-content:center">
              ${isPDF
                ? `<iframe src="${url}" style="width:100%;height:400px;border:none"></iframe>`
                : `<img src="${url}" style="width:100%;max-height:400px;object-fit:contain;display:block" />`
              }
            </div>
            <div>
              <div class="form-hint" style="margin-bottom:var(--space-4)">Registrá solo los productos del negocio. Si aparece algo nuevo que necesitás comprar, agregalo primero en Ingredientes.</div>
              ${buildExpenseForm()}
            </div>
          </div>
        `,
        primaryLabel: 'Registrar gasto',
        // El archivo nunca se guarda — se libera al cerrar el modal (confirm, cancelar, X o Escape)
        onClose: () => URL.revokeObjectURL(url),
        onConfirm: () => saveExpense(null),
      });
    };
    input.click();
  }

  function renderMonthBar(label, revenue, expenses) {
    const max = Math.max(revenue, expenses, 1);
    const revPct = Math.round((revenue / max) * 100);
    const expPct = Math.round((expenses / max) * 100);
    return `
      <div>
        <div class="text-xs text-muted" style="margin-bottom: var(--space-2)">${label}</div>
        <div style="display: flex; flex-direction: column; gap: 4px">
          <div style="display: flex; align-items: center; gap: var(--space-2)">
            <div style="width: 60px; text-align: right; font-size: var(--text-xs); color: var(--color-text-muted)">Ingr.</div>
            <div style="flex:1; height: 12px; background: var(--color-border-light); border-radius: var(--radius-full); overflow: hidden">
              <div style="height:100%; width: ${revPct}%; background: var(--color-primary); border-radius: var(--radius-full)"></div>
            </div>
            <div style="width: 80px; font-size: var(--text-xs); font-weight: 500">${fmt(revenue)}</div>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-2)">
            <div style="width: 60px; text-align: right; font-size: var(--text-xs); color: var(--color-text-muted)">Gastos</div>
            <div style="flex:1; height: 12px; background: var(--color-border-light); border-radius: var(--radius-full); overflow: hidden">
              <div style="height:100%; width: ${expPct}%; background: var(--color-accent); border-radius: var(--radius-full)"></div>
            </div>
            <div style="width: 80px; font-size: var(--text-xs); font-weight: 500">${fmt(expenses)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function last6Months() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      months.push({ key, label });
    }
    return months;
  }

  function render(container) {
    const month   = currentMonth();
    const data    = getMonthData(month);
    const months  = last6Months();
    const expsByMonth = months.map(m => {
      const d = getMonthData(m.key);
      return { ...m, revenue: d.revenue, expenses: d.totalExp };
    });

    // Expense breakdown by category
    const byCat = {};
    data.expenses.forEach(e => {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <h1 class="page-title">Finanzas</h1>
          <p class="page-subtitle">Ingresos, gastos y rentabilidad del emprendimiento.</p>
        </div>

        <!-- Month KPIs -->
        <div class="grid-4" style="margin-bottom: var(--space-8)">
          <div class="stat-card" style="--stat-color: var(--color-primary)">
            <div class="stat-label">Ingresos este mes</div>
            <div class="stat-value">${fmt(data.revenue)}</div>
            <div class="stat-meta">Pedidos cobrados</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--color-warning)">
            <div class="stat-label">Por cobrar</div>
            <div class="stat-value">${fmt(data.pending)}</div>
            <div class="stat-meta">Pedidos sin cobrar</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--color-accent)">
            <div class="stat-label">Gastos este mes</div>
            <div class="stat-value">${fmt(data.totalExp)}</div>
            <div class="stat-meta">${data.expenses.length} registros</div>
          </div>
          <div class="stat-card" style="--stat-color: ${data.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
            <div class="stat-label">Ganancia neta</div>
            <div class="stat-value ${data.profit < 0 ? 'text-danger' : ''}">${fmt(data.profit)}</div>
            <div class="stat-meta">Ingresos − Gastos</div>
          </div>
        </div>

        <div class="grid-2" style="align-items: start; margin-bottom: var(--space-8)">

          <!-- Chart last 6 months -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Últimos 6 meses</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-4)">
              ${expsByMonth.map(m => renderMonthBar(m.label, m.revenue, m.expenses)).join('')}
            </div>
            <div class="d-flex gap-4 mt-4" style="font-size: var(--text-xs); color: var(--color-text-muted)">
              <div class="d-flex items-center gap-1"><div style="width:10px;height:10px;border-radius:50%;background:var(--color-primary)"></div> Ingresos cobrados</div>
              <div class="d-flex items-center gap-1"><div style="width:10px;height:10px;border-radius:50%;background:var(--color-accent)"></div> Gastos</div>
            </div>
          </div>

          <!-- Expense breakdown -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Gastos por categoría</div>
              <div class="card-subtitle">Este mes</div>
            </div>
            ${Object.keys(byCat).length === 0 ? '<div class="empty-state" style="padding: var(--space-8)"><div class="empty-state-title">Sin gastos registrados</div></div>' : `
              <div style="display: flex; flex-direction: column; gap: var(--space-3)">
                ${Object.entries(byCat).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                  const pct = data.totalExp > 0 ? Math.round((amt / data.totalExp) * 100) : 0;
                  return `
                    <div>
                      <div class="d-flex justify-between items-center" style="margin-bottom: var(--space-1)">
                        <span class="text-sm">${EXP_CATS[cat] || cat}</span>
                        <span class="text-sm font-medium">${fmt(amt)} <span class="text-muted">(${pct}%)</span></span>
                      </div>
                      <div class="progress">
                        <div class="progress-bar" style="width: ${pct}%; background: var(--color-accent)"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Expenses table -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Registro de gastos</div>
              <div class="card-subtitle">Todos los gastos ingresados</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-ghost btn-sm" onclick="FinancesModule.openWithReceipt()">Subir comprobante</button>
              <button class="btn btn-sm btn-primary" onclick="FinancesModule.importFromExcel()">Importar Excel</button>
            </div>
          </div>
          <div class="table-wrapper" style="border:none; margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-6)); border-radius: 0">
            <table class="table">
              <thead>
                <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th></th></tr>
              </thead>
              <tbody>
                ${Store.expenses.all().sort((a,b) => b.date.localeCompare(a.date)).map(renderExpRow).join('')}
                ${Store.expenses.count() === 0 ? '<tr><td colspan="5"><div class="empty-state" style="padding: var(--space-8)"><div class="empty-state-title">Sin gastos</div></div></td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  return { render, openCreateModal, openEditExpense, removeExpense, importFromExcel, openWithReceipt };
})();
