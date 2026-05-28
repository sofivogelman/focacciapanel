/**
 * Store — LocalStorage-backed data layer
 * All collections are plain arrays of objects with auto-incremented IDs.
 */
const Store = (() => {
  const PREFIX = 'focaccia_';

  // ─── Seed data ──────────────────────────────────────────────────────────────
  const SEEDS = {
    products: [],
    clients: [],
    ingredients: [
      // Masa base
      { id:1,  name:'Harina de fuerza Chacabuco', category:'base',       unit:'g',  cost:0, stock:0, minStock:500, createdAt:'2026-05-28' },
      { id:2,  name:'Levadura seca',              category:'base',       unit:'g',  cost:0, stock:0, minStock:20,  createdAt:'2026-05-28' },
      { id:3,  name:'Sal',                        category:'condimento', unit:'g',  cost:0, stock:0, minStock:200, createdAt:'2026-05-28' },
      { id:4,  name:'Azúcar',                     category:'condimento', unit:'g',  cost:0, stock:0, minStock:100, createdAt:'2026-05-28' },
      { id:5,  name:'Aceite',                     category:'condimento', unit:'ml', cost:0, stock:0, minStock:500, createdAt:'2026-05-28' },
      // Toppings
      { id:6,  name:'Tomates cherry',             category:'topping',    unit:'g',  cost:0, stock:0, minStock:300, createdAt:'2026-05-28' },
      { id:7,  name:'Pesto',                      category:'topping',    unit:'g',  cost:0, stock:0, minStock:150, createdAt:'2026-05-28' },
      { id:8,  name:'Queso parmesano',            category:'topping',    unit:'g',  cost:0, stock:0, minStock:150, createdAt:'2026-05-28' },
      { id:9,  name:'Papa',                       category:'topping',    unit:'g',  cost:0, stock:0, minStock:500, createdAt:'2026-05-28' },
      { id:10, name:'Romero seco',                category:'hierba',     unit:'g',  cost:0, stock:0, minStock:30,  createdAt:'2026-05-28' },
      { id:11, name:'Aceitunas en rodajas',       category:'topping',    unit:'g',  cost:0, stock:0, minStock:150, createdAt:'2026-05-28' },
    ],
    orders: [],
    expenses: [],

    recipes: [],
    flavors: [],
    formats: [],
    promos:  [],
  };

  // ─── Private helpers ─────────────────────────────────────────────────────────
  function key(name) { return PREFIX + name; }

  function load(name) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw === null) {
        // First run: seed with sample data
        const seed = SEEDS[name] || [];
        save(name, seed);
        return seed;
      }
      return JSON.parse(raw);
    } catch { return []; }
  }

  function save(name, data) {
    localStorage.setItem(key(name), JSON.stringify(data));
  }

  function nextId(collection) {
    if (!collection.length) return 1;
    return Math.max(...collection.map(r => r.id)) + 1;
  }

  // ─── Generic CRUD factory ────────────────────────────────────────────────────
  function collection(name) {
    return {
      all()        { return load(name); },
      find(id)     { return load(name).find(r => r.id === id) || null; },
      where(fn)    { return load(name).filter(fn); },
      create(data) {
        const col = load(name);
        const record = { ...data, id: nextId(col), createdAt: data.createdAt || new Date().toISOString().slice(0, 10) };
        col.push(record);
        save(name, col);
        return record;
      },
      update(id, data) {
        const col = load(name);
        const idx = col.findIndex(r => r.id === id);
        if (idx === -1) return null;
        col[idx] = { ...col[idx], ...data };
        save(name, col);
        return col[idx];
      },
      remove(id) {
        const col = load(name);
        const filtered = col.filter(r => r.id !== id);
        save(name, filtered);
        return filtered.length < col.length;
      },
      count()      { return load(name).length; },
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  return {
    products:    collection('products'),
    clients:     collection('clients'),
    ingredients: collection('ingredients'),
    orders:      collection('orders'),
    expenses:    collection('expenses'),
    recipes:     collection('recipes'),
    flavors:     collection('flavors'),
    formats:     collection('formats'),
    promos:      collection('promos'),

    /**
     * computeStockImpact — Dado un conjunto de orders, devuelve cuánto
     * ingrediente se necesita para producirlos, cruzando con las recetas.
     *
     * El modificador de formato (FORMAT_MOD) ajusta cantidades según
     * el tamaño pedido (Familiar=1.0, Chica=0.5, Grande=1.5…).
     *
     * Devuelve array ordenado por "after" ascendente (peor situación primero).
     */
    computeStockImpact(orders) {
      const FORMAT_MOD = {
        'chica': 0.5, 'pequeña': 0.5, 'mini': 0.5, 'personal': 0.5,
        'mediana': 0.75,
        'familiar': 1.0, 'normal': 1.0,
        'grande': 1.5, 'xl': 1.5, 'extra': 1.5,
      };

      const recipes     = load('recipes');
      const needed      = {};   // ingredientId → qty total requerida

      orders.forEach(order => {
        (order.items || []).forEach(item => {
          if (!item.productId) return;
          const modifier    = FORMAT_MOD[(item.format || '').toLowerCase()] || 1.0;
          const itemRecipes = recipes.filter(r => r.productId === item.productId);
          itemRecipes.forEach(r => {
            const qty = r.qty * item.qty * modifier;
            needed[r.ingredientId] = (needed[r.ingredientId] || 0) + qty;
          });
        });
      });

      return Object.entries(needed)
        .map(([ingId, totalQty]) => {
          const ing = load('ingredients').find(i => i.id === parseInt(ingId));
          if (!ing) return null;
          const rounded = Math.round(totalQty * 100) / 100;
          return {
            id:         ing.id,
            name:       ing.name,
            unit:       ing.unit,
            needed:     rounded,
            stock:      ing.stock,
            after:      Math.round((ing.stock - rounded) * 100) / 100,
            deficit:    ing.stock < rounded,
            costNeeded: Math.round(rounded * ing.cost),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.after - b.after);
    },

    // Computed stats for dashboard
    stats() {
      const orders      = load('orders');
      const expenses    = load('expenses');
      const ingredients = load('ingredients');

      const thisMonth   = new Date().toISOString().slice(0, 7);
      const monthOrders = orders.filter(o => o.date.startsWith(thisMonth));
      const revenue     = monthOrders.filter(o => o.paid).reduce((s, o) => s + o.total, 0);
      const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
      const pending     = orders.filter(o => o.status === 'pendiente').length;
      const lowStock    = ingredients.filter(i => i.stock <= i.minStock).length;

      return { revenue, monthExpenses, profit: revenue - monthExpenses, pending, totalOrders: monthOrders.length, lowStock };
    },

    // Reset all data (dev utility)
    reset() {
      Object.keys(SEEDS).forEach(name => {
        localStorage.removeItem(key(name));
      });
    },
  };
})();
