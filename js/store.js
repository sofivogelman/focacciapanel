/**
 * Store — LocalStorage-backed data layer
 * All collections are plain arrays of objects with auto-incremented IDs.
 */
const Store = (() => {
  const PREFIX = 'focaccia_';

  // ─── Seed data ──────────────────────────────────────────────────────────────
  const SEEDS = {
    products: [
      { id: 1, name: 'Focaccia Clásica', description: 'Romero, aceite de oliva y sal en escamas', category: 'clasica', price: 1800, cost: 650, unit: 'entera', active: true, image: '🫓' },
      { id: 2, name: 'Focaccia de Tomate Cherry', description: 'Tomates cherry asados, albahaca fresca, ajo', category: 'especial', price: 2200, cost: 800, unit: 'entera', active: true, image: '🍅' },
      { id: 3, name: 'Focaccia de Aceitunas', description: 'Aceitunas negras y verdes, orégano', category: 'clasica', price: 2000, cost: 720, unit: 'entera', active: true, image: '🫒' },
      { id: 4, name: 'Focaccia de Cebolla Caramelizada', description: 'Cebolla caramelizada, queso gruyère', category: 'especial', price: 2400, cost: 950, unit: 'entera', active: true, image: '🧅' },
      { id: 5, name: 'Focaccia Mini (Porción)', description: 'Clásica en porción individual', category: 'mini', price: 500, cost: 180, unit: 'porción', active: true, image: '🍞' },
    ],
    clients: [
      { id: 1, name: 'Martina García', phone: '11-5555-1234', email: 'martina@example.com', address: 'Palermo, CABA', notes: 'Prefiere entrega los sábados', createdAt: '2025-11-15' },
      { id: 2, name: 'Restaurant El Olivo', phone: '11-4444-5678', email: 'compras@elolivo.com', address: 'Las Cañitas, CABA', notes: 'Pedido semanal de 10 unidades', createdAt: '2025-10-03' },
      { id: 3, name: 'Lucía Fernández', phone: '11-6666-9012', email: '', address: 'Belgrano, CABA', notes: '', createdAt: '2026-01-20' },
      { id: 4, name: 'Café Verona', phone: '11-3333-4567', email: 'info@cafeverona.com', address: 'Recoleta, CABA', notes: 'Cliente mayorista, 15% descuento', createdAt: '2025-09-10' },
    ],
    ingredients: [
      { id: 1, name: 'Harina 0000', unit: 'kg', stock: 8.5, minStock: 5, cost: 350, category: 'base' },
      { id: 2, name: 'Aceite de oliva', unit: 'litro', stock: 3.2, minStock: 2, cost: 1800, category: 'base' },
      { id: 3, name: 'Levadura seca', unit: 'g', stock: 120, minStock: 50, cost: 0.8, category: 'base' },
      { id: 4, name: 'Sal en escamas', unit: 'g', stock: 400, minStock: 100, cost: 0.9, category: 'condimento' },
      { id: 5, name: 'Romero fresco', unit: 'g', stock: 80, minStock: 50, cost: 1.2, category: 'hierba' },
      { id: 6, name: 'Tomates cherry', unit: 'kg', stock: 1.5, minStock: 1, cost: 1200, category: 'topping' },
      { id: 7, name: 'Aceitunas negras', unit: 'g', stock: 600, minStock: 200, cost: 2.5, category: 'topping' },
      { id: 8, name: 'Queso gruyère', unit: 'g', stock: 350, minStock: 200, cost: 3.8, category: 'topping' },
      { id: 9, name: 'Cebolla', unit: 'kg', stock: 2.8, minStock: 1, cost: 400, category: 'topping' },
      { id: 10, name: 'Albahaca fresca', unit: 'g', stock: 40, minStock: 30, cost: 1.5, category: 'hierba' },
    ],
    orders: [
      {
        id: 1, clientId: 2, clientName: 'Restaurant El Olivo',
        date: '2026-05-25', deliveryDate: '2026-05-27', status: 'entregado',
        items: [{ productId: 1, name: 'Focaccia Clásica', qty: 5, price: 1800 }, { productId: 3, name: 'Focaccia de Aceitunas', qty: 3, price: 2000 }],
        total: 15000, notes: 'Entrega antes de las 11hs', paymentMethod: 'transferencia', paid: true
      },
      {
        id: 2, clientId: 1, clientName: 'Martina García',
        date: '2026-05-26', deliveryDate: '2026-05-28', status: 'en_preparacion',
        items: [{ productId: 2, name: 'Focaccia de Tomate Cherry', qty: 2, price: 2200 }],
        total: 4400, notes: '', paymentMethod: 'efectivo', paid: false
      },
      {
        id: 3, clientId: 4, clientName: 'Café Verona',
        date: '2026-05-27', deliveryDate: '2026-05-29', status: 'pendiente',
        items: [{ productId: 1, name: 'Focaccia Clásica', qty: 4, price: 1800 }, { productId: 4, name: 'Focaccia de Cebolla Caramelizada', qty: 2, price: 2400 }],
        total: 12000, notes: 'Aplicar 15% descuento mayorista', paymentMethod: 'transferencia', paid: false
      },
      {
        id: 4, clientId: 3, clientName: 'Lucía Fernández',
        date: '2026-05-20', deliveryDate: '2026-05-22', status: 'entregado',
        items: [{ productId: 5, name: 'Focaccia Mini (Porción)', qty: 6, price: 500 }],
        total: 3000, notes: '', paymentMethod: 'efectivo', paid: true
      },
    ],
    expenses: [
      { id: 1, description: 'Compra harina y aceite', amount: 8500, date: '2026-05-15', category: 'ingredientes' },
      { id: 2, description: 'Gas mes de mayo', amount: 3200, date: '2026-05-01', category: 'servicios' },
      { id: 3, description: 'Packaging (cajas)', amount: 2100, date: '2026-05-10', category: 'packaging' },
      { id: 4, description: 'Transporte delivery', amount: 1500, date: '2026-05-23', category: 'logistica' },
    ],

    // ─── Recetas ────────────────────────────────────────────────────────────────
    // Cantidades de ingrediente por unidad "Familiar" (tamaño base = 1.0).
    // Para formatos más chicos/grandes, sync.js aplica FORMAT_MOD como multiplicador.
    // ingredientId referencia los IDs del seed de ingredients arriba.
    recipes: [
      // Focaccia Clásica (productId: 1)
      { id:  1, productId: 1, ingredientId:  1, qty: 0.40 }, // Harina 0000 — 400g
      { id:  2, productId: 1, ingredientId:  2, qty: 0.04 }, // Aceite de oliva — 40ml
      { id:  3, productId: 1, ingredientId:  3, qty: 5    }, // Levadura seca — 5g
      { id:  4, productId: 1, ingredientId:  4, qty: 10   }, // Sal en escamas — 10g
      { id:  5, productId: 1, ingredientId:  5, qty: 15   }, // Romero fresco — 15g
      // Focaccia de Tomate Cherry (productId: 2)
      { id:  6, productId: 2, ingredientId:  1, qty: 0.40 }, // Harina
      { id:  7, productId: 2, ingredientId:  2, qty: 0.04 }, // Aceite
      { id:  8, productId: 2, ingredientId:  3, qty: 5    }, // Levadura
      { id:  9, productId: 2, ingredientId:  6, qty: 0.15 }, // Tomates cherry — 150g
      { id: 10, productId: 2, ingredientId: 10, qty: 20   }, // Albahaca fresca — 20g
      // Focaccia de Aceitunas (productId: 3)
      { id: 11, productId: 3, ingredientId:  1, qty: 0.40 },
      { id: 12, productId: 3, ingredientId:  2, qty: 0.04 },
      { id: 13, productId: 3, ingredientId:  3, qty: 5    },
      { id: 14, productId: 3, ingredientId:  7, qty: 80   }, // Aceitunas negras — 80g
      // Focaccia de Cebolla Caramelizada (productId: 4)
      { id: 15, productId: 4, ingredientId:  1, qty: 0.40 },
      { id: 16, productId: 4, ingredientId:  2, qty: 0.04 },
      { id: 17, productId: 4, ingredientId:  3, qty: 5    },
      { id: 18, productId: 4, ingredientId:  9, qty: 0.25 }, // Cebolla — 250g
      { id: 19, productId: 4, ingredientId:  8, qty: 60   }, // Queso gruyère — 60g
      // Focaccia Mini Porción (productId: 5) — media ración base
      { id: 20, productId: 5, ingredientId:  1, qty: 0.20 },
      { id: 21, productId: 5, ingredientId:  2, qty: 0.02 },
      { id: 22, productId: 5, ingredientId:  3, qty: 3    },
      { id: 23, productId: 5, ingredientId:  4, qty: 5    },
      { id: 24, productId: 5, ingredientId:  5, qty: 8    },
    ],
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
