const PromoMsgModule = (() => {

  const FLAVOR_EMOJI = {
    romero: '🌿', papa: '🧀', parmesano: '🧀', mozzarella: '🧀', queso: '🧀',
    tomate: '🍅', cherry: '🍅', pesto: '🌱', aceitun: '🫒', cebolla: '🧅',
    ajo: '🧄', hongo: '🍄', champinon: '🍄', jamon: '🍖', jamón: '🍖',
    rúcula: '🥬', rucula: '🥬', espinaca: '🥬', albahaca: '🌿', oregano: '🌿',
    oregán: '🌿', brie: '🧀', cream: '🧀', dulce: '🍯',
  };

  function flavorEmoji(name) {
    const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [key, emoji] of Object.entries(FLAVOR_EMOJI)) {
      const normKey = key.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (n.includes(normKey)) return emoji;
    }
    return '🍞';
  }

  function fmtPrice(p) {
    return '$' + Number(p).toLocaleString('es-AR');
  }

  function getCurrentWeekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function getCurrentPromo() {
    const weekStart = getCurrentWeekStart();
    return Store.promos.where(p => p.active && p.semana === weekStart)[0] || null;
  }

  function buildPromoDesc(promo) {
    if (promo.notes) return promo.notes;
    if (promo.items && promo.items.length) {
      const parts = promo.items.map(i => `${i.qty || 1} ${i.format}`).join(' + ');
      return `${parts} por ${fmtPrice(promo.price)}`;
    }
    return `${promo.name} por ${fmtPrice(promo.price)}`;
  }

  function buildMessage(promo) {
    const formats = Store.formats.where(f => f.active !== false);
    const flavors = Store.flavors.all();
    const lines = [];

    lines.push('🌿 Focaccias Artesanales 🌿');
    lines.push(' ');

    if (promo) {
      lines.push(`PROMO DE LA SEMANA - ${promo.name}:`);
      lines.push('');
      lines.push(buildPromoDesc(promo));
      lines.push('');
      lines.push('✨✨Pedi la tuya ✨✨');
      lines.push('');
    }

    lines.push('');
    lines.push('Formatos y Precios :');
    formats.forEach(f => lines.push(`* ${f.name}: ${fmtPrice(f.price)}`));

    lines.push('');
    lines.push('Sabores disponibles :');
    flavors.forEach(f => lines.push(` ${flavorEmoji(f.name)} ${f.name}`));

    lines.push('');
    lines.push('¿Cómo hacer tu pedido?');
    lines.push('💻 Formulario web: https://tinyurl.com/pedi-tu-focaccia');
    lines.push('📲 Mensaje directo: wa.me/5491122339340');
    lines.push('');
    lines.push('Recordá hacer el pedido con al menos 24 hrs de anticipación');
    lines.push('');
    lines.push('📍 Entregas a coordinar en Zona Norte (Bancalari, Villanueva, Nordelta y alrededores)');
    lines.push('');
    lines.push('💳 Aceptamos transferencia o efectivo.');

    return lines.join('\n');
  }

  function regenerate() {
    const promo = getCurrentPromo();
    const ta = document.getElementById('promoMsgText');
    if (ta) ta.value = buildMessage(promo);
    App.toast('success', 'Mensaje actualizado desde los datos actuales');
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
    const promo    = getCurrentPromo();
    const msgText  = buildMessage(promo);
    const promoTag = promo
      ? `<span style="background:var(--color-primary-subtle);color:var(--color-primary-dark);font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-full);font-weight:500">Promo: ${promo.name}</span>`
      : `<span style="background:var(--color-surface-alt);color:var(--color-text-muted);font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-full)">Sin promo esta semana</span>`;

    container.innerHTML = `
      <div class="fade-in">
        <div class="page-header d-flex items-center justify-between" style="flex-wrap:wrap;gap:var(--space-3)">
          <div>
            <h1 class="page-title">Mensaje WhatsApp</h1>
            <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-2)">
              <p class="page-subtitle" style="margin:0">Generado desde los datos actuales</p>
              ${promoTag}
            </div>
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
            style="font-family:monospace;font-size:var(--text-sm);min-height:500px;line-height:1.7;resize:vertical;border-radius:var(--radius-sm)"
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    `;

    // Set value after DOM insertion to avoid HTML-entity issues
    document.getElementById('promoMsgText').value = msgText;
  }

  return { render, regenerate, copyMsg };
})();
