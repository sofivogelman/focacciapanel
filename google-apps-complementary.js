// ====================================================================
// FOCACCIA PANEL — Función complementaria para tu Google Apps Script
// ====================================================================
//
// INSTRUCCIONES:
//
// Pegá TODO este archivo AL FINAL de tu script existente, después de
// tu última línea de código. No modifica ni reemplaza nada tuyo.
//
// Después buscá tu función doGet existente (la que usa tu bot) y
// agregá SOLO las 3 líneas marcadas con ← al principio de ella:
//
//   function doGet(e) {
//     // ← AGREGÁ ESTAS 3 LÍNEAS al principio de tu doGet:
//     if (e && e.parameter && e.parameter.app === 'focaccia') {
//       return focacciaGetOrders(e);
//     }
//     // ... tu código existente del bot sigue intacto acá abajo ...
//   }
//
// Si NO tenés doGet en tu script, podés agregar esta versión standalone:
//
//   function doGet(e) {
//     return focacciaGetOrders(e);
//   }
//
// ─────────────────────────────────────────────────────────────────────
// POR QUÉ POLLING (y no push):
//
// El Dashboard vive en tu computadora (file://) → no tiene IP pública.
// Google no puede hacer fetch hacia un archivo local.
// La solución es la inversa: el Dashboard le pregunta al script GAS
// cada N segundos "¿hay filas nuevas?" — eso es lo que hace sync.js.
//
// ─────────────────────────────────────────────────────────────────────
// URL QUE TENÉS QUE PEGAR EN EL DASHBOARD:
//
// 1. En Apps Script: Implementar → Administrar implementaciones
//    (o Nueva implementación si nunca publicaste como Web App)
// 2. Copiá la URL → debería verse así:
//    https://script.google.com/macros/s/ABC123.../exec
// 3. Si ya tenés doGet y usaste la variante con parámetro, la URL es:
//    https://script.google.com/macros/s/ABC123.../exec?app=focaccia
// 4. Abrí el Dashboard → clic en "Sheets" (topbar, arriba a la derecha)
// 5. Pegá la URL en el campo → elegí intervalo → "Guardar y activar"
//
// ====================================================================

// ─── Configuración de columnas (NO toques si ya configuraste store.js) ──────
// Estos índices coinciden con tu hoja real:
//   B(1)=Fecha · C(2)=Cliente · D(3)=Teléfono · E(4)=Zona
//   G(6)=Items · H(7)=Aclaraciones · I(8)=Total

const FOCACCIA_COL = {
  TIMESTAMP: 0,  // A — Marca de tiempo auto (Google Forms / tu propio código)
  DATE:      1,  // B — Fecha del pedido
  CLIENT:    2,  // C — Nombre del cliente
  PHONE:     3,  // D — Teléfono
  ZONE:      4,  // E — Zona / Dirección
  // F (5) — columna no mapeada, se omite
  ITEMS:     6,  // G — "1x Familiar (Aceitunas)\n1x Familiar (Tomate Cherry)"
  NOTES:     7,  // H — Aclaraciones
  TOTAL:     8,  // I — Total en pesos
};

const FOCACCIA_SHEET_NAME = 'Respuestas de formulario 1'; // ← cambiá por el nombre exacto de tu pestaña

// ─── Endpoint principal ───────────────────────────────────────────────────────
/**
 * focacciaGetOrders — Devuelve todas las filas procesadas como JSON.
 *
 * El Dashboard hace GET a esta función cada N segundos (polling).
 * Compara los timestamps que ya conoce y solo importa las filas nuevas.
 *
 * Respuesta de ejemplo:
 * {
 *   "ok": true,
 *   "count": 4,
 *   "fetchedAt": "2026-05-27T20:00:00.000Z",
 *   "rows": [
 *     {
 *       "timestamp": "2026-05-27T14:30:00.000Z",   ← clave de deduplicación
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
function focacciaGetOrders(e) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FOCACCIA_SHEET_NAME);

    if (!sheet) {
      return focacciaJsonResp({
        ok: false,
        error: 'Hoja "' + FOCACCIA_SHEET_NAME + '" no encontrada. '
             + 'Verificá el nombre en FOCACCIA_SHEET_NAME.',
      });
    }

    const allValues = sheet.getDataRange().getValues();

    // La primera fila son los encabezados — se omite
    const rows = allValues.slice(1)
      .map(focacciaParseRow)
      .filter(Boolean);   // filtra filas vacías o con error de parseo

    return focacciaJsonResp({
      ok:        true,
      count:     rows.length,
      fetchedAt: new Date().toISOString(),
      rows,
    });

  } catch (err) {
    Logger.log('[FocacciaPanel] Error en focacciaGetOrders: ' + err.message);
    return focacciaJsonResp({ ok: false, error: err.message });
  }
}

// ─── Parseo de una fila ───────────────────────────────────────────────────────
/**
 * focacciaParseRow — Convierte un array de valores de fila en el objeto
 * que espera el Dashboard.
 *
 * Maneja: objetos Date de GAS, strings de fecha, valores vacíos.
 * Devuelve null si la fila no tiene cliente ni items (fila vacía o inválida).
 */
function focacciaParseRow(row) {
  try {
    // ── Timestamp para deduplicación (col A) ──
    const rawTs = row[FOCACCIA_COL.TIMESTAMP];
    let ts = '';
    if (rawTs) {
      try {
        ts = (rawTs instanceof Date ? rawTs : new Date(rawTs)).toISOString();
      } catch (_) {
        ts = String(rawTs);
      }
    }

    // ── Fecha visible del pedido (col B) ──
    const rawDate = row[FOCACCIA_COL.DATE];
    let displayDate = '';
    if (rawDate) {
      try {
        displayDate = (rawDate instanceof Date ? rawDate : new Date(rawDate))
          .toISOString().slice(0, 10);
      } catch (_) {
        displayDate = String(rawDate).trim();
      }
    }

    const client = String(row[FOCACCIA_COL.CLIENT] || '').trim();
    const items  = focacciaParseItems(row[FOCACCIA_COL.ITEMS]);

    // Ignorar filas completamente vacías
    if (!client && items.length === 0) return null;

    // Clave de deduplicación: timestamp real (col A) si existe,
    // sino combinación de fecha + cliente + contenido de items
    const dedupeKey = ts || [displayDate, client, String(row[FOCACCIA_COL.ITEMS])].join('||');

    return {
      timestamp: dedupeKey,                                          // usado para dedup en Dashboard
      date:      displayDate,                                        // col B
      client,                                                        // col C
      phone:     String(row[FOCACCIA_COL.PHONE] || '').trim(),      // col D
      zone:      String(row[FOCACCIA_COL.ZONE]  || '').trim(),      // col E
      items,                                                         // col G — parseado
      notes:     String(row[FOCACCIA_COL.NOTES] || '').trim(),      // col H
      total:     focacciaParseMonetary(row[FOCACCIA_COL.TOTAL]),    // col I
    };

  } catch (err) {
    Logger.log('[FocacciaPanel] Error parseando fila: ' + err.message);
    return null;
  }
}

// ─── Parseo de la columna G ───────────────────────────────────────────────────
/**
 * focacciaParseItems — Extrae items del campo combinado de la columna G.
 *
 * Formato de la celda (un item por línea, separados por Alt+Enter = \n):
 *   "1x Familiar (Aceitunas)"
 *   "2x Chica (Tomate Cherry y Pesto)"
 *   "1x Grande (Romero)"
 *
 * También acepta variantes:
 *   "1 X Familiar (Aceitunas)"  (espacio antes de X)
 *   "1× Familiar (Aceitunas)"  (× en lugar de x)
 *
 * Regex:  ^(\d+)\s*[xX×]\s+([^(]+?)\s*\(([^)]+)\)\s*$
 *          ─qty─           ─formato─    ──sabor──
 *
 * Si la celda está vacía → devuelve []
 * Si una línea no matchea el patrón → fallback genérico
 */
function focacciaParseItems(rawCell) {
  const raw = String(rawCell || '').trim();
  if (!raw) return [];

  // Google Sheets guarda Alt+Enter como \n en GAS
  const lines = raw.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);

  var ITEM_RE = /^(\d+)\s*[xX×]\s+([^(]+?)\s*\(([^)]+)\)\s*$/;
  var items   = [];

  lines.forEach(function(line) {
    var match = line.match(ITEM_RE);
    if (match) {
      var qty    = parseInt(match[1], 10) || 1;
      var format = match[2].trim();
      var flavor = match[3].trim();
      if (flavor) items.push({ qty: qty, format: format, flavor: flavor });
    } else {
      // Fallback: extraer lo que se pueda
      var numMatch  = line.match(/^(\d+)\s*[xX×]?\s*/);
      var qty       = numMatch ? parseInt(numMatch[1]) : 1;
      var remainder = line.replace(/^\d+\s*[xX×]?\s*/, '').trim();
      if (remainder) items.push({ qty: qty, format: '', flavor: remainder });
    }
  });

  return items;
}

// ─── Parseo de moneda argentina ───────────────────────────────────────────────
/**
 * focacciaParseMonetary — Convierte "$2.400,50" o "2400" → número.
 *
 * Soporta:
 *   "$2.400"    → 2400   (punto como miles, sin decimal)
 *   "$2.400,50" → 2400.5 (punto como miles, coma como decimal)
 *   "2400"      → 2400   (sin formato)
 *   2400        → 2400   (ya es número)
 */
function focacciaParseMonetary(raw) {
  if (typeof raw === 'number') return raw;
  var str = String(raw || '').replace(/[^0-9.,]/g, '');   // solo dígitos, puntos y comas
  if (!str) return 0;

  if (str.indexOf('.') !== -1 && str.indexOf(',') !== -1) {
    // Formato "2.400,50": punto=miles, coma=decimal
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.indexOf(',') !== -1) {
    // Solo coma: decimal → "2400,50"
    str = str.replace(',', '.');
  } else if (str.indexOf('.') !== -1) {
    // Solo punto: verificar si es miles ("2.400") o decimal ("2.5")
    var parts = str.split('.');
    if (parts[parts.length - 1].length === 3) {
      str = str.replace(/\./g, '');  // es separador de miles
    }
    // si no, es decimal → dejarlo como está
  }

  return parseFloat(str) || 0;
}

// ─── Helper de respuesta JSON ────────────────────────────────────────────────
function focacciaJsonResp(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

// ─── Función de test (ejecutala manualmente desde el editor) ────────────────
/**
 * focacciaTest — Ejecutá esta función desde el editor de Apps Script
 * para verificar que el parseo funciona correctamente.
 * Abrí el Log (Ver → Registros) para ver el resultado.
 */
function focacciaTest() {
  var result = focacciaGetOrders({});
  Logger.log(result.getContent());
}
