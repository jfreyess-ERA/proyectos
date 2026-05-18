/* ============================================================
   Projection (Lámina 7) + Resources (Lámina 8) + Gantt (Lámina 9)
   ============================================================ */

function ProjectionView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [drawerCatId, setDrawerCatId] = React.useState(null);
  const [sort, setSort] = React.useState({ col: null, dir: "desc" });
  const [feasFilter, setFeasFilter] = React.useState(new Set()); // empty = all
  const tableCardRef = React.useRef(null);
  const [downloading, setDownloading] = React.useState(false);

  const downloadTableImage = async () => {
    if (!tableCardRef.current || downloading) return;
    setDownloading(true);
    try {
      // foreignObjectRendering=true lets the browser resolve CSS variables
      const canvas = await html2canvas(tableCardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        foreignObjectRendering: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `tabla-resumen-${(client.legalName || "cliente").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      // Must be in DOM for Firefox + Safari
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(err) {
      console.error("[download]", err);
      alert("No se pudo generar la imagen: " + err.message);
    } finally {
      setDownloading(false);
    }
  };
  const sc = { feePct: 30, feePctOnSavings: 50, feeMonths: 36, projectionYears: 5, includedCategories: null, ...(client.scenario || {}) };
  const groups = aggregateByEra(client, eraCategories);
  const total = totalSpend(client);

  const toggleSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  const SI = ({ col }) => sort.col !== col ? <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span> : (
    <span style={{ marginLeft: 3, opacity: 0.7 }}>{sort.dir === "desc" ? "↓" : "↑"}</span>
  );
  const thSort = { cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };

  const included = sc.includedCategories;
  const isIncluded = (catId) => included == null || included.includes(catId);

  const set = (patch) => store.updateClient(client.id, { scenario: { ...sc, ...patch } });

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  // Filter + Sort groups
  const sortedGroups = React.useMemo(() => {
    let list = groups;
    if (feasFilter.size > 0) {
      list = list.filter(g => feasFilter.has(Math.round(g.avgFeasibility)));
    }
    if (!sort.col) return list;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let va, vb;
      if      (sort.col === "name")    { va = (a.category?.label || "").toLowerCase(); vb = (b.category?.label || "").toLowerCase(); return dir * va.localeCompare(vb); }
      else if (sort.col === "total")   { va = a.total;               vb = b.total; }
      else if (sort.col === "scope")   { va = a.avgScopePct;         vb = b.avgScopePct; }
      else if (sort.col === "scopeAmt"){ va = a.optimizationAmount;  vb = b.optimizationAmount; }
      else if (sort.col === "minPct")  { va = a.avgMinPct;           vb = b.avgMinPct; }
      else if (sort.col === "maxPct")  { va = a.avgMaxPct;           vb = b.avgMaxPct; }
      else if (sort.col === "feas")    { va = a.avgFeasibility;      vb = b.avgFeasibility; }
      else if (sort.col === "min")     { va = a.minSavings;          vb = b.minSavings; }
      else if (sort.col === "max")     { va = a.maxSavings;          vb = b.maxSavings; }
      else return 0;
      return dir * (va - vb);
    });
  }, [groups, sort, feasFilter]);

  // Totals
  const inc = groups.filter(g => isIncluded(g.categoryId));
  const sumMin = inc.reduce((s, g) => s + g.minSavings, 0);
  const sumMax = inc.reduce((s, g) => s + g.maxSavings, 0);
  const sumAvg = inc.reduce((s, g) => s + g.potentialSavings, 0);

  // Fees ERA = % savings × months charged (annual savings × months/12)
  const feeMin = sumMin * (sc.feePctOnSavings / 100) * (sc.feeMonths / 12);
  const feeMax = sumMax * (sc.feePctOnSavings / 100) * (sc.feeMonths / 12);
  const feeAvg = sumAvg * (sc.feePctOnSavings / 100) * (sc.feeMonths / 12);

  // Client return = annual savings × years - ERA fee
  const retMin = sumMin * sc.projectionYears - feeMin;
  const retMax = sumMax * sc.projectionYears - feeMax;
  const retAvg = sumAvg * sc.projectionYears - feeAvg;

  const catLabel = (cat) => cat ? (cat.label || cat.key) : "—";

  // Tiers
  const tiers = { A: [], B: [], C: [], D: [] };
  groups.forEach(g => { tiers[tierFor(g, total)].push(g); });

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.nav.projection}</div>
          <h2 className="h2">{t.projection.title}</h2>
          <p className="lede" style={{ marginTop: 4 }}>{t.projection.lede}</p>
        </div>
        <div className="btn-row no-print">
          <button className="btn" onClick={() => window.print()}>⎙ {t.actions.print}</button>
        </div>
      </div>

      {/* Fee config */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>{t.projection.honorariosCfg}</h3>
          <span className="pill champagne">{t.projection.noSavings}</span>
        </div>
        <div className="grid cols-3">
          <Field label={t.projection.pctSavings} hint={`% del ahorro que cobra ERA`}>
            <div className="row" style={{ gap: 10 }}>
              <input type="range" min="0" max="100" step="1" value={sc.feePctOnSavings} onChange={e => set({ feePctOnSavings: +e.target.value })} style={{ flex: 1 }} />
              <input className="input right" type="number" value={sc.feePctOnSavings} onChange={e => set({ feePctOnSavings: +e.target.value })} style={{ width: 70 }} />
            </div>
          </Field>
          <Field label={t.projection.months} hint="Meses sobre los que se calculan los honorarios (ej. 36)">
            <div className="row" style={{ gap: 10 }}>
              <input type="range" min="0" max="60" step="1" value={sc.feeMonths} onChange={e => set({ feeMonths: +e.target.value })} style={{ flex: 1 }} />
              <input className="input right" type="number" value={sc.feeMonths} onChange={e => set({ feeMonths: +e.target.value })} style={{ width: 70 }} />
            </div>
          </Field>
          <Field label={t.projection.horizon} hint="Años de proyección del retorno cliente">
            <div className="row" style={{ gap: 10 }}>
              <input type="range" min="1" max="10" step="1" value={sc.projectionYears} onChange={e => set({ projectionYears: +e.target.value })} style={{ flex: 1 }} />
              <input className="input right" type="number" value={sc.projectionYears} onChange={e => set({ projectionYears: +e.target.value })} style={{ width: 70 }} />
            </div>
          </Field>
        </div>
      </div>

      {/* Tabla 2: Resumen factibilidad y proyección de ahorros */}
      <div ref={tableCardRef} className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header + filtros */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Tabla resumen</div>
              <h3 className="h3" style={{ margin: 0 }}>Factibilidad y proyección de ahorros (anuales)</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pill variant="champagne">{sortedGroups.length} / {groups.length}</Pill>
              <button
                className="btn ghost sm"
                title="Descargar tabla como imagen"
                disabled={downloading}
                onClick={downloadTableImage}
                style={{ fontSize: 15, padding: "3px 8px", lineHeight: 1 }}
              >
                {downloading ? "…" : "⬇"}
              </button>
            </div>
          </div>
          {/* Factibilidad filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Factibilidad:</span>
            {[1, 2, 3, 4, 5].map(v => {
              const active = feasFilter.size === 0 || feasFilter.has(v);
              const selected = feasFilter.has(v);
              return (
                <button key={v}
                  onClick={() => setFeasFilter(prev => {
                    const next = new Set(prev);
                    if (next.has(v)) next.delete(v); else next.add(v);
                    return next;
                  })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    borderColor: selected ? "var(--accent)" : "var(--line)",
                    background: selected ? "var(--accent-bg)" : "var(--surface-2)",
                    color: selected ? "var(--accent)" : "var(--text-2)",
                  }}
                >
                  <FeasDots value={v} /> {v}
                </button>
              );
            })}
            {feasFilter.size > 0 && (
              <button onClick={() => setFeasFilter(new Set())}
                style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Limpiar
              </button>
            )}
          </div>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th></th>
              <th style={thSort} onClick={() => toggleSort("name")}>{t.projection.cuentas}<SI col="name"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("total")}>Spend under review<SI col="total"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("scope")}>% alcance<SI col="scope"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("scopeAmt")}>$MM alcance<SI col="scopeAmt"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("feas")}>Factib.<SI col="feas"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("minPct")}>% ahorr_min<SI col="minPct"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("maxPct")}>% ahorr_max<SI col="maxPct"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("min")}>MM$ ahorr_min<SI col="min"/></th>
              <th className="right" style={thSort} onClick={() => toggleSort("max")}>MM$ ahorr_max<SI col="max"/></th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map(g => {
              const included = isIncluded(g.categoryId);
              return (
                <tr key={g.categoryId} style={{ opacity: included ? 1 : 0.45, cursor: "pointer" }}
                    onClick={(ev) => { if (ev.target.tagName === "INPUT") return; setDrawerCatId(g.categoryId); }}>
                  <td style={{ paddingLeft: 16 }}>
                    <input type="checkbox" checked={included} onChange={() => {
                      const cur = sc.includedCategories == null ? groups.map(x => x.categoryId) : sc.includedCategories;
                      const next = cur.includes(g.categoryId) ? cur.filter(c => c !== g.categoryId) : [...cur, g.categoryId];
                      set({ includedCategories: next });
                    }} />
                  </td>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td className="right tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency)}</td>
                  <td className="right tabular">{fmtPct(g.avgScopePct)}</td>
                  <td className="right tabular">{fmtMoney(g.optimizationAmount, client.currency)}</td>
                  <td className="right"><FeasDots value={Math.round(g.avgFeasibility)} /></td>
                  <td className="right tabular">{fmtPct(g.avgMinPct)}</td>
                  <td className="right tabular">{fmtPct(g.avgMaxPct)}</td>
                  <td className="right tabular" style={{ color: "var(--text-2)" }}>{fmtMoney(g.minSavings, client.currency)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.maxSavings, client.currency)}</td>
                </tr>
              );
            })}
            <tr className="totals">
              <td></td>
              <td>{t.expenses.total}</td>
              <td className="right">{fmtMoney(total, client.currency)}</td>
              <td className="right">{fmtPct(sortedGroups.length > 0 ? sortedGroups.reduce((s,g) => s + g.optimizationAmount, 0) / (sortedGroups.reduce((s,g) => s + g.total, 0) || 1) * 100 : 0)}</td>
              <td className="right">{fmtMoney(sortedGroups.reduce((s,g) => s + g.optimizationAmount, 0), client.currency)}</td>
              <td className="right">—</td>
              <td className="right">{fmtPct(sortedGroups.length > 0 ? sortedGroups.reduce((s,g) => s + g.avgMinPct * g.total, 0) / (sortedGroups.reduce((s,g) => s + g.total, 0) || 1) : 0)}</td>
              <td className="right">{fmtPct(sortedGroups.length > 0 ? sortedGroups.reduce((s,g) => s + g.avgMaxPct * g.total, 0) / (sortedGroups.reduce((s,g) => s + g.total, 0) || 1) : 0)}</td>
              <td className="right">{fmtMoney(sortedGroups.reduce((s,g) => s + g.minSavings, 0), client.currency)}</td>
              <td className="right" style={{ color: "var(--positive-2)" }}>{fmtMoney(sortedGroups.reduce((s,g) => s + g.maxSavings, 0), client.currency)}</td>
            </tr>
          </tbody>
        </table>

        {/* Retorno cliente — incluido en la descarga */}
        <div style={{
          padding: "20px 24px",
          background: "var(--ink)",
          color: "var(--on-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase",
              color: "var(--champagne)", fontWeight: 700, marginBottom: 4,
            }}>
              Retorno cliente {sc.projectionYears} {sc.projectionYears === 1 ? "año" : "años"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              ERA {sc.feePctOnSavings}% × {sc.feeMonths} meses · {client.legalName}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Rango cliente</div>
            <div style={{
              fontSize: 28, fontWeight: 700, color: "var(--champagne)",
              fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            }}>
              {fmtMoney(retMin, client.currency)} — {fmtMoney(retMax, client.currency)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
              medio: {fmtMoney(retAvg, client.currency)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Honorarios ERA</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: "rgba(244,241,232,0.85)",
              fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            }}>
              {fmtMoney(feeMin, client.currency)} — {fmtMoney(feeMax, client.currency)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
              medio: {fmtMoney(feeAvg, client.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit ranges per expense line */}
      <div className="card flat" style={{ padding: "14px 20px", background: "var(--surface-2)", fontSize: 13, color: "var(--text-2)" }}>
        💡 Los rangos por línea (alcance, ahorro mín/máx, factibilidad) se configuran en la pestaña <strong>Gastos → Rangos</strong>.
      </div>

      {/* Tier cards (Quick win / Estratégica / Mantener / Descartar) */}
      <div className="grid cols-4">
        {["A", "B", "C", "D"].map(tk => {
          const list = tiers[tk];
          const sum = list.reduce((s, g) => s + g.total, 0);
          const savSum = list.reduce((s, g) => s + g.potentialSavings, 0);
          return (
            <div key={tk} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className={"tier " + tk}>{t.profiling[`tier${tk}`]}</span>
                <span className="spacer" />
                <span className="tabular" style={{ fontSize: 11, color: "var(--text-3)" }}>{list.length}</span>
              </div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
                {fmtMoney(sum, client.currency, { compact: true })}
              </div>
              <div className="tabular" style={{ fontSize: 12, color: "var(--positive-2)", fontWeight: 700, marginTop: 2 }}>
                +{fmtMoney(savSum, client.currency, { compact: true })} ahorro medio
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.4 }}>
                {t.profiling.tierExplain[tk]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Volume × avg savings matrix */}
      <ProfilingMatrix groups={groups} total={total} client={client} onCategoryClick={setDrawerCatId} />

      {/* Hero retorno */}
      <div className="card" style={{ background: "var(--ink)", color: "var(--on-ink)", borderColor: "var(--ink)", padding: 32 }}>
        <div className="grid cols-3" style={{ alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--champagne)", fontWeight: 700, marginBottom: 6 }}>
              {t.projection.retorno5y} {sc.projectionYears} {t.projection.retornoYears}
            </div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>{client.legalName}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              ERA: {sc.feePctOnSavings}% × {sc.feeMonths} meses
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.65 }}>Rango cliente</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--champagne)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {fmtMoney(retMin, client.currency, { compact: true })} — {fmtMoney(retMax, client.currency, { compact: true })}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>medio: {fmtMoney(retAvg, client.currency, { compact: true })}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.65 }}>{t.projection.honorariosERA}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(244,241,232,0.9)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {fmtMoney(feeMin, client.currency, { compact: true })} — {fmtMoney(feeMax, client.currency, { compact: true })}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>medio: {fmtMoney(feeAvg, client.currency, { compact: true })}</div>
          </div>
        </div>
      </div>

      {/* Resources Lámina 8 */}
      <ResourcesPanel client={client} groups={inc} retAvg={retAvg} />

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


function ResourcesPanel({ client, groups, retAvg }) {
  const { t } = useI18n();
  const store = useStore();
  const defaultRoles = [
    { id: "r1", title: "Director / Gerente General", hours: 8 },
    { id: "r2", title: "CFO / Gerente Finanzas", hours: 20 },
    { id: "r3", title: "Jefe de Operaciones", hours: 24 },
    { id: "r4", title: "Analista", hours: 40 },
  ];
  const r = { eraHHPerCat: 200, roles: defaultRoles, ...(client.resources || {}) };
  if (!r.roles || !Array.isArray(r.roles) || r.roles.length === 0) r.roles = defaultRoles;
  const setR = (patch) => store.updateClient(client.id, { resources: { ...r, ...patch } });
  const updRole = (i, patch) => {
    const next = r.roles.map((x, k) => k === i ? { ...x, ...patch } : x);
    setR({ roles: next });
  };
  const addRole = () => setR({ roles: [...r.roles, { id: "r" + Date.now(), title: "Nuevo cargo", hours: 0 }] });
  const removeRole = (i) => setR({ roles: r.roles.filter((_, k) => k !== i) });

  const n = groups.length;
  const clientHH = r.roles.reduce((s, x) => s + (+x.hours || 0), 0);
  const eraHH = n * r.eraHHPerCat;
  const totalHH = clientHH + eraHH;
  const retornoPorHH = clientHH > 0 ? retAvg / clientHH : 0;

  // Pie geometry
  const cx = 120, cy = 120, R = 100;
  const ang = totalHH > 0 ? (eraHH / totalHH) * 2 * Math.PI : 0;
  const arc = (a0, a1) => {
    const x0 = cx + R * Math.sin(a0), y0 = cy - R * Math.cos(a0);
    const x1 = cx + R * Math.sin(a1), y1 = cy - R * Math.cos(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${cx} ${cy} L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
  };
  const eraColor = "var(--ink)", cliColor = "var(--champagne)";
  const eraPct = totalHH > 0 ? (eraHH / totalHH) * 100 : 0;
  const cliPct = 100 - eraPct;

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <div className="eyebrow">Lámina · {t.resources.title}</div>
          <h3 className="h3" style={{ margin: 0 }}>{t.resources.title}</h3>
        </div>
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>{t.resources.lede}</p>

      <div className="grid cols-2" style={{ gap: 24, alignItems: "start" }}>
        {/* Pie chart */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700, marginBottom: 10 }}>
            Distribución de horas
          </div>
          <div className="row" style={{ gap: 20, alignItems: "center" }}>
            <svg viewBox="0 0 240 240" style={{ width: 200, height: 200, flexShrink: 0 }}>
              {totalHH === 0 ? (
                <circle cx={cx} cy={cy} r={R} fill="var(--surface-2)" stroke="var(--line)" />
              ) : eraHH === totalHH ? (
                <circle cx={cx} cy={cy} r={R} fill={eraColor} />
              ) : eraHH === 0 ? (
                <circle cx={cx} cy={cy} r={R} fill={cliColor} />
              ) : (
                <>
                  <path d={arc(0, ang)} fill={eraColor} />
                  <path d={arc(ang, 2 * Math.PI)} fill={cliColor} />
                </>
              )}
              <circle cx={cx} cy={cy} r={50} fill="var(--surface)" />
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="var(--text-3)" fontFamily="Trebuchet MS">Total HH</text>
              <text x={cx} y={cy + 14} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)" fontFamily="Trebuchet MS">{totalHH}</text>
            </svg>
            <div className="stack sm" style={{ fontSize: 13 }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span style={{ width: 12, height: 12, background: eraColor, borderRadius: 2 }} />
                <strong>ERA Group</strong>
                <span className="tabular" style={{ color: "var(--text-3)" }}>· {eraHH} HH · {fmtPct(eraPct)}</span>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span style={{ width: 12, height: 12, background: cliColor, borderRadius: 2 }} />
                <strong>Cliente</strong>
                <span className="tabular" style={{ color: "var(--text-3)" }}>· {clientHH} HH · {fmtPct(cliPct)}</span>
              </div>
              <div className="divider" style={{ margin: "6px 0" }} />
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                ERA: {n} cat × {r.eraHHPerCat} HH
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label={t.resources.eraHH}>
              <input className="input right" type="number" value={r.eraHHPerCat} onChange={e => setR({ eraHHPerCat: +e.target.value || 0 })} style={{ width: 120 }} />
            </Field>
          </div>
        </div>

        {/* Roles editor */}
        <div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700 }}>
              Horas del cliente por cargo
            </span>
            <button className="btn ghost sm" onClick={addRole}>+ cargo</button>
          </div>
          <table className="t" style={{ fontSize: 13 }}>
            <thead><tr>
              <th>Cargo</th>
              <th className="right" style={{ width: 90 }}>HH</th>
              <th style={{ width: 40 }}></th>
            </tr></thead>
            <tbody>
              {r.roles.map((role, i) => (
                <tr key={role.id}>
                  <td><input className="input" value={role.title} onChange={e => updRole(i, { title: e.target.value })} /></td>
                  <td className="right"><input className="input right" type="number" value={role.hours} onChange={e => updRole(i, { hours: +e.target.value || 0 })} /></td>
                  <td><button className="btn ghost sm danger" onClick={() => removeRole(i)} title="Eliminar">×</button></td>
                </tr>
              ))}
              <tr className="totals">
                <td>Total cliente</td>
                <td className="right tabular">{clientHH} HH</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <Stat
          label="Retorno por HH cliente · rango"
          value={`${fmtMoney(clientHH > 0 ? (groups.reduce((s,g)=>s+g.minSavings,0) * client.scenario.projectionYears - groups.reduce((s,g)=>s+g.minSavings,0) * (client.scenario.feePctOnSavings/100) * (client.scenario.feeMonths/12)) / clientHH : 0, client.currency, { compact: true })} — ${fmtMoney(clientHH > 0 ? (groups.reduce((s,g)=>s+g.maxSavings,0) * client.scenario.projectionYears - groups.reduce((s,g)=>s+g.maxSavings,0) * (client.scenario.feePctOnSavings/100) * (client.scenario.feeMonths/12)) / clientHH : 0, client.currency, { compact: true })}`}
          sub={`/ HH cliente (${clientHH} HH)`}
          variant="accent"
        />
        <Stat label={t.resources.categoriesIncluded} value={n} sub={t.scenarios.proposed} variant="dark" />
      </div>
    </div>
  );
}

// ============================================================
// Gantt (Lámina 9)
// ============================================================
function GanttView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const groups = aggregateByEra(client, eraCategories).filter(g => {
    const inc = client.scenario.includedCategories;
    return inc == null || inc.includes(g.categoryId);
  });

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  const STAGE_KEYS = ["K", "S", "O", "I", "G"];
  const DEFAULT_STAGES = { K: 1, S: 2, O: 2, I: 4, G: 3 };
  const STAGE_COLORS = {
    K: "#003A70", S: "#1F4E85", O: "#FF9C00", I: "#D88200", G: "#2F7D63",
  };

  // Per-category workplan: { start, stages: {K,S,O,I,G} } stored in client.scenario.workplan
  const workplan = client.scenario.workplan || {};
  const planFor = (categoryId) => {
    const p = workplan[categoryId] || {};
    return {
      start: p.start ?? 0,
      stages: { ...DEFAULT_STAGES, ...(p.stages || {}) },
    };
  };
  const setPlan = (categoryId, patch) => {
    const cur = planFor(categoryId);
    const next = {
      start: patch.start != null ? patch.start : cur.start,
      stages: { ...cur.stages, ...(patch.stages || {}) },
    };
    const wp = { ...workplan, [categoryId]: next };
    store.setScenario(client.id, { ...client.scenario, workplan: wp });
  };

  // Compute total months needed = max(start + sum of stages) across categories
  const maxMonth = groups.reduce((m, g) => {
    const p = planFor(g.categoryId);
    const dur = STAGE_KEYS.reduce((s, k) => s + (+p.stages[k] || 0), 0);
    return Math.max(m, p.start + dur);
  }, 12);
  const totalMonths = Math.max(12, maxMonth);
  const monthsArr = Array.from({ length: totalMonths }, (_, i) => i + 1);

  const catLabel = (cat) => cat ? (t.categories[cat.key] || cat.key) : "—";

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.nav.gantt}</div>
          <h2 className="h2">{t.gantt.title}</h2>
          <p className="lede" style={{ marginTop: 4 }}>{t.gantt.lede}</p>
        </div>
        <div className="btn-row no-print">
          <button className="btn" onClick={() => window.print()}>⎙ {t.actions.print}</button>
        </div>
      </div>

      {/* Legend */}
      <div className="card flat" style={{ padding: "14px 18px", background: "var(--surface-2)" }}>
        <div className="row wrap" style={{ gap: 18, alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700 }}>Etapas:</span>
          {Object.entries(t.gantt.stagesShort).map(([k, label]) => (
            <span key={k} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 18, height: 12, background: STAGE_COLORS[k], borderRadius: 2 }} />
              <strong>{label}</strong>
              <span style={{ color: "var(--text-3)" }}>· {t.gantt.stages[k]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="card flat" style={{ padding: 0, overflow: "auto" }}>
        <table className="t" style={{ tableLayout: "fixed", minWidth: 900 }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 60 }} />
            {STAGE_KEYS.map(k => <col key={"c-" + k} style={{ width: 54 }} />)}
            <col style={{ width: 60 }} />
            <col style={{ width: "100%" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan="2" style={{ verticalAlign: "bottom" }}>{t.expenses.cols.category}</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>N°</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>{t.gantt.start}</th>
              <th colSpan={STAGE_KEYS.length} style={{ textAlign: "center", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Meses por etapa</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>Total</th>
              <th style={{ textAlign: "center", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Cronograma</th>
            </tr>
            <tr>
              {STAGE_KEYS.map(k => (
                <th key={"h-" + k} className="right" style={{ paddingLeft: 4, paddingRight: 4 }}>
                  <span style={{ display: "inline-block", width: 18, height: 4, background: STAGE_COLORS[k], borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                  {t.gantt.stagesShort[k]}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const p = planFor(g.categoryId);
              const total = STAGE_KEYS.reduce((s, k) => s + (+p.stages[k] || 0), 0);
              const segments = [];
              let cursor = p.start;
              for (const k of STAGE_KEYS) {
                const d = +p.stages[k] || 0;
                if (d > 0) segments.push({ stage: k, dur: d });
                cursor += d;
              }

              // Bar segment style
              const barSeg = (color, label, dur, first, last, isDots) => ({
                flex: dur,
                background: color,
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
                borderRadius: first && last ? 3 : first ? "3px 0 0 3px" : last ? "0 3px 3px 0" : 0,
                marginRight: last ? 0 : 1,
                letterSpacing: isDots ? 2 : 0.3,
                minWidth: 0,
                overflow: "hidden",
              });

              return (
                <tr key={g.categoryId}>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td className="right tabular">{i + 1}</td>
                  <td className="right">
                    <input className="input right" type="number" min="0" max="48" value={p.start}
                      onChange={e => setPlan(g.categoryId, { start: Math.max(0, +e.target.value || 0) })}
                      style={{ width: 50 }} />
                  </td>
                  {STAGE_KEYS.map(k => (
                    <td key={"e-" + k} className="right">
                      <input className="input right" type="number" min="0" max="48" value={p.stages[k]}
                        onChange={e => setPlan(g.categoryId, { stages: { [k]: Math.max(0, +e.target.value || 0) } })}
                        style={{ width: 44 }} />
                    </td>
                  ))}
                  <td className="right tabular" style={{ fontWeight: 700 }}>{total}m</td>
                  <td style={{ padding: "4px 8px" }}>
                    <div style={{ display: "flex", height: 22, alignItems: "stretch" }}>
                      {/* Start offset */}
                      {p.start > 0 && <div style={{ flex: p.start, minWidth: 4 }} />}
                      {segments.map((seg, si) => {
                        const color = STAGE_COLORS[seg.stage];
                        const label = t.gantt.stagesShort[seg.stage];
                        const isFirst = si === 0;
                        const isLast = si === segments.length - 1;
                        if (seg.stage !== "G" || seg.dur <= 3) {
                          // Show individual labels for all stages except long Seguimiento
                          return (
                            <div key={si} style={barSeg(color, label, seg.dur, isFirst, isLast, false)}>
                              {Array.from({ length: seg.dur }, (_, j) => (
                                <span key={j} style={{ flex: 1, textAlign: "center" }}>{label}</span>
                              ))}
                            </div>
                          );
                        }
                        // Seguimiento largo: label | ··· | label
                        return (
                          <div key={si} style={{ ...barSeg(color, label, seg.dur, isFirst, isLast, false), padding: 0, justifyContent: "space-between" }}>
                            <span style={{ padding: "0 5px", flexShrink: 0 }}>{label}</span>
                            <span style={{ letterSpacing: 2, opacity: 0.8, flexShrink: 0 }}>···</span>
                            <span style={{ padding: "0 5px", flexShrink: 0 }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Month scale: start and end */}
                    {total > 0 && (
                      <div style={{ display: "flex", fontSize: 9, color: "var(--text-3)", marginTop: 1 }}>
                        <div style={{ flex: p.start, minWidth: 0 }} />
                        <div style={{ flex: total, display: "flex", justifyContent: "space-between", padding: "0 1px" }}>
                          <span>M{p.start + 1}</span>
                          <span>M{p.start + total}</span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stage descriptions */}
      <div className="grid cols-5">
        {Object.entries(t.gantt.stagesShort).map(([k, label]) => (
          <div key={k} className="card" style={{ padding: 14, borderTop: `4px solid ${STAGE_COLORS[k]}` }}>
            <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700, color: STAGE_COLORS[k] }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", margin: "2px 0 4px" }}>{t.gantt.stages[k]}</div>
            <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>{t.gantt.stagesDesc[k]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ProjectionView, GanttView, ResourcesPanel });
