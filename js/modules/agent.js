const AgentModule = (() => {

  let history = []; // mensajes de la sesión actual

  // ─── Contexto del negocio ─────────────────────────────────────────────────────
  function buildContext() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const orders   = Store.orders.all();
    const expenses = Store.expenses.all();

    return {
      fecha_hoy:    new Date().toISOString().slice(0, 10),
      pedidos:      orders.filter(o => (o.date || '') >= cutoffStr || o.status === 'pendiente'),
      gastos:       expenses.filter(e => (e.date || '') >= cutoffStr),
      ingredientes: Store.ingredients.all(),
      repartos:     Store.deliveries.all(),
      clientes:     Store.clients.all(),
      masaLog:      Store.masaLog.all(),
      promos:       Store.promos.all(),
      formatos:     Store.formats.all(),
      sabores:      Store.flavors.all(),
      resumen: {
        total_pedidos:    orders.length,
        pedidos_pendientes: orders.filter(o => o.status === 'pendiente').length,
        total_clientes:   Store.clients.count(),
        ingredientes_stock_bajo: Store.ingredients.where(i => i.stock <= i.minStock).length,
      },
    };
  }

  // ─── Llamada a Gemini ─────────────────────────────────────────────────────────
  async function askGemini(question) {
    const key = localStorage.getItem('focaccia_gemini_key') || '';
    if (!key) return 'Para usar el asistente necesitás configurar tu clave de Gemini en **Configuración → Detección automática de comprobantes**.';

    const ctx = buildContext();
    const systemPrompt = `Sos un asistente experto en análisis de negocios para una emprendedora de focaccia artesanal en Argentina. Tenés acceso completo a los datos de su negocio.

Reglas:
- Respondé siempre en español argentino, de forma clara y directa
- Usá números concretos cuando los tenés en los datos
- Si algo no está en los datos, decilo claramente
- Podés hacer cálculos, comparaciones, rankings y recomendaciones
- Formateo: usá **negrita** para números importantes, listas con guiones para rankings

DATOS DEL NEGOCIO (últimos 90 días + pendientes):
${JSON.stringify(ctx)}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nPREGUNTA: ' + question }] }
          ],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return `Error ${res.status}: ${err.error?.message || 'No se pudo conectar con Gemini'}`;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
  }

  // ─── UI ───────────────────────────────────────────────────────────────────────
  const SUGERENCIAS = [
    '¿Cuánto gané este mes?',
    '¿Qué sabor se vende más?',
    '¿Cuáles son mis clientes más frecuentes?',
    '¿Cómo está el inventario?',
    'Resumí las ventas de los últimos 30 días',
    '¿Cuánto gasté en ingredientes este mes?',
  ];

  function renderMsg(role, text) {
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return `<div class="agent-msg agent-msg-${role}"><p>${html}</p></div>`;
  }

  function appendMsg(role, text) {
    const chat = document.getElementById('agentChat');
    if (!chat) return;
    chat.insertAdjacentHTML('beforeend', renderMsg(role, text));
    chat.scrollTop = chat.scrollHeight;
  }

  async function send(text) {
    const input = document.getElementById('agentInput');
    const btn   = document.getElementById('agentSendBtn');
    const question = text || input?.value.trim();
    if (!question) return;

    if (input) input.value = '';
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    appendMsg('user', question);
    history.push({ role: 'user', text: question });

    const chat = document.getElementById('agentChat');
    if (chat) chat.insertAdjacentHTML('beforeend', '<div class="agent-msg agent-msg-bot agent-typing" id="agentTyping"><p>Analizando datos…</p></div>');

    const response = await askGemini(question);

    document.getElementById('agentTyping')?.remove();
    appendMsg('bot', response);
    history.push({ role: 'bot', text: response });

    if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
  }

  // ─── Popup flotante ──────────────────────────────────────────────────────────
  function renderPopup(container) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);border-bottom:var(--border);flex-shrink:0">
          <div>
            <div class="text-sm font-semibold">Asistente IA</div>
            <div class="text-xs" style="color:var(--color-text-muted)">Consultá datos del negocio</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="AgentModule.closePopup()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <!-- Chat -->
        <div id="agentChat" style="flex:1;overflow-y:auto;padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)">
          <div class="agent-msg agent-msg-bot"><p>¡Hola! ¿En qué te ayudo hoy?</p></div>
          ${history.map(m => renderMsg(m.role, m.text)).join('')}
        </div>
        <!-- Sugerencias rápidas -->
        <div style="padding:var(--space-2) var(--space-3);display:flex;flex-wrap:wrap;gap:4px;border-top:1px solid var(--color-border-light)">
          ${SUGERENCIAS.slice(0, 3).map(s => `
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;height:auto;line-height:1.6"
              onclick="AgentModule.send('${s.replace(/'/g, "\\'")}')">
              ${s}
            </button>
          `).join('')}
        </div>
        <!-- Input -->
        <div style="padding:var(--space-3);display:flex;gap:var(--space-2);border-top:var(--border)">
          <input type="text" class="form-input flex-1" id="agentInput"
            placeholder="Preguntame algo…" style="font-size:var(--text-sm)" />
          <button class="btn btn-primary btn-sm" id="agentSendBtn" onclick="AgentModule.send()">Enviar</button>
        </div>
      </div>
    `;

    document.getElementById('agentInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    const chat = document.getElementById('agentChat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function openPopup() {
    const wrap = document.getElementById('agentPopupWrap');
    if (!wrap) return;
    wrap.style.display = 'flex';
    renderPopup(wrap);
  }

  function closePopup() {
    const wrap = document.getElementById('agentPopupWrap');
    if (wrap) wrap.style.display = 'none';
  }

  function togglePopup() {
    const wrap = document.getElementById('agentPopupWrap');
    if (!wrap) return;
    wrap.style.display === 'none' ? openPopup() : closePopup();
  }

  // Mantener render() por compatibilidad (no se usa como ruta pero no rompe nada)
  function render(container) { renderPopup(container); }

  return { render, send, openPopup, closePopup, togglePopup };
})();
