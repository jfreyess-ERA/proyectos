/* ============================================================
   Views: expenses (manual / paste / table)
   ============================================================ */

// ── Export to Excel ───────────────────────────────────────────────
function downloadTemplate() {
  const templateRows = [
    {
      "Categoría": "Energía",
      "Subcategoría": "Electricidad",
      "Proveedor": "Iberdrola",
      "Monto": 120000,
      "N° proveedores": 3,
      "% Ahorro estimado": 12,
      "% Ahorro mínimo": 8,
      "% Ahorro máximo": 18,
      "% Alcance": 100,
      "Factibilidad": 4,
      "Meses implementación": 6,
      "Notas": "Ejemplo",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(templateRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");
  XLSX.writeFile(wb, "plantilla_gastos.xlsx");
}

function getCompleteness(expense) {
  let score = 0;
  if (expense.supplier && expense.supplier.trim()) score += 20;
  if (+expense.amount > 0) score += 20;
  if (+expense.savingsPct > 0) score += 20;
  if (+expense.feasibility > 0) score += 20;
  if (expense.subcategory && expense.subcategory.trim()) score += 20;
  return score;
}

function validateExpense(expense) {
  const warnings = [];
  if (+expense.amount <= 0) warnings.push("Sin monto");
  if (+expense.savingsPct > 100) warnings.push("% ahorro > 100");
  if (+expense.feasibility > 5) warnings.push("Factibilidad > 5");
  return warnings;
}

const PIPELINE_STATES = [
  { id: "", label: "— Sin analizar —" },
  { id: "analysis", label: "En análisis" },
  { id: "proposal", label: "Propuesta enviada" },
  { id: "closed_won", label: "Cerrado ganado" },
  { id: "closed_lost", label: "Cerrado perdido" },
];

function exportToExcel(client, catLabel, eraCategories) {
  const rows = client.expenses.map(e => {
    const cat = client.categories.find(c => c.id === e.categoryId);
    const era = eraCategories.find(er => er.id === cat?.eraId);
    const row = {
      "Categoría ERA":      era?.label || "",
      "Categoría cliente":  catLabel(cat),
      "Subcategoría":       e.subcategory || "",
      "Proveedor":          e.supplier || "",
      "Monto":              +e.amount || 0,
      "N° proveedores":     +e.suppliers || 0,
      "% Ahorro estimado":  +e.savingsPct || 0,
      "% Ahorro mínimo":    +e.savingsMinPct || 0,
      "% Ahorro máximo":    +e.savingsMaxPct || 0,
      "% Alcance":          +e.scopePct || 0,
      "Factibilidad":       +e.feasibility || 0,
      "Meses impl.":        +e.months || 0,
      "Vencimiento":        e.contractUntil || "",
      "Notas":              e.notes || "",
    };
    if (e.monthly && e.monthly.length > 0) {
      e.monthly.forEach((v, i) => { row[`M${i + 1}`] = v; });
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");
  const name = (client.legalName || "cliente")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/gi, "").trim()
    .replace(/\s+/g, "_").slice(0, 40);
  XLSX.writeFile(wb, `gastos_${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function RangesTab({ client, readonly = false }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];

  const update = (idx, patch) => {
    const next = client.expenses.map((e, i) => i === idx ? { ...e, ...patch } : e);
    store.setExpenses(client.id, next);
  };

  const catLabel = (catId) => {
    const cat = client.categories.find(c => c.id === catId);
    return cat ? (cat.label || cat.key) : "—";
  };

  if (client.expenses.length === 0) {
    return <Empty icon="◯" title="Sin gastos" hint="Importa gastos primero." />;
  }

  return (
    <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <h3 className="h3" style={{ margin: 0 }}>Rangos por línea de gasto · ajuste consultor</h3>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
          Ahorro mín/máx = Gasto × Alcance % × Ahorro %. La proyección usa estos rangos.
        </div>
      </div>
      <div style={{ overflow: "auto" }}>
        <table className="t">
          <thead>
            <tr>
              <th>Categoría cliente</th>
              <th>ERA</th>
              <th>Subcategoría / Proveedor</th>
              <th className="right">Monto</th>
              <th className="right">Alcance %</th>
              <th className="right">Ahorro mín %</th>
              <th className="right">Ahorro máx %</th>
              <th className="right">Factibilidad</th>
            </tr>
          </thead>
          <tbody>
            {client.expenses.map((e, i) => {
              const cat = client.categories.find(c => c.id === e.categoryId);
              const era = eraCategories.find(ec => ec.id === cat?.eraId);
              const scope = e.scopePct == null ? 100 : +e.scopePct;
              return (
                <tr key={e.id || i}>
                  <td style={{ fontSize: 12 }}>{catLabel(e.categoryId)}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {era ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: era.color, flexShrink: 0 }} />
                        {era.label}
                      </span>
                    ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{e.subcategory || e.supplier || "—"}</td>
                  <td className="right tabular">{fmtMoney(+e.amount || 0, client.currency)}</td>
                  <td className="right">
                    <input className="input right" type="number" min="0" max="100" value={scope}
                      onChange={ev => update(i, { scopePct: +ev.target.value || 0 })}
                      style={{ width: 70 }} disabled={readonly} />
                  </td>
                  <td className="right">
                    <input className="input right" type="number" min="0" max="100" step="0.1"
                      value={e.savingsMinPct || 0}
                      onChange={ev => update(i, { savingsMinPct: +ev.target.value || 0 })}
                      style={{ width: 70 }} disabled={readonly} />
                  </td>
                  <td className="right">
                    <input className="input right" type="number" min="0" max="100" step="0.1"
                      value={e.savingsMaxPct || 0}
                      onChange={ev => update(i, { savingsMaxPct: +ev.target.value || 0 })}
                      style={{ width: 70 }} disabled={readonly} />
                  </td>
                  <td className="right">
                    <select className="select" value={e.feasibility || 0}
                      onChange={ev => update(i, { feasibility: +ev.target.value })}
                      style={{ width: 60 }} disabled={readonly}>
                      {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpensesView({ client, readonly = false }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [mode, setMode] = React.useState("table");
  const [showAddCat, setShowAddCat] = React.useState(false);
  const [importToast, setImportToast] = React.useState(null); // { rows, cats }
  const [drawerIdx, setDrawerIdx] = React.useState(null);     // expense index for side drawer
  const [filters, setFilters] = React.useState({ eraId: "", feasMin: 0, amountMin: 0, amountMax: 0 });
  const [showFilters, setShowFilters] = React.useState(false);
  const [undoSnapshot, setUndoSnapshot] = React.useState(null);

  React.useEffect(() => {
    const handler = (ev) => {
      if (ev.key === "Escape") {
        if (drawerIdx != null) { setDrawerIdx(null); return; }
        if (showFilters) { setShowFilters(false); return; }
        if (showAddCat) { setShowAddCat(false); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerIdx, showFilters, showAddCat]);

  const expenses = client.expenses;
  const total = totalSpend(client);

  const update = (idx, patch) => {
    store.setExpenses(client.id, expenses.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };
  const remove = (idx) => store.setExpenses(client.id, expenses.filter((_, i) => i !== idx));
  const duplicate = (idx) => {
    const copy = { ...expenses[idx], id: uid("e") };
    store.setExpenses(client.id, [...expenses.slice(0, idx + 1), copy, ...expenses.slice(idx + 1)]);
  };
  const addRow = (categoryId) => {
    store.setExpenses(client.id, [...expenses, blankExpense(categoryId || client.categories[0]?.id)]);
  };
  const bulkRemove = (ids) => {
    store.setExpenses(client.id, expenses.filter(e => !ids.has(e.id)));
  };
  const bulkChangeCategory = (ids, categoryId) => {
    store.setExpenses(client.id, expenses.map(e => ids.has(e.id) ? { ...e, categoryId } : e));
  };
  const catLabel = (cat) => {
    if (!cat) return "—";
    return t.categories[cat.key] || cat.label || cat.key;
  };

  // Empty state — no expenses and no categories yet
  if (expenses.length === 0 && client.categories.length === 0 && mode === "table") {
    return (
      <div className="stack lg">
        <div className="row between">
          <div>
            <div className="eyebrow">{t.nav.expenses}</div>
            <h2 className="h2">{t.expenses.title}</h2>
          </div>
        </div>
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <h3 className="h3" style={{ marginBottom: 8 }}>Sin gastos</h3>
          {!readonly && (
            <>
              <p className="lede" style={{ maxWidth: 400, margin: "0 auto 24px" }}>
                Empieza importando un archivo Excel con los gastos del cliente, o crea las categorías manualmente y añade filas una a una.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn primary" onClick={() => setMode("excel")}>📊 Importar Excel</button>
                <button className="btn" onClick={() => setShowAddCat(true)}>+ Crear categoría</button>
                <button className="btn ghost" onClick={() => setMode("manual")}>Añadir fila manual</button>
              </div>
            </>
          )}
        </div>
        {!readonly && (
          <AddCategoryModal open={showAddCat} onClose={() => setShowAddCat(false)}
            onCreate={(name) => {
              store.addCategory(client.id, { id: uid("cat"), key: name.toLowerCase().replace(/\s+/g, "_"), label: name, color: AUTO_CAT_COLORS[0] });
              setShowAddCat(false); setMode("table");
            }} />
        )}
      </div>
    );
  }

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.nav.expenses}</div>
          <h2 className="h2">{t.expenses.title}</h2>
        </div>
        <div className="btn-row">
          {expenses.length > 0 && (
            <button className="btn ghost sm" onClick={() => exportToExcel(client, catLabel, eraCategories)} title="Exportar a Excel">↓ Excel</button>
          )}
          {!readonly && (
            <button className="btn ghost sm" onClick={() => downloadTemplate()} title="Descargar plantilla Excel">⬇ Plantilla</button>
          )}
          {mode === "table" && (
            <button className="btn ghost sm" onClick={() => setShowFilters(s => !s)} title="Filtros avanzados">
              ⚡ Filtros
              {(filters.eraId || filters.feasMin > 0 || filters.amountMin > 0 || filters.amountMax > 0) && (
                <span style={{ marginLeft: 5, background: "var(--accent)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                  {[filters.eraId, filters.feasMin > 0, filters.amountMin > 0, filters.amountMax > 0].filter(Boolean).length}
                </span>
              )}
            </button>
          )}
          {!readonly && (
            <button className="btn" onClick={() => setShowAddCat(true)}>+ {t.actions.addCategory}</button>
          )}
          {!readonly && (
            <button className="btn primary" onClick={() => addRow()}>+ {t.actions.addRow}</button>
          )}
        </div>
      </div>

      {/* Post-import success toast */}
      {importToast && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:10, background:"oklch(0.96 0.06 145)", border:"1px solid oklch(0.82 0.12 145)", fontSize:13 }}>
          <span style={{ color:"oklch(0.35 0.14 145)", fontWeight:600 }}>
            ✓ {importToast.rows} fila{importToast.rows!==1?"s":""} importada{importToast.rows!==1?"s":""}
            {importToast.cats > 0 && ` · ${importToast.cats} categoría${importToast.cats!==1?"s":""} nueva${importToast.cats!==1?"s":""} creada${importToast.cats!==1?"s":""}`}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            {undoSnapshot && (
              <button className="btn ghost sm" style={{ color:"oklch(0.35 0.14 145)", borderColor:"oklch(0.72 0.12 145)" }}
                onClick={() => {
                  store.setExpenses(client.id, undoSnapshot);
                  setUndoSnapshot(null);
                  setImportToast(null);
                }}>
                ↩ Deshacer
              </button>
            )}
            <button onClick={() => setImportToast(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"oklch(0.50 0.14 145)" }}>×</button>
          </div>
        </div>
      )}

      <div className="grid cols-2">
        <Stat label={t.expenses.total} value={fmtMoney(total, client.currency, { compact: true })} sub={`${expenses.length} ${t.expenses.rowCount}`} variant="dark" />
        <Stat label={t.dashboard.categoriesAnalyzed} value={new Set(expenses.map(e => e.categoryId)).size} sub={`/ ${client.categories.length} ${t.clients.categories}`} />
      </div>

      <Tabs active={mode} onChange={setMode} tabs={[
        { id: "table",      label: t.expenses.modes.table, count: expenses.length || null },
        { id: "rangos",     label: "⊞ Rangos" },
        ...(!readonly ? [
          { id: "manual", label: t.expenses.modes.manual },
          { id: "paste",  label: t.expenses.modes.paste },
          { id: "excel",  label: "Excel" },
        ] : []),
      ]} />

      {mode === "table" && (
        <ExpenseTable client={client} expenses={expenses} eraCategories={eraCategories}
          update={update} remove={remove} duplicate={duplicate} catLabel={catLabel}
          onOpen={idx => setDrawerIdx(idx)}
          onBulkRemove={bulkRemove}
          onBulkChangeCategory={bulkChangeCategory}
          filters={filters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(s => !s)}
          onChangeFilters={setFilters}
          activeIdx={drawerIdx}
          readonly={readonly}
        />
      )}
      {mode === "rangos" && (
        <RangesTab client={client} readonly={readonly} />
      )}
      {mode === "manual" && (
        <ManualEntry client={client} catLabel={catLabel} onAdd={(exp) => store.addExpense(client.id, exp)} />
      )}
      {mode === "paste" && (
        <PasteImport client={client} catLabel={catLabel} onImport={(rows) => {
          store.setExpenses(client.id, [...expenses, ...rows]);
          setImportToast({ rows: rows.length, cats: 0 });
          setMode("table");
        }} />
      )}
      {mode === "excel" && (
        <ExcelImport client={client} catLabel={catLabel} eraCategories={eraCategories}
          onImport={(rows, newCats) => {
            setUndoSnapshot([...expenses]);
            (newCats || []).forEach(cat => { const { _isNew, ...d } = cat; store.addCategory(client.id, d); });
            store.setExpenses(client.id, [...expenses, ...rows]);
            setImportToast({ rows: rows.length, cats: (newCats || []).length });
            setMode("table");
          }}
        />
      )}

      <AddCategoryModal open={showAddCat} onClose={() => setShowAddCat(false)}
        onCreate={(name) => {
          store.addCategory(client.id, { id: uid("cat"), key: name.toLowerCase().replace(/\s+/g, "_"), label: name, color: AUTO_CAT_COLORS[client.categories.length % AUTO_CAT_COLORS.length] });
          setShowAddCat(false);
        }} />

      <ExpenseDrawer
        open={drawerIdx != null}
        expense={drawerIdx != null ? expenses[drawerIdx] : null}
        client={client}
        catLabel={catLabel}
        eraCategories={eraCategories}
        update={patch => update(drawerIdx, patch)}
        remove={() => { remove(drawerIdx); setDrawerIdx(null); }}
        duplicate={() => { duplicate(drawerIdx); setDrawerIdx(null); }}
        onClose={() => setDrawerIdx(null)}
        idx={drawerIdx != null ? drawerIdx : 0}
        totalCount={expenses.length}
        onNavigate={d => setDrawerIdx(prev => Math.max(0, Math.min(expenses.length - 1, prev + d)))}
        readonly={readonly}
      />
    </div>
  );
}

function ExpenseTable({ client, expenses, eraCategories = [], update, remove, duplicate, catLabel, onOpen, onBulkRemove, onBulkChangeCategory, filters = {}, showFilters = false, onToggleFilters, onChangeFilters, activeIdx, readonly = false }) {
  const { t } = useI18n();
  const store = useStore();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState({ col: null, dir: "desc" });
  const [selected, setSelected] = React.useState(new Set());
  const [bulkCatId, setBulkCatId] = React.useState("");
  const [expandedNotes, setExpandedNotes] = React.useState(new Set());

  const toggleSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  const SortIcon = ({ col }) => sort.col !== col ? null : (
    <span style={{ marginLeft: 4, opacity: 0.6 }}>{sort.dir === "desc" ? "↓" : "↑"}</span>
  );

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (expenses.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  // Filter
  const q = search.toLowerCase();
  let rows = expenses.map((e, i) => ({ e, i }));
  if (q) {
    rows = rows.filter(({ e }) => {
      const cat = client.categories.find(c => c.id === e.categoryId);
      const era = eraCategories.find(er => er.id === cat?.eraId);
      return (
        (catLabel(cat) || "").toLowerCase().includes(q) ||
        (era?.label || "").toLowerCase().includes(q) ||
        (e.subcategory || "").toLowerCase().includes(q) ||
        (e.supplier || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q)
      );
    });
  }

  // Advanced filters
  if (filters.eraId) {
    rows = rows.filter(({ e }) => {
      const cat = client.categories.find(c => c.id === e.categoryId);
      return cat?.eraId === filters.eraId;
    });
  }
  if (filters.feasMin > 0) {
    rows = rows.filter(({ e }) => (+e.feasibility || 0) >= filters.feasMin);
  }
  if (filters.amountMin > 0) rows = rows.filter(({ e }) => (+e.amount || 0) >= filters.amountMin);
  if (filters.amountMax > 0) rows = rows.filter(({ e }) => (+e.amount || 0) <= filters.amountMax);

  // Sort
  if (sort.col) {
    rows.sort((a, b) => {
      let va, vb;
      if (sort.col === "category") { va = catLabel(client.categories.find(c=>c.id===a.e.categoryId))||""; vb = catLabel(client.categories.find(c=>c.id===b.e.categoryId))||""; }
      else if (sort.col === "supplier") { va = a.e.supplier||""; vb = b.e.supplier||""; }
      else if (sort.col === "amount") { va = +a.e.amount||0; vb = +b.e.amount||0; }
      else if (sort.col === "savings") { va = +a.e.savingsPct||0; vb = +b.e.savingsPct||0; }
      if (typeof va === "string") return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sort.dir === "asc" ? va - vb : vb - va;
    });
  }

  const allVisibleSelected = rows.length > 0 && rows.every(({ e }) => selected.has(e.id));
  const someSelected = selected.size > 0;
  const total = totalSpend(client);
  const showEra = eraCategories.length > 0;

  // ERA coverage info
  const eraWithMapping = expenses.filter(e => {
    const cat = client.categories.find(c => c.id === e.categoryId);
    return cat?.eraId;
  }).length;

  const activeFilterCount = [filters.eraId, filters.feasMin > 0, filters.amountMin > 0, filters.amountMax > 0].filter(Boolean).length;

  return (
    <div className="stack" style={{ gap: 10 }}>
      {/* Search bar + ERA coverage */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="🔍  Buscar por categoría, proveedor, subcategoría…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 420 }}
        />
        {search && (
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {rows.length} de {expenses.length} filas
          </span>
        )}
        {search && <button className="btn ghost sm" onClick={() => setSearch("")}>✕ Limpiar</button>}
        {eraCategories.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 99, padding: "2px 10px", marginLeft: "auto" }}>
            {eraWithMapping} / {expenses.length} con ERA
          </span>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {eraCategories.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Categoría ERA</label>
              <select className="select" value={filters.eraId} onChange={e => onChangeFilters && onChangeFilters(f => ({ ...f, eraId: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">Todas</option>
                {eraCategories.map(er => <option key={er.id} value={er.id}>{er.label}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 100 }}>
            <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Factibilidad ≥</label>
            <input className="input" type="number" min={0} max={5} value={filters.feasMin || ""} placeholder="1–5" onChange={e => onChangeFilters && onChangeFilters(f => ({ ...f, feasMin: +e.target.value || 0 }))} style={{ fontSize: 12 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
            <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Monto mínimo</label>
            <MoneyInput value={filters.amountMin || 0} onChange={v => onChangeFilters && onChangeFilters(f => ({ ...f, amountMin: v }))} placeholder="0" style={{ fontSize: 12 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
            <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Monto máximo</label>
            <MoneyInput value={filters.amountMax || 0} onChange={v => onChangeFilters && onChangeFilters(f => ({ ...f, amountMax: v }))} placeholder="sin límite" style={{ fontSize: 12 }} />
          </div>
          <button className="btn ghost sm" onClick={() => onChangeFilters && onChangeFilters({ eraId: "", feasMin: 0, amountMin: 0, amountMax: 0 })}>
            Limpiar filtros
          </button>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {rows.length} de {expenses.length} filas visibles
            </span>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && !readonly && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          borderRadius: 8, background: "var(--accent-bg)", border: "1px solid var(--accent)",
          fontSize: 13,
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <select
            className="select"
            value={bulkCatId}
            onChange={e => setBulkCatId(e.target.value)}
            style={{ minWidth: 180, fontSize: 12 }}
          >
            <option value="">Cambiar categoría…</option>
            {client.categories.map(c => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
          <button className="btn sm"
            disabled={!bulkCatId}
            onClick={() => {
              if (bulkCatId) { onBulkChangeCategory(selected, bulkCatId); setBulkCatId(""); setSelected(new Set()); }
            }}
          >
            Aplicar
          </button>
          <button className="btn sm danger"
            onClick={() => {
              if (!confirm(`¿Eliminar ${selected.size} fila${selected.size !== 1 ? "s" : ""}?`)) return;
              onBulkRemove(selected);
              setSelected(new Set());
            }}
          >
            🗑 Eliminar
          </button>
          <button className="btn ghost sm" onClick={() => setSelected(new Set())}>✕</button>
        </div>
      )}

      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        <table className="t">
          <thead>
            <tr>
              {!readonly && (
                <th style={{ width: 36, paddingLeft: 12 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (allVisibleSelected) {
                        setSelected(prev => {
                          const next = new Set(prev);
                          rows.forEach(({ e }) => next.delete(e.id));
                          return next;
                        });
                      } else {
                        setSelected(prev => {
                          const next = new Set(prev);
                          rows.forEach(({ e }) => next.add(e.id));
                          return next;
                        });
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                </th>
              )}
              <th style={{ width: 8 }}></th>
              {showEra && <th>ERA</th>}
              <th style={{ cursor:"pointer", userSelect:"none" }} onClick={() => toggleSort("category")}>{t.expenses.cols.category} <SortIcon col="category" /></th>
              <th>{t.expenses.cols.subcategory}</th>
              <th style={{ cursor:"pointer", userSelect:"none" }} onClick={() => toggleSort("supplier")}>{t.expenses.cols.supplier} <SortIcon col="supplier" /></th>
              <th className="right" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => toggleSort("amount")}>{t.expenses.cols.amount} <SortIcon col="amount" /></th>
              <th className="right">{t.expenses.cols.suppliers}</th>
              <th style={{ cursor:"pointer", userSelect:"none" }} onClick={() => toggleSort("savings")}>% Ahorro <SortIcon col="savings" /></th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, i }) => {
              const cat = client.categories.find(c => c.id === e.categoryId);
              const era = eraCategories.find(er => er.id === cat?.eraId);
              const isSelected = selected.has(e.id);
              const isActive = activeIdx === i;
              const warnings = validateExpense(e);
              const completeness = getCompleteness(e);
              const completenessColor = completeness < 40
                ? "oklch(0.65 0.12 25)"
                : completeness < 80
                  ? "oklch(0.68 0.12 50)"
                  : "oklch(0.60 0.14 145)";
              const clickableStyle = { cursor: "pointer" };
              const openDrawer = (ev) => {
                // Don't open if clicking on an interactive element
                if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT" || ev.target.tagName === "BUTTON") return;
                onOpen && onOpen(i);
              };
              let rowBg = undefined;
              if (isActive) rowBg = "oklch(0.96 0.03 265)";
              else if (isSelected) rowBg = "var(--accent-bg)";
              return (
                <tr key={e.id} style={{ background: rowBg, boxShadow: isActive ? "inset 3px 0 0 var(--accent)" : undefined }}>
                  {!readonly && (
                    <td style={{ paddingLeft: 12 }} onClick={ev => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(e.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                  )}
                  <td onClick={openDrawer} style={clickableStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 6, height: 24, background: cat?.color || "#ccc", display: "block", borderRadius: 2 }} />
                      {warnings.length > 0 && (
                        <span title={warnings.join(", ")} style={{ fontSize: 12, cursor: "default" }}>⚠️</span>
                      )}
                    </div>
                  </td>
                  {showEra && (
                    <td onClick={ev => ev.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                      <select
                        className="select"
                        value={cat?.eraId || ""}
                        onChange={ev => store.setCategoryMapping(client.id, cat?.id, ev.target.value || null)}
                        style={{ minWidth: 140, fontSize: 12 }}
                        disabled={readonly || !cat}
                      >
                        <option value="">— Sin ERA —</option>
                        {eraCategories.map(er => (
                          <option key={er.id} value={er.id}>{er.label}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td onClick={ev => ev.stopPropagation()}>
                    <input
                      className="input"
                      value={cat?.label || cat?.key || ""}
                      onChange={ev => {
                        if (!cat) return;
                        store.updateClient(client.id, {
                          categories: client.categories.map(c =>
                            c.id === cat.id ? { ...c, label: ev.target.value } : c
                          )
                        });
                      }}
                      disabled={readonly || !cat}
                      style={{ minWidth: 130 }}
                      placeholder="Categoría"
                    />
                  </td>
                  <td><input className="input" value={e.subcategory} onChange={ev => update(i, { subcategory: ev.target.value })} disabled={readonly} /></td>
                  <td><input className="input" value={e.supplier} onChange={ev => update(i, { supplier: ev.target.value })} disabled={readonly} /></td>
                  <td className="right">
                    <MoneyInput value={e.amount} onChange={v => update(i, { amount: v })} disabled={readonly} style={{ width: 120 }} />
                  </td>
                  <td className="right">
                    <input className="input right" type="number" value={e.suppliers} onChange={ev => update(i, { suppliers: +ev.target.value || 0 })} style={{ width: 60 }} disabled={readonly} />
                  </td>
                  <td onClick={openDrawer} style={{ textAlign:"right", fontSize:12, color: e.savingsPct > 0 ? "var(--text-1)" : "var(--text-3)", ...clickableStyle }}>
                    {e.savingsPct > 0 ? e.savingsPct.toFixed(1) + "%" : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span
                      title={`Completitud: ${completeness}%`}
                      style={{ display: "inline-block", width: 28, height: 4, borderRadius: 2, background: "var(--line)", verticalAlign: "middle", marginRight: 6, position: "relative", overflow: "hidden" }}
                    >
                      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: completeness + "%", background: completenessColor, borderRadius: 2 }} />
                    </span>
                    <button className="btn ghost sm" onClick={() => onOpen && onOpen(i)} title="Ver detalle">↗</button>
                    {!readonly && <button className="btn ghost sm" onClick={() => duplicate(i)} title="Duplicar">⎘</button>}
                    {!readonly && <button className="btn ghost sm danger" onClick={() => remove(i)} title="Eliminar">×</button>}
                  </td>
                </tr>
              );
            })}
            {!search && (
              <tr className="totals">
                <td colSpan={readonly ? (showEra ? 2 : 1) : (showEra ? 3 : 2)}></td>
                <td colSpan={2}>{t.expenses.total}</td>
                <td></td>
                <td className="right">{fmtMoney(total, client.currency)}</td>
                <td className="right">{expenses.reduce((s, e) => s + (+e.suppliers || 0), 0)}</td>
                <td></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expense Detail Drawer ─────────────────────────────────────────
function ExpenseDrawer({ open, expense, client, catLabel, eraCategories, update, remove, duplicate, onClose, idx, totalCount, onNavigate, readonly = false }) {
  const { t } = useI18n();
  if (!open || !expense) return null;

  const cat = client.categories.find(c => c.id === expense.categoryId);
  const era = eraCategories.find(e => e.id === cat?.eraId);

  const savingsAbs = expense.amount > 0 && expense.savingsPct > 0
    ? expense.amount * (expense.savingsPct / 100) : 0;

  const warnings = validateExpense(expense);

  // Unique supplier names for autocomplete
  const supplierOptions = [...new Set((client.expenses || []).map(e => e.supplier).filter(Boolean))];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.25)" }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(480px, calc(100vw - 48px))",
        background: "var(--surface)", borderLeft: "1px solid var(--line)",
        boxShadow: "-8px 0 40px rgba(0,0,0,.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 20px 14px", borderBottom: "1px solid var(--line)",
          gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {catLabel(cat)}
            </div>
            {expense.supplier && (
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{expense.supplier}</div>
            )}
            {era && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: era.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{era.label}</span>
              </div>
            )}
          </div>
          {/* Prev/Next navigation */}
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <button className="btn ghost sm" disabled={idx <= 0} onClick={() => onNavigate && onNavigate(-1)} title="Anterior">‹</button>
            <span style={{ fontSize: 11, color: "var(--text-3)", alignSelf: "center", minWidth: 40, textAlign: "center" }}>{idx + 1}/{totalCount}</span>
            <button className="btn ghost sm" disabled={idx >= totalCount - 1} onClick={() => onNavigate && onNavigate(1)} title="Siguiente">›</button>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {!readonly && <button className="btn ghost sm" onClick={duplicate} title="Duplicar">⎘</button>}
            {!readonly && <button className="btn ghost sm danger" onClick={remove} title="Eliminar">×</button>}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-3)", lineHeight: 1, paddingLeft: 6 }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Validation warnings */}
          {warnings.length > 0 && (
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "oklch(0.97 0.06 60)", border: "1px solid oklch(0.85 0.12 60)", fontSize: 12, color: "oklch(0.45 0.14 50)", marginBottom: 14, display: "flex", gap: 6 }}>
              ⚠️ {warnings.join(" · ")}
            </div>
          )}

          {/* Supplier datalist */}
          <datalist id="suppliers-list">
            {supplierOptions.map((s, i) => <option key={i} value={s} />)}
          </datalist>

          {/* Savings summary card */}
          {expense.amount > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              marginBottom: 20, padding: "14px 16px", borderRadius: 10,
              background: "var(--surface-2)", border: "1px solid var(--line)",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Monto total</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney(expense.amount, client.currency)}</div>
              </div>
              {savingsAbs > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Ahorro estimado</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "oklch(0.42 0.14 145)" }}>
                    {fmtMoney(savingsAbs, client.currency)}
                    <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 5, color: "var(--text-2)" }}>
                      ({expense.savingsPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid cols-2" style={{ gap: 14 }}>
            <Field label={t.expenses.cols.category} span={2}>
              <select className="select" value={expense.categoryId} onChange={e => update({ categoryId: e.target.value })} disabled={readonly}>
                {client.categories.map(c => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
              </select>
            </Field>

            <Field label={t.expenses.cols.subcategory} span={2}>
              <input className="input" value={expense.subcategory || ""} onChange={e => update({ subcategory: e.target.value })} readOnly={readonly} />
            </Field>

            <Field label={t.expenses.cols.supplier} span={2}>
              <input className="input" list="suppliers-list" value={expense.supplier || ""} onChange={e => update({ supplier: e.target.value })} readOnly={readonly} />
            </Field>

            <Field label={`${t.expenses.cols.amount} (${client.currency})`}>
              <MoneyInput value={expense.amount || 0} onChange={v => update({ amount: v })} disabled={readonly} />
            </Field>

            <Field label={t.expenses.cols.suppliers}>
              <input className="input right" type="number" value={expense.suppliers || 0} onChange={e => update({ suppliers: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="% Ahorro estimado">
              <input className="input right" type="number" step="0.1" min={0} max={100} value={expense.savingsPct || 0} onChange={e => update({ savingsPct: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="% Alcance">
              <input className="input right" type="number" step="0.1" min={0} max={100} value={expense.scopePct || 0} onChange={e => update({ scopePct: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="% Ahorro mínimo">
              <input className="input right" type="number" step="0.1" value={expense.savingsMinPct || 0} onChange={e => update({ savingsMinPct: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="% Ahorro máximo">
              <input className="input right" type="number" step="0.1" value={expense.savingsMaxPct || 0} onChange={e => update({ savingsMaxPct: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="Factibilidad (1–5)">
              <input className="input right" type="number" min={0} max={5} value={expense.feasibility || 0} onChange={e => update({ feasibility: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label="Meses implementación">
              <input className="input right" type="number" min={0} value={expense.months || 0} onChange={e => update({ months: +e.target.value || 0 })} readOnly={readonly} />
            </Field>

            <Field label={t.expenses.cols.contract} span={2}>
              <input className="input" type="month" value={expense.contractUntil || ""} onChange={e => update({ contractUntil: e.target.value })} readOnly={readonly} />
            </Field>

            <Field label={t.expenses.cols.notes} span={2}>
              <input className="input" value={expense.notes || ""} onChange={e => update({ notes: e.target.value })} readOnly={readonly} />
            </Field>
          </div>

          {/* Monthly series if present */}
          {expense.monthly && expense.monthly.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                Serie mensual · {expense.monthly.length} períodos
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {expense.monthly.map((v, idx) => (
                  <div key={idx} style={{
                    padding: "4px 8px", borderRadius: 6,
                    background: "var(--surface-2)", border: "1px solid var(--line)",
                    fontSize: 12, fontFamily: "var(--font-mono)",
                  }}>
                    <span style={{ color: "var(--text-3)", marginRight: 4 }}>M{idx + 1}</span>
                    {fmtMoney(v, client.currency, { compact: true })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ManualEntry({ client, catLabel, onAdd }) {
  const { t } = useI18n();
  const [exp, setExp] = React.useState(() => blankExpense(client.categories[0]?.id));
  const set = (patch) => setExp(p => ({ ...p, ...patch }));

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3 className="h3">+ {t.actions.addRow}</h3>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <Field label={t.expenses.cols.category}>
          <select className="select" value={exp.categoryId} onChange={e => set({ categoryId: e.target.value })}>
            {client.categories.map(c => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t.expenses.cols.subcategory}>
          <input className="input" value={exp.subcategory} onChange={e => set({ subcategory: e.target.value })} />
        </Field>
        <Field label={t.expenses.cols.supplier} span={2}>
          <input className="input" value={exp.supplier} onChange={e => set({ supplier: e.target.value })} />
        </Field>
        <Field label={`${t.expenses.cols.amount} (${client.currency})`}>
          <MoneyInput value={exp.amount} onChange={v => set({ amount: v })} />
        </Field>
        <Field label={t.expenses.cols.suppliers}>
          <input className="input right" type="number" value={exp.suppliers} onChange={e => set({ suppliers: +e.target.value || 0 })} />
        </Field>
        <Field label={t.expenses.cols.contract}>
          <input className="input" type="month" value={exp.contractUntil} onChange={e => set({ contractUntil: e.target.value })} />
        </Field>
        <Field label={t.expenses.cols.notes} span={2}>
          <input className="input" value={exp.notes} onChange={e => set({ notes: e.target.value })} />
        </Field>
      </div>
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="btn primary" onClick={() => {
          onAdd(exp);
          setExp(blankExpense(exp.categoryId));
        }}>+ {t.actions.addRow}</button>
      </div>
    </div>
  );
}

function PasteImport({ client, catLabel, onImport }) {
  const { t } = useI18n();
  const [text, setText] = React.useState("");
  const [parsed, setParsed] = React.useState([]);

  const parse = (raw) => {
    if (!raw.trim()) return [];
    const sep = raw.includes("\t") ? "\t" : ",";
    const lines = raw.trim().split(/\r?\n/);
    const out = [];
    for (const line of lines) {
      const cols = line.split(sep).map(c => c.trim());
      if (cols.length < 2) continue;
      // First 3 cols: category, subcategory, supplier. Then numeric periods.
      // If only one amount + maybe suppliers, also supported.
      const [catGuess, sub, sup, ...rest] = cols;
      const nums = rest.map(v => parseFloat((v || "0").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0);
      // Detect: if rest.length >= 3 and most are numeric, treat as period series
      let monthly = null, amount = 0, suppliers = 1;
      if (nums.length >= 3) {
        monthly = nums;
        amount = nums.reduce((a, b) => a + b, 0);
      } else {
        // Legacy mode: amount, suppliers
        amount = nums[0] || 0;
        suppliers = parseInt(rest[1] || "1") || 1;
      }
      const catId = client.categories.find(c =>
        (t.categories[c.key] || c.key || "").toLowerCase().includes((catGuess || "").toLowerCase()) ||
        (catGuess || "").toLowerCase().includes((t.categories[c.key] || c.key || "").toLowerCase())
      )?.id || client.categories[0]?.id;
      out.push({
        ...blankExpense(catId),
        subcategory: sub || "",
        supplier: sup || "",
        amount,
        suppliers,
        ...(monthly ? { monthly } : {}),
      });
    }
    return out;
  };

  React.useEffect(() => { setParsed(parse(text)); }, [text]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3 className="h3">{t.expenses.modes.paste}</h3>
        <p className="lede" style={{ fontSize: 12, marginBottom: 10 }}>
          Columnas: Categoría, Subcategoría, Proveedor, y luego <strong>N columnas numéricas</strong> (uno por período: 6, 12, 18, 24 meses, lo que cargues). El sistema toma la cantidad de períodos del primer pegado.
        </p>
        <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder={"Energía\tElectricidad\tIberdrola\t98000\t102000\t110000\t...\nTelco\tFijo + datos\tMovistar\t15000\t15200\t14800\t..."} />
        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end", gap: 8 }}>
          <button className="btn ghost" onClick={() => setText("")}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={parsed.length === 0} onClick={() => onImport(parsed)}>
            {t.actions.apply} ({parsed.length})
          </button>
        </div>
      </div>
      <div className="card">
        <h3 className="h3">Vista previa · {parsed.length}</h3>
        {parsed.length === 0 ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: "20px 0" }}>—</div>
        ) : (
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table className="t" style={{ fontSize: 12 }}>
              <thead><tr>
                <th>{t.expenses.cols.category}</th>
                <th>{t.expenses.cols.supplier}</th>
                <th className="right">{t.expenses.cols.amount}</th>
                <th className="right">Períodos</th>
              </tr></thead>
              <tbody>
                {parsed.map((p, i) => {
                  const cat = client.categories.find(c => c.id === p.categoryId);
                  return (
                    <tr key={i}>
                      <td><CategorySwatch color={cat?.color || "#ccc"} label={catLabel(cat)} /></td>
                      <td>{p.supplier}</td>
                      <td className="right">{fmtMoney(p.amount, client.currency)}</td>
                      <td className="right tabular">{p.monthly ? p.monthly.length : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCategoryModal({ open, onClose, onCreate }) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  React.useEffect(() => { if (open) setName(""); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.actions.addCategory}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>{t.actions.save}</button>
        </>
      }
    >
      <Field label={t.expenses.cols.category}>
        <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Categories Tab ────────────────────────────────────────────────

function CategoriesTab({ client, catLabel, eraCategories, onSetMapping, onDeleteCat, onUpdateCat, readonly = false }) {
  const cats = client.categories;
  const [expandedNotes, setExpandedNotes] = React.useState(new Set());

  const toggleNotes = (id) => setExpandedNotes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const pipelineDot = (pipeline) => {
    const colors = {
      closed_won: "oklch(0.55 0.14 145)",
      proposal: "oklch(0.52 0.16 265)",
      analysis: "oklch(0.65 0.14 80)",
    };
    return colors[pipeline] || "var(--line)";
  };

  if (cats.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-3)" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗂</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin categorías</div>
        <div style={{ fontSize: 13 }}>Importa un Excel o crea categorías con el botón "+ Categoría"</div>
      </div>
    );
  }

  return (
    <div className="stack lg">
      {eraCategories.length === 0 && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: "oklch(0.97 0.03 80)", border: "1px solid oklch(0.88 0.07 80)", fontSize: 13, color: "oklch(0.45 0.10 80)" }}>
          ⚠ Sin categorías ERA configuradas. Ve a <strong>Administración</strong> (pantalla de clientes) para crearlas.
        </div>
      )}
      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
      <table className="t">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>Categoría cliente</th>
            <th>Categoría ERA</th>
            <th style={{ minWidth: 160 }}>Pipeline</th>
            <th style={{ width: 48 }}>Notas</th>
            <th style={{ width: 48 }}></th>
          </tr>
        </thead>
        <tbody>
          {cats.map(cat => {
            const era = eraCategories.find(e => e.id === cat.eraId);
            const notesOpen = expandedNotes.has(cat.id);
            return (
              <React.Fragment key={cat.id}>
                <tr>
                  <td style={{ paddingLeft: 12 }}>
                    <span style={{ width: 6, height: 24, background: cat.color || "#ccc", display: "block", borderRadius: 2 }} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{catLabel(cat)}</td>
                  <td>
                    {eraCategories.length === 0 ? (
                      <span style={{ color: "var(--text-3)", fontSize: 12 }}>Sin categorías ERA — créalas en Administración</span>
                    ) : (
                      <select
                        className="select"
                        value={cat.eraId || ""}
                        onChange={e => onSetMapping(cat.id, e.target.value || null)}
                        style={{ minWidth: 200 }}
                        disabled={readonly}
                      >
                        <option value="">— Sin mapear —</option>
                        {eraCategories.map(e => (
                          <option key={e.id} value={e.id}>{e.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: pipelineDot(cat.pipeline), flexShrink: 0 }} />
                      <select
                        className="select"
                        value={cat.pipeline || ""}
                        onChange={e => onUpdateCat && onUpdateCat(cat.id, { pipeline: e.target.value })}
                        style={{ fontSize: 12 }}
                        disabled={readonly}
                      >
                        {PIPELINE_STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="btn ghost sm"
                      title={notesOpen ? "Cerrar notas" : "Editar notas"}
                      onClick={() => toggleNotes(cat.id)}
                      style={{ opacity: cat.notes ? 1 : 0.5 }}
                    >📝</button>
                  </td>
                  <td>
                    {!readonly && (
                      <button
                        className="btn ghost sm danger"
                        title="Eliminar categoría"
                        onClick={() => {
                          if (!confirm(`¿Eliminar la categoría "${catLabel(cat)}"?`)) return;
                          onDeleteCat(cat.id);
                        }}
                      >×</button>
                    )}
                  </td>
                </tr>
                {notesOpen && (
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={6} style={{ padding: "8px 12px" }}>
                      <textarea
                        className="textarea"
                        value={cat.notes || ""}
                        placeholder="Notas sobre esta categoría…"
                        onChange={e => onUpdateCat && onUpdateCat(cat.id, { notes: e.target.value })}
                        style={{ width: "100%", minHeight: 60, fontSize: 12, resize: "vertical" }}
                        readOnly={readonly}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Charts View ──────────────────────────────────────────────────

function ChartsView({ client, eraCategories, catLabel }) {
  const [hoveredExp, setHoveredExp] = React.useState(null);
  const expenses = client.expenses || [];

  if (expenses.length === 0) {
    return <Empty icon="📊" title="Sin datos para graficar" hint="Importa o añade gastos primero." />;
  }

  const totalSpendAmt = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
  if (totalSpendAmt === 0) {
    return <Empty icon="📊" title="Sin montos registrados" hint="Añade montos a los gastos para ver gráficos." />;
  }

  // ── Chart 1: Group by ERA category ────────────────────────────
  const eraGroups = {};
  expenses.forEach(e => {
    const cat = client.categories.find(c => c.id === e.categoryId);
    const era = eraCategories.find(er => er.id === cat?.eraId);
    const key = era ? era.id : "__none__";
    const label = era ? era.label : "Sin ERA";
    const color = era ? era.color : "var(--line)";
    const scope = e.scopePct == null ? 100 : (+e.scopePct || 0);
    const minPct = +e.savingsMinPct || 0;
    const maxPct = +e.savingsMaxPct || 0;
    if (!eraGroups[key]) eraGroups[key] = { label, color, spend: 0, minSavings: 0, maxSavings: 0 };
    eraGroups[key].spend += +e.amount || 0;
    eraGroups[key].minSavings += (+e.amount || 0) * (scope / 100) * (minPct / 100);
    eraGroups[key].maxSavings += (+e.amount || 0) * (scope / 100) * (maxPct / 100);
  });

  const eraGroupsSorted = Object.values(eraGroups).sort((a, b) => b.spend - a.spend);
  const maxSpend = eraGroupsSorted[0]?.spend || 1;

  // ── Chart 2: Scatter — all expenses (Y = mid of min/max range) ────
  const maxAmount = Math.max(...expenses.map(e => +e.amount || 0), 1);
  const svgW = 600;
  const svgH = 300;
  const padL = 36, padR = 10, padT = 10, padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const scatterPoints = expenses.map((e, i) => {
    const cat = client.categories.find(c => c.id === e.categoryId);
    const era = eraCategories.find(er => er.id === cat?.eraId);
    const minPct = +e.savingsMinPct || 0;
    const maxPct = +e.savingsMaxPct || 0;
    const midPct = (minPct + maxPct) / 2;
    const x = padL + (((+e.amount || 0) / maxAmount) * plotW);
    const y = padT + ((1 - Math.min(midPct, 100) / 100) * plotH);
    // range bar: y positions for min and max
    const yMin = padT + ((1 - Math.min(minPct, 100) / 100) * plotH);
    const yMax = padT + ((1 - Math.min(maxPct, 100) / 100) * plotH);
    const r = 4 + ((+e.feasibility || 0) / 5) * 8;
    const color = era ? era.color : (cat?.color || "#ccc");
    const rangeTxt = (minPct > 0 || maxPct > 0) ? `${minPct.toFixed(1)}%–${maxPct.toFixed(1)}% ahorro` : "Sin rango";
    const label = `${e.supplier || catLabel(cat)} · ${fmtMoney(+e.amount || 0, client.currency, { compact: true })} · ${rangeTxt} · F${+e.feasibility || 0}`;
    return { x, y, yMin, yMax, r, color, label, i, minPct, maxPct };
  });

  return (
    <div className="stack lg">
      {/* Chart 1 */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text-1)" }}>Gasto y ahorro potencial por categoría ERA</div>
        {eraGroupsSorted.length === 0 ? (
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Sin categorías ERA mapeadas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {eraGroupsSorted.map(g => {
              const spendPct = (g.spend / maxSpend) * 100;
              const minSavPct = (g.minSavings / maxSpend) * 100;
              const maxSavPct = (g.maxSavings / maxSpend) * 100;
              return (
                <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                  <span style={{ width: 160, fontSize: 12, color: "var(--text-1)", fontWeight: 500, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.label}>{g.label}</span>
                  <div style={{ flex: 1, position: "relative", height: 18 }}>
                    {/* Spend bar */}
                    <div style={{ position: "absolute", top: 3, left: 0, height: 12, width: spendPct + "%", background: g.color, opacity: 0.7, borderRadius: 2 }} />
                    {/* Max savings range bar (lighter) */}
                    {maxSavPct > 0 && (
                      <div style={{ position: "absolute", top: 3, left: 0, height: 12, width: maxSavPct + "%", background: "oklch(0.65 0.14 145)", opacity: 0.55, borderRadius: 2 }} />
                    )}
                    {/* Min savings bar (darker) */}
                    {minSavPct > 0 && (
                      <div style={{ position: "absolute", top: 3, left: 0, height: 12, width: minSavPct + "%", background: "oklch(0.52 0.16 145)", opacity: 0.9, borderRadius: 2 }} />
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-2)", fontFamily: "var(--font-mono)", minWidth: 80, textAlign: "right" }}>
                    {fmtMoney(g.spend, client.currency, { compact: true })}
                  </span>
                  {maxSavPct > 0 && (
                    <span style={{ fontSize: 11, color: "oklch(0.42 0.14 145)", fontFamily: "var(--font-mono)", minWidth: 120, textAlign: "right" }}>
                      ↓{fmtMoney(g.minSavings, client.currency, { compact: true })}–{fmtMoney(g.maxSavings, client.currency, { compact: true })}
                    </span>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "var(--text-3)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 6, background: "oklch(0.52 0.16 265)", opacity: 0.7, borderRadius: 1, display: "inline-block" }} />Gasto total</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 6, background: "oklch(0.52 0.16 145)", borderRadius: 1, display: "inline-block" }} />Ahorro mín (rango)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 6, background: "oklch(0.65 0.14 145)", opacity: 0.7, borderRadius: 1, display: "inline-block" }} />Ahorro máx (rango)</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart 2: Scatter */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--text-1)" }}>Oportunidades — Monto vs Rango de Ahorro</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>Y = punto medio del rango mín–máx · Barra vertical = rango · Tamaño = factibilidad · Color = categoría ERA</div>
        <div style={{ position: "relative", width: "100%" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: svgH, display: "block" }} preserveAspectRatio="xMidYMid meet">
            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="var(--line)" strokeWidth={0.5} />
            <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="var(--line)" strokeWidth={0.5} />
            {/* Y axis labels */}
            {[0, 25, 50, 75, 100].map(v => {
              const y = padT + ((1 - v / 100) * plotH);
              return (
                <React.Fragment key={v}>
                  <line x1={padL - 3} y1={y} x2={padL} y2={y} stroke="var(--line)" strokeWidth={0.4} />
                  <text x={padL - 5} y={y + 3} textAnchor="end" fontSize={6} fill="var(--text-3)">{v}%</text>
                </React.Fragment>
              );
            })}
            {/* X axis label */}
            <text x={padL + plotW / 2} y={svgH - 2} textAnchor="middle" fontSize={6} fill="var(--text-3)">Monto →</text>
            <text x={5} y={padT + plotH / 2} textAnchor="middle" fontSize={6} fill="var(--text-3)" transform={`rotate(-90 5 ${padT + plotH / 2})`}>% Ahorro (rango) →</text>
            {/* Range bars + Points */}
            {scatterPoints.map(pt => (
              <g key={pt.i}>
                {/* Vertical range bar (min to max) */}
                {(pt.minPct > 0 || pt.maxPct > 0) && pt.yMin !== pt.yMax && (
                  <line
                    x1={pt.x} y1={pt.yMin}
                    x2={pt.x} y2={pt.yMax}
                    stroke={pt.color}
                    strokeWidth={1.5}
                    opacity={0.4}
                  />
                )}
                {/* Center point at midpoint */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.r}
                  fill={pt.color}
                  opacity={0.75}
                  style={{ cursor: "default" }}
                >
                  <title>{pt.label}</title>
                </circle>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── ERA Categories Modal (Maintainer) ────────────────────────────

function EraCategoriesModal({ open, onClose, eraCategories, onAdd, onUpdate, onDelete }) {
  const [form, setForm] = React.useState(null); // null = closed, {} = new, {id,...} = editing
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function handleSave(e) {
    e.preventDefault();
    if (!form.label?.trim()) { setErr("El nombre es requerido"); return; }
    setSaving(true); setErr("");
    try {
      if (form.id) {
        await onUpdate(form.id, { label: form.label.trim(), color: form.color, sort_order: form.sort_order || 0 });
      } else {
        const key = form.label.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 40);
        await onAdd({ key, label: form.label.trim(), color: form.color || AUTO_CAT_COLORS[eraCategories.length % AUTO_CAT_COLORS.length], sort_order: eraCategories.length });
      }
      setForm(null);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id, label) {
    if (!confirm(`¿Eliminar la categoría ERA "${label}"?`)) return;
    try { await onDelete(id); } catch (e) { setErr(e.message); }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,.35)" }} onClick={onClose} />
      <div style={{
        position: "fixed", zIndex: 51, top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column",
        background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14,
        boxShadow: "var(--shadow-pop)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>⚙ Categorías ERA</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-3)" }}>×</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
          {err && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{err}</div>}

          {eraCategories.length === 0 && !form && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-3)", fontSize: 13 }}>
              Sin categorías ERA todavía. Crea la primera abajo.
            </div>
          )}

          {eraCategories.map(cat => (
            form?.id === cat.id ? (
              <EraForm key={cat.id} form={form} setForm={setForm} onSave={handleSave} saving={saving} onCancel={() => setForm(null)} />
            ) : (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13, color: "var(--text-1)" }}>{cat.label}</span>
                <button className="btn ghost sm" onClick={() => { setForm({ ...cat }); setErr(""); }}>Editar</button>
                <button className="btn ghost sm danger" onClick={() => handleDelete(cat.id, cat.label)}>×</button>
              </div>
            )
          ))}

          {form && !form.id && (
            <EraForm form={form} setForm={setForm} onSave={handleSave} saving={saving} onCancel={() => setForm(null)} isNew />
          )}
        </div>

        {/* Footer */}
        {!form && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
            <button
              className="btn primary"
              style={{ width: "100%" }}
              onClick={() => { setForm({ label: "", color: AUTO_CAT_COLORS[eraCategories.length % AUTO_CAT_COLORS.length], sort_order: eraCategories.length }); setErr(""); }}
            >
              + Nueva categoría ERA
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function EraForm({ form, setForm, onSave, saving, onCancel, isNew }) {
  return (
    <form onSubmit={onSave} style={{ padding: "10px 0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          autoFocus
          className="input"
          style={{ flex: 1 }}
          placeholder="Nombre de la categoría ERA"
          value={form.label || ""}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
        />
        {/* Color dots */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 160 }}>
          {AUTO_CAT_COLORS.map(c => (
            <button
              key={c} type="button"
              onClick={() => setForm(f => ({ ...f, color: c }))}
              style={{
                width: 18, height: 18, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: 2,
                transform: form.color === c ? "scale(1.3)" : "scale(1)", transition: "transform .1s",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? "Guardando…" : isNew ? "Crear" : "Guardar"}</button>
      </div>
    </form>
  );
}

// ── Excel Import ──────────────────────────────────────────────────

const AUTO_CAT_COLORS = [
  "oklch(0.52 0.16 265)", "oklch(0.50 0.16 160)", "oklch(0.52 0.16 25)",
  "oklch(0.54 0.14 50)",  "oklch(0.50 0.16 300)", "oklch(0.50 0.14 220)",
  "oklch(0.52 0.14 340)", "oklch(0.54 0.12 90)",  "oklch(0.46 0.10 250)",
  "oklch(0.50 0.14 190)", "oklch(0.48 0.16 285)", "oklch(0.52 0.14 130)",
];

const IMPORT_FIELDS = [
  { id: "skip",          label: "— No importar —",       type: "skip" },
  { id: "category",      label: "Categoría",              type: "text" },
  { id: "subcategory",   label: "Subcategoría",           type: "text" },
  { id: "supplier",      label: "Proveedor",              type: "text" },
  { id: "amount",        label: "Monto total",            type: "number" },
  { id: "suppliers",     label: "N° proveedores",         type: "number" },
  { id: "savingsPct",    label: "% Ahorro estimado",      type: "number" },
  { id: "savingsMinPct", label: "% Ahorro mínimo",        type: "number" },
  { id: "savingsMaxPct", label: "% Ahorro máximo",        type: "number" },
  { id: "scopePct",      label: "% Alcance",              type: "number" },
  { id: "feasibility",   label: "Factibilidad (1–5)",     type: "number" },
  { id: "months",        label: "Meses implementación",   type: "number" },
  { id: "notes",         label: "Notas",                  type: "text"   },
  { id: "monthly",       label: "Serie mensual (M1…Mn)",  type: "series" },
];

function autoDetectField(header) {
  const h = (header || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/categ/.test(h))                           return "category";
  if (/sub/.test(h))                             return "subcategory";
  if (/prov|supplier|vendor/.test(h))            return "supplier";
  if (/monto|amount|total|gasto|costo|spend/.test(h)) return "amount";
  if (/n.?prov|num.*prov|#.*prov/.test(h))       return "suppliers";
  if (/min.*ah|ah.*min|saving.*min|min.*sav|bajo.*ah|ah.*bajo|low.*sav|sav.*low/.test(h)) return "savingsMinPct";
  if (/max.*ah|ah.*max|saving.*max|max.*sav|alto.*ah|ah.*alto|high.*sav|sav.*high/.test(h)) return "savingsMaxPct";
  if (/ahorro|saving|saving_pct|sav/.test(h))    return "savingsPct";
  if (/alcance|scope/.test(h))                   return "scopePct";
  if (/fact|feasib/.test(h))                     return "feasibility";
  if (/mes.*impl|impl.*mes|month.*impl/.test(h)) return "months";
  if (/nota|note|obs/.test(h))                   return "notes";
  if (/^m\d+$|^mes\s*\d+$|^month\s*\d+$|^period\s*\d+$/.test(h)) return "monthly";
  return "skip";
}

function parseNum(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  // Handle "5%" → 5, "12,5" → 12.5, "1.234,56" → 1234.56
  let s = String(v).trim().replace(/[^\d.,%,-]/g, "");
  const isPct = s.endsWith("%");
  s = s.replace("%", "");
  // European format: 1.234,56 → last separator is comma
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US/neutral: just replace comma decimal
    s = s.replace(",", ".");
  }
  const n = parseFloat(s) || 0;
  // If value looks like a decimal fraction (0.05) and field expects %, multiply
  return n;
}

// Normalize string: remove accents, lowercase, collapse spaces/punctuation
function normStr(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find best matching category by word overlap (accent-insensitive)
function matchCategory(val, categories, catLabel) {
  const normVal = normStr(val);
  if (!normVal) return categories[0]?.id;
  const valWords = normVal.split(" ").filter(w => w.length > 2);

  let bestId = null, bestScore = -1;
  for (const c of categories) {
    const normLabel = normStr(catLabel(c));
    const normKey   = normStr(c.key);

    // Exact match
    if (normLabel === normVal || normKey === normVal) return c.id;

    // Word overlap score
    const labelWords = normLabel.split(" ").filter(w => w.length > 2);
    const overlap = valWords.filter(w =>
      labelWords.some(lw => lw.includes(w) || w.includes(lw))
    ).length;
    const score = valWords.length > 0 ? overlap / valWords.length : 0;
    if (score > bestScore) { bestScore = score; bestId = c.id; }
  }

  // Accept match only if at least one meaningful word matched
  return bestScore > 0 ? bestId : null;
}

function ExcelImport({ client, catLabel, eraCategories = [], onImport }) {
  const [step, setStep]       = React.useState(1); // 1=upload 2=map+preview
  const [headers, setHeaders] = React.useState([]);
  const [rows, setRows]       = React.useState([]);   // raw string rows from Excel
  const [mapping, setMapping] = React.useState({});   // colIndex -> fieldId
  const [fileName, setFileName] = React.useState("");
  const [error, setError]     = React.useState("");
  // Stable category IDs across mapping changes (reset on new file)
  const catIdCache = React.useRef({}); // normStr(name) → catId
  // ERA mapping: catId → eraId | null (only for new cats)
  const [eraMapping, setEraMapping] = React.useState({});

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    catIdCache.current = {}; // reset stable IDs for new file
    setEraMapping({});
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!data || data.length < 2) { setError("El archivo no tiene suficientes filas."); return; }
        const hdrs = data[0].map(h => String(h ?? "").trim());
        const dataRows = data.slice(1).filter(r => r.some(c => c !== "" && c != null));
        setHeaders(hdrs);
        setRows(dataRows);
        // Auto-detect mapping
        const autoMap = {};
        hdrs.forEach((h, i) => { autoMap[i] = autoDetectField(h); });
        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        setError("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildExpenses() {
    const seriesCols = Object.entries(mapping)
      .filter(([, f]) => f === "monthly")
      .map(([i]) => parseInt(i));

    // ── Collect unique category names from the Excel ───────────────
    const catNames = new Set();
    Object.entries(mapping).forEach(([colIdx, fieldId]) => {
      if (fieldId !== "category") return;
      rows.forEach(row => {
        const val = String(row[parseInt(colIdx)] || "").trim();
        if (val) catNames.add(val);
      });
    });

    // ── For each name: reuse existing exact match OR create new ────
    const usedColors = new Set(client.categories.map(c => c.color));
    let colorIdx = 0;
    const newCategories = [];
    const catIdByNorm = {}; // normStr(name) → categoryId

    catNames.forEach(name => {
      const norm = normStr(name);
      // Exact match against existing categories (accent-insensitive)
      const existing = client.categories.find(c =>
        normStr(c.label || c.key) === norm
      );
      if (existing) {
        catIdByNorm[norm] = existing.id;
      } else {
        // Use cached stable ID (so ERA mapping survives mapping dropdown changes)
        if (!catIdCache.current[norm]) {
          catIdCache.current[norm] = uid("cat");
        }
        let color;
        do { color = AUTO_CAT_COLORS[colorIdx % AUTO_CAT_COLORS.length]; colorIdx++; }
        while (usedColors.has(color) && colorIdx < AUTO_CAT_COLORS.length * 2);
        usedColors.add(color);
        const key = norm.replace(/\s+/g, "_").slice(0, 40) || uid("k");
        const newCat = { id: catIdCache.current[norm], key, label: name, color, _isNew: true };
        newCategories.push(newCat);
        catIdByNorm[norm] = newCat.id;
      }
    });

    const allCategories = [...client.categories, ...newCategories];
    const fallbackId = allCategories[0]?.id;

    // ── Build expense rows ─────────────────────────────────────────
    const expenses = rows.map(row => {
      const exp = { ...blankExpense(fallbackId) };

      Object.entries(mapping).forEach(([colIdx, fieldId]) => {
        if (fieldId === "skip" || fieldId === "monthly") return;
        const val = row[parseInt(colIdx)];
        if (fieldId === "category") {
          const norm = normStr(String(val || "").trim());
          exp.categoryId = catIdByNorm[norm] || fallbackId;
        } else if (["subcategory", "supplier", "notes"].includes(fieldId)) {
          exp[fieldId] = String(val ?? "");
        } else {
          let n = parseNum(val);
          const isPctField = ["savingsPct","savingsMinPct","savingsMaxPct","scopePct"].includes(fieldId);
          if (isPctField && n > 0 && n <= 1) n = Math.round(n * 100 * 10) / 10;
          exp[fieldId] = n;
        }
      });

      if (seriesCols.length > 0) {
        const monthly = seriesCols.map(i => parseNum(row[i]));
        exp.monthly = monthly;
        exp.amount  = monthly.reduce((a, b) => a + b, 0);
      }

      // If min/max are set but savingsPct isn't, auto-derive the average
      if (!exp.savingsPct && (exp.savingsMinPct || exp.savingsMaxPct)) {
        exp.savingsPct = Math.round(((+exp.savingsMinPct || 0) + (+exp.savingsMaxPct || 0)) / 2 * 10) / 10;
      }

      return exp;
    });

    // Flag duplicate rows: same supplier (normalized) + categoryId — only mark the repeat, not the original
    const seenKeys = new Set();
    expenses.forEach((exp) => {
      const key = `${exp.categoryId}|${normStr(exp.supplier || "")}`;
      if (seenKeys.has(key)) {
        exp._duplicate = true;
      } else {
        seenKeys.add(key);
      }
    });

    return { expenses, newCategories, allCategories };
  }

  // Memoize built data so it only recomputes when rows/mapping change,
  // NOT when eraMapping changes (avoids fighting the user's selections)
  const builtData = React.useMemo(
    () => step >= 2 && rows.length > 0
      ? buildExpenses()
      : { expenses: [], newCategories: [], allCategories: client.categories },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, JSON.stringify(mapping), client.id, client.categories.length]
  );
  const preview        = builtData.expenses;
  const previewNewCats = builtData.newCategories;
  const previewAllCats = builtData.allCategories;

  // Seed eraMapping once per category (new = auto-match, existing = stored eraId)
  // eraMapping is the single source of truth for all ERA dropdowns in the import view
  const allCatIds = previewAllCats.map(c => c.id).join(",");
  React.useEffect(() => {
    if (!previewAllCats.length) return;
    setEraMapping(prev => {
      const updates = {};
      previewAllCats.forEach(cat => {
        if (prev[cat.id] !== undefined) return; // already set — don't overwrite
        if (cat._isNew) {
          // Auto-match new categories against ERA
          updates[cat.id] = (eraCategories.length
            ? matchCategory(cat.label, eraCategories, c => c.label)
            : null) || null;
        } else {
          // Seed from stored value on existing categories
          updates[cat.id] = cat.eraId || null;
        }
      });
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCatIds, eraCategories.length]);

  // ── Step indicator ─────────────────────────────────────────────
  const StepBar = ({ current }) => (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20 }}>
      {[["1","Subir archivo"],["2","Mapear columnas"],["3","Vista previa"]].map(([n, label], idx) => {
        const s = idx + 1;
        const done = s < current, active = s === current;
        return (
          <React.Fragment key={n}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{
                width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700,
                background: done ? "oklch(0.36 0.14 145)" : active ? "var(--accent)" : "var(--line)",
                color: (done||active) ? "#fff" : "var(--text-3)",
              }}>{done ? "✓" : n}</span>
              <span style={{ fontSize:12, fontWeight: active ? 600 : 400, color: active ? "var(--text-1)" : "var(--text-3)" }}>{label}</span>
            </div>
            {idx < 2 && <div style={{ flex:1, height:1, background:"var(--line)", margin:"0 10px", minWidth:24 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ── Step 1: Upload ─────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="card" style={{ maxWidth: 520 }}>
        <StepBar current={1} />
        <label style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "40px 24px", border: "2px dashed var(--line)", borderRadius: 10,
          cursor: "pointer", background: "var(--surface-2)", transition: "border-color .15s",
        }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}
        >
          <span style={{ fontSize: 40 }}>📊</span>
          <span style={{ fontWeight: 600, color: "var(--text-1)" }}>Haz clic o arrastra tu archivo aquí</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>.xlsx · .xls · .csv</span>
          <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFile} />
        </label>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 14, textAlign: "center" }}>
          ¿No tienes el formato correcto?{" "}
          <button
            className="btn ghost sm"
            style={{ fontSize: 12, padding: "2px 8px" }}
            onClick={() => downloadTemplate()}
          >Descargar plantilla</button>
        </p>
      </div>
    );
  }

  // ── Step 2 + 3: Map + Preview ──────────────────────────────────
  const seriesCount = Object.values(mapping).filter(f => f === "monthly").length;
  const hasPreview = preview.length > 0;

  return (
    <div className="stack lg">
      <StepBar current={hasPreview ? 3 : 2} />
      {/* Header */}
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div>
          <h3 className="h3">Mapear campos · <span style={{ fontWeight: 400, color: "var(--text-3)" }}>{fileName}</span></h3>
          <p className="lede" style={{ marginBottom: 0 }}>
            {rows.length} filas · {Object.values(mapping).filter(f=>f!=="skip").length} columnas mapeadas
          </p>
        </div>
        <button className="btn ghost" onClick={() => { setStep(1); setHeaders([]); setRows([]); setFileName(""); }}>
          ← Cambiar archivo
        </button>
      </div>

      {/* Mapping table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="t" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>#</th>
              <th>Columna en Excel</th>
              <th>Muestra de valores</th>
              <th style={{ width: 220 }}>Campo destino</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const sample = rows.slice(0, 3).map(r => r[i]).filter(v => v !== "" && v != null).join(" · ");
              const fieldId = mapping[i] || "skip";
              return (
                <tr key={i} style={{ background: fieldId !== "skip" ? "var(--surface-2)" : "" }}>
                  <td style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{h || <span style={{ color: "var(--text-3)" }}>(sin nombre)</span>}</td>
                  <td style={{ color: "var(--text-3)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sample || "—"}
                  </td>
                  <td>
                    <select
                      className="select"
                      value={fieldId}
                      onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}
                      style={{ width: "100%" }}
                    >
                      {IMPORT_FIELDS.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {seriesCount > 0 && (
        <div className="pill" style={{ alignSelf: "flex-start", background: "var(--accent-bg)", color: "var(--accent)" }}>
          📅 {seriesCount} columna{seriesCount !== 1 ? "s" : ""} de serie mensual detectadas
        </div>
      )}

      {previewNewCats.length > 0 && eraCategories.length === 0 && (
        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 12, color: "var(--text-3)" }}>
          Se crearán {previewNewCats.length} categoría{previewNewCats.length !== 1 ? "s" : ""} nuevas. Crea categorías ERA con ⚙ para mapearlas.
        </div>
      )}

      {(() => {
        const dupCount = preview.filter(p => p._duplicate).length;
        return dupCount > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "oklch(0.97 0.06 60)", border: "1px solid oklch(0.85 0.12 60)", fontSize: 12, color: "oklch(0.45 0.14 50)" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span><strong>{dupCount} fila{dupCount !== 1 ? "s" : ""}</strong> con posible duplicado (mismo proveedor y categoría). Revisa antes de importar.</span>
          </div>
        ) : null;
      })()}

      {/* Preview */}
      <div>
        <h4 className="h3" style={{ marginBottom: 10 }}>Vista previa · {preview.length} filas</h4>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            <table className="t" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Categoría cliente</th>
                  {eraCategories.length > 0 && <th>Categoría ERA</th>}
                  <th>Subcategoría</th>
                  <th>Proveedor</th>
                  <th className="right">Monto</th>
                  <th className="right">% Ahorro</th>
                  {seriesCount > 0 && <th className="right">Períodos</th>}
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((p, i) => {
                  const cat = previewAllCats.find(c => c.id === p.categoryId);
                  const isNew = cat?._isNew;
                  // Always read from eraMapping — it's the single source of truth
                  const eraId = cat ? (eraMapping[cat.id] ?? null) : null;
                  const eraCat = eraCategories.find(e => e.id === eraId);
                  return (
                    <tr key={i} style={{ background: p._duplicate ? "oklch(0.98 0.04 60)" : undefined }}>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <CategorySwatch color={cat?.color || "#ccc"} label={cat?.label || catLabel(cat)} />
                          {isNew && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: "oklch(0.82 0.10 265)", color: "oklch(0.38 0.14 265)", borderRadius: 4, padding: "1px 4px" }}>
                              nuevo
                            </span>
                          )}
                          {p._duplicate && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: "oklch(0.88 0.10 60)", color: "oklch(0.45 0.14 50)", borderRadius: 4, padding: "1px 4px" }} title="Posible duplicado">
                              dup
                            </span>
                          )}
                        </span>
                      </td>
                      {eraCategories.length > 0 && (
                        <td>
                          <select
                            className="select"
                            value={eraId || ""}
                            onChange={e => {
                              if (cat) setEraMapping(prev => ({ ...prev, [cat.id]: e.target.value || null }));
                            }}
                            style={{ minWidth: 140, fontSize: 12 }}
                          >
                            <option value="">— Sin mapear —</option>
                            {eraCategories.map(e => (
                              <option key={e.id} value={e.id}>{e.label}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td>{p.subcategory || "—"}</td>
                      <td>{p.supplier || "—"}</td>
                      <td className="right tabular">{fmtMoney(p.amount, client.currency)}</td>
                      <td className="right tabular">{p.savingsPct > 0 ? p.savingsPct.toFixed(1) + "%" : "—"}</td>
                      {seriesCount > 0 && <td className="right tabular">{p.monthly?.length ?? "—"}</td>}
                      <td style={{ color: "var(--text-3)", fontSize: 11 }}>{p.notes || "—"}</td>
                    </tr>
                  );
                })}
                {preview.length > 20 && (
                  <tr><td colSpan={eraCategories.length > 0 ? 8 : 7} style={{ textAlign: "center", color: "var(--text-3)", padding: "8px 0" }}>
                    +{preview.length - 20} filas más…
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn ghost" onClick={() => { setStep(1); setHeaders([]); setRows([]); setFileName(""); }}>
          Cancelar
        </button>
        <button
          className="btn primary"
          disabled={preview.length === 0}
          onClick={() => {
            // Apply ERA mapping to new categories before importing
            const catsWithEra = previewNewCats.map(cat => ({
              ...cat,
              eraId: eraMapping[cat.id] || null,
            }));
            onImport(preview, catsWithEra);
          }}
        >
          Importar {preview.length} fila{preview.length !== 1 ? "s" : ""}
          {previewNewCats.length > 0 && ` · ${previewNewCats.length} cat.`}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ExpensesView, ExpenseTable, ExpenseDrawer, ManualEntry, PasteImport, ExcelImport, AddCategoryModal, CategoriesTab, ChartsView, EraCategoriesModal, EraForm, RangesTab });
