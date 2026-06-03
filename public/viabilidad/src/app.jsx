/* ============================================================
   App shell + router
   ============================================================ */

function TierConfigSection({ store }) {
  const { t } = useI18n();
  const tc = store.state.tierConfig || DEFAULT_TIER_CONFIG;
  const [draft, setDraft] = React.useState(null);

  // Sync draft when tierConfig changes (e.g. after load)
  React.useEffect(() => { setDraft(null); }, [tc]);

  const cur = draft || tc;
  const fmtAmt = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(0)} MM` : `$${n.toLocaleString()}`;

  const handleChange = (key, val) => {
    setDraft(prev => ({ ...(prev || tc), [key]: val }));
  };

  const saveField = (key, val) => {
    const parsed = key === "highVolumeAmount" ? Number(val) :
                   key === "highSavingsPct"   ? Number(val) :
                   parseInt(val, 10);
    if (isNaN(parsed)) return;
    const patch = { [key]: parsed };
    setDraft(prev => ({ ...(prev || tc), ...patch }));
    store.updateTierConfig(patch);
  };

  const tierConditions = [
    { tk: "A", name: t.tierA, cond: `Gasto ≥ ${fmtAmt(cur.highVolumeAmount)}  ·  ahorro ≥ ${cur.highSavingsPct}%  ·  factibilidad ≥ ${cur.quickWinFeasMin}` },
    { tk: "B", name: t.tierB, cond: `Gasto ≥ ${fmtAmt(cur.highVolumeAmount)}  ·  sin cumplir Quick Win` },
    { tk: "C", name: t.tierC, cond: `Gasto < ${fmtAmt(cur.highVolumeAmount)}  ·  ahorro ≥ ${cur.highSavingsPct}%  ·  factibilidad ≥ ${cur.lowVolFeasMin}` },
    { tk: "D", name: t.tierD, cond: `Gasto < ${fmtAmt(cur.highVolumeAmount)}  ·  ahorro < ${cur.highSavingsPct}%  o  factibilidad < ${cur.lowVolFeasMin}` },
  ];

  const inputStyle = { width: "100%", padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text-1)" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" };
  const hintStyle = { fontSize: 11, color: "var(--text-3)", marginTop: 3 };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Umbrales de clasificación</div>
      <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 0, marginBottom: 16 }}>
        Define los valores que determinan la asignación de tiers ({t.tierA} / {t.tierB} / {t.tierC} / {t.tierD}) a cada categoría ERA.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Volumen alto */}
          <div>
            <label style={labelStyle}>Volumen alto (nominal $)</label>
            <input
              type="number"
              step="1000000"
              value={cur.highVolumeAmount}
              style={inputStyle}
              onChange={e => handleChange("highVolumeAmount", e.target.value)}
              onBlur={e => saveField("highVolumeAmount", e.target.value)}
            />
            <div style={hintStyle}>Gasto mínimo para considerar alto volumen (en moneda base)</div>
          </div>

          {/* Ahorro mínimo % */}
          <div>
            <label style={labelStyle}>Ahorro mínimo %</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={cur.highSavingsPct}
              style={inputStyle}
              onChange={e => handleChange("highSavingsPct", e.target.value)}
              onBlur={e => saveField("highSavingsPct", e.target.value)}
            />
            <div style={hintStyle}>Porcentaje de ahorro estimado mínimo para considerar "alto ahorro"</div>
          </div>

          {/* Factibilidad Quick Win */}
          <div>
            <label style={labelStyle}>Factibilidad Quick Win (mín)</label>
            <input
              type="number"
              step="1"
              min="1"
              max="5"
              value={cur.quickWinFeasMin}
              style={inputStyle}
              onChange={e => handleChange("quickWinFeasMin", e.target.value)}
              onBlur={e => saveField("quickWinFeasMin", e.target.value)}
            />
            <div style={hintStyle}>Factibilidad mínima para clasificar como Tier A (Quick Win)</div>
          </div>

          {/* Factibilidad Bajo Impacto */}
          <div>
            <label style={labelStyle}>Factibilidad Bajo Impacto (mín)</label>
            <input
              type="number"
              step="1"
              min="1"
              max="5"
              value={cur.lowVolFeasMin}
              style={inputStyle}
              onChange={e => handleChange("lowVolFeasMin", e.target.value)}
              onBlur={e => saveField("lowVolFeasMin", e.target.value)}
            />
            <div style={hintStyle}>Factibilidad mínima para clasificar como Tier C (Bajo impacto)</div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="card flat" style={{ padding: "14px 20px", background: "var(--surface-2)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>
          Vista previa de condiciones
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <tbody>
            {tierConditions.map(({ tk, name, cond }) => (
              <tr key={tk} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "7px 12px 7px 0", whiteSpace: "nowrap" }}>
                  <span className={"tier " + tk}>{tk}</span>
                </td>
                <td style={{ padding: "7px 8px 7px 0", whiteSpace: "nowrap", fontWeight: 600, fontSize: 12, color: "var(--text-1)", minWidth: 110 }}>{name}</td>
                <td style={{ padding: "7px 12px", color: "var(--text-2)", lineHeight: 1.5 }}>{cond}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

      <TierConfigSection store={store} />
    </div>
  );
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function ShareModal({ client, tabs, onClose }) {
  const [selectedTabs, setSelectedTabs] = React.useState(tabs.map(t => t.id));
  const [password, setPassword] = React.useState("");
  const [days, setDays] = React.useState(7);
  const [generatedUrl, setGeneratedUrl] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const toggleTab = (id) => {
    setSelectedTabs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", client.id);
    url.searchParams.set("readonly", "1");
    if (selectedTabs.length > 0 && selectedTabs.length < tabs.length) {
      url.searchParams.set("tabs", selectedTabs.join(","));
    } else {
      url.searchParams.delete("tabs");
    }
    if (password.trim()) {
      const hash = await sha256(password.trim());
      url.searchParams.set("pw", hash);
    } else {
      url.searchParams.delete("pw");
    }
    if (days > 0) {
      const exp = Math.floor(Date.now() / 1000) + days * 86400;
      url.searchParams.set("exp", String(exp));
    } else {
      url.searchParams.delete("exp");
    }
    setGeneratedUrl(url.toString());
    setCopied(false);
  };

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-2)", marginBottom: 8, display: "block" };
  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 480, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.2)", position: "relative" }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-2)", lineHeight: 1 }}
        >×</button>

        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🔗 Compartir análisis</div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Pestañas a incluir</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tabs.map(tab => (
              <label key={tab.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "5px 10px", border: "1px solid var(--line)", borderRadius: 6, background: selectedTabs.includes(tab.id) ? "var(--surface-2)" : "transparent" }}>
                <input
                  type="checkbox"
                  checked={selectedTabs.includes(tab.id)}
                  onChange={() => toggleTab(tab.id)}
                  style={{ margin: 0 }}
                />
                {tab.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Clave de acceso <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
          <input
            type="password"
            placeholder="Dejar vacío para acceso sin contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Vigencia (días)</label>
          <input
            type="number"
            min="0"
            value={days}
            onChange={e => setDays(parseInt(e.target.value, 10) || 0)}
            style={{ ...inputStyle, width: 120 }}
          />
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>
            {days === 0 ? "Sin vencimiento" : `Válido por ${days} día${days !== 1 ? "s" : ""}`}
          </div>
        </div>

        <button className="btn primary" onClick={handleGenerate} disabled={selectedTabs.length === 0} style={{ marginBottom: generatedUrl ? 16 : 0 }}>
          Generar enlace
        </button>

        {generatedUrl && (
          <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              readOnly
              value={generatedUrl}
              style={{ flex: 1, background: "transparent", border: "none", fontSize: 11, color: "var(--text-2)", outline: "none", minWidth: 0 }}
              onClick={e => e.target.select()}
            />
            <button className="btn ghost sm" onClick={handleCopy} style={{ flexShrink: 0 }}>
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordGate({ pwHash, onVerified }) {
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setChecking(true);
    const hash = await sha256(input.trim());
    if (hash === pwHash) {
      onVerified();
    } else {
      setError(true);
      setChecking(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 340, width: "100%" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Enlace protegido</div>
        <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 24 }}>Ingresa la clave de acceso para ver este análisis.</div>
        <input
          type="password"
          placeholder="Clave de acceso"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          style={{ width: "100%", padding: "10px 14px", border: `1px solid ${error ? "#c00" : "var(--line)"}`, borderRadius: 8, fontSize: 14, background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box", marginBottom: 8 }}
          autoFocus
        />
        {error && <div style={{ fontSize: 13, color: "#c00", marginBottom: 8 }}>Clave incorrecta. Inténtalo de nuevo.</div>}
        <button className="btn primary" onClick={handleSubmit} disabled={checking || !input.trim()} style={{ width: "100%" }}>
          {checking ? "Verificando…" : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

function ExpiryBanner({ exp }) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = exp - now;
  if (remaining <= 0) return null;

  let timeStr;
  if (remaining < 3600) {
    const mins = Math.ceil(remaining / 60);
    timeStr = `${mins} minuto${mins !== 1 ? "s" : ""}`;
  } else if (remaining < 86400) {
    const hrs = Math.ceil(remaining / 3600);
    timeStr = `${hrs} hora${hrs !== 1 ? "s" : ""}`;
  } else {
    const d = Math.ceil(remaining / 86400);
    timeStr = `${d} día${d !== 1 ? "s" : ""}`;
  }

  return (
    <div style={{ background: "oklch(0.95 0.06 85)", border: "1px solid oklch(0.80 0.12 85)", color: "oklch(0.40 0.12 60)", fontSize: 13, fontWeight: 500, padding: "8px 20px" }}>
      ⏱ Este enlace es válido por {timeStr} más
    </div>
  );
}

function ExpiredLink() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 340 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⌛</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Enlace expirado</div>
        <div style={{ fontSize: 14, color: "var(--text-2)" }}>
          Este enlace de acceso ha vencido. Solicita un nuevo enlace al propietario del análisis.
        </div>
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
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [shareParams, setShareParams] = React.useState(null);
  const [pwVerified, setPwVerified] = React.useState(false);
  const eraCategories = store.state.eraCategories || [];
  const saveStatus = store.state.saveStatus || 'idle';

  // ── Auth guard ────────────────────────────────────────────────
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('readonly') === '1' && params.get('view')) return;
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
      const pwHash = params.get('pw') || null;
      const expTs = params.get('exp') ? parseInt(params.get('exp'), 10) : null;
      const tabsParam = params.get('tabs');
      const allowedTabs = tabsParam ? tabsParam.split(',') : null;
      if (pwHash || expTs || allowedTabs) setShareParams({ pwHash, expTs, allowedTabs });
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("readonly");
      url.searchParams.delete("tabs");
      url.searchParams.delete("pw");
      url.searchParams.delete("exp");
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
    { id: "fx",         label: (t.fx && t.fx.nav) || "Tipo de cambio" },
    { id: "scenarios",  label: t.nav.scenarios },
  ];

  const isExpired = shareParams?.expTs && Math.floor(Date.now() / 1000) > shareParams.expTs;

  if (isExpired) {
    return (
      <div className="app">
        <Topbar />
        <main><ExpiredLink /></main>
      </div>
    );
  }

  if (shareParams?.pwHash && !pwVerified) {
    return (
      <div className="app">
        <Topbar />
        <main><PasswordGate pwHash={shareParams.pwHash} onVerified={() => setPwVerified(true)} /></main>
      </div>
    );
  }

  const visibleTabs = shareParams?.allowedTabs
    ? tabs.filter(t => shareParams.allowedTabs.includes(t.id))
    : tabs;

  if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === section)) {
    setSection(visibleTabs[0].id);
  }

  return (
    <div className="app">
      <Topbar>
        <button className="btn ghost sm" onClick={goToClients}>← {t.nav.clients}</button>
        {active.prospectId && !readonly && (
          <a href="/" className="btn ghost sm" style={{ marginLeft: 4 }} title="Volver al Sistema de Gestión">
            ← Sistema de Gestión
          </a>
        )}
        {!readonly && (
          <button
            className="btn ghost sm"
            title="Compartir análisis"
            onClick={() => setShowShareModal(true)}
          >
            🔗 Compartir
          </button>
        )}
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
      {shareParams?.expTs && !isExpired && <ExpiryBanner exp={shareParams.expTs} />}
      <main>
        <Tabs tabs={visibleTabs} active={section} onChange={setSection} />
        {section === "expenses"   && <ExpensesView client={active} readonly={readonly} requestedMode={requestedExpensesMode} onRequestedModeConsumed={() => setRequestedExpensesMode(null)} />}
        {section === "expenses"   && <ClientDataView client={active} readonly={readonly} />}
        {section === "expenses"   && <SpendSummary client={active} />}
        {section === "evolution"  && <EvolutionView client={active} readonly={readonly} />}
        {section === "projection" && <ProjectionView client={active} readonly={readonly} onGoToRangos={() => { setSection("expenses"); setRequestedExpensesMode("rangos"); }} />}
        {section === "projection" && <div style={{ marginTop: 40 }}><HonorariosChart client={active} /></div>}
        {section === "projection" && <div style={{ marginTop: 40 }}><GanttView client={active} readonly={readonly} /></div>}
        {section === "projection" && <div style={{ marginTop: 40 }}><RetornoSummaryCard client={active} /></div>}
        {section === "fx"         && <FXView />}
        {section === "scenarios"  && <ScenariosView client={active} readonly={readonly} />}
      </main>
      <SaveIndicator status={saveStatus} />
      {showShareModal && <ShareModal client={active} tabs={tabs} onClose={() => setShowShareModal(false)} />}
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
