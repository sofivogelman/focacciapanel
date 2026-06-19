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
        <td class="td-hide-mobile"><span class="badge badge-default">${EXP_CATS[e.category] || e.category}</span></td>
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
    const isEdit    = !!e;
    const isCat     = isEdit ? e.category : 'ingredientes';
    const showStock = !isEdit;
    const ingredients = Store.ingredients.all().sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <input class="form-input" id="fExpDesc" value="${isEdit ? e.description : ''}" placeholder="Compra de harina, gas, etc." list="expIngredientsList" autocomplete="off" required />
        <datalist id="expIngredientsList">
          ${ingredients.map(i => `<option value="${i.name}">`).join('')}
        </datalist>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Monto *</label>
          <input type="number" class="form-input" id="fExpAmount" value="${isEdit ? e.amount : ''}" min="0" step="1" placeholder="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="fExpCat" onchange="FinancesModule.toggleStockFields()">
            ${Object.entries(EXP_CATS).map(([k,v]) => `<option value="${k}" ${(isEdit ? e.category : 'ingredientes') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>

      ${showStock ? `
      <div id="fExpStockGroup" style="background:var(--color-primary-subtle);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);display:${isCat === 'ingredientes' ? 'block' : 'none'}">
        <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-3)">Actualizar inventario (opcional)</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Ingrediente comprado</label>
            <select class="form-select" id="fExpIng" onchange="FinancesModule.onIngredientChange()">
              <option value="">— No actualizar stock —</option>
              ${ingredients.map(i => `<option value="${i.id}" data-unit="${i.unit}">
                ${i.name} (stock actual: ${i.stock} ${i.unit})
              </option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="fExpQtyGroup" style="margin-bottom:0;display:none">
            <label class="form-label">Cantidad comprada (<span id="fExpIngUnit">unidad</span>)</label>
            <input type="number" class="form-input" id="fExpQty" min="0" step="0.01" placeholder="0" />
          </div>
        </div>
      </div>
      ` : ''}

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

  function toggleStockFields() {
    const cat   = document.getElementById('fExpCat')?.value;
    const group = document.getElementById('fExpStockGroup');
    if (group) group.style.display = cat === 'ingredientes' ? 'block' : 'none';
  }

  function onIngredientChange() {
    const sel     = document.getElementById('fExpIng');
    const opt     = sel?.options[sel.selectedIndex];
    const unit    = opt?.dataset.unit || '';
    const qtyGrp  = document.getElementById('fExpQtyGroup');
    const unitLbl = document.getElementById('fExpIngUnit');
    if (qtyGrp)  qtyGrp.style.display  = opt?.value ? 'block' : 'none';
    if (unitLbl) unitLbl.textContent    = unit;
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

      // Actualizar stock del ingrediente si se seleccionó uno
      const ingId = parseInt(document.getElementById('fExpIng')?.value || '0');
      const qty   = parseFloat(document.getElementById('fExpQty')?.value || '0');
      if (ingId && qty > 0) {
        const ing = Store.ingredients.find(ingId);
        if (ing) {
          const newStock = Math.round((ing.stock + qty) * 100) / 100;
          Store.ingredients.update(ingId, { stock: newStock });
          App.toast('success', `Stock de ${ing.name}: +${qty} ${ing.unit} → ${newStock} ${ing.unit}`);
        }
      } else {
        App.toast('success', installments > 1 ? `Gasto en ${installments} cuotas registrado` : 'Gasto registrado');
      }
    }
    if (Router.current() === 'finances') render(document.getElementById('pageContent'));
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
    // DD/MM/YY o DD/MM/YYYY
    const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mSlash) {
      const year = mSlash[3].length === 2 ? '20' + mSlash[3] : mSlash[3];
      return `${year}-${mSlash[2].padStart(2, '0')}-${mSlash[1].padStart(2, '0')}`;
    }
    // DD-MMM o DD MMM (ej: "30-may", "11-jun")
    const MESES = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
                    jan:1,                              apr:4,            aug:8,            dec:12 };
    const mDash = s.match(/^(\d{1,2})[-\s]([a-z]{3})/i);
    if (mDash) {
      const mon = MESES[mDash[2].toLowerCase()];
      if (mon) {
        const year = new Date().getFullYear();
        return `${year}-${String(mon).padStart(2,'0')}-${mDash[1].padStart(2,'0')}`;
      }
    }
    return '';
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

          // Normaliza nombre de columna: minúsculas, sin BOM ni espacios invisibles
          const nk = k => String(k)
            .replace(/[​‌‍﻿ ]/g, '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().trim();
          const colKeys = Object.keys(rows[0]);
          const findCol = (...names) => {
            for (const n of names) {
              const k = colKeys.find(k => nk(k).includes(n));
              if (k) return k;
            }
            return null;
          };

          const colFecha   = findCol('fecha');
          const colTotal   = findCol('total', 'monto', 'importe', 'precio');
          const colProduct = findCol('producto', 'descripcion', 'detalle', 'descripci');
          const colCuotas  = findCol('cuota', 'contado');

          if (!colFecha || !colTotal) {
            const falta = [!colFecha && '"Fecha"', !colTotal && '"Monto/Total"'].filter(Boolean).join(' y ');
            App.toast('error', `Columnas: ${colKeys.join(', ')} — falta ${falta}`);
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
  const GEMINI_KEY_LS = 'focaccia_gemini_key';
  let _rrc = 0; // receipt row counter for unique IDs

  function getGeminiKey() {
    return localStorage.getItem(GEMINI_KEY_LS) || '';
  }

  async function analyzeReceiptWithGemini(base64Data, mimeType) {
    const key = getGeminiKey();
    if (!key) { App.toast('error', 'Configurá tu clave Gemini en Configuración → IA'); return null; }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'Sos un asistente para una emprendedora de focaccia argentina. Analizá este ticket/factura y extraé CADA ITEM por separado con su precio individual. Para cada item intentá identificar si es un ingrediente de panadería/cocina (harina, aceite, levadura, sal, azúcar, tomate, queso, papa, romero, etc.) e indicá la cantidad y unidad si aparece en el texto (ej: 2kg → cantidad:2000, unidad:"g"). Respondé SOLO con un JSON array sin markdown: [{"descripcion":"nombre del producto","monto":1234,"ingrediente":"nombre si es ingrediente o null","cantidad":null,"unidad":null}]. Si no podés separar items, devolvé el total como un solo objeto en el array.' },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]}]
      }),
    });
    if (!res.ok) { App.toast('error', 'Error al llamar a Gemini: ' + res.status); return null; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch { App.toast('error', 'No se pudo leer la respuesta de Gemini'); return null; }
  }

  function _receiptIngOptions(selectedId) {
    const ingredients = Store.ingredients.all().sort((a, b) => a.name.localeCompare(b.name));
    return `<option value="">— No actualizar stock —</option>` +
      ingredients.map(i =>
        `<option value="${i.id}" data-unit="${i.unit}" ${i.id === selectedId ? 'selected' : ''}>${i.name} (${i.stock} ${i.unit})</option>`
      ).join('');
  }

  function _tryMatchIngredient(nombre) {
    if (!nombre) return null;
    const lower = (nombre || '').toLowerCase();
    return Store.ingredients.all().find(i => lower.includes(i.name.toLowerCase().slice(0, 5))) || null;
  }

  function addReceiptRow(item = {}) {
    const list  = document.getElementById('receiptItemsList');
    if (!list) return;
    const idx   = _rrc++;
    const match = item.ingrediente ? _tryMatchIngredient(item.ingrediente) : null;
    const div   = document.createElement('div');
    div.id        = `rrow_${idx}`;
    div.className = 'receipt-item-row';
    div.style     = 'border-bottom:var(--border-light);padding:var(--space-3) 0;display:flex;flex-direction:column;gap:var(--space-2)';
    div.innerHTML = `
      <div class="d-flex gap-2 items-center">
        <input type="text" class="form-input flex-1" id="riDesc_${idx}"
          value="${(item.descripcion || '').replace(/"/g, '&quot;')}" placeholder="Descripción del item" style="height:34px" />
        <input type="number" class="form-input" id="riMonto_${idx}"
          value="${item.monto || ''}" min="0" step="1" placeholder="$0"
          style="width:100px;height:34px;text-align:right"
          oninput="FinancesModule.recalcReceiptTotal()" />
        <button class="btn btn-ghost btn-icon btn-sm" title="Eliminar"
          onclick="document.getElementById('rrow_${idx}').remove();FinancesModule.recalcReceiptTotal()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="d-flex gap-2 items-center" style="padding-left:2px">
        <select class="form-select" id="riIng_${idx}" style="height:30px;font-size:var(--text-xs);flex:1"
          onchange="FinancesModule.onReceiptIngChange(${idx})">
          ${_receiptIngOptions(match?.id)}
        </select>
        <input type="number" class="form-input" id="riQty_${idx}" min="0" step="0.01"
          placeholder="Cantidad" value="${item.cantidad || ''}"
          style="width:90px;height:30px;font-size:var(--text-xs);display:${match ? 'block' : 'none'}" />
        <span class="text-xs text-muted" id="riUnit_${idx}" style="white-space:nowrap;display:${match ? 'inline' : 'none'}">${match?.unit || ''}</span>
      </div>
    `;
    list.appendChild(div);
    recalcReceiptTotal();
  }

  function onReceiptIngChange(idx) {
    const sel  = document.getElementById(`riIng_${idx}`);
    const opt  = sel?.options[sel.selectedIndex];
    const unit = opt?.dataset.unit || '';
    const show = !!opt?.value;
    const qty  = document.getElementById(`riQty_${idx}`);
    const lbl  = document.getElementById(`riUnit_${idx}`);
    if (qty) qty.style.display = show ? 'block' : 'none';
    if (lbl) { lbl.style.display = show ? 'inline' : 'none'; lbl.textContent = unit; }
  }

  function recalcReceiptTotal() {
    let total = 0;
    document.querySelectorAll('[id^="riMonto_"]').forEach(el => {
      total += parseFloat(el.value) || 0;
    });
    const el = document.getElementById('receiptGrandTotal');
    if (el) el.textContent = fmt(total);
  }

  function saveReceiptItems() {
    const date = document.getElementById('rDate')?.value || new Date().toISOString().slice(0, 10);
    const cat  = document.getElementById('rCat')?.value  || 'ingredientes';
    const rows = document.querySelectorAll('.receipt-item-row');
    if (!rows.length) { App.toast('error', 'Agregá al menos un item'); return false; }

    let saved = 0;
    let stockMsgs = [];

    rows.forEach(row => {
      const idMatch = row.id.match(/rrow_(\d+)/);
      if (!idMatch) return;
      const idx   = idMatch[1];
      const desc  = document.getElementById(`riDesc_${idx}`)?.value.trim();
      const monto = parseFloat(document.getElementById(`riMonto_${idx}`)?.value);
      if (!desc || !monto || monto <= 0) return;

      Store.expenses.create({ description: desc, amount: monto, category: cat, date });
      saved++;

      const ingId = parseInt(document.getElementById(`riIng_${idx}`)?.value || '0');
      const qty   = parseFloat(document.getElementById(`riQty_${idx}`)?.value  || '0');
      if (ingId && qty > 0) {
        const ing = Store.ingredients.find(ingId);
        if (ing) {
          const newStock = Math.round((ing.stock + qty) * 100) / 100;
          Store.ingredients.update(ingId, { stock: newStock });
          stockMsgs.push(`${ing.name} +${qty}${ing.unit}`);
        }
      }
    });

    if (!saved) { App.toast('error', 'Ningún item tiene descripción y monto'); return false; }

    App.toast('success', `${saved} gasto${saved !== 1 ? 's' : ''} registrado${saved !== 1 ? 's' : ''}${stockMsgs.length ? ' · Stock: ' + stockMsgs.join(', ') : ''}`);
    render(document.getElementById('pageContent'));
    return true;
  }

  function openWithReceipt() {
    const input   = document.createElement('input');
    input.type    = 'file';
    input.accept  = 'image/*,application/pdf';
    input.capture = 'environment';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url       = URL.createObjectURL(file);
      const isPDF     = file.type === 'application/pdf';
      const hasGemini = !!getGeminiKey();
      _rrc = 0;

      const catOptions = Object.entries(EXP_CATS)
        .map(([k, v]) => `<option value="${k}" ${k === 'ingredientes' ? 'selected' : ''}>${v}</option>`).join('');

      App.openModal({
        title: 'Cargar comprobante',
        size: 'modal-lg',
        body: `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);align-items:start" class="receipt-grid">

            <!-- Imagen -->
            <div style="display:flex;flex-direction:column;gap:var(--space-3)">
              <div style="background:var(--color-border-light);border-radius:var(--radius-sm);overflow:hidden;min-height:160px;display:flex;align-items:center;justify-content:center">
                ${isPDF
                  ? `<iframe src="${url}" style="width:100%;height:340px;border:none"></iframe>`
                  : `<img src="${url}" style="width:100%;max-height:340px;object-fit:contain;display:block" />`
                }
              </div>
              ${!isPDF ? `
                <button class="btn btn-secondary btn-sm" id="btnDetectar" ${!hasGemini ? 'disabled title="Configurá tu clave Gemini primero"' : ''}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/></svg>
                  Auto-detectar items con IA
                </button>
                ${!hasGemini ? '<div class="form-hint">Configurá tu clave Gemini en Configuración para usar esta función.</div>' : ''}
              ` : ''}
            </div>

            <!-- Items -->
            <div>
              <div class="form-row" style="margin-bottom:var(--space-4)">
                <div class="form-group">
                  <label class="form-label">Fecha</label>
                  <input type="date" class="form-input" id="rDate" value="${new Date().toISOString().slice(0,10)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Categoría</label>
                  <select class="form-select" id="rCat">${catOptions}</select>
                </div>
              </div>

              <div class="text-xs font-semibold" style="color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">Items del comprobante</div>
              <div id="receiptItemsList" style="min-height:60px;max-height:320px;overflow-y:auto"></div>

              <button class="btn btn-ghost btn-sm" style="margin-top:var(--space-2)" onclick="FinancesModule.addReceiptRow()">+ Agregar item</button>

              <div class="d-flex justify-between items-center" style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:var(--border)">
                <span class="text-sm font-semibold">Total</span>
                <span class="font-semibold text-primary" id="receiptGrandTotal">$0</span>
              </div>
            </div>
          </div>
        `,
        primaryLabel: 'Registrar gastos',
        onClose: () => URL.revokeObjectURL(url),
        onOpen: () => {
          addReceiptRow(); // fila vacía inicial

          const btn = document.getElementById('btnDetectar');
          if (!btn) return;
          btn.addEventListener('click', async () => {
            btn.disabled    = true;
            btn.textContent = 'Analizando…';
            const reader    = new FileReader();
            reader.onload   = async evt => {
              const b64   = evt.target.result.split(',')[1];
              const items = await analyzeReceiptWithGemini(b64, file.type);
              btn.disabled = false;
              btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/></svg> Auto-detectar items con IA';
              if (items?.length) {
                document.getElementById('receiptItemsList').innerHTML = '';
                _rrc = 0;
                items.forEach(item => addReceiptRow(item));
                App.toast('success', `${items.length} item${items.length !== 1 ? 's' : ''} detectado${items.length !== 1 ? 's' : ''} — revisá y corregí si hace falta`);
              }
            };
            reader.readAsDataURL(file);
          });
        },
        onConfirm: () => saveReceiptItems(),
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

  function relevantMonths() {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const set = new Set();
    // Siempre incluir los últimos 3 meses + actual
    for (let i = -3; i <= 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(d.toISOString().slice(0, 7));
    }
    // Agregar meses futuros que tengan gastos (cuotas), hasta 24 meses adelante
    const maxFuture = new Date(now.getFullYear(), now.getMonth() + 24, 1).toISOString().slice(0, 7);
    Store.expenses.all().forEach(e => {
      const m = (e.date || '').slice(0, 7);
      if (m > thisMonth && m <= maxFuture) set.add(m);
    });
    return [...set].sort().map(key => {
      const d = new Date(key + '-01T12:00:00');
      return { key, label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) };
    });
  }

  function renderMonthlyTable(months) {
    const current = currentMonth();
    return `
      <div class="card" style="margin-bottom:var(--space-6)">
        <div class="card-header">
          <div>
            <div class="card-title">Resultados por mes</div>
            <div class="card-subtitle">Ingresos cobrados · gastos comprometidos (incluye cuotas)</div>
          </div>
        </div>
        <div class="table-wrapper" style="border:none;margin:calc(-1 * var(--space-4)) calc(-1 * var(--space-6));border-radius:0">
          <table class="table">
            <thead><tr><th>Mes</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th><th style="text-align:right">Ganancia</th></tr></thead>
            <tbody>
              ${months.map(m => {
                const d = getMonthData(m.key);
                const profit = d.revenue - d.totalExp;
                const hasData = d.revenue > 0 || d.totalExp > 0;
                const isCurrent = m.key === current;
                const dash = `<span style="color:var(--color-text-muted)">—</span>`;
                return `
                  <tr${isCurrent ? ' style="background:var(--color-primary-subtle,#f0f7f4)"' : ''}>
                    <td class="font-medium text-sm" style="text-transform:capitalize">
                      ${m.label}${isCurrent ? ' <span class="badge badge-primary" style="margin-left:4px">Actual</span>' : ''}
                    </td>
                    <td class="text-sm" style="text-align:right">${d.revenue > 0 ? fmt(d.revenue) : dash}</td>
                    <td class="text-sm" style="text-align:right${d.totalExp > 0 ? ';color:var(--color-danger)' : ''}">${d.totalExp > 0 ? fmt(d.totalExp) : dash}</td>
                    <td class="text-sm" style="text-align:right;font-weight:600;color:${profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${hasData ? fmt(profit) : dash}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function render(container) {
    const month   = currentMonth();
    const data    = getMonthData(month);
    const months  = relevantMonths();
    const expsByMonth = months.map(m => {
      const d = getMonthData(m.key);
      return { ...m, revenue: d.revenue, expenses: d.totalExp };
    });

    // Expense breakdown by category (this month)
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

        <!-- KPIs del mes actual -->
        <div class="grid-4" style="margin-bottom:var(--space-6)">
          <div class="stat-card" style="--stat-color:var(--color-primary)">
            <div class="stat-label">Ingresos este mes</div>
            <div class="stat-value">${fmt(data.revenue)}</div>
            <div class="stat-meta">Pedidos cobrados</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-warning)">
            <div class="stat-label">Por cobrar</div>
            <div class="stat-value">${fmt(data.pending)}</div>
            <div class="stat-meta">Pedidos sin cobrar</div>
          </div>
          <div class="stat-card" style="--stat-color:var(--color-accent)">
            <div class="stat-label">Gastos este mes</div>
            <div class="stat-value">${fmt(data.totalExp)}</div>
            <div class="stat-meta">${data.expenses.length} registro${data.expenses.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="stat-card" style="--stat-color:${data.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
            <div class="stat-label">Ganancia neta</div>
            <div class="stat-value ${data.profit < 0 ? 'text-danger' : ''}">${fmt(data.profit)}</div>
            <div class="stat-meta">Ingresos − Gastos</div>
          </div>
        </div>

        <!-- Tabla de resultados por mes -->
        ${renderMonthlyTable(months)}

        <!-- Gráfico evolución + Categorías -->
        <div class="grid-2" style="align-items:start;margin-bottom:var(--space-6)">

          <div class="card">
            <div class="card-header">
              <div class="card-title">Evolución mensual</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-4)">
              ${expsByMonth.map(m => renderMonthBar(m.label, m.revenue, m.expenses)).join('')}
            </div>
            <div class="d-flex gap-4 mt-4" style="font-size:var(--text-xs);color:var(--color-text-muted)">
              <div class="d-flex items-center gap-1"><div style="width:10px;height:10px;border-radius:50%;background:var(--color-primary)"></div> Ingresos</div>
              <div class="d-flex items-center gap-1"><div style="width:10px;height:10px;border-radius:50%;background:var(--color-accent)"></div> Gastos</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Gastos por categoría</div>
              <div class="card-subtitle">Este mes</div>
            </div>
            ${Object.keys(byCat).length === 0 ? '<div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-title">Sin gastos este mes</div></div>' : `
              <div style="display:flex;flex-direction:column;gap:var(--space-3)">
                ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const pct = data.totalExp > 0 ? Math.round((amt / data.totalExp) * 100) : 0;
                  return `
                    <div>
                      <div class="d-flex justify-between items-center" style="margin-bottom:var(--space-1)">
                        <span class="text-sm">${EXP_CATS[cat] || cat}</span>
                        <span class="text-sm font-medium">${fmt(amt)} <span class="text-muted">(${pct}%)</span></span>
                      </div>
                      <div class="progress"><div class="progress-bar" style="width:${pct}%;background:var(--color-accent)"></div></div>
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
              <button class="btn btn-ghost btn-sm" onclick="FinancesModule.clearAllExpenses()" style="color:var(--color-danger)">Eliminar todos</button>
              <button class="btn btn-ghost btn-sm" onclick="FinancesModule.openWithReceipt()">Subir comprobante</button>
              <button class="btn btn-sm btn-primary" onclick="FinancesModule.importFromExcel()">Importar Excel</button>
            </div>
          </div>
          <div class="table-wrapper" style="border:none; margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-6)); border-radius: 0">
            <table class="table">
              <thead>
                <tr><th>Fecha</th><th>Descripción</th><th class="th-hide-mobile">Categoría</th><th>Monto</th><th></th></tr>
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

  function clearAllExpenses() {
    const count = Store.expenses.count();
    if (!count) { App.toast('error', 'No hay gastos para eliminar'); return; }
    if (!confirm(`¿Eliminás los ${count} gastos registrados? Esta acción no se puede deshacer.`)) return;
    Store.expenses.all().forEach(e => Store.expenses.remove(e.id));
    App.toast('success', `${count} gasto${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`);
    render(document.getElementById('pageContent'));
  }

  return { render, openCreateModal, openEditExpense, removeExpense, importFromExcel, openWithReceipt, clearAllExpenses, toggleStockFields, onIngredientChange, addReceiptRow, recalcReceiptTotal, onReceiptIngChange };
})();
