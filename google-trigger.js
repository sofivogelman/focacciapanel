// ============================================================
// FOCACCIA PANEL — Google Apps Script
// ============================================================
// INSTRUCCIONES DE INSTALACIÓN:
//
// 1. Abrí tu Google Sheets con las respuestas del formulario
// 2. Extensiones → Apps Script
// 3. Reemplazá todo el contenido con este archivo
// 4. Ajustá la sección CONFIG más abajo según tu hoja
// 5. Guardá (Ctrl+S) y nombrá el proyecto "FocacciaPanel"
//
// PUBLICAR COMO WEB APP:
// 6. Implementar → Nueva implementación
// 7. Tipo: Aplicación web
// 8. Ejecutar como: Yo · Quién tiene acceso: Cualquier persona
// 9. Hacé clic en "Implementar" y copiá la URL generada
// 10. En el Dashboard: botón "Sheets" en el topbar → pegá la URL
//
// ACTIVAR DISPARADOR AUTOMÁTICO (onFormSubmit):
// 11. En Apps Script: ícono de reloj → "+ Agregar activador"
// 12. Función: onFormSubmit · Tipo de evento: Al enviar formulario
// ============================================================

// ─── CONFIGURACIÓN ──────────────────────────────────────────
// Índices de columna en base 0 (A=0, B=1, C=2 …)
// Ajustá SHEET_NAME y los índices COL_* si tu hoja es diferente.

const CONFIG = {
  SHEET_NAME: 'Respuestas de formulario 1', // nombre exacto de la pestaña

  COL_TIMESTAMP: 0,  // A — Marca de tiempo (auto Google Forms; si no existe dejá en 0)
  COL_DATE:      1,  // B — Fecha del pedido
  COL_CLIENT:    2,  // C — Nombre del cliente
  COL_PHONE:     3,  // D — Teléfono
  COL_ZONE:      4,  // E — Zona / Dirección de entrega
  // F (5) — columna no usada, se omite
  COL_ITEMS:     6,  // G — Cantidad + Formato + Sabor (multilinea dentro de la celda)
  COL_NOTES:     7,  // H — Aclaraciones / Notas
  COL_TOTAL:     8,  // I — Total por pedido ($)

  MAX_ROWS: 0,       // 0 = devolver todas las filas
};

// ─── ENDPOINT GET — el Dashboard hace polling acá ─────────────
/**
 * doGet — Devuelve todas las filas como JSON.
 * Ejemplo de respuesta:
 * {
 *   "ok": true, "count": 5, "fetchedAt": "...",
 *   "rows": [
 *     {
 *       "timestamp": "2026-05-27T20:00:00.000Z",
 *       "date": "2026-05-27",
 *       "client": "Martina García",
 *       "phone": "11-5555-1234",
 *       "zone": "Palermo",
 *       "items": [
 *         { "qty": 1, "format": "Familiar", "flavor": "Aceitunas" },
 *         { "qty": 1, "format": "Familiar", "flavor": "Tomate Cherry y Pesto" }
 *       ],
 *       "notes": "",
 *       "total": 3600
 *     }
 *   ]
 * }
 */
function doGet(e) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ ok: false, error: 'Hoja "' + CONFIG.SHEET_NAME + '" no encontrada.' });
    }

    const allValues = sheet.getDataRange().getValues();
    const dataRows  = allValues.slice(1); // omitir fila de encabezados
    const limit     = CONFIG.MAX_ROWS > 0 ? CONFIG.MAX_ROWS : dataRows.length;
    const rows      = dataRows.slice(0, limit).map(parseRow).filter(r => r !== null);

    return jsonResponse({ ok: true, count: rows.length, fetchedAt: new Date().toISOString(), rows });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── DISPARADOR DE FORMULARIO ────────────────────────────────
/**
 * onFormSubmit — Se ejecuta al recibir un nuevo registro del formulario.
 * Guarda metadatos en Script Properties para debug.
 * El Dashboard detecta la nueva fila en el próximo ciclo de polling.
 */
function onFormSubmit(e) {
  try {
    const payload = parseRow(e.values);
    if (!payload) return;

    const props = PropertiesService.getScriptProperties();
    props.setProperty('lastOrderAt',    new Date().toISOString());
    props.setProperty('lastOrder',      JSON.stringify(payload));
    props.setProperty('totalOrders',    String(getTotalRows()));

    Logger.log('[FocacciaPanel] Nuevo pedido: ' + JSON.stringify(payload));
  } catch (err) {
    Logger.log('[FocacciaPanel] Error en onFormSubmit: ' + err.message);
  }
}

// ─── ENDPOINT POST (reservado para webhooks futuros) ─────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    PropertiesService.getScriptProperties().setProperty('lastPost', JSON.stringify(body));
    return jsonResponse({ ok: true, received: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── PARSEO DE FILA ──────────────────────────────────────────
/**
 * parseRow — Convierte un array de valores en el objeto que espera el Dashboard.
 * Maneja: Date objects de GAS, strings de fecha, celdas vacías.
 */
function parseRow(row) {
  try {
    // Timestamp para deduplicación (col A: auto GAS, o compuesto)
    const rawTs = row[CONFIG.COL_TIMESTAMP];
    let ts = '';
    if (rawTs) {
      try { ts = (rawTs instanceof Date ? rawTs : new Date(rawTs)).toISOString(); }
      catch (_) { ts = String(rawTs); }
    }

    // Fecha visible del pedido (col B)
    const rawDate = row[CONFIG.COL_DATE];
    let displayDate = '';
    if (rawDate) {
      try { displayDate = (rawDate instanceof Date ? rawDate : new Date(rawDate)).toISOString().slice(0, 10); }
      catch (_) { displayDate = String(rawDate).trim(); }
    }

    const client = String(row[CONFIG.COL_CLIENT] || '').trim();
    const items  = parseItems(row[CONFIG.COL_ITEMS]);

    // Clave de dedup: timestamp real si existe, sino compuesto
    const dedupeKey = ts || [displayDate, client, String(row[CONFIG.COL_ITEMS])].join('||');

    // Total en pesos (col I) — maneja formato argentino: "$2.400" / "2400"
    const total = parseMonetary(row[CONFIG.COL_TOTAL]);

    return {
      timestamp: dedupeKey,
      date:      displayDate,
      client,
      phone:     String(row[CONFIG.COL_PHONE] || '').trim(),
      zone:      String(row[CONFIG.COL_ZONE]  || '').trim(),
      items,
      notes:     row.length > CONFIG.COL_NOTES ? String(row[CONFIG.COL_NOTES] || '').trim() : '',
      total,
    };
  } catch (_) {
    return null;
  }
}

// ─── PARSEO DE ITEMS (Columna G) ────────────────────────────
/**
 * parseItems — Extrae lista de productos de una celda multilinea.
 *
 * Formato esperado (una línea por item):
 *   "1x Familiar (Aceitunas)"
 *   "2x Chica (Tomate Cherry y Pesto)"
 *   "1x Grande (Romero)"
 *
 * Cada salto de línea dentro de la celda (Alt+Enter) indica un nuevo item
 * del mismo pedido. Si la celda está vacía, devuelve array vacío.
 *
 * Regex:  ^(\d+)\s*[xX×]\s+([^(]+?)\s*\(([^)]+)\)\s*$
 *          ─qty─          ─format──     ──flavor──
 */
function parseItems(rawCell) {
  const raw = String(rawCell || '').trim();
  if (!raw) return [];

  // Dividir por saltos de línea (Alt+Enter produce \n en GAS)
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const ITEM_RE = /^(\d+)\s*[xX×]\s+([^(]+?)\s*\((.+)\)\s*$/;
  const items   = [];

  lines.forEach(line => {
    const match = line.match(ITEM_RE);
    if (match) {
      const qty    = parseInt(match[1], 10) || 1;
      const format = match[2].trim();
      const flavor = match[3].trim();
      if (flavor) items.push({ qty, format, flavor });
    } else {
      // Fallback: línea sin paréntesis o sin formato
      const numMatch  = line.match(/^(\d+)\s*[xX×]?\s*/);
      const qty       = numMatch ? parseInt(numMatch[1]) : 1;
      const remainder = line.replace(/^\d+\s*[xX×]?\s*/, '').trim();
      if (remainder) items.push({ qty, format: '', flavor: remainder });
    }
  });

  return items;
}

// ─── HELPERS ────────────────────────────────────────────────
/**
 * parseMonetary — Parsea "$2.400,50" o "2400" → número.
 * Soporta formato argentino: punto como separador de miles, coma como decimal.
 */
function parseMonetary(raw) {
  if (typeof raw === 'number') return raw;
  let str = String(raw || '').replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  if (str.includes('.') && str.includes(',')) {
    // Formato: 2.400,50
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Decimal con coma: 2400,50
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Punto: puede ser miles (2.400) o decimal (2.5)
    const parts = str.split('.');
    if (parts[parts.length - 1].length === 3) str = str.replace(/\./g, ''); // miles
  }
  return parseFloat(str) || 0;
}

function jsonResponse(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getTotalRows() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  return sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
}

/** Ejecutá esta función manualmente desde el editor para probar el endpoint. */
function testDoGet() {
  Logger.log(doGet({}).getContent());
}
