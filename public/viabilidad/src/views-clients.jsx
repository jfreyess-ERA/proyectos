/* ============================================================
   Views: client list + client form
   ============================================================ */

function ClientsView({ onOpen }) {
  const { t } = useI18n();
  const store = useStore();
  const [search, setSearch] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);
  const [tab, setTab] = React.useState("clients");

  const filtered = store.state.clients.filter(c =>
    !search ||
    (c.legalName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.tradeName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.sector || "").toLowerCase().includes(search.toLowerCase())
  );

  const clientsWithExpenses = store.state.clients.filter(c => c.expenses && c.expenses.length > 0);
  const showBenchmarkTab = clientsWithExpenses.length >= 2;

  const tabDefs = showBenchmarkTab
    ? [{ id: "clients", label: "Clientes" }, { id: "benchmark", label: "📊 Benchmark ERA" }]
    : [{ id: "clients", label: "Clientes" }];

  return (
    <main>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">{t.brand}</div>
          <h1 className="h1">{t.clients.title}</h1>
          <p className="lede">{t.clients.lede}</p>
        </div>
        <div className="btn-row">
          <button className="btn ghost sm" onClick={() => store.resetAll()}>{t.actions.reset}</button>
          <button className="btn" onClick={() => store.seedDemo()}>{t.actions.seed}</button>
          <button className="btn primary" onClick={() => setShowNew(true)}>+ {t.actions.newClient}</button>
        </div>
      </div>

      {showBenchmarkTab && (
        <Tabs tabs={tabDefs} active={tab} onChange={setTab} />
      )}

      {tab === "benchmark" && (
        <BenchmarkView clients={store.state.clients} eraCategories={store.state.eraCategories || []} />
      )}

      {tab === "clients" && (
        <>
          {store.state.clients.length > 0 && (
            <div style={{ marginBottom: 20, maxWidth: 360 }}>
              <input
                className="input"
                placeholder={t.clients.search}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {store.state.clients.length === 0 ? (
            <Empty
              icon="◇"
              title={t.clients.empty}
              hint={t.clients.emptyHint}
              action={
                <div className="btn-row" style={{ justifyContent: "center" }}>
                  <button className="btn" onClick={() => store.seedDemo()}>{t.actions.seed}</button>
                  <button className="btn primary" onClick={() => setShowNew(true)}>+ {t.actions.newClient}</button>
                </div>
              }
            />
          ) : (
            <div className="grid cols-3">
              {filtered.map(c => {
                const spend = totalSpend(c);
                const { min: savMin, max: savMax } = savingsRange(c);
                const hasSavings = savMax > 0;
                return (
                  <div key={c.id} className="client-card" onClick={() => onOpen(c.id)}>
                    <div className="row between">
                      <div>
                        <div className="name">{c.legalName || "—"}</div>
                        <div className="meta">{c.sector || ""} {c.country ? "· " + c.country : ""}</div>
                      </div>
                      <Pill variant={["muted","champagne","positive","muted"][c.stage]}>
                        {t.client.stages[c.stage]}
                      </Pill>
                    </div>
                    <div className="stats">
                      <div>
                        <div className="v" style={{ fontSize: 13 }}>{fmtMoney(c.revenue, c.currency)}</div>
                        <div className="l">{t.clients.revenue}</div>
                      </div>
                      <div>
                        <div className="v" style={{ fontSize: 13 }}>{fmtMoney(spend, c.currency)}</div>
                        <div className="l">{t.clients.spend}</div>
                      </div>
                      <div>
                        <div className="v" style={{ color: "var(--positive-2)", fontSize: 12 }}>
                          {hasSavings
                            ? `${fmtMoney(savMin, c.currency)} – ${fmtMoney(savMax, c.currency)}`
                            : "—"}
                        </div>
                        <div className="l">{t.clients.savings}</div>
                      </div>
                    </div>
                    <div className="meta" style={{ paddingTop: 8 }}>
                      {c.expenses.length} {t.expenses.rowCount} · {c.categories.length} {t.clients.categories}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <NewClientModal open={showNew} onClose={() => setShowNew(false)} onCreate={async (name, prospectId, initialData) => {
        const id = await store.addClient(name, prospectId, initialData);
        setShowNew(false);
        onOpen(id);
      }} />
    </main>
  );
}

// ============================================================
// Benchmark view — cross-client ERA category comparison
// ============================================================
function BenchmarkView({ clients, eraCategories }) {
  // Only include clients that have at least one expense
  const activeClients = clients.filter(c => c.expenses && c.expenses.length > 0);

  // Build matrix: for each era category, per client totals
  // cell = { total, savings, savingsPct }
  const matrix = eraCategories.map(cat => {
    const cells = activeClients.map(client => {
      const matching = client.expenses.filter(e => e.categoryId === cat.id);
      if (matching.length === 0) return null;
      const total = matching.reduce((sum, e) => sum + (e.amount || 0), 0);
      const savings = matching.reduce((sum, e) => sum + (e.amount || 0) * (e.savingsPct || 0) / 100, 0);
      const weightedPct = total > 0 ? (savings / total) * 100 : 0;
      return { total, savings, savingsPct: weightedPct };
    });
    // Check if any client has data for this category
    const hasData = cells.some(c => c !== null);
    if (!hasData) return null;

    // Compute average savings pct across clients that have data
    const populated = cells.filter(c => c !== null);
    const avgSavingsPct = populated.length > 0
      ? populated.reduce((sum, c) => sum + c.savingsPct, 0) / populated.length
      : 0;
    const avgTotal = populated.reduce((sum, c) => sum + c.total, 0) / populated.length;
    const avgSavings = populated.reduce((sum, c) => sum + c.savings, 0) / populated.length;

    return { cat, cells, avgSavingsPct, avgTotal, avgSavings };
  }).filter(Boolean);

  const totalCategories = matrix.length;
  const totalClients = activeClients.length;

  if (totalCategories === 0) {
    return (
      <Empty
        icon="◈"
        title="Sin datos de categorías ERA"
        hint="Agrega gastos con categorías ERA a los clientes para ver el benchmark comparativo."
      />
    );
  }

  // For cell highlighting: compare each client's savingsPct against row average
  return (
    <div className="stack">
      <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 8 }}>
        {totalClients} clientes · {totalCategories} categorías ERA con datos
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid var(--line)", minWidth: 160 }}>
                Categoría ERA
              </th>
              {activeClients.map(c => (
                <th key={c.id} style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid var(--line)", minWidth: 130 }}>
                  {(c.legalName || "—").slice(0, 15)}{(c.legalName || "").length > 15 ? "…" : ""}
                </th>
              ))}
              <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "2px solid var(--line)", minWidth: 120, color: "var(--text-2)" }}>
                Promedio
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ cat, cells, avgSavingsPct, avgTotal, avgSavings }) => (
              <tr key={cat.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    display: "inline-block", width: 10, height: 10,
                    borderRadius: "50%", background: cat.color || "var(--accent)", flexShrink: 0
                  }} />
                  {cat.key || cat.id}
                </td>
                {cells.map((cell, idx) => {
                  if (!cell) {
                    return (
                      <td key={activeClients[idx].id} style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-3)" }}>
                        —
                      </td>
                    );
                  }
                  const aboveAvg = cell.savingsPct > avgSavingsPct + 0.5;
                  const belowAvg = cell.savingsPct < avgSavingsPct - 0.5 && avgSavingsPct > 0;
                  const cellBg = aboveAvg
                    ? "oklch(0.95 0.05 145)"
                    : belowAvg
                      ? "oklch(0.96 0.04 25)"
                      : "transparent";
                  return (
                    <td key={activeClients[idx].id} style={{
                      padding: "8px 12px", textAlign: "right",
                      background: cellBg, borderRadius: 4
                    }}>
                      <div style={{ fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(cell.total, activeClients[idx].currency, { compact: true })}
                      </div>
                      {cell.savings > 0 && (
                        <div style={{ fontSize: 11, color: "var(--positive-2)", marginTop: 2 }}>
                          {cell.savingsPct.toFixed(0)}% ahorro
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-2)", background: "var(--surface-2)" }}>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(avgTotal, (activeClients[0] || {}).currency || "CLP", { compact: true })}
                  </div>
                  {avgSavings > 0 && (
                    <div style={{ fontSize: 11, color: "var(--positive-2)", marginTop: 2 }}>
                      {avgSavingsPct.toFixed(0)}% ahorro
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
        Celda verde = ahorro por encima del promedio · Celda roja = ahorro por debajo del promedio
      </div>
    </div>
  );
}

function NewClientModal({ open, onClose, onCreate }) {
  const { t } = useI18n();
  const store = useStore();
  const [mode, setMode] = React.useState("crm");   // "crm" | "new"
  const [name, setName] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [prospects, setProspects] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMode("crm"); setName(""); setQuery("");
    setProspects([]); setSelected(null); setCreating(false);
    // Load full list immediately on open
    setSearching(true);
    store.searchProspects("").then(results => {
      setProspects(results);
      setSearching(false);
    });
  }, [open]);

  // Debounced CRM search (filter as user types)
  React.useEffect(() => {
    if (mode !== "crm") return;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await store.searchProspects(query);
      setProspects(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, mode]);

  // Already-linked prospect ids
  const linkedIds = new Set(store.state.clients.map(c => c.prospectId).filter(Boolean));

  const canCreate = creating ? false : mode === "crm" ? !!selected : !!name.trim();

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      if (mode === "crm" && selected) {
        await onCreate(selected.company || "", selected.id, {
          legalName: selected.company || "",
          sector: [selected.industry, selected.subsector].filter(Boolean).join(" · "),
          country: selected.country || "Chile",
          contact: {
            name:  selected.contact_name || "",
            role:  selected.role  || "",
            email: selected.email || "",
            phone: selected.phone || "",
          },
        });
      } else {
        await onCreate(name.trim(), null, {});
      }
    } catch(e) { setCreating(false); }
  };

  const btnStyle = (active) => ({
    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, cursor: "pointer",
    fontWeight: active ? 600 : 400,
    border: "1px solid " + (active ? "var(--accent)" : "var(--line)"),
    background: active ? "oklch(0.95 0.04 265)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-2)",
  });

  return (
    <Modal open={open} onClose={onClose} title="Nuevo análisis de viabilidad"
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={creating}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={!canCreate} onClick={handleCreate}>
            {creating ? "Creando…" : "Crear análisis"}
          </button>
        </>
      }
    >
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button style={btnStyle(mode === "crm")}  onClick={() => setMode("crm")}>📋 Importar desde CRM</button>
        <button style={btnStyle(mode === "new")}  onClick={() => setMode("new")}>✚ Nuevo cliente</button>
      </div>

      {/* ── CRM mode ── */}
      {mode === "crm" && (
        <div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.5 }}>🔍</span>
            <input className="input" autoFocus placeholder="Buscar empresa o contacto…"
              value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }}
              style={{ paddingLeft: 32 }} />
          </div>

          {/* Results list */}
          {!searching && query.trim() && prospects.length === 0 && (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-3)", fontSize: 13 }}>
              Sin resultados para "<strong>{query}</strong>"
            </div>
          )}
          {!searching && prospects.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12 }}>
              {prospects.map((p, i) => {
                const isSel  = selected?.id === p.id;
                const hasAnalysis = linkedIds.has(p.id);
                return (
                  <div key={p.id} onClick={() => setSelected(p)} style={{
                    padding: "10px 14px", cursor: "pointer",
                    background: isSel ? "oklch(0.95 0.04 265)" : i % 2 === 0 ? "transparent" : "var(--surface-2)",
                    borderBottom: i < prospects.length - 1 ? "1px solid var(--line)" : "none",
                    borderLeft: "3px solid " + (isSel ? "var(--accent)" : "transparent"),
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.company}</span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {hasAnalysis && (
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "oklch(0.90 0.05 265)", color: "var(--accent)", fontWeight: 600 }}>
                            Ya tiene análisis
                          </span>
                        )}
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--line)" }}>
                          {p.stage || p.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 3 }}>
                      {[p.industry, p.country].filter(Boolean).join(" · ")}
                      {p.contact_name ? ` · ${p.contact_name}` : ""}
                      {p.email ? ` · ${p.email}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected prospect summary */}
          {selected && (
            <div style={{ padding: "12px 14px", background: "oklch(0.95 0.04 265)", borderRadius: 8, border: "1px solid oklch(0.82 0.07 265)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>✓ Seleccionado</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.company}</div>
              {(selected.industry || selected.country) && (
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  {[selected.industry, selected.subsector, selected.country].filter(Boolean).join(" · ")}
                </div>
              )}
              {selected.contact_name && (
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                  {selected.contact_name}{selected.role ? ` · ${selected.role}` : ""}
                  {selected.email ? ` · ${selected.email}` : ""}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </div>
              )}
            </div>
          )}

          {searching && prospects.length === 0 && (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-3)", fontSize: 13 }}>Cargando…</div>
          )}
        </div>
      )}

      {/* ── New client mode ── */}
      {mode === "new" && (
        <Field label={t.client.legalName}>
          <input className="input" autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && handleCreate()}
            placeholder="Razón social del cliente" />
        </Field>
      )}
    </Modal>
  );
}

// ============================================================
// Client data form (general info)
// ============================================================
function ClientDataView({ client, readonly = false }) {
  const { t } = useI18n();
  const store = useStore();
  const update = (patch) => store.updateClient(client.id, patch);
  const updateContact = (patch) => update({ contact: { ...client.contact, ...patch } });

  return (
    <div className="stack lg">
      <div>
        <div className="eyebrow">{t.client.general}</div>
        <h2 className="h2">{client.legalName || "—"}</h2>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 className="h3">{t.client.general}</h3>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <Field label={t.client.legalName} span={2}>
              <input className="input" value={client.legalName || ""} onChange={e => update({ legalName: e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.tradeName}>
              <input className="input" value={client.tradeName || ""} onChange={e => update({ tradeName: e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.taxId}>
              <input className="input" value={client.taxId || ""} onChange={e => update({ taxId: e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.sector} span={2}>
              <input className="input" value={client.sector || ""} onChange={e => update({ sector: e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.employees}>
              <input className="input right" type="number" value={client.employees ?? ""} onChange={e => update({ employees: e.target.value === "" ? null : +e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.sites}>
              <input className="input right" type="number" value={client.sites ?? ""} onChange={e => update({ sites: e.target.value === "" ? null : +e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.country}>
              <input className="input" value={client.country || ""} onChange={e => update({ country: e.target.value })} readOnly={readonly} />
            </Field>
            <Field label={t.client.currency}>
              <CurrencySelect value={client.currency} onChange={v => update({ currency: v })} disabled={readonly} />
            </Field>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3 className="h3">Facturación</h3>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <Field label={t.client.year}>
                <input className="input right" type="number" value={client.year ?? ""} onChange={e => update({ year: +e.target.value })} readOnly={readonly} />
              </Field>
              <Field label={t.client.stage}>
                <select className="select" value={client.stage} onChange={e => update({ stage: +e.target.value })} disabled={readonly}>
                  {t.client.stages.map((s, i) => <option key={i} value={i}>{s}</option>)}
                </select>
              </Field>
              <Field label={`${t.client.revenue} (${client.currency})`} span={2}>
                <MoneyInput value={client.revenue ?? 0} onChange={v => update({ revenue: v || null })} disabled={readonly} />
              </Field>
              <Field label={`${t.client.ebitda} (${client.currency})`} span={2}>
                <MoneyInput value={client.ebitda ?? 0} onChange={v => update({ ebitda: v || null })} disabled={readonly} />
              </Field>
            </div>
          </div>

          <div className="card">
            <h3 className="h3">{t.client.contact}</h3>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <Field label={t.client.contact} span={2}>
                <input className="input" value={client.contact?.name || ""} onChange={e => updateContact({ name: e.target.value })} readOnly={readonly} />
              </Field>
              <Field label={t.client.contactRole}>
                <input className="input" value={client.contact?.role || ""} onChange={e => updateContact({ role: e.target.value })} readOnly={readonly} />
              </Field>
              <Field label={t.client.phone}>
                <input className="input" value={client.contact?.phone || ""} onChange={e => updateContact({ phone: e.target.value })} readOnly={readonly} />
              </Field>
              <Field label={t.client.email} span={2}>
                <input className="input" value={client.contact?.email || ""} onChange={e => updateContact({ email: e.target.value })} readOnly={readonly} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="h3">{t.client.notes}</h3>
        <textarea className="textarea" value={client.notes || ""} onChange={e => update({ notes: e.target.value })} placeholder="…" readOnly={readonly} />
      </div>

      <div className="row between">
        <div className="meta" style={{ fontSize: 12, color: "var(--text-3)" }}>
          {t.clients.created}: {new Date(client.createdAt).toLocaleDateString()} · {t.clients.lastEdit}: {new Date(client.updatedAt).toLocaleString()}
        </div>
        <button className="btn danger" disabled={readonly} onClick={() => {
          if (confirm(t.common.confirmDelete)) {
            store.deleteClient(client.id);
          }
        }}>{t.actions.delete}</button>
      </div>
    </div>
  );
}

Object.assign(window, { ClientsView, ClientDataView, NewClientModal, BenchmarkView });
