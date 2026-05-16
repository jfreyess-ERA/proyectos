/* ============================================================
   Dashboard + Scenarios
   ============================================================ */

function fmtRange(min, max, currency, opts) {
  if (Math.abs(min - max) < 1) return fmtMoney(max, currency, opts);
  return `${fmtMoney(min, currency, opts)} – ${fmtMoney(max, currency, opts)}`;
}

function DashboardView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [drawerCatId, setDrawerCatId] = React.useState(null);
  const total = totalSpend(client);
  const groups = aggregateByEra(client, eraCategories);
  const sumMin = groups.reduce((s, g) => s + (g.minSavings || 0), 0);
  const sumMax = groups.reduce((s, g) => s + (g.maxSavings || 0), 0);
  const ofRevenue = client.revenue > 0 ? (total / client.revenue) * 100 : null;
  const savPctMin = total > 0 ? (sumMin / total) * 100 : 0;
  const savPctMax = total > 0 ? (sumMax / total) * 100 : 0;

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  const topVolume = groups.slice(0, 5);
  const topSavings = [...groups].sort((a, b) => (b.maxSavings || 0) - (a.maxSavings || 0)).slice(0, 5);
  const maxVol = topVolume[0]?.total || 1;
  const maxSav = topSavings[0]?.maxSavings || 1;
  const catLabel = (cat) => cat ? (cat.label || cat.key) : "—";

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.dashboard.title}</div>
          <h2 className="h2">{client.legalName}</h2>
          <p className="lede" style={{ marginTop: 4 }}>{t.dashboard.lede}</p>
        </div>
        <div className="btn-row no-print">
          <button className="btn" onClick={() => window.print()}>⎙ {t.actions.print}</button>
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid cols-4">
        <Stat label={t.dashboard.currentSpend} value={fmtMoney(total, client.currency)}
              sub={ofRevenue != null ? `${fmtPct(ofRevenue)} ${t.dashboard.ofRevenue}` : null} variant="dark" />
        <Stat label={t.dashboard.potentialSavings} value={fmtRange(sumMin, sumMax, client.currency)}
              sub={`${fmtPct(savPctMin)} – ${fmtPct(savPctMax)}`} variant="accent" />
        <Stat label={t.dashboard.categoriesAnalyzed} value={groups.length}
              sub={`${client.expenses.length} ${t.expenses.rowCount}`} />
        <Stat label="3 años" value={fmtRange(sumMin * 3, sumMax * 3, client.currency)}
              sub={t.dashboard.potentialSavings.toLowerCase()} />
      </div>

      <div className="grid cols-2">
        {/* Top volume */}
        <div className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <h3 className="h3" style={{ margin: 0 }}>{t.dashboard.topCategories}</h3>
            <span className="pill">{groups.length}</span>
          </div>
          <div className="stack sm">
            {topVolume.map(g => (
              <div key={g.categoryId} style={{ cursor: "pointer" }} onClick={() => setDrawerCatId(g.categoryId)}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} />
                  <span className="tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency)}</span>
                </div>
                <Bar value={g.total} max={maxVol} />
              </div>
            ))}
          </div>
        </div>

        {/* Top savings */}
        <div className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <h3 className="h3" style={{ margin: 0 }}>{t.dashboard.topSavings}</h3>
            <span className="pill positive">+ {fmtRange(sumMin, sumMax, client.currency)}</span>
          </div>
          <div className="stack sm">
            {topSavings.map(g => (
              <div key={g.categoryId} style={{ cursor: "pointer" }} onClick={() => setDrawerCatId(g.categoryId)}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} />
                  <span className="tabular" style={{ fontWeight: 700, color: "var(--positive-2)" }}>
                    +{fmtRange(g.minSavings || 0, g.maxSavings || 0, client.currency)}
                  </span>
                </div>
                <Bar value={g.maxSavings || 0} max={maxSav} variant="positive" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="card">
        <h3 className="h3">Distribución del gasto</h3>
        <div style={{ display: "flex", height: 36, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
          {groups.map(g => {
            const w = total > 0 ? (g.total / total) * 100 : 0;
            return (
              <div key={g.categoryId}
                   title={`${catLabel(g.category)}: ${fmtMoney(g.total, client.currency)} (${fmtPct(w)})`}
                   style={{ width: w + "%", background: g.category?.color || "#ccc" }} />
            );
          })}
        </div>
        <div className="row wrap" style={{ marginTop: 12, gap: 12 }}>
          {groups.map(g => {
            const w = total > 0 ? (g.total / total) * 100 : 0;
            return (
              <div key={g.categoryId} style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, background: g.category?.color || "#ccc", borderRadius: 2 }} />
                <span>{catLabel(g.category)}</span>
                <span style={{ color: "var(--text-3)" }}>{fmtPct(w)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <CategoryDrawer
        open={drawerCatId != null}
        categoryId={drawerCatId}
        client={client}
        eraCategories={eraCategories}
        onClose={() => setDrawerCatId(null)}
      />
    </div>
  );
}

// ============================================================
// Scenarios
// ============================================================
function ScenariosView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [drawerCatId, setDrawerCatId] = React.useState(null);
  const groups = aggregateByEra(client, eraCategories);
  const total = totalSpend(client);

  const included = client.scenario.includedCategories;
  const isIncluded = (catId) => included == null || included.includes(catId);

  const toggleInclude = (catId) => {
    const cur = included == null ? groups.map(g => g.categoryId) : included;
    const next = cur.includes(catId) ? cur.filter(c => c !== catId) : [...cur, catId];
    store.updateClient(client.id, { scenario: { ...client.scenario, includedCategories: next } });
  };

  const setFee = (pct) => {
    store.updateClient(client.id, { scenario: { ...client.scenario, feePct: pct } });
  };

  const includedGroups = groups.filter(g => isIncluded(g.categoryId));
  const includedSpend = includedGroups.reduce((s, g) => s + g.total, 0);
  const includedSavMin = includedGroups.reduce((s, g) => s + (g.minSavings || 0), 0);
  const includedSavMax = includedGroups.reduce((s, g) => s + (g.maxSavings || 0), 0);
  const feeMonths = client.scenario.feeMonths || 36;
  const byCat = client.scenario.feePctByCat || {};
  const feeMin = includedGroups.reduce((s, g) => {
    const pct = byCat[g.categoryId] != null ? byCat[g.categoryId] : client.scenario.feePct;
    return s + (g.minSavings || 0) * (pct / 100) * (feeMonths / 12);
  }, 0);
  const feeMax = includedGroups.reduce((s, g) => {
    const pct = byCat[g.categoryId] != null ? byCat[g.categoryId] : client.scenario.feePct;
    return s + (g.maxSavings || 0) * (pct / 100) * (feeMonths / 12);
  }, 0);
  const netClientMin = includedSavMin - feeMin;
  const netClientMax = includedSavMax - feeMax;
  const netClient3yMin = (includedSavMin * 3) - feeMin;
  const netClient3yMax = (includedSavMax * 3) - feeMax;
  const catLabel = (cat) => cat ? (cat.label || cat.key) : "—";

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  return (
    <div className="stack lg">
      <div>
        <div className="eyebrow">{t.nav.scenarios}</div>
        <h2 className="h2">{t.scenarios.title}</h2>
        <p className="lede" style={{ marginTop: 4 }}>{t.scenarios.lede}</p>
      </div>

      <div className="grid cols-2">
        {/* Current */}
        <div className="card" style={{ background: "var(--surface-2)" }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="h3" style={{ margin: 0 }}>{t.scenarios.current}</h3>
            <Pill variant="muted">Baseline</Pill>
          </div>
          <div className="stack sm">
            <div className="row between"><span style={{ color: "var(--text-2)" }}>{t.dashboard.currentSpend}</span>
              <span className="tabular" style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney(total, client.currency)}</span></div>
            <div className="row between"><span style={{ color: "var(--text-2)" }}>{t.dashboard.categoriesAnalyzed}</span>
              <span className="tabular">{groups.length}</span></div>
            <div className="divider" style={{ margin: "8px 0" }} />
            <div className="row between"><span style={{ color: "var(--text-2)" }}>{t.scenarios.year1}</span>
              <span className="tabular">{fmtMoney(total, client.currency)}</span></div>
            <div className="row between"><span style={{ color: "var(--text-2)" }}>{t.scenarios.year3}</span>
              <span className="tabular">{fmtMoney(total * 3, client.currency)}</span></div>
          </div>
        </div>

        {/* Proposed */}
        <div className="card" style={{ background: "var(--ink)", color: "var(--on-ink)", borderColor: "var(--ink)" }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="h3" style={{ margin: 0, color: "var(--champagne)" }}>{t.scenarios.proposed}</h3>
            <span className="pill champagne">ERA</span>
          </div>
          <div className="stack sm">
            <div className="row between"><span style={{ opacity: 0.75 }}>{t.dashboard.potentialSavings}</span>
              <span className="tabular" style={{ fontWeight: 700, fontSize: 16, color: "var(--champagne)" }}>{fmtRange(includedSavMin, includedSavMax, client.currency)}</span></div>
            <div className="row between"><span style={{ opacity: 0.75 }}>{t.scenarios.include}</span>
              <span className="tabular">{includedGroups.length} / {groups.length}</span></div>
            <div className="divider" style={{ margin: "8px 0", background: "rgba(244,241,232,0.15)" }} />
            <div className="row between"><span style={{ opacity: 0.75 }}>{t.scenarios.year1}</span>
              <span className="tabular" style={{ color: "var(--champagne)" }}>−{fmtRange(includedSavMin, includedSavMax, client.currency)}</span></div>
            <div className="row between"><span style={{ opacity: 0.75 }}>{t.scenarios.year3}</span>
              <span className="tabular" style={{ color: "var(--champagne)", fontWeight: 700 }}>−{fmtRange(includedSavMin * 3, includedSavMax * 3, client.currency)}</span></div>
          </div>
        </div>
      </div>

      {/* Selection table */}
      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }} className="row between">
          <h3 className="h3" style={{ margin: 0 }}>{t.scenarios.include}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => store.updateClient(client.id, { scenario: { ...client.scenario, includedCategories: groups.map(g => g.categoryId) } })}>
              Todas
            </button>
            <button className="btn ghost sm" onClick={() => store.updateClient(client.id, { scenario: { ...client.scenario, includedCategories: [] } })}>
              Ninguna
            </button>
            <button className="btn ghost sm" onClick={() => store.updateClient(client.id, { scenario: { ...client.scenario, includedCategories: groups.filter(g => tierFor(g, total) === "A" || tierFor(g, total) === "B").map(g => g.categoryId) } })}>
              Solo A + B
            </button>
          </div>
        </div>
        <table className="t">
          <thead><tr>
            <th style={{ width: 50 }}></th>
            <th>{t.expenses.cols.category}</th>
            <th>{t.profiling.tier}</th>
            <th className="right">{t.profiling.volume}</th>
            <th className="right">{t.profiling.savings}</th>
            <th className="right">{t.profiling.potential}</th>
          </tr></thead>
          <tbody>
            {groups.map(g => {
              const inc = isIncluded(g.categoryId);
              const tk = tierFor(g, total);
              return (
                <tr key={g.categoryId} style={{ opacity: inc ? 1 : 0.45, cursor: "pointer" }}
                    onClick={(ev) => { if (ev.target.tagName === "INPUT") return; setDrawerCatId(g.categoryId); }}>
                  <td style={{ paddingLeft: 16 }}>
                    <input type="checkbox" checked={inc} onChange={() => toggleInclude(g.categoryId)} />
                  </td>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td><span className={"tier " + tk}>{tk}</span></td>
                  <td className="right tabular">{fmtMoney(g.total, client.currency)}</td>
                  <td className="right tabular">{fmtPct(g.avgSavingsPct)}</td>
                  <td className="right tabular" style={{ color: inc ? "var(--positive-2)" : "var(--text-3)", fontWeight: 700 }}>
                    {fmtRange(g.minSavings || 0, g.maxSavings || 0, client.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fee model */}
      <div className="card">
        <h3 className="h3">{t.scenarios.fee}</h3>
        <div className="grid cols-3" style={{ alignItems: "end", gap: 20, marginBottom: 20 }}>
          <Field label={`${t.scenarios.feeLabel} (default)`}>
            <div className="row" style={{ gap: 12 }}>
              <input type="range" min="0" max="50" step="1" value={client.scenario.feePct}
                     onChange={e => setFee(+e.target.value)}
                     style={{ flex: 1 }} />
              <input className="input right" type="number" min="0" max="100" value={client.scenario.feePct}
                     onChange={e => setFee(+e.target.value)} style={{ width: 80 }} />
            </div>
          </Field>
          <Field label={t.scenarios.months}>
            <div className="row" style={{ gap: 12 }}>
              <input type="range" min="6" max="60" step="1" value={client.scenario.feeMonths || 36}
                     onChange={e => store.updateClient(client.id, { scenario: { ...client.scenario, feeMonths: +e.target.value } })}
                     style={{ flex: 1 }} />
              <input className="input right" type="number" min="0" max="120" value={client.scenario.feeMonths || 36}
                     onChange={e => store.updateClient(client.id, { scenario: { ...client.scenario, feeMonths: +e.target.value } })} style={{ width: 80 }} />
            </div>
          </Field>
          <Stat label={t.scenarios.fee} value={fmtRange(feeMin, feeMax, client.currency)} sub={`${client.scenario.feePct}% × ${(client.scenario.feeMonths || 36)} meses`} variant="accent" />
        </div>

        {/* Per-category fee override */}
        <div style={{ marginTop: 8 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700 }}>
              {t.scenarios.perCategory}
            </span>
            <button className="btn ghost sm" onClick={() => store.updateClient(client.id, { scenario: { ...client.scenario, feePctByCat: {} } })}>
              Resetear
            </button>
          </div>
          <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
            <table className="t" style={{ fontSize: 13 }}>
              <thead><tr>
                <th>{t.expenses.cols.category}</th>
                <th className="right">{t.profiling.potential}</th>
                <th className="right">{t.scenarios.feeLabel}</th>
                <th className="right">{t.scenarios.fee}</th>
              </tr></thead>
              <tbody>
                {includedGroups.map(g => {
                  const byCat = client.scenario.feePctByCat || {};
                  const pct = byCat[g.categoryId] != null ? byCat[g.categoryId] : client.scenario.feePct;
                  const months = client.scenario.feeMonths || 36;
                  const fMin = (g.minSavings || 0) * (pct / 100) * (months / 12);
                  const fMax = (g.maxSavings || 0) * (pct / 100) * (months / 12);
                  return (
                    <tr key={g.categoryId} style={{ cursor: "pointer" }}
                        onClick={(ev) => { if (ev.target.tagName === "INPUT") return; setDrawerCatId(g.categoryId); }}>
                      <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                      <td className="right tabular">{fmtRange(g.minSavings || 0, g.maxSavings || 0, client.currency)}</td>
                      <td className="right">
                        <input className="input right" type="number" min="0" max="100" value={pct}
                               onChange={e => {
                                 const next = { ...byCat, [g.categoryId]: +e.target.value || 0 };
                                 store.updateClient(client.id, { scenario: { ...client.scenario, feePctByCat: next } });
                               }}
                               style={{ width: 70 }} />
                      </td>
                      <td className="right tabular" style={{ color: "var(--champagne-2)", fontWeight: 700 }}>{fmtRange(fMin, fMax, client.currency)}</td>
                    </tr>
                  );
                })}
                <tr className="totals">
                  <td colSpan={3}>{t.scenarios.fee} total</td>
                  <td className="right tabular">{fmtRange(feeMin, feeMax, client.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Final summary block */}
      <div className="card" style={{ background: "var(--ink)", color: "var(--on-ink)", borderColor: "var(--ink)", padding: 32 }}>
        <div className="grid cols-3" style={{ alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--champagne)", fontWeight: 700, marginBottom: 8 }}>
              Propuesta {client.legalName}
            </div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>{client.tradeName || ""} · {client.year}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.65 }}>{t.scenarios.year1} · {t.scenarios.net}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--champagne)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {fmtRange(netClientMin, netClientMax, client.currency)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.65 }}>{t.scenarios.year3} · {t.scenarios.net}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--champagne)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {fmtRange(netClient3yMin, netClient3yMax, client.currency)}
            </div>
          </div>
        </div>
      </div>
      <CategoryDrawer
        open={drawerCatId != null}
        categoryId={drawerCatId}
        client={client}
        eraCategories={eraCategories}
        onClose={() => setDrawerCatId(null)}
      />
    </div>
  );
}

Object.assign(window, { DashboardView, ScenariosView });
