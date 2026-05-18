/* ============================================================
   App shell + router
   ============================================================ */

function EraAdminView() {
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [label, setLabel] = React.useState("");
  const [color, setColor] = React.useState("#4A90D9");
  const [editId, setEditId] = React.useState(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editColor, setEditColor] = React.useState("");

  const add = () => {
    if (!label.trim()) return;
    const key = label.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    store.addEraCategory({ key, label: label.trim(), color, sort_order: eraCategories.length });
    setLabel(""); setColor("#4A90D9");
  };

  const startEdit = (era) => { setEditId(era.id); setEditLabel(era.label); setEditColor(era.color); };
  const saveEdit = () => {
    if (!editLabel.trim()) return;
    store.updateEraCategory(editId, { label: editLabel.trim(), color: editColor });
    setEditId(null);
  };

  return (
    <div className="stack lg" style={{ maxWidth: 700 }}>
      <div>
        <div className="eyebrow">Administración</div>
        <h2 className="h2">Categorías ERA</h2>
        <p style={{ fontSize: 14, color: "var(--text-3)", marginTop: 4 }}>
          Lista global de categorías ERA. Se usan en todos los clientes para agrupar gastos en proyecciones, dashboards y perfilado.
        </p>
      </div>

      {/* Add new */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Nueva categoría ERA</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="input" placeholder="Nombre (ej: Energía, Logística…)" value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            style={{ flex: 1, minWidth: 200 }} autoFocus />
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            title="Color"
            style={{ width: 40, height: 36, border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", padding: 2 }} />
          <button className="btn primary" onClick={add} disabled={!label.trim()}>+ Agregar</button>
        </div>
      </div>

      {/* List */}
      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        {eraCategories.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏷</div>
            <div style={{ fontWeight: 600 }}>Sin categorías ERA</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Agrega la primera arriba</div>
          </div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 8 }}></th>
                <th>Nombre</th>
                <th style={{ width: 80 }}>Color</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {eraCategories.map(era => (
                <tr key={era.id}>
                  <td style={{ paddingLeft: 12 }}>
                    <span style={{ width: 6, height: 24, background: era.color, display: "block", borderRadius: 2 }} />
                  </td>
                  <td>
                    {editId === era.id ? (
                      <input className="input" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                        autoFocus style={{ width: "100%", maxWidth: 300 }} />
                    ) : (
                      <span style={{ fontWeight: 500 }}>{era.label}</span>
                    )}
                  </td>
                  <td>
                    {editId === era.id ? (
                      <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                        style={{ width: 36, height: 30, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", padding: 2 }} />
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)" }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: era.color, flexShrink: 0, border: "1px solid var(--line)" }} />
                        {era.color}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {editId === era.id ? (
                      <>
                        <button className="btn sm" onClick={saveEdit} disabled={!editLabel.trim()}>Guardar</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => setEditId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="btn ghost sm" onClick={() => startEdit(era)}>✏ Editar</button>
                        <button className="btn ghost sm danger" style={{ marginLeft: 4 }}
                          onClick={() => { if (confirm(`¿Eliminar "${era.label}"?`)) store.deleteEraCategory(era.id); }}
                        >×</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function App() {
  const { t } = useI18n();
  const store = useStore();
  const [section, setSection] = React.useState("expenses");
  const [globalTab, setGlobalTab] = React.useState("clients");
  const [readonly, setReadonly] = React.useState(false);
  const [requestedExpensesMode, setRequestedExpensesMode] = React.useState(null);
  const eraCategories = store.state.eraCategories || [];
  const saveStatus = store.state.saveStatus || 'idle';

  // ── Auth guard ────────────────────────────────────────────────
  React.useEffect(() => {
    const { supabaseUrl, supabaseAnon, loginUrl } = window.VIABILITY_CONFIG;
    const sbAuth = supabase.createClient(supabaseUrl, supabaseAnon);
    sbAuth.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = loginUrl + "?next=/viabilidad/index.html";
      }
    });
  }, []);

  // ── Handle ?prospect_id= URL param ───────────────────────────
  React.useEffect(() => {
    if (store.loading) return;
    const params = new URLSearchParams(window.location.search);
    const prospectId = params.get("prospect_id");
    const prospectName = params.get("prospect_name") || "";
    if (!prospectId) return;

    // Check if an analysis already exists for this prospect
    const existing = store.state.clients.find(c => c.prospectId === prospectId);
    if (existing) {
      store.setActiveClient(existing.id);
      setSection("expenses");
    } else {
      // Create new analysis linked to this prospect
      store.addClient(prospectName, prospectId).then(() => {
        setSection("expenses");
      });
    }
    // Clean up URL param without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete("prospect_id");
    url.searchParams.delete("prospect_name");
    window.history.replaceState({}, "", url.toString());
  }, [store.loading]);

  // ── Handle ?view= URL param (read-only share link) ───────────
  React.useEffect(() => {
    if (store.loading) return;
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("view");
    const isReadonly = params.get("readonly") === "1";
    if (viewId) {
      const found = store.state.clients.find(c => c.id === viewId);
      if (found) {
        store.setActiveClient(found.id);
        setSection("expenses");
        if (isReadonly) setReadonly(true);
      }
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("readonly");
      window.history.replaceState({}, "", url.toString());
    }
  }, [store.loading]);

  if (store.loading) {
    return React.createElement("div", { className: "boot" }, "Cargando análisis…");
  }

  if (store.error) {
    return React.createElement("div", { className: "boot", style: { color: "#c00" } },
      React.createElement("div", null, "Error al conectar: " + store.error),
      React.createElement("button", { onClick: store.reload, style: { marginTop: 12, padding: "6px 16px", cursor: "pointer" } }, "Reintentar")
    );
  }

  const active = store.state.clients.find(c => c.id === store.state.activeClientId);
  const goToClients = () => store.setActiveClient(null);

  if (!active) {
    return (
      <div className="app">
        <Topbar />
        <main>
          <Tabs
            tabs={[
              { id: "clients", label: t.nav.clients },
              { id: "admin",   label: "⚙ Administración" },
            ]}
            active={globalTab}
            onChange={setGlobalTab}
          />
          {globalTab === "clients" && (
            <ClientsView onOpen={(id) => { store.setActiveClient(id); setSection("expenses"); }} />
          )}
          {globalTab === "admin" && <EraAdminView />}
        </main>
        <SaveIndicator status={saveStatus} />
      </div>
    );
  }

  const tabs = [
    { id: "expenses",   label: t.nav.expenses, count: active.expenses.length },
    { id: "evolution",  label: t.nav.evolution },
    { id: "projection", label: t.nav.projection },
    { id: "dashboard",  label: `${t.nav.dashboard} · ${t.nav.gantt}` },
    { id: "scenarios",  label: t.nav.scenarios },
  ];

  return (
    <div className="app">
      <Topbar>
        <button className="btn ghost sm" onClick={goToClients}>← {t.nav.clients}</button>
        {active.prospectId && !readonly && (
          <a href="/" className="btn ghost sm" style={{ marginLeft: 4 }} title="Volver al Sistema de Gestión">
            ← Sistema de Gestión
          </a>
        )}
        <button
          className="btn ghost sm"
          title="Copiar enlace de solo lectura"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("view", active.id);
            url.searchParams.set("readonly", "1");
            navigator.clipboard.writeText(url.toString()).then(() => {
              alert("Enlace copiado al portapapeles");
            });
          }}
        >
          🔗 Compartir
        </button>
      </Topbar>
      <Crumbs items={[
        { label: t.nav.clients, onClick: goToClients },
        { label: active.legalName || "—" },
      ]} />
      {readonly && (
        <div style={{
          background: "oklch(0.95 0.05 265)", border: "1px solid oklch(0.80 0.10 265)",
          color: "oklch(0.40 0.14 265)", fontSize: 13, fontWeight: 500,
          padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <span>👁 Modo solo lectura — los cambios no se guardan</span>
          <button className="btn ghost sm" onClick={() => setReadonly(false)}>Salir</button>
        </div>
      )}
      <main>
        <Tabs tabs={tabs} active={section} onChange={setSection} />
        {section === "expenses"   && <ExpensesView client={active} readonly={readonly} requestedMode={requestedExpensesMode} onRequestedModeConsumed={() => setRequestedExpensesMode(null)} />}
        {section === "expenses"   && <ClientDataView client={active} readonly={readonly} />}
        {section === "evolution"  && <EvolutionView client={active} readonly={readonly} />}
        {section === "projection" && <ProjectionView client={active} readonly={readonly} onGoToRangos={() => { setSection("expenses"); setRequestedExpensesMode("rangos"); }} />}
        {section === "dashboard"  && <DashboardView client={active} readonly={readonly} />}
        {section === "dashboard"  && <GanttView client={active} readonly={readonly} />}
        {section === "scenarios"  && <ScenariosView client={active} readonly={readonly} />}
      </main>
      <SaveIndicator status={saveStatus} />
    </div>
  );
}

function Root() {
  return (
    <I18nProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </I18nProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);
