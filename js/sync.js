/**
 * Sync — Módulo de sincronización con Google Sheets via GAS Web App.
 *
 * Flujo:
 *   Google Form → Google Sheets → GAS Web App (doGet)
 *                                       ↑ polling cada N seg
 *   Dashboard local ────────────────────
 *
 * No requiere servidor propio. El GAS Web App actúa como API JSON pública.
 */
const Sync = (() => {
  const CONFIG_KEY = 'focaccia_sync_config';

  let pollingTimer       = null;
  let knownTimestamps    = new Set();   // timestamps ya importados
  let isPolling          = false;       // mutex para evitar solapamiento

  // ─── Config ──────────────────────────────────────────────────────────────────
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : { url: '', interval: 15, enabled: false };
    } catch { return { url: '', interval: 15, enabled: false }; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  // ─── Estado de timestamps conocidos ─────────────────────────────────────────
  function buildKnownSet() {
    knownTimestamps = new Set(
      Store.orders.where(o => o.gasTimestamp).map(o => o.gasTimestamp)
    );
  }

  // ─── Helpers de matching formato/sabor ──────────────────────────────────────
  // Modificador de tamaño según formato del pedido
  const FORMAT_MOD = {
    'chica': 0.5, 'pequeña': 0.5, 'mini': 0.5, 'personal': 0.5,
    'mediana': 0.75,
    'familiar': 1.0, 'estandar': 1.0, 'normal': 1.0,
    'grande': 1.5, 'xl': 1.5, 'extra': 1.5,
  };

  function formatModifier(fmt) {
    return FORMAT_MOD[(fmt || '').toLowerCase().trim()] || 1.0;
  }

  /**
   * matchProduct — Busca el sabor configurado más afín al flavor del pedido.
   * Usa Store.flavors (config) como fuente primaria; Store.products como fallback.
   */
  function matchProduct(flavor) {
    if (!flavor) return null;
    // Limpiar calificadores de promo antes de buscar el sabor base
    const clean = flavor.replace(/\(sin\s+individual[^)]*\)/gi, '').trim();
    const words  = clean.toLowerCase().split(/[\s,()y\+&]+/).filter(w => w.length > 2);

    const cfgFlavors = Store.flavors.where(f => f.active);
    if (cfgFlavors.length > 0) {
      const scored = cfgFlavors
        .map(f => ({ f, hits: words.filter(w => f.name.toLowerCase().includes(w)).length }))
        .filter(s => s.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      if (scored[0]) return { id: null, name: scored[0].f.name, price: 0 };
    }

    // Fallback: Store.products (catálogo manual previo)
    const products = Store.products.where(p => p.active);
    const scored   = products
      .map(p => ({ p, hits: words.filter(w => p.name.toLowerCase().includes(w)).length }))
      .filter(s => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return scored[0]?.p || null;
  }

  function buildItemName(gi) {
    const parts = [];
    if (gi.format) parts.push(gi.format);
    if (gi.flavor) parts.push(`(${gi.flavor})`);
    return parts.join(' ') || 'Focaccia';
  }

  // ─── Normalización de datos GAS → Store ──────────────────────────────────────
  /**
   * normalizeRow — Convierte la fila GAS al formato del Store.
   *
   * row viene de google-trigger.js::parseRow():
   *   { timestamp, date, client, phone, zone, items:[{qty,format,flavor}], notes, total }
   *
   * - Crea o reutiliza cliente por nombre exacto
   * - Por cada GAS item: busca producto en catálogo, aplica modificador de formato
   * - Usa el total de la columna I (si existe) como autoridad; si no, calcula
   */
  function normalizeRow(row) {
    // 1. Buscar o crear cliente
    const clientName = (row.client || '').trim();
    const clientLow  = clientName.toLowerCase();
    let client = clientLow
      ? Store.clients.where(c => c.name.toLowerCase() === clientLow)[0]
      : null;

    if (!client && clientName) {
      client = Store.clients.create({
        name:    clientName,
        phone:   row.phone || '',
        email:   '',
        address: row.zone  || '',
        notes:   'Importado desde Google Sheets',
      });
    }

    // 2. Convertir [{qty, format, flavor}] → store items [{productId, name, qty, price, format, flavor}]
    const gasItems   = Array.isArray(row.items) ? row.items : [];
    const storeItems = gasItems.map(gi => {
      // Si el formato viene vacío (regex vieja en GAS), intentar extraerlo del sabor
      let format = gi.format || '';
      let flavor = gi.flavor || '';
      if (!format && flavor) {
        const activeFormats = Store.formats.where(f => f.active);
        const found = activeFormats.find(f => flavor.toLowerCase().startsWith(f.name.toLowerCase() + ' '));
        if (found) { format = found.name; flavor = flavor.slice(found.name.length).replace(/^\s*\(|\)\s*$/g, '').trim(); }
      }

      // Buscar precio: promo configurada > formato configurado > producto > 0
      const cfgPromo  = typeof ConfigModule !== 'undefined' ? ConfigModule.resolvePromo(flavor) : null;
      const cfgFormat = Store.formats.where(f => f.active && f.name.toLowerCase() === format.toLowerCase())[0];
      const product   = matchProduct(flavor);
      const modifier  = formatModifier(format);

      let price = 0;
      if (cfgPromo?.promo?.price)  price = cfgPromo.promo.price;
      else if (cfgFormat?.price)   price = cfgFormat.price;
      else if (product)            price = Math.round(product.price * modifier);

      return {
        productId: product?.id || null,
        name:      buildItemName({ format, flavor }),
        qty:       Math.max(1, gi.qty || 1),
        price,
        format,
        flavor,
      };
    });

    // 3. Total: columna I si existe y es válido; sino calcular desde items
    const sheetTotal = row.total || 0;
    const calcTotal  = storeItems.reduce((s, i) => s + i.qty * i.price, 0);
    const total      = sheetTotal > 0 ? sheetTotal : calcTotal;

    // 4. Fechas: usar col B (date), fallback a timestamp truncado
    // Normaliza DD/MM/YY o DD/MM/YYYY → YYYY-MM-DD
    function toISODate(str) {
      if (!str) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      const p = str.split('/');
      if (p.length === 3) {
        const y = p[2].length === 2 ? '20' + p[2] : p[2];
        return `${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      }
      return null;
    }
    const orderDate = toISODate(row.date)
      || toISODate(row.timestamp)
      || new Date().toISOString().slice(0, 10);
    const delivDate = new Date(new Date(orderDate + 'T12:00:00').getTime() + 2 * 864e5)
      .toISOString().slice(0, 10);

    return {
      clientId:     client?.id || null,
      clientName:   clientName || 'Sin nombre',
      date:         orderDate,
      deliveryDate: delivDate,
      status:       'pendiente',
      items:        storeItems.length > 0
        ? storeItems
        : [{ productId: null, name: 'Pedido sin detallar', qty: 1, price: total }],
      total,
      paymentMethod: 'efectivo',
      paid:          false,
      notes:         row.notes || '',
      zone:          row.zone  || '',
      fromGAS:       true,
      gasTimestamp:  row.timestamp || '',
    };
  }

  // ─── Polling ──────────────────────────────────────────────────────────────────
  async function poll() {
    const cfg = loadConfig();
    if (!cfg.url || isPolling) return;

    isPolling = true;
    setStatus('polling');
    spinIcon(true);

    try {
      const resp = await fetch(cfg.url, { method: 'GET', cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Respuesta inválida del servidor');

      const rows = data.rows || [];

      // Refrescar set de conocidos (puede haber cambiado por ediciones manuales)
      buildKnownSet();

      const newRows = rows.filter(r => r.timestamp && !knownTimestamps.has(r.timestamp));

      if (newRows.length > 0) {
        // Importar cada pedido nuevo al Store
        newRows.forEach(row => {
          const order = normalizeRow(row);
          Store.orders.create(order);
          knownTimestamps.add(row.timestamp);
        });

        // Refrescar la vista activa
        refreshCurrentView();
        App.updatePendingBadge();

        // Toast de nuevo pedido
        if (newRows.length === 1) {
          const r = newRows[0];
          const itemSummary = (r.items || []).slice(0, 2)
            .map(i => `${i.qty}× ${i.flavor || i.name}`).join(', ');
          App.toast('newOrder',
            `¡Nuevo pedido de <strong>${r.client || 'cliente'}</strong>!` +
            (itemSummary ? ` — ${itemSummary}` : ''),
            5500
          );
        } else {
          App.toast('newOrder', `¡${newRows.length} nuevos pedidos recibidos desde Google Sheets!`, 5500);
        }
      }

      setStatus('synced');
    } catch (err) {
      console.warn('[Sync] Error al sincronizar:', err.message);
      setStatus('error');
    } finally {
      isPolling = false;
      spinIcon(false);
    }
  }

  // ─── Refrescar vista activa ───────────────────────────────────────────────────
  function refreshCurrentView() {
    const page = document.getElementById('pageContent');
    if (!page) return;
    const route = Router.current();
    const modMap = {
      dashboard: DashboardModule,
      orders:    OrdersModule,
      finances:  FinancesModule,
    };
    modMap[route]?.render(page);
  }

  // ─── Indicador de estado en topbar ───────────────────────────────────────────
  function setStatus(s) {
    const dot   = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    if (!dot || !label) return;

    const map = {
      idle:    { color: 'var(--color-border)',    text: 'Sin configurar' },
      paused:  { color: 'var(--color-text-muted)', text: 'Pausado' },
      polling: { color: 'var(--color-warning)',    text: 'Sincronizando…' },
      synced:  { color: 'var(--color-success)',
                 text: 'Actualizado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) },
      error:   { color: 'var(--color-danger)',     text: 'Error de conexión' },
    };

    const st = map[s] || map.idle;
    dot.style.background  = st.color;
    label.textContent     = st.text;
  }

  function spinIcon(on) {
    const svg = document.getElementById('syncRefreshIcon');
    if (svg) svg.classList.toggle('sync-spinning', on);
  }

  // ─── Ciclo de polling ─────────────────────────────────────────────────────────
  function start() {
    const cfg = loadConfig();
    if (!cfg.url || !cfg.enabled) { setStatus('paused'); return; }
    stop();
    buildKnownSet();
    poll();  // primer poll inmediato
    pollingTimer = setInterval(poll, cfg.interval * 1000);
  }

  function stop() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  }

  // ─── Modal de configuración ───────────────────────────────────────────────────
  function openConfigModal() {
    const cfg = loadConfig();

    App.openModal({
      title: 'Sincronización con Google Sheets',
      size:  'modal-lg',
      body: `
        <div class="form-group">
          <label class="form-label">URL del Web App (Google Apps Script) *</label>
          <input class="form-input" id="fSyncUrl"
            value="${cfg.url}"
            placeholder="https://script.google.com/macros/s/…/exec" />
          <div class="form-hint">
            Publicá tu script como Web App y pegá la URL aquí.
            El archivo <code>google-trigger.js</code> de esta carpeta contiene el código listo para usar.
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Intervalo de actualización</label>
            <select class="form-select" id="fSyncInterval">
              ${[[10,'Cada 10 segundos'],[15,'Cada 15 segundos'],[30,'Cada 30 segundos'],[60,'Cada 1 minuto']].map(
                ([v, l]) => `<option value="${v}" ${cfg.interval === v ? 'selected' : ''}>${l}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estado de la sincronización</label>
            <select class="form-select" id="fSyncEnabled">
              <option value="si" ${cfg.enabled ? 'selected' : ''}>Activa</option>
              <option value="no" ${!cfg.enabled ? 'selected' : ''}>Pausada</option>
            </select>
          </div>
        </div>

        <div class="divider"></div>

        <div style="background:var(--color-primary-subtle); border-radius:var(--radius-md); padding:var(--space-4)">
          <div class="font-semibold text-sm" style="color:var(--color-primary-dark); margin-bottom:var(--space-3)">
            Cómo configurarlo — paso a paso
          </div>
          <ol style="padding-left:var(--space-5); display:flex; flex-direction:column; gap:var(--space-2); font-size:var(--text-sm); color:var(--color-text-secondary); line-height:var(--leading-relaxed)">
            <li>Abrí tu Google Sheets → <strong>Extensiones → Apps Script</strong></li>
            <li>Reemplazá todo el código con el contenido de <code style="background:var(--color-surface);padding:1px 5px;border-radius:3px;font-size:11px">google-trigger.js</code></li>
            <li>Ajustá la sección <code style="background:var(--color-surface);padding:1px 5px;border-radius:3px;font-size:11px">CONFIG</code>: nombre de hoja e índices de columna</li>
            <li><strong>Implementar → Nueva implementación → Tipo: App web</strong></li>
            <li>Ejecutar como: <strong>Yo</strong> · Acceso: <strong>Cualquier persona</strong></li>
            <li>Copiá la URL generada y pegala en el campo de arriba</li>
            <li>Para el trigger automático: ícono de reloj → Agregar activador → <code style="background:var(--color-surface);padding:1px 5px;border-radius:3px;font-size:11px">onFormSubmit</code> → Al enviar formulario</li>
          </ol>
        </div>
      `,
      primaryLabel: 'Guardar y activar',
      onConfirm: () => {
        const url      = document.getElementById('fSyncUrl').value.trim();
        const interval = parseInt(document.getElementById('fSyncInterval').value) || 15;
        const enabled  = document.getElementById('fSyncEnabled').value === 'si';

        if (enabled && !url) { App.toast('error', 'Ingresá la URL del Web App'); return false; }

        saveConfig({ url, interval, enabled });
        stop();

        if (enabled && url) {
          start();
          App.toast('success', 'Sincronización activada · Verificando conexión…');
        } else {
          setStatus('paused');
          App.toast('info', 'Configuración guardada · Sincronización pausada');
        }
        return true;
      },
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  function init() {
    buildKnownSet();
    const cfg = loadConfig();
    if (cfg.url && cfg.enabled) {
      start();
    } else {
      setStatus(cfg.url ? 'paused' : 'idle');
    }
  }

  return { init, start, stop, poll, openConfigModal };
})();
