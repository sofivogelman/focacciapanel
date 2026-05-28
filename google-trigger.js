// ============================================================
// FOCACCIA PANEL — Google Apps Script
// ============================================================
// Reemplazá TODO el contenido de tu proyecto Apps Script con este archivo.
//
// ESTRUCTURA DE COLUMNAS (después de eliminar col B):
//   A(0) Fecha/hora · B(1) Nombre · C(2) Teléfono · D(3) Zona
//   E(4) Día de entrega · F(5) Detalle pedido · G(6) Aclaraciones · H(7) Total
//
// PUBLICAR COMO WEB APP:
//   Implementar → Nueva implementación → Tipo: Aplicación web
//   Ejecutar como: Yo · Acceso: Cualquier persona
//   Copiá la URL y pegala en el Dashboard (botón Sheets en el topbar)
// ============================================================

// ─── Configuración de columnas ────────────────────────────────────────────────
// Índices 0-based (A=0, B=1 …). Actualizados para estructura sin col B.

const FOCACCIA_COL = {
  TIMESTAMP: 0,  // A — Fecha/hora (Date object — auto de Google Forms o doPost)
  CLIENT:    1,  // B — Nombre del cliente
  PHONE:     2,  // C — Teléfono
  ZONE:      3,  // D — Zona / Dirección
  DIA:       4,  // E — Día de entrega (del formulario HTML)
  ITEMS:     5,  // F — Detalle del pedido ("1x Familiar (Sabor)\n…")
  NOTES:     6,  // G — Aclaraciones
  TOTAL:     7,  // H — Total en pesos
};

const FOCACCIA_SHEET_NAME = 'Pedidos'; // ← nombre exacto de tu pestaña

// ─── doPost — recibe pedidos desde el formulario HTML ────────────────────────
function doPost(e) {
  try {
    // Log del request completo para diagnóstico (Ver → Ejecuciones en Apps Script)
    Logger.log('[doPost] e.postData: ' + (e && e.postData ? e.postData.contents : 'VACÍO'));

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOCACCIA_SHEET_NAME);
    if (!sheet) {
      Logger.log('[doPost] ERROR: hoja "' + FOCACCIA_SHEET_NAME + '" no encontrada');
      return ContentService
        .createTextOutput(JSON.stringify({ result: "error", message: 'Hoja "' + FOCACCIA_SHEET_NAME + '" no encontrada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    Logger.log('[doPost] data recibida: ' + JSON.stringify(data));

    var detallePedido = (data.items || []).map(function(item) {
      return item.cantidad + "x " + item.formato + (item.sabor ? " (" + item.sabor + ")" : "");
    }).join("\n");

    sheet.appendRow([
      new Date(),
      data.nombre        || '',
      data.telefono      || '',
      data.zona          || '',
      data.dia           || '',
      detallePedido,
      data.aclaraciones  || '',
      data.total         || 0
    ]);

    Logger.log('[doPost] Fila agregada OK para: ' + data.nombre);
    alertaNuevoPedido();

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('[doPost] ERROR: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Alerta WhatsApp ──────────────────────────────────────────────────────────
function alertaNuevoPedido() {
  var miTelefono = "5491122339340";
  var apiKey     = "1603758";
  var texto      = "¡Nuevo pedido de focaccia!";
  var url        = "https://api.callmebot.com/whatsapp.php?phone=" + miTelefono
                 + "&text=" + encodeURIComponent(texto) + "&apikey=" + apiKey;
  UrlFetchApp.fetch(url);
}

// ─── doGet — el Dashboard hace polling acá ───────────────────────────────────
function doGet(e) {
  return focacciaGetOrders(e);
}

// ─── Endpoint principal ───────────────────────────────────────────────────────
function focacciaGetOrders(e) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FOCACCIA_SHEET_NAME);

    if (!sheet) {
      return focacciaJsonResp({
        ok:    false,
        error: 'Hoja "' + FOCACCIA_SHEET_NAME + '" no encontrada. Verificá el nombre en FOCACCIA_SHEET_NAME.',
      });
    }

    const allValues = sheet.getDataRange().getValues();

    // Omitir la primera fila (encabezados)
    const rows = allValues.slice(1)
      .map(focacciaParseRow)
      .filter(Boolean);

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

// ─── Parseo de fila ───────────────────────────────────────────────────────────
function focacciaParseRow(row) {
  try {
    // Col A: timestamp (Date object desde Forms o doPost)
    // Se usa para deduplicación Y como fuente de la fecha del pedido.
    const rawTs = row[FOCACCIA_COL.TIMESTAMP];
    let ts          = '';
    let displayDate = '';

    if (rawTs) {
      try {
        const d = rawTs instanceof Date ? rawTs : new Date(rawTs);
        ts          = d.toISOString();
        displayDate = ts.slice(0, 10); // YYYY-MM-DD, sin la hora
      } catch (_) {
        ts          = String(rawTs);
        displayDate = '';
      }
    }

    const client = String(row[FOCACCIA_COL.CLIENT] || '').trim();
    const items  = focacciaParseItems(row[FOCACCIA_COL.ITEMS]);

    // Ignorar filas completamente vacías
    if (!client && items.length === 0) return null;

    // Clave de deduplicación: ISO timestamp si existe, sino compuesto
    const dedupeKey = ts || [displayDate, client, String(row[FOCACCIA_COL.ITEMS])].join('||');

    return {
      timestamp: dedupeKey,
      date:      displayDate,
      client,
      phone:     String(row[FOCACCIA_COL.PHONE] || '').trim(),
      zone:      String(row[FOCACCIA_COL.ZONE]  || '').trim(),
      dia:       String(row[FOCACCIA_COL.DIA]   || '').trim(), // día de entrega del formulario
      items,
      notes:     String(row[FOCACCIA_COL.NOTES] || '').trim(),
      total:     focacciaParseMonetary(row[FOCACCIA_COL.TOTAL]),
    };

  } catch (err) {
    Logger.log('[FocacciaPanel] Error parseando fila: ' + err.message);
    return null;
  }
}

// ─── Parseo de items (col F) ──────────────────────────────────────────────────
// Formato esperado por línea: "1x Familiar (Tomate Cherry y Pesto)"
// También soporta: "1× ...", "2 X ...", y sabores con paréntesis anidados.
function focacciaParseItems(rawCell) {
  const raw = String(rawCell || '').trim();
  if (!raw) return [];

  const lines  = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const ITEM_RE = /^(\d+)\s*[xX×]\s+([^(]+?)\s*\((.+)\)\s*$/;
  const items  = [];

  lines.forEach(function(line) {
    const match = line.match(ITEM_RE);
    if (match) {
      items.push({
        qty:    parseInt(match[1], 10) || 1,
        format: match[2].trim(),
        flavor: match[3].trim(),
      });
    } else {
      // Fallback: línea sin paréntesis
      const numMatch  = line.match(/^(\d+)\s*[xX×]?\s*/);
      const qty       = numMatch ? parseInt(numMatch[1]) : 1;
      const remainder = line.replace(/^\d+\s*[xX×]?\s*/, '').trim();
      if (remainder) items.push({ qty, format: '', flavor: remainder });
    }
  });

  return items;
}

// ─── Parseo de moneda argentina ───────────────────────────────────────────────
// Soporta: "$2.400" → 2400 · "$2.400,50" → 2400.5 · 2400 → 2400
function focacciaParseMonetary(raw) {
  if (typeof raw === 'number') return raw;
  let str = String(raw || '').replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.'); // 2.400,50 → 2400.5
  } else if (str.includes(',')) {
    str = str.replace(',', '.');                     // 2400,50 → 2400.5
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts[parts.length - 1].length === 3) str = str.replace(/\./g, ''); // miles → entero
  }
  return parseFloat(str) || 0;
}

// ─── Helper JSON ──────────────────────────────────────────────────────────────
function focacciaJsonResp(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

// ─── Test manual ──────────────────────────────────────────────────────────────
// Ejecutá esta función desde el editor (Ver → Registros para ver el resultado)
function focacciaTest() {
  Logger.log(doGet({}).getContent());
}
