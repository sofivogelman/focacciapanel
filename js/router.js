/**
 * Router — simple hash-based SPA router
 */
const Router = (() => {
  const routes = {
    dashboard: { title: 'Resumen',      module: () => DashboardModule,  primaryLabel: 'Nuevo pedido',    primaryRoute: 'orders' },
    orders:    { title: 'Pedidos',      module: () => OrdersModule,     primaryLabel: 'Nuevo pedido',    primaryRoute: null },
    products:  { title: 'Catálogo',     module: () => ProductsModule,   primaryLabel: '',                primaryRoute: null },
    inventory: { title: 'Ingredientes', module: () => InventoryModule,  primaryLabel: 'Agregar stock',   primaryRoute: null },
    clients:   { title: 'Clientes',     module: () => ClientsModule,    primaryLabel: 'Nuevo cliente',   primaryRoute: null },
    finances:  { title: 'Finanzas',     module: () => FinancesModule,   primaryLabel: 'Agregar gasto',   primaryRoute: null },
    produccion: { title: 'Producción',   module: () => ProductionModule,  primaryLabel: '',              primaryRoute: null },
    analisis:   { title: 'Análisis',     module: () => AnalyticsModule,  primaryLabel: '',              primaryRoute: null },
    config:    { title: 'Configuración', module: () => ConfigModule,      primaryLabel: '',              primaryRoute: null },
  };

  let current = null;

  function navigate(route) {
    if (!routes[route]) route = 'dashboard';
    current = route;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    // Update topbar
    document.getElementById('topbarTitle').textContent = routes[route].title;
    const primaryBtn = document.getElementById('topbarPrimaryBtn');
    const label = routes[route].primaryLabel;
    document.getElementById('topbarPrimaryLabel').textContent = label;
    primaryBtn.style.display = label ? '' : 'none';

    // Render module
    const mod = routes[route].module();
    const container = document.getElementById('pageContent');
    container.innerHTML = '';

    // Primary button action
    primaryBtn.onclick = () => {
      if (routes[route].primaryRoute) {
        navigate(routes[route].primaryRoute);
      } else {
        mod.openCreateModal?.();
      }
    };

    mod.render(container);
  }

  function init() {
    // Wire nav items
    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', () => {
        navigate(el.dataset.route);
      });
    });

    // Start on dashboard
    navigate('dashboard');
  }

  return { init, navigate, current: () => current };
})();
