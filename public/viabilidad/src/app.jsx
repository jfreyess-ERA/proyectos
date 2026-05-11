/* ============================================================
   App shell + router
   ============================================================ */

function App() {
  const { t } = useI18n();
  const store = useStore();
  const [section, setSection] = React.useState("data");

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
        <ClientsView onOpen={(id) => { store.setActiveClient(id); setSection("data"); }} />
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
    { id: "scenarios",  label: t.nav.scenarios },
  ];

  return (
    <div className="app">
      <Topbar>
        <button className="btn ghost sm" onClick={goToClients}>← {t.nav.clients}</button>
        {active.prospectId && (
          <a
            href="/"
            className="btn ghost sm"
            style={{ marginLeft: 4 }}
            title="Volver al Sistema de Gestión"
          >
            ← Sistema de Gestión
          </a>
        )}
      </Topbar>
      <Crumbs items={[
        { label: t.nav.clients, onClick: goToClients },
        { label: active.legalName || "—" },
      ]} />
      <main>
        <Tabs tabs={tabs} active={section} onChange={setSection} />
        {section === "data"       && <ClientDataView client={active} />}
        {section === "expenses"   && <ExpensesView client={active} />}
        {section === "evolution"  && <EvolutionView client={active} />}
        {section === "projection" && <ProjectionView client={active} />}
        {section === "gantt"      && <GanttView client={active} />}
        {section === "dashboard"  && <DashboardView client={active} />}
        {section === "scenarios"  && <ScenariosView client={active} />}
      </main>
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
