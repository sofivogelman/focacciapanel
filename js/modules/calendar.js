const CalendarModule = (() => {
  // ─── Config ──────────────────────────────────────────────────────────────────
  // 1. Abrí console.cloud.google.com → APIs & Services → Credentials
  // 2. Creá credencial: OAuth 2.0 > Aplicación web
  // 3. En "Orígenes de JS autorizados" agregá el URL desde el que abrís el panel
  // 4. Pegá el Client ID acá abajo:
  const CLIENT_ID = '';

  const SCOPE    = 'https://www.googleapis.com/auth/calendar.events';
  const COLOR_ID = '3'; // grape = violeta

  let tokenClient  = null;
  let accessToken  = null;
  let tokenExpiry  = 0;
  let pendingOrder = null;

  // ─── Título del evento ────────────────────────────────────────────────────────
  function formatZoneForTitle(order) {
    const zoneRaw = (order.zone || '').trim();

    // Lote: campo propio primero, sino parseado del zone string
    const lote = (order.lote || '').trim() || (() => {
      const m = zoneRaw.match(/lote\s*(\d+)/i);
      return m ? 'Lote ' + m[1] : '';
    })();

    if (zoneRaw.toLowerCase().includes('villa nueva')) {
      // Barrio: campo propio primero, sino segunda parte del zone string
      const barrio = (order.barrio || '').trim() || (() => {
        const parts = zoneRaw.split(/\s*-\s*/);
        const p1 = (parts[1] || '').trim();
        return (p1 && !/^(lote|lt\.?)\s*\d/i.test(p1)) ? p1 : '';
      })();
      const base = barrio || 'Villa Nueva';
      return lote ? `${base} ${lote}` : base;
    }

    // Otras zonas: primer segmento del string de zona
    const zoneName = zoneRaw.split(/\s*-\s*/)[0].trim();
    if (!zoneName) return '';
    return lote ? `${zoneName} ${lote}` : zoneName;
  }

  function buildTitle(order) {
    const name = (order.clientName || '').trim();
    const zone = formatZoneForTitle(order);
    return zone ? `${name} — ${zone}` : name;
  }

  // ─── Descripción del evento ───────────────────────────────────────────────────
  function itemLabel(item) {
    const fmt = (item.format || '').trim();
    const flv = (item.flavor || '').trim() || (() => {
      const m = (item.name || '').match(/\(([^(]+)/);
      return m ? m[1].trim() : '';
    })();
    return flv ? `${fmt} — ${flv}` : (fmt || item.name || '');
  }

  function buildDescription(order) {
    const lines = (order.items || []).map(i => `${i.qty}× ${itemLabel(i)}`);
    lines.push('');
    const payMap = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito' };
    lines.push(`Total: $${(order.total || 0).toLocaleString('es-AR')}`);
    lines.push(`${payMap[order.paymentMethod] || 'Sin método'} | ${order.paid ? 'Cobrado ✓' : 'Sin cobrar'}`);
    if (order.notes) { lines.push(''); lines.push(`Notas: ${order.notes}`); }
    return lines.join('\n');
  }

  // ─── Objeto de evento para la API ─────────────────────────────────────────────
  function buildEvent(order) {
    const dateStr = order.deliveryDate;
    let start, end;

    if (order.deliveryTime) {
      const tz = 'America/Argentina/Buenos_Aires';
      const [h, m] = order.deliveryTime.split(':').map(Number);
      const pad = n => String(n).padStart(2, '0');
      start = { dateTime: `${dateStr}T${pad(h)}:${pad(m)}:00`, timeZone: tz };
      end   = { dateTime: `${dateStr}T${pad((h + 1) % 24)}:${pad(m)}:00`, timeZone: tz };
    } else {
      const nextDay = new Date(dateStr + 'T12:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      start = { date: dateStr };
      end   = { date: nextDay.toISOString().slice(0, 10) };
    }

    return {
      summary:     buildTitle(order),
      description: buildDescription(order),
      colorId:     COLOR_ID,
      start,
      end,
    };
  }

  // ─── Llamada a la API ─────────────────────────────────────────────────────────
  function createCalendarEvent(order) {
    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildEvent(order)),
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        if (data.error.code === 401) {
          accessToken = null;
          tokenExpiry = 0;
          pendingOrder = order;
          tokenClient.requestAccessToken({ prompt: '' });
        } else {
          App.toast('error', `Calendar: ${data.error.message}`);
        }
        return;
      }
      Store.orders.update(order.id, { calendarEventId: data.id });
      App.toast('success', 'Evento creado en Google Calendar');
      if (Router.current() === 'orders') OrdersModule.render(document.getElementById('pageContent'));
    })
    .catch(() => App.toast('error', 'No se pudo crear el evento en Google Calendar'));
  }

  // ─── OAuth2 ───────────────────────────────────────────────────────────────────
  function ensureTokenClient() {
    if (tokenClient) return true;
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      App.toast('error', 'Google Identity Services no disponible. Revisá tu conexión a internet.');
      return false;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          App.toast('error', `Autenticación Google: ${resp.error}`);
          pendingOrder = null;
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
        if (pendingOrder) {
          createCalendarEvent(pendingOrder);
          pendingOrder = null;
        }
      },
    });
    return true;
  }

  // ─── API pública ─────────────────────────────────────────────────────────────
  function addToCalendar(orderId) {
    if (!CLIENT_ID) {
      App.toast('warning', 'Configurá el CLIENT_ID de Google en js/modules/calendar.js');
      return;
    }
    const order = Store.orders.find(orderId);
    if (!order) return;
    if (!order.deliveryDate) { App.toast('error', 'El pedido no tiene fecha de entrega'); return; }

    if (!ensureTokenClient()) return;

    if (accessToken && Date.now() < tokenExpiry) {
      createCalendarEvent(order);
    } else {
      pendingOrder = order;
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  return { addToCalendar };
})();
