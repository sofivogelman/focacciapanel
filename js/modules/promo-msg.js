const PromoMsgModule = (() => {

  function buildMessage() {
    return [
      '🌿 DOBLEZ — Focacceria Artesanal 🌿',
      '',
      '¿Cómo hacer tu pedido?',
      '💻 Formulario web: https://tinyurl.com/pedi-tu-focaccia',
      '📲 WhatsApp: wa.me/5491122339340',
      '',
      '⚠️ LOS PEDIDOS SE HACEN CON MÍNIMO 24 HS DE ANTICIPACIÓN ⚠️',
      '',
      '📍 Entregas en Zona Norte',
      '   Bancalari, Villanueva, Nordelta y alrededores',
      '',
      '💳 Aceptamos transferencia o efectivo.',
    ].join('\n');
  }

  function regenerate() {
    const ta = document.getElementById('promoMsgText');
    if (ta) ta.value = buildMessage();
    App.toast('success', 'Mensaje actualizado');
  }

  async function copyMsg() {
    const ta = document.getElementById('promoMsgText');
    const text = ta ? ta.value : '';
    try {
      await navigator.clipboard.writeText(text);
      App.toast('success', 'Mensaje copiado — listo para pegar en WhatsApp');
    } catch {
      if (ta) { ta.select(); document.execCommand('copy'); }
      App.toast('success', 'Mensaje copiado');
    }
  }

  function render(container) {
    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between" style="flex-wrap:wrap;gap:var(--space-3)">
          <div>
            <h1 class="page-title">Mensaje WhatsApp</h1>
            <p class="page-subtitle" style="margin:0">Listo para copiar y pegar</p>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-shrink:0">
            <button class="btn btn-secondary btn-sm" onclick="PromoMsgModule.regenerate()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Regenerar
            </button>
            <button class="btn btn-primary btn-sm" onclick="PromoMsgModule.copyMsg()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copiar mensaje
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header" style="padding-bottom:var(--space-3)">
            <div class="card-title">Texto del mensaje</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Podés editarlo antes de copiar</div>
          </div>
          <textarea
            id="promoMsgText"
            class="form-textarea"
            style="font-family:monospace;font-size:var(--text-sm);min-height:260px;line-height:1.7;resize:vertical;border-radius:var(--radius-sm)"
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    `;

    document.getElementById('promoMsgText').value = buildMessage();
  }

  return { render, regenerate, copyMsg };
})();
