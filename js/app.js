/**
 * App — global utilities and initialization
 */
const App = (() => {
  // ─── Toast ──────────────────────────────────────────────────────────────────
  const TOAST_ICONS = {
    success:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    newOrder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  };

  function toast(type, message, duration = 3500) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    // Mensaje especial para nuevos pedidos de Sheets
    const titleHtml = type === 'newOrder'
      ? '<div class="toast-title">¡Nuevo pedido recibido con éxito!</div>'
      : '';
    el.innerHTML = `
      <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
      <div class="toast-content">
        ${titleHtml}
        <div class="toast-message">${message}</div>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" style="margin:-4px -4px -4px 0" onclick="this.parentElement.remove()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ─── Modal ──────────────────────────────────────────────────────────────────
  let activeModal = null;
  let activeModalOnClose = null;

  function openModal({ title, body, primaryLabel = 'Confirmar', onConfirm, hideCancelBtn = false, size = '', onOpen, onClose }) {
    closeModal();
    activeModalOnClose = onClose || null;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="btn btn-ghost btn-icon btn-sm" id="modalCloseBtn" aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          ${!hideCancelBtn ? '<button class="btn btn-secondary" id="modalCancelBtn">Cancelar</button>' : ''}
          <button class="btn btn-primary" id="modalConfirmBtn">${primaryLabel}</button>
        </div>
      </div>
    `;

    document.getElementById('modalMount').appendChild(backdrop);
    activeModal = backdrop;

    requestAnimationFrame(() => backdrop.classList.add('open'));

    backdrop.getElementById = id => backdrop.querySelector('#' + id);

    const close = () => closeModal();
    backdrop.querySelector('#modalCloseBtn').onclick = close;
    if (!hideCancelBtn) backdrop.querySelector('#modalCancelBtn').onclick = close;

    backdrop.querySelector('#modalConfirmBtn').onclick = () => {
      const result = onConfirm?.();
      if (result !== false) closeModal();
    };

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });

    document.addEventListener('keydown', handleEsc);
    if (onOpen) setTimeout(onOpen, 0);
  }

  function handleEsc(e) {
    if (e.key === 'Escape') closeModal();
  }

  function closeModal() {
    if (!activeModal) return;
    activeModalOnClose?.();
    activeModalOnClose = null;
    activeModal.classList.remove('open');
    setTimeout(() => { activeModal?.remove(); activeModal = null; }, 300);
    document.removeEventListener('keydown', handleEsc);
  }

  // ─── Sidebar (mobile) ───────────────────────────────────────────────────────
  function initSidebar() {
    const toggle  = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    function open() {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    }
    function close() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }

    toggle?.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);

    // Close sidebar on nav click (mobile)
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => { if (window.innerWidth <= 768) close(); });
    });
  }

  // ─── Date display ───────────────────────────────────────────────────────────
  function initDate() {
    const el = document.getElementById('sidebarDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ─── Pending badge ──────────────────────────────────────────────────────────
  function updatePendingBadge() {
    const badge = document.getElementById('pendingBadge');
    if (!badge) return;
    const count = Store.orders.where(o => o.status === 'pendiente').length;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }

  // ─── Init ───────────────────────────────────────────────────────────────────
  function init() {
    initSidebar();
    initDate();
    updatePendingBadge();
    Router.init();
    Sync.init();
  }

  return { init, toast, openModal, closeModal, updatePendingBadge };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
