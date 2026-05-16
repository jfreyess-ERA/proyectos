/* ============================================================
   App shell + router
   ============================================================ */

function App() {
  const { t } = useI18n();
  const store = useStore();
  const [section, setSection] = React.useState("data");
  const [showEraMgr, setShowEraMgr] = React.useState(false);
  const [readonly, setReadonly] = React.useState(false);
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
      setSection("data");
    } else {
      // Create new analysis linked to this prospect
      store.addClient(prospectName, prospectId).then(() => {
        setSection("data");
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
        setSection("data");
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
        <Topbar>
          <button className="btn ghost sm" onClick={() => setShowEraMgr(true)}>⚙ Categorías ERA</button>
        </Topbar>
        <ClientsView onOpen={(id) => { store.setActiveClient(id); setSection("data"); }} />
        <SaveIndicator status={saveStatus} />
        <EraCategoriesModal open={showEraMgr} onClose={() => setShowEraMgr(false)}
          eraCategories={eraCategories}
          onAdd={cat => store.addEraCategory(cat)}
          onUpdate={(id, p) => store.updateEraCategory(id, p)}
          onDelete={id => store.deleteEraCategory(id)} />
      </div>
    );
  }

  const tabs = [
    { id: "data",       label: t.nav.data },
    { id: "expenses",   label: t.nav.expenses, count: active.expenses.length },
    { id: "evolution",  label: t.nav.evolution },
    { id: "projection", label: t.nav.projection },
    { id: "gantt",      label: t.nav.gantt },
    { id: "dashboard",  label: t.nav.dashboard },
    { id: "profiling",  label: t.nav.profiling },
    { id: "scenarios",  label: t.nav.scenarios },
  ];

  return (
    <div className="app">
      <Topbar>
        {!readonly && (
          <button className="btn ghost sm" onClick={() => setShowEraMgr(true)}>⚙ Categorías ERA</button>
        )}
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
        {section === "data"       && <ClientDataView client={active} readonly={readonly} />}
        {section === "expenses"   && <ExpensesView client={active} readonly={readonly} />}
        {section === "evolution"  && <EvolutionView client={active} readonly={readonly} />}
        {section === "projection" && <ProjectionView client={active} readonly={readonly} />}
        {section === "gantt"      && <GanttView client={active} readonly={readonly} />}
        {section === "dashboard"  && <DashboardView client={active} readonly={readonly} />}
        {section === "profiling"  && <ProfilingView client={active} readonly={readonly} />}
        {section === "scenarios"  && <ScenariosView client={active} readonly={readonly} />}
      </main>
      <SaveIndicator status={saveStatus} />
      <EraCategoriesModal open={showEraMgr} onClose={() => setShowEraMgr(false)}
        eraCategories={eraCategories}
        onAdd={cat => store.addEraCategory(cat)}
        onUpdate={(id, p) => store.updateEraCategory(id, p)}
        onDelete={id => store.deleteEraCategory(id)} />
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
