/* ============================================================
   Store — multi-client persistence via Supabase
   ============================================================ */

const { supabaseUrl, supabaseAnon } = window.VIABILITY_CONFIG;
const sb = supabase.createClient(supabaseUrl, supabaseAnon);

// ── Constants ──────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "energy",      key: "energy",      color: "#B8893A" },
  { id: "telco",       key: "telco",       color: "#2F7D63" },
  { id: "logistics",   key: "logistics",   color: "#6B4F8F" },
  { id: "insurance",   key: "insurance",   color: "#B5573D" },
  { id: "banking",     key: "banking",     color: "#1F4F7A" },
  { id: "maintenance", key: "maintenance", color: "#7A6A3A" },
  { id: "office",      key: "office",      color: "#8A8A6E" },
  { id: "cleaning",    key: "cleaning",    color: "#3D7A8A" },
  { id: "legal",       key: "legal",       color: "#5A4F3A" },
  { id: "tech",        key: "tech",        color: "#3A5A8A" },
  { id: "packaging",   key: "packaging",   color: "#A06A3D" },
  { id: "travel",      key: "travel",      color: "#6E2D4A" },
  { id: "fleet",       key: "fleet",       color: "#2A5A4A" },
  { id: "utilities",   key: "utilities",   color: "#4A7AA0" },
];

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ── Blank objects ──────────────────────────────────────────────────
function blankClient(name = "") {
  return {
    id: null, // assigned by Supabase
    legalName: name,
    tradeName: "",
    taxId: "",
    sector: "",
    employees: null,
    sites: null,
    country: "Chile",
    currency: "CLP",
    year: new Date().getFullYear() - 1,
    revenue: null,
    ebitda: null,
    contact: { name: "", role: "", email: "", phone: "" },
    notes: "",
    stage: 1,
    categories: [],
    expenses: [],
    scenario: {
      feePct: 30,
      feePctOnSavings: 50,
      feeMonths: 36,
      projectionYears: 5,
      includedCategories: null,
    },
    resources: {
      clientHHPerCat: 30,
      eraHHPerCat: 200,
    },
    prospectId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function blankExpense(categoryId = "energy") {
  return {
    id: uid("e"),
    categoryId,
    subcategory: "",
    supplier: "",
    amount: 0,
    suppliers: 1,
    savingsPct: 0,
    savingsMinPct: 0,
    savingsMaxPct: 0,
    scopePct: 100,
    feasibility: 0,
    months: 6,
    contractUntil: "",
    notes: "",
    monthly: null,
  };
}

// ── Row ↔ Client converters ────────────────────────────────────────
function rowToClient(row, expenseRows = []) {
  return {
    id: row.id,
    legalName: row.legal_name || "",
    tradeName: row.trade_name || "",
    taxId: row.tax_id || "",
    sector: row.sector || "",
    employees: row.employees,
    sites: row.sites,
    country: row.country || "Chile",
    currency: row.currency || "CLP",
    year: row.year || new Date().getFullYear() - 1,
    revenue: row.revenue,
    ebitda: row.ebitda,
    contact: row.contact || { name: "", role: "", email: "", phone: "" },
    notes: row.notes || "",
    stage: row.stage || 1,
    categories: row.categories || DEFAULT_CATEGORIES.map(c => ({ ...c })),
    expenses: expenseRows.map(expRowToExpense),
    scenario: row.scenario || { feePct: 30, feePctOnSavings: 50, feeMonths: 36, projectionYears: 5, includedCategories: null },
    resources: row.resources || { clientHHPerCat: 30, eraHHPerCat: 200 },
    prospectId: row.prospect_id,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function clientToRow(client) {
  const row = {
    legal_name: client.legalName,
    trade_name: client.tradeName,
    tax_id: client.taxId,
    sector: client.sector,
    employees: client.employees,
    sites: client.sites,
    country: client.country,
    currency: client.currency,
    year: client.year,
    revenue: client.revenue,
    ebitda: client.ebitda,
    contact: client.contact,
    notes: client.notes,
    stage: client.stage,
    categories: client.categories,
    scenario: client.scenario,
    resources: client.resources,
    prospect_id: client.prospectId || null,
    updated_at: new Date().toISOString(),
  };
  if (client.id) row.id = client.id;
  return row;
}

function expRowToExpense(row) {
  return {
    id: row.id,
    categoryId: row.category_id || "",
    subcategory: row.subcategory || "",
    supplier: row.supplier || "",
    amount: row.amount || 0,
    suppliers: row.suppliers || 1,
    savingsPct: row.savings_pct || 0,
    savingsMinPct: row.savings_min_pct || 0,
    savingsMaxPct: row.savings_max_pct || 0,
    scopePct: row.scope_pct != null ? row.scope_pct : 100,
    feasibility: row.feasibility || 3,
    months: row.months || 6,
    contractUntil: row.contract_until || "",
    notes: row.notes || "",
    monthly: row.monthly || null,
  };
}

function expenseToRow(expense, analysisId) {
  return {
    // id omitted — Supabase auto-generates UUID; local ids may be non-UUID strings
    analysis_id: analysisId,
    category_id: expense.categoryId,
    subcategory: expense.subcategory,
    supplier: expense.supplier,
    amount: expense.amount,
    suppliers: expense.suppliers,
    savings_pct: expense.savingsPct,
    savings_min_pct: expense.savingsMinPct,
    savings_max_pct: expense.savingsMaxPct,
    scope_pct: expense.scopePct,
    feasibility: expense.feasibility,
    months: expense.months,
    contract_until: expense.contractUntil,
    notes: expense.notes,
    monthly: expense.monthly,
  };
}

// ── Monthly data helpers (unchanged) ──────────────────────────────
function genMonthly(annualAmount, opts = {}) {
  const { trend = 0, seasonal = 0.08, noise = 0.05, seed = 1 } = opts;
  let rnd = seed;
  const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const monthlyAvg = annualAmount / 12;
  const months = [];
  for (let m = 0; m < 12; m++) {
    const tFactor = 1 + (trend * (m - 5.5) / 11);
    const sFactor = 1 + seasonal * Math.sin((m / 12) * 2 * Math.PI - 1);
    const nFactor = 1 + (r() - 0.5) * 2 * noise;
    months.push(monthlyAvg * tFactor * sFactor * nFactor);
  }
  const sum = months.reduce((a, b) => a + b, 0);
  const k = sum > 0 ? annualAmount / sum : 1;
  return months.map(v => Math.round(v * k));
}

function getMonthly(expense, fallbackLen = 12) {
  if (expense.monthly && expense.monthly.length > 0) return expense.monthly;
  const n = fallbackLen || 12;
  const flat = (+expense.amount || 0) / n;
  return Array(n).fill(flat);
}

function periodCount(client) {
  if (!client || !client.expenses) return 12;
  let max = 0;
  for (const e of client.expenses) {
    if (e.monthly && e.monthly.length > max) max = e.monthly.length;
  }
  return max || 12;
}

function periodLabels(n, lang = "es") {
  if (n === 12) return lang === "en" ? MONTH_LABELS_EN : MONTH_LABELS_ES;
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

// ── Seed data ──────────────────────────────────────────────────────
function seedClient() {
  const c = blankClient("Industrias Mediterráneas S.A.");
  c.categories = DEFAULT_CATEGORIES.map(x => ({ ...x })); // demo uses preset cats
  c.tradeName = "MedIndus";
  c.taxId = "B-87654321";
  c.sector = "Manufactura · Componentes industriales";
  c.employees = 280;
  c.sites = 4;
  c.country = "Chile";
  c.currency = "CLP";
  c.year = 2024;
  c.revenue = 48500000;
  c.ebitda = 5800000;
  c.contact = { name: "Laura Méndez", role: "Directora Financiera", email: "l.mendez@medindus.es", phone: "+34 91 555 0144" };
  c.notes = "Cliente referido por Banco Sabadell. Interesado especialmente en energía y logística.";
  c.stage = 2;
  const seedExpenses = [
    ["energy","Electricidad alta tensión","Iberdrola",1240000,1,18],
    ["energy","Gas natural industrial","Naturgy",340000,1,12],
    ["telco","Telefonía fija + datos","Movistar",182000,2,22],
    ["logistics","Transporte nacional","DSV",890000,3,14],
    ["insurance","Multirriesgo industrial","Mapfre",220000,1,11],
    ["banking","Comisiones bancarias","BBVA",145000,3,25],
    ["maintenance","Mantenimiento preventivo","Veolia",310000,4,10],
    ["cleaning","Limpieza industrial","OHL",285000,1,12],
    ["tech","ERP + licencias SaaS","SAP",410000,5,11],
    ["packaging","Cartón y film","Smurfit",540000,2,13],
  ];
  const trendByCat = { energy: 0.22, logistics: 0.14, telco: -0.04, insurance: 0.08, banking: -0.10, maintenance: 0.06, cleaning: 0.05, tech: 0.18, packaging: 0.12 };
  c.expenses = seedExpenses.map(([cat, sub, sup, amt, sups, sav], i) => {
    const exp = { ...blankExpense(cat), subcategory: sub, supplier: sup, amount: amt, suppliers: sups, savingsPct: sav, savingsMinPct: Math.max(0, sav - 5), savingsMaxPct: sav + 4, feasibility: sav >= 15 ? 5 : sav >= 10 ? 4 : sav >= 5 ? 3 : 2, months: sav >= 15 ? 4 : sav >= 8 ? 6 : 8 };
    exp.monthly = genMonthly(amt, { trend: trendByCat[cat] || 0, seasonal: 0.06, noise: 0.06, seed: (i + 7) * 13 });
    return exp;
  });
  return c;
}

// ── Aggregation helpers (unchanged) ───────────────────────────────
function aggregateByCategory(client) {
  if (!client) return [];
  const map = new Map();
  for (const e of client.expenses) {
    const cur = map.get(e.categoryId) || { categoryId: e.categoryId, total: 0, suppliers: 0, lines: 0, weightedScope: 0, weightedSavings: 0, weightedMin: 0, weightedMax: 0, weightedFeas: 0, maxMonths: 0 };
    const amt = +e.amount || 0;
    cur.total += amt;
    cur.suppliers += +e.suppliers || 0;
    cur.lines += 1;
    const scope = (e.scopePct == null ? 100 : +e.scopePct) / 100;
    const optAmt = amt * scope;
    cur.weightedScope += optAmt;
    cur.weightedSavings += optAmt * (+e.savingsPct || 0) / 100;
    cur.weightedMin += optAmt * (+e.savingsMinPct || +e.savingsPct || 0) / 100;
    cur.weightedMax += optAmt * (+e.savingsMaxPct || +e.savingsPct || 0) / 100;
    cur.weightedFeas += amt * (+e.feasibility || 3);
    cur.maxMonths = Math.max(cur.maxMonths, +e.months || 0);
    map.set(e.categoryId, cur);
  }
  return Array.from(map.values()).map(g => {
    const cat = client.categories.find(c => c.id === g.categoryId);
    return { ...g, category: cat, avgSavingsPct: g.total > 0 ? ((g.weightedMin + g.weightedMax) / 2 / g.total) * 100 : 0, avgMinPct: g.total > 0 ? (g.weightedMin / g.total) * 100 : 0, avgMaxPct: g.total > 0 ? (g.weightedMax / g.total) * 100 : 0, avgFeasibility: g.total > 0 ? (g.weightedFeas / g.total) : 3, potentialSavings: (g.weightedMin + g.weightedMax) / 2, minSavings: g.weightedMin, maxSavings: g.weightedMax, optimizationAmount: g.weightedScope, avgScopePct: g.total > 0 ? (g.weightedScope / g.total) * 100 : 100, months: g.maxMonths || 6 };
  }).sort((a, b) => b.total - a.total);
}

function aggregateByEra(client, eraCategories = []) {
  if (!client) return [];
  const map = new Map();
  for (const e of client.expenses) {
    const cat = client.categories.find(c => c.id === e.categoryId);
    const eraId = cat?.eraId || "__unassigned__";
    const cur = map.get(eraId) || {
      categoryId: eraId, eraId, total: 0, suppliers: 0, lines: 0,
      weightedScope: 0, weightedSavings: 0, weightedMin: 0, weightedMax: 0, weightedFeas: 0, maxMonths: 0,
    };
    const amt = +e.amount || 0;
    cur.total += amt;
    cur.suppliers += +e.suppliers || 0;
    cur.lines += 1;
    const scope = (e.scopePct == null ? 100 : +e.scopePct) / 100;
    const optAmt = amt * scope;
    cur.weightedScope += optAmt;
    cur.weightedSavings += optAmt * (+e.savingsPct || 0) / 100;
    cur.weightedMin += optAmt * (+e.savingsMinPct || +e.savingsPct || 0) / 100;
    cur.weightedMax += optAmt * (+e.savingsMaxPct || +e.savingsPct || 0) / 100;
    cur.weightedFeas += amt * (+e.feasibility || 3);
    cur.maxMonths = Math.max(cur.maxMonths, +e.months || 0);
    map.set(eraId, cur);
  }
  return Array.from(map.values()).map(g => {
    const era = eraCategories.find(ec => ec.id === g.eraId);
    const cat = era
      ? { id: era.id, color: era.color, label: era.label, key: era.label }
      : { id: "__unassigned__", color: "#bbb", label: "Sin categoría ERA", key: "sin-era" };
    return {
      ...g,
      category: cat,
      era,
      avgSavingsPct: g.total > 0 ? ((g.weightedMin + g.weightedMax) / 2 / g.total) * 100 : 0,
      avgMinPct:     g.total > 0 ? (g.weightedMin / g.total) * 100 : 0,
      avgMaxPct:     g.total > 0 ? (g.weightedMax / g.total) * 100 : 0,
      avgFeasibility: g.total > 0 ? g.weightedFeas / g.total : 3,
      potentialSavings: (g.weightedMin + g.weightedMax) / 2,
      minSavings:    g.weightedMin,
      maxSavings:    g.weightedMax,
      optimizationAmount: g.weightedScope,
      avgScopePct:   g.total > 0 ? (g.weightedScope / g.total) * 100 : 100,
      months:        g.maxMonths || 6,
    };
  }).sort((a, b) => b.total - a.total);
}

function totalSpend(client) {
  if (!client) return 0;
  return client.expenses.reduce((s, e) => s + (+e.amount || 0), 0);
}

function totalSavings(client) {
  if (!client) return 0;
  return client.expenses.reduce((s, e) => s + (+e.amount || 0) * (+e.savingsPct || 0) / 100, 0);
}

function savingsRange(client) {
  if (!client) return { min: 0, max: 0 };
  let min = 0, max = 0;
  client.expenses.forEach(e => {
    const amt = +e.amount || 0;
    const scope = (e.scopePct == null ? 100 : +e.scopePct) / 100;
    min += amt * scope * ((+e.savingsMinPct || 0) / 100);
    max += amt * scope * ((+e.savingsMaxPct || 0) / 100);
  });
  return { min, max };
}

function tierFor(group, totalClient) {
  const share = totalClient > 0 ? group.total / totalClient : 0;
  const sav = group.avgSavingsPct;
  if (sav >= 12 && share >= 0.04) return "A";
  if (sav >= 8 && share >= 0.08) return "B";
  if (sav < 4 || share < 0.015) return "D";
  return "C";
}

const MONTH_LABELS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_LABELS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthlyByCategory(client) {
  if (!client) return [];
  const n = periodCount(client);
  const map = new Map();
  for (const e of client.expenses) {
    const months = getMonthly(e, n);
    const cur = map.get(e.categoryId) || { categoryId: e.categoryId, months: Array(n).fill(0) };
    for (let m = 0; m < n; m++) cur.months[m] += months[m] || 0;
    map.set(e.categoryId, cur);
  }
  return Array.from(map.values()).map(g => ({ ...g, category: client.categories.find(c => c.id === g.categoryId), total: g.months.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
}

function monthlyByEra(client, eraCategories = []) {
  if (!client) return [];
  const n = periodCount(client);
  const map = new Map();
  for (const e of client.expenses) {
    const cat = client.categories.find(c => c.id === e.categoryId);
    const eraId = cat?.eraId || "__unassigned__";
    const months = getMonthly(e, n);
    const cur = map.get(eraId) || { categoryId: eraId, eraId, months: Array(n).fill(0) };
    for (let m = 0; m < n; m++) cur.months[m] += months[m] || 0;
    map.set(eraId, cur);
  }
  return Array.from(map.values()).map(g => {
    const era = eraCategories.find(ec => ec.id === g.eraId);
    const cat = era
      ? { id: era.id, color: era.color, label: era.label, key: era.label }
      : { id: "__unassigned__", color: "#bbb", label: "Sin categoría ERA", key: "sin-era" };
    return { ...g, category: cat, era, total: g.months.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => b.total - a.total);
}

function monthlyTotals(client) {
  if (!client) return Array(12).fill(0);
  const n = periodCount(client);
  const totals = Array(n).fill(0);
  for (const e of client.expenses) {
    const m = getMonthly(e, n);
    for (let i = 0; i < n; i++) totals[i] += m[i] || 0;
  }
  return totals;
}

// ── Store context ──────────────────────────────────────────────────
const StoreContext = React.createContext(null);

function StoreProvider({ children }) {
  const [clients, setClients] = React.useState([]);
  const [activeClientId, setActiveClientId] = React.useState(null);
  const [eraCategories, setEraCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [saveStatus, setSaveStatus] = React.useState('idle'); // 'idle'|'saving'|'saved'
  const pendingSaves = React.useRef({});
  const saveResetTimer = React.useRef(null);

  // ── Load all from Supabase ──────────────────────────────────────
  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Tiempo de espera agotado (15s)")), 15000)
      );
      const [{ data: analyses, error: aErr }, { data: expenses, error: eErr }] = await Promise.race([
        Promise.all([
          sb.from("viability_analyses").select("*").order("updated_at", { ascending: false }),
          sb.from("viability_expenses").select("*"),
        ]),
        timeout,
      ]);
      if (aErr) throw aErr;
      if (eErr) throw eErr;

      const byAnalysis = {};
      for (const e of expenses || []) {
        if (!byAnalysis[e.analysis_id]) byAnalysis[e.analysis_id] = [];
        byAnalysis[e.analysis_id].push(e);
      }
      setClients((analyses || []).map(a => rowToClient(a, byAnalysis[a.id] || [])));

      // ERA categories — load separately so a missing table doesn't crash the app
      try {
        const { data: eraCats, error: ecErr } = await sb
          .from("viability_era_categories").select("*").order("sort_order", { ascending: true });
        if (!ecErr) setEraCategories(eraCats || []);
      } catch (_) { /* tabla aún no creada */ }
    } catch (e) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  // ── Debounced save for a single client ─────────────────────────
  function schedSave(clientId) {
    setSaveStatus('saving');
    if (pendingSaves.current[clientId]) clearTimeout(pendingSaves.current[clientId]);
    pendingSaves.current[clientId] = setTimeout(async () => {
      setClients(prev => {
        const c = prev.find(x => x.id === clientId);
        if (!c) return prev;
        const row = clientToRow(c);
        const expRows = c.expenses.map(e => expenseToRow(e, clientId));
        sb.from("viability_analyses").update(row).eq("id", clientId).then(() => {
          setSaveStatus('saved');
          if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
          saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
        });
        sb.from("viability_expenses").delete().eq("analysis_id", clientId).then(() => {
          if (expRows.length > 0) sb.from("viability_expenses").insert(expRows).then(() => {});
        });
        return prev;
      });
    }, 1500);
  }

  // ── API ────────────────────────────────────────────────────────
  const api = React.useMemo(() => ({
    state: { clients, activeClientId, eraCategories, saveStatus },
    loading,
    error,
    reload: loadAll,

    setActiveClient: (id) => setActiveClientId(id),

    addClient: async (name, prospectId = null, initialData = {}) => {
      const c = { ...blankClient(name || "Nuevo cliente"), ...initialData };
      c.prospectId = prospectId || null;
      // Deep-merge contact if provided
      if (initialData.contact) c.contact = { ...blankClient().contact, ...initialData.contact };
      const row = clientToRow(c);
      delete row.id;
      const { data, error: err } = await sb.from("viability_analyses").insert(row).select().single();
      if (err) throw err;
      const newClient = rowToClient(data, []);
      setClients(prev => [newClient, ...prev]);
      setActiveClientId(newClient.id);
      return newClient.id;
    },

    searchProspects: async (query) => {
      if (!query || !query.trim()) return [];
      const q = query.trim();
      const { data } = await sb.from("prospects")
        .select("id, company, contact_name, role, email, phone, industry, subsector, country, status, stage")
        .or(`company.ilike.%${q}%,contact_name.ilike.%${q}%,industry.ilike.%${q}%`)
        .order("company", { ascending: true })
        .limit(25);
      return data || [];
    },

    deleteClient: async (id) => {
      if (pendingSaves.current[id]) clearTimeout(pendingSaves.current[id]);
      await sb.from("viability_analyses").delete().eq("id", id);
      setClients(prev => prev.filter(c => c.id !== id));
      setActiveClientId(prev => (prev === id ? null : prev));
    },

    updateClient: (id, patch) => {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
      schedSave(id);
    },

    setExpenses: (clientId, expenses) => {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, expenses, updatedAt: Date.now() } : c));
      schedSave(clientId);
    },

    addExpense: (clientId, expense) => {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, expenses: [...c.expenses, expense], updatedAt: Date.now() } : c));
      schedSave(clientId);
    },

    addCategory: (clientId, cat) => {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, categories: [...c.categories, cat], updatedAt: Date.now() } : c));
      schedSave(clientId);
    },

    setCategoryMapping: (clientId, catId, eraId) => {
      setClients(prev => prev.map(c => {
        if (c.id !== clientId) return c;
        return { ...c, categories: c.categories.map(cat => cat.id === catId ? { ...cat, eraId: eraId || null } : cat), updatedAt: Date.now() };
      }));
      schedSave(clientId);
    },

    addEraCategory: async (cat) => {
      const row = { key: cat.key, label: cat.label, color: cat.color, sort_order: cat.sort_order || 0 };
      const { data, error: err } = await sb.from("viability_era_categories").insert(row).select().single();
      if (err) throw err;
      setEraCategories(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
      return data;
    },

    updateEraCategory: async (id, patch) => {
      const { error: err } = await sb.from("viability_era_categories").update(patch).eq("id", id);
      if (err) throw err;
      setEraCategories(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    },

    deleteEraCategory: async (id) => {
      const { error: err } = await sb.from("viability_era_categories").delete().eq("id", id);
      if (err) throw err;
      setEraCategories(prev => prev.filter(c => c.id !== id));
    },

    setScenario: (clientId, scenario) => {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, scenario, updatedAt: Date.now() } : c));
      schedSave(clientId);
    },

    seedDemo: async () => {
      const c = seedClient();
      const { expenses } = c;
      const row = clientToRow(c);
      delete row.id;
      const { data, error: err } = await sb.from("viability_analyses").insert(row).select().single();
      if (err) throw err;
      const expRows = expenses.map(e => expenseToRow(e, data.id));
      if (expRows.length > 0) await sb.from("viability_expenses").insert(expRows);
      await loadAll();
      setActiveClientId(data.id);
    },

    resetAll: async () => {
      if (confirm("¿Borrar todos los análisis? Esta acción no se puede deshacer.")) {
        await sb.from("viability_analyses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        setClients([]);
        setActiveClientId(null);
      }
    },
  }), [clients, activeClientId, eraCategories, saveStatus, loading, error, loadAll]);

  return React.createElement(StoreContext.Provider, { value: api }, children);
}

function useStore() { return React.useContext(StoreContext); }

Object.assign(window, {
  DEFAULT_CATEGORIES, blankClient, blankExpense, seedClient,
  genMonthly, getMonthly, StoreContext, StoreProvider, useStore,
  aggregateByCategory, aggregateByEra, totalSpend, totalSavings, savingsRange, tierFor, uid,
  monthlyByCategory, monthlyByEra, monthlyTotals, MONTH_LABELS_ES, MONTH_LABELS_EN,
  periodCount, periodLabels,
});
