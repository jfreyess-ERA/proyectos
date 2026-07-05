/* ============================================================
   Profiling view: feasibility of optimization per category
   ============================================================ */

function MiniSparkline({ data, currency, color = "var(--accent)" }) {
  if (!data || data.length < 2) return null;
  const W = 400, H = 60, P = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const px = (i) => P + (i / (data.length - 1)) * (W - P * 2);
  const py = (v) => H - P - ((v - min) / range) * (H - P * 2);
  const pts = data.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  // Fill area under line
  const fillPts = `${px(0)},${H - P} ${pts} ${px(data.length - 1)},${H - P}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 48, display: "block" }}>
      <polygon points={fillPts} fill={color} fillOpacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* First and last value labels */}
      <text x={px(0) + 4} y={py(data[0]) - 4} fontSize="9" fill="var(--text-2)" fontFamily="Trebuchet MS">{fmtMoney(data[0], currency, { compact: true })}</text>
      <text x={px(data.length - 1) - 4} y={py(data[data.length - 1]) - 4} fontSize="9" fill="var(--text-2)" textAnchor="end" fontFamily="Trebuchet MS">{fmtMoney(data[data.length - 1], currency, { compact: true })}</text>
    </svg>
  );
}

// ── Smooth Catmull-Rom spline path ─────────────────────────────
function smoothCurvePath(pts, tension = 0.4) {
  if (pts.length < 2) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// ── Color palette for multi-series charts ──────────────────────
const CHART_PALETTE = [
  "#4A90D9","#E8A838","#2ECC71","#E74C3C",
  "#9B59B6","#1ABC9C","#F39C12","#E91E63",
  "#00BCD4","#FF5722","#607D8B","#8BC34A",
];
const MONTH_ABBR_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function DrawerEvolution({ expenses, currency, categoryColor }) {
  const [mode, setMode] = React.useState("total"); // "total" | "lines" | "suppliers"
  const [hiddenKeys, setHiddenKeys] = React.useState(new Set());

  const withMonthly = expenses.filter(e => e.monthly && e.monthly.length > 0);
  if (withMonthly.length === 0) return null;

  const nMonths = Math.max(...withMonthly.map(e => e.monthly.length));
  const idxs = Array.from({ length: nMonths }, (_, i) => i);

  // Build series based on mode
  let series;
  if (mode === "total") {
    series = [{
      key: "total", label: "Total",
      data: idxs.map(i => withMonthly.reduce((s, e) => s + (e.monthly[i] || 0), 0)),
      color: categoryColor || "#4A90D9",
    }];
  } else if (mode === "lines") {
    series = withMonthly.map((e, idx) => ({
      key: e.id || String(idx),
      label: [e.supplier, e.subcategory].filter(Boolean).join(" · ") || `Línea ${idx + 1}`,
      data: idxs.map(i => e.monthly[i] || 0),
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  } else {
    // by supplier
    const map = {};
    withMonthly.forEach(e => {
      const key = e.supplier?.trim() || "—";
      if (!map[key]) map[key] = { key, label: key, data: Array(nMonths).fill(0), color: CHART_PALETTE[Object.keys(map).length % CHART_PALETTE.length] };
      idxs.forEach(i => { map[key].data[i] += e.monthly[i] || 0; });
    });
    series = Object.values(map);
  }

  const visible = series.filter(s => !hiddenKeys.has(s.key));
  const display = visible.length > 0 ? visible : series;

  const toggleKey = (key) => setHiddenKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next.size >= series.length ? new Set() : next; // reset if hiding all
  });

  // SVG layout
  const W = 860, H = 270, PL = 80, PR = 14, PT = 28, PB = 24;
  const cW = W - PL - PR, cH = H - PT - PB;
  const allVals = display.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const px = i => PL + (nMonths === 1 ? cW / 2 : (i / (nMonths - 1)) * cW);
  const py = v => PT + cH - (v / maxV) * cH;
  const step = Math.ceil(nMonths / 8);
  const solo = display.length === 1;
  // Which point indices get a value label (avoid crowding in multi-series)
  const labelEvery = solo ? (nMonths <= 6 ? 1 : 2) : 0; // 0 = only first+last+max per series

  const modeButtons = [
    { id: "total", label: "Total" },
    ...(withMonthly.length > 1 ? [{ id: "lines", label: "Por línea" }] : []),
    ...(new Set(withMonthly.map(e => e.supplier?.trim() || "—")).size > 1 ? [{ id: "suppliers", label: "Por proveedor" }] : []),
  ];

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
          Evolución mensual · {nMonths} períodos
        </div>
        {modeButtons.length > 1 && (
          <div style={{ display: "flex", gap: 3 }}>
            {modeButtons.map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setHiddenKeys(new Set()); }}
                style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                  border: "1px solid " + (mode === m.id ? "var(--accent)" : "var(--line)"),
                  background: mode === m.id ? "var(--accent)" : "transparent",
                  color: mode === m.id ? "#fff" : "var(--text-2)", fontWeight: 500,
                }}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 270, display: "block" }}>
        {/* Y-axis gridlines + labels */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const v = maxV * f;
          const yy = py(v);
          return (
            <g key={f}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy}
                stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 3" />
              <text x={PL - 6} y={yy + 3} fontSize="9" fill="var(--text-3)"
                textAnchor="end" fontFamily="Trebuchet MS">
                {fmtMoney(v, currency, { compact: true })}
              </text>
            </g>
          );
        })}

        {/* Series: smooth curves + fill + dots + labels */}
        {display.map(s => {
          const ptArr = s.data.map((v, i) => [px(i), py(v)]);
          const linePath = smoothCurvePath(ptArr);
          const fillPath = `${linePath} L ${px(nMonths - 1)},${py(0)} L ${px(0)},${py(0)} Z`;
          const maxIdx = s.data.indexOf(Math.max(...s.data));
          // Which indices get a visible label
          const labeled = labelEvery > 0
            ? new Set(idxs.filter(i => i % labelEvery === 0 || i === nMonths - 1))
            : new Set([0, nMonths - 1, maxIdx]);

          return (
            <g key={s.key}>
              {solo && <path d={fillPath} fill={s.color} fillOpacity="0.10" stroke="none" />}
              <path d={linePath} fill="none" stroke={s.color}
                strokeWidth={solo ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots + labels */}
              {idxs.map(i => {
                const cx = ptArr[i][0], cy = ptArr[i][1];
                const show = labeled.has(i);
                const label = fmtMoney(s.data[i], currency, { compact: true });
                const labelW = label.length * 5.5 + 6;
                // Position label above dot; if near top, flip below
                const above = cy > PT + 18;
                const ly = above ? cy - 7 : cy + 16;
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={show ? 3.5 : 2.5} fill={s.color}
                      stroke="var(--surface)" strokeWidth="1.5" />
                    {show && (
                      <>
                        <rect x={cx - labelW / 2} y={ly - 10} width={labelW} height={12}
                          rx="3" fill="var(--surface)" fillOpacity="0.90" />
                        <text x={cx} y={ly} fontSize="8.5" fill={s.color} fontWeight="600"
                          textAnchor="middle" fontFamily="Trebuchet MS">
                          {label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Month labels */}
        {idxs.map(i => (i % step === 0 || i === nMonths - 1) && (
          <text key={i} x={px(i)} y={H - 4} fontSize="8.5" fill="var(--text-3)"
            textAnchor="middle" fontFamily="Trebuchet MS">
            {MONTH_ABBR_ES[i % 12]}
          </text>
        ))}
      </svg>

      {/* Legend chips (filter) */}
      {series.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {series.map(s => {
            const active = !hiddenKeys.has(s.key);
            return (
              <button key={s.key} onClick={() => toggleKey(s.key)} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                border: "1px solid " + (active ? s.color : "var(--line)"),
                background: active ? s.color + "22" : "transparent",
                color: active ? "var(--text-1)" : "var(--text-3)",
                fontWeight: active ? 500 : 400, transition: "all .15s",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? s.color : "var(--line)", flexShrink: 0 }} />
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryDrawer({ open, categoryId, client, eraCategories = [], onClose }) {
  const { t } = useI18n();
  if (!open || !categoryId) return null;

  // Auto-detect: ERA mode if categoryId exists in eraCategories, else client category mode
  const era = eraCategories.find(e => e.id === categoryId);
  const isEraMode = !!era;

  const cat = isEraMode
    ? (era ? { color: era.color, label: era.label, key: era.label, notes: null, pipeline: null } : null)
    : client.categories.find(c => c.id === categoryId);

  const eraForCat = isEraMode ? null : eraCategories.find(e => e.id === cat?.eraId);

  const catLabel = (c) => c ? (c.label || c.key) : "—";
  const expenses = isEraMode
    ? client.expenses.filter(e => {
        const cc = client.categories.find(c => c.id === e.categoryId);
        return effectiveEraId(e, cc) === categoryId;
      })
    : client.expenses.filter(e => e.categoryId === categoryId);
  const total = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
  let savMin = 0, savMax = 0;
  expenses.forEach(e => {
    const amt = +e.amount || 0;
    const scope = (e.scopePct == null ? 100 : +e.scopePct) / 100;
    savMin += amt * scope * ((+e.savingsMinPct || 0) / 100);
    savMax += amt * scope * ((+e.savingsMaxPct || 0) / 100);
  });
  const avgFeas = expenses.length > 0
    ? expenses.reduce((s, e) => s + (+e.feasibility || 0), 0) / expenses.length : 0;

  // Monthly sparkline: sum across all expenses that have monthly series
  const monthlyExpenses = expenses.filter(e => e.monthly && e.monthly.length > 0);
  const monthlyData = (() => {
    if (monthlyExpenses.length === 0) return [];
    const maxLen = Math.max(...monthlyExpenses.map(e => e.monthly.length));
    return Array.from({ length: maxLen }, (_, i) =>
      monthlyExpenses.reduce((s, e) => s + (e.monthly[i] || 0), 0)
    );
  })();

  // Group expenses by supplier
  const supplierMap = {};
  expenses.forEach(e => {
    const key = e.supplier?.trim() || "—";
    if (!supplierMap[key]) supplierMap[key] = { supplier: key, amount: 0, lines: 0, savingsPct: [] };
    supplierMap[key].amount += +e.amount || 0;
    supplierMap[key].lines += 1;
    if (+e.savingsPct > 0) supplierMap[key].savingsPct.push(+e.savingsPct);
  });
  const suppliers = Object.values(supplierMap).sort((a, b) => b.amount - a.amount);

  // Pipeline badge colors
  const pipelineColors = {
    analysis:     { bg: "oklch(0.90 0.08 265)", color: "oklch(0.35 0.14 265)" },
    proposal:     { bg: "oklch(0.90 0.08 50)",  color: "oklch(0.40 0.14 50)" },
    closed_won:   { bg: "oklch(0.90 0.08 145)", color: "oklch(0.35 0.14 145)" },
    closed_lost:  { bg: "oklch(0.92 0.04 0)",   color: "oklch(0.45 0.08 0)" },
  };
  const pipelineLabels = { analysis: "En análisis", proposal: "Propuesta enviada", closed_won: "Cerrado ganado", closed_lost: "Cerrado perdido" };
  const pipeline = isEraMode ? null : cat?.pipeline;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.4)" }} />
      <div style={{
        position: "fixed", zIndex: 301,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(1380px, calc(100vw - 24px))",
        maxHeight: "94vh",
        background: "var(--surface)", borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,.28)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 13, height: 13, background: (isEraMode ? era?.color : cat?.color) || "#ccc", borderRadius: 3, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-1)" }}>
                {isEraMode ? (era?.label || "Sin ERA") : catLabel(cat)}
              </span>
              {!isEraMode && pipeline && pipelineLabels[pipeline] && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px", background: (pipelineColors[pipeline]||{}).bg, color: (pipelineColors[pipeline]||{}).color, flexShrink: 0 }}>
                  {pipelineLabels[pipeline]}
                </span>
              )}
            </div>
            {!isEraMode && eraForCat && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                <span style={{ width: 7, height: 7, background: eraForCat.color, borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>ERA: {eraForCat.label}</span>
              </div>
            )}
            {isEraMode && (() => {
              const clientCats = client.categories.filter(c => c.eraId === categoryId);
              return clientCats.length > 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  {clientCats.map(c => c.label || c.key).join(" · ")}
                </div>
              ) : null;
            })()}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-3)", lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Gasto total", value: fmtMoney(total, client.currency), accent: false },
              { label: "Ahorro potencial", value: savMax > 0 ? `${fmtMoney(savMin, client.currency)} – ${fmtMoney(savMax, client.currency)}` : "—", accent: true },
              { label: "Factibilidad media", value: avgFeas > 0 ? avgFeas.toFixed(1) + " / 5" : "—", accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: accent ? "var(--positive-2)" : "var(--text-1)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Two-column: table left, chart right */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) 1fr", gap: 28, alignItems: "start" }}>
            {/* Suppliers breakdown */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                {expenses.length} línea{expenses.length !== 1 ? "s" : ""} · {suppliers.length} proveedor{suppliers.length !== 1 ? "es" : ""}
              </div>
              <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
                <table className="t" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Subcategoría</th>
                      <th className="right">Monto</th>
                      <th className="right">% Ahorro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e, i) => (
                      <tr key={e.id || i}>
                        <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.supplier || "—"}</td>
                        <td style={{ color: "var(--text-2)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subcategory || "—"}</td>
                        <td className="right tabular" style={{ whiteSpace: "nowrap" }}>{fmtMoney(+e.amount || 0, client.currency)}</td>
                        <td className="right tabular" style={{ whiteSpace: "nowrap", color: +e.savingsPct > 0 ? "var(--positive-2)" : "var(--text-3)" }}>
                          {+e.savingsPct > 0 ? (+e.savingsPct).toFixed(1) + "%" : "—"}
                        </td>
                      </tr>
                    ))}
                    {expenses.length > 1 && (
                      <tr className="totals">
                        <td colSpan={2}>Total</td>
                        <td className="right tabular">{fmtMoney(total, client.currency)}</td>
                        <td className="right tabular">{savMax > 0 ? `${(savMin/total*100).toFixed(1)}%–${(savMax/total*100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Notes */}
              {!isEraMode && cat?.notes && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Notas</div>
                  {cat.notes}
                </div>
              )}
            </div>

            {/* Monthly evolution chart */}
            <div>
              <DrawerEvolution
                expenses={expenses}
                currency={client.currency}
                categoryColor={(isEraMode ? era?.color : cat?.color) || "var(--accent)"}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfilingView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const tierConfig = store.state.tierConfig || DEFAULT_TIER_CONFIG;
  const groups = aggregateByEra(client, eraCategories);
  // Use the sum of ERA groups as total — not totalSpend() — so that
  // the matrix threshold line (volThreshPct = highVolumeAmount/total)
  // is equivalent to the tierFor comparison (g.total >= highVolumeAmount).
  // totalSpend() would include expenses without ERA category, making the
  // denominator larger and shifting the threshold line left.
  const total = groups.reduce((s, g) => s + g.total, 0) || totalSpend(client);
  const totalSav = totalSavings(client);
  const [drawerCatId, setDrawerCatId] = React.useState(null);
  const [showLogic, setShowLogic] = React.useState(false);
  const [activeTier, setActiveTier] = React.useState(null);

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.profiling.none} hint={t.expenses.lede} />;
  }

  const tiers = { A: [], B: [], C: [], D: [] };
  groups.forEach(g => { tiers[tierFor(g, tierConfig)].push(g); });

  const catLabel = (cat) => cat ? (cat.label || cat.key) : "—";

  const maxVolume = Math.max(...groups.map(g => g.total), 1);
  const maxSavings = Math.max(...groups.map(g => g.potentialSavings), 1);

  return (
    <div className="stack lg">
      <div>
        <div className="eyebrow">{t.nav.profiling}</div>
        <h2 className="h2">{t.profiling.title}</h2>
        <p className="lede" style={{ marginTop: 4 }}>{t.profiling.lede}</p>
      </div>

      {/* Tier summary cards */}
      <div className="grid cols-4">
        {["A", "B", "C", "D"].map(tk => {
          const list = tiers[tk];
          const sum = list.reduce((s, g) => s + g.total, 0);
          const savSum = list.reduce((s, g) => s + g.potentialSavings, 0);
          const isActive = activeTier === tk;
          return (
            <div key={tk} className="card" style={{ padding: 16, cursor: list.length > 0 ? "pointer" : "default", outline: isActive ? "2px solid var(--accent)" : "none", outlineOffset: -2 }}
              onClick={() => list.length > 0 && setActiveTier(isActive ? null : tk)}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className={"tier " + tk}>{t.profiling[`tier${tk}`]}</span>
                <span className="spacer" />
                <span className="tabular" style={{ fontSize: 11, color: "var(--text-3)" }}>{list.length}</span>
              </div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
                {fmtMoney(sum, client.currency, { compact: true })}
              </div>
              <div className="tabular" style={{ fontSize: 12, color: "var(--positive-2)", fontWeight: 700, marginTop: 2 }}>
                +{fmtMoney(savSum, client.currency, { compact: true })} {t.profiling.potential.toLowerCase()}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.4 }}>
                {t.profiling.tierExplain[tk]}
              </div>
              {list.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 8, fontWeight: 600 }}>
                  {isActive ? "▲ Ocultar" : "▼ Ver categorías"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tier detail panel */}
      {activeTier && tiers[activeTier].length > 0 && (
        <div className="card flat" style={{ padding: 0, overflow: "hidden", marginTop: -8 }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
            <span className={"tier " + activeTier}>{t.profiling[`tier${activeTier}`]}</span>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>{tiers[activeTier].length} {tiers[activeTier].length === 1 ? "categoría" : "categorías"}</span>
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>{t.expenses.cols.category}</th>
                <th className="right">{t.profiling.volume}</th>
                <th className="right">% gasto</th>
                <th className="right">{t.profiling.savings}</th>
                <th className="right">{t.profiling.potential}</th>
                <th className="right">Factib.</th>
              </tr>
            </thead>
            <tbody>
              {tiers[activeTier].map(g => (
                <tr key={g.categoryId} style={{ cursor: "pointer" }} onClick={() => setDrawerCatId(g.categoryId)}>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td className="right tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency)}</td>
                  <td className="right tabular">{fmtPct(total > 0 ? g.total / total * 100 : 0)}</td>
                  <td className="right tabular">{fmtPct(g.avgSavingsPct)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.potentialSavings, client.currency)}</td>
                  <td className="right"><FeasDots value={Math.round(g.avgFeasibility)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Logic toggle */}
      <div style={{ marginTop: -8 }}>
        <button
          className="btn ghost sm"
          onClick={() => setShowLogic(v => !v)}
          style={{ fontSize: 12, color: "var(--text-3)", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ display: "inline-block", transition: "transform 0.15s", transform: showLogic ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          ¿Cómo se clasifica cada categoría?
        </button>
        {showLogic && (
          <div className="card flat" style={{ marginTop: 8, padding: "16px 20px", background: "var(--surface-2)", fontSize: 13 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ textAlign: "left", padding: "6px 12px 6px 0", fontWeight: 600, fontSize: 12, color: "var(--text-2)" }}>Tier</th>
                  <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, fontSize: 12, color: "var(--text-2)" }}>Condición</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const tc = tierConfig;
                  const fmtAmt = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(0)} MM` : `$${n.toLocaleString()}`;
                  return [
                    { tk: "A", cond: `Gasto ≥ ${fmtAmt(tc.highVolumeAmount)}  ·  ahorro ≥ ${tc.highSavingsPct}%  ·  factibilidad ≥ ${tc.quickWinFeasMin}` },
                    { tk: "B", cond: `Gasto ≥ ${fmtAmt(tc.highVolumeAmount)}  ·  sin cumplir Quick Win` },
                    { tk: "C", cond: `Gasto < ${fmtAmt(tc.highVolumeAmount)}  ·  ahorro ≥ ${tc.highSavingsPct}%  ·  factibilidad ≥ ${tc.lowVolFeasMin}` },
                    { tk: "D", cond: `Gasto < ${fmtAmt(tc.highVolumeAmount)}  ·  ahorro < ${tc.highSavingsPct}%  o  factibilidad < ${tc.lowVolFeasMin}` },
                  ];
                })().map(({ tk, cond }) => (
                  <tr key={tk} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap" }}>
                      <span className={"tier " + tk}>{t.profiling[`tier${tk}`]}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text-2)", lineHeight: 1.5 }}>{cond}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
              La <strong>factibilidad</strong> es el promedio ponderado por monto de todos los gastos de la categoría (escala 1–5).
              El <strong>volumen</strong> es el gasto nominal total de la categoría ERA.
            </div>
          </div>
        )}
      </div>

      {/* Detail table */}
      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h3 className="h3" style={{ margin: 0 }}>{t.dashboard.breakdown}</h3>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>{t.profiling.tier}</th>
              <th>{t.expenses.cols.category}</th>
              <th className="right">{t.profiling.volume}</th>
              <th className="right">% {t.dashboard.currentSpend}</th>
              <th>{t.profiling.volume}</th>
              <th className="right">{t.profiling.suppliers}</th>
              <th className="right">{t.profiling.savings}</th>
              <th className="right">{t.profiling.potential}</th>
              <th>{t.profiling.potential}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => {
              const tk = tierFor(g, tierConfig);
              const share = total > 0 ? (g.total / total) * 100 : 0;
              return (
                <tr key={g.categoryId} style={{ cursor: "pointer" }} onClick={() => setDrawerCatId(g.categoryId)}>
                  <td><span className={"tier " + tk}>{t.profiling[`tier${tk}`]}</span></td>
                  <td>
                    <CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} />
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{g.lines} líneas</div>
                  </td>
                  <td className="right tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency)}</td>
                  <td className="right tabular">{fmtPct(share)}</td>
                  <td style={{ width: 140 }}><Bar value={g.total} max={maxVolume} /></td>
                  <td className="right tabular">{g.suppliers}</td>
                  <td className="right tabular">{fmtPct(g.avgSavingsPct)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.potentialSavings, client.currency)}</td>
                  <td style={{ width: 140 }}><Bar value={g.potentialSavings} max={maxSavings} variant="positive" /></td>
                </tr>
              );
            })}
            <tr className="totals">
              <td></td>
              <td>{t.expenses.total}</td>
              <td className="right">{fmtMoney(total, client.currency)}</td>
              <td className="right">100%</td>
              <td></td>
              <td className="right">{groups.reduce((s, g) => s + g.suppliers, 0)}</td>
              <td className="right">{total > 0 ? fmtPct((totalSav / total) * 100) : "—"}</td>
              <td className="right" style={{ color: "var(--positive-2)" }}>{fmtMoney(totalSav, client.currency)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Volume × savings matrix */}
      <ProfilingMatrix groups={groups} total={total} client={client} tierConfig={tierConfig} onCategoryClick={setDrawerCatId} />

      <CategoryDrawer
        open={drawerCatId != null}
        categoryId={drawerCatId}
        client={client}
        eraCategories={store.state.eraCategories || []}
        onClose={() => setDrawerCatId(null)}
      />
    </div>
  );
}

function ProfilingMatrix({ groups, total, client, tierConfig, onCategoryClick }) {
  const { t } = useI18n();
  const tc = tierConfig || DEFAULT_TIER_CONFIG;
  // Convert nominal volume threshold to % of total for the vertical line
  const volThreshPct = total > 0 ? (tc.highVolumeAmount / total) * 100 : 8;
  const savThreshPct = tc.highSavingsPct;

  const W = 720, H = 420, P = 54;
  // Domain must include both data values AND the threshold lines so dashed lines stay visible
  const maxShare = Math.max(...groups.map(g => total > 0 ? g.total / total * 100 : 0), volThreshPct * 1.15, 20);
  const maxSav = Math.max(...groups.map(g => g.avgSavingsPct), savThreshPct * 1.2, 25);

  const x = (share) => P + (share / maxShare) * (W - P * 2);
  const y = (sav) => H - P - (sav / maxSav) * (H - P * 2);
  const maxTotal = Math.max(...groups.map(g => g.total), 1);
  const r = (spend) => Math.max(6, Math.min(32, 6 + Math.sqrt(spend / maxTotal) * 26));
  const feasColor = (f) => f >= 4 ? "#2f7d63" : f >= 3 ? "#c8861a" : "#c0392b";

  // Label: above if cy > H*0.55 (bubble is in lower part), below if near top
  const labelPos = (cy, radius) => cy > H * 0.55 ? "above" : "below";

  // ── Feasibility filter ──────────────────────────────────────────
  const [feasFilter, setFeasFilter] = React.useState(null); // null|"high"|"med"|"low"
  const visibleGroups = feasFilter == null ? groups
    : feasFilter === "high" ? groups.filter(g => g.avgFeasibility >= 4)
    : feasFilter === "med"  ? groups.filter(g => g.avgFeasibility >= 3 && g.avgFeasibility < 4)
    : groups.filter(g => g.avgFeasibility < 3);

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h3 className="h3" style={{ margin: 0 }}>Matriz volumen × ahorro</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "var(--text-3)" }}>
          <span>● tamaño = gasto total</span>
          {/* Feasibility filter chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ marginRight: 2 }}>Factibilidad:</span>
            {[
              { key: null,   c: "var(--line)",  label: "Todas" },
              { key: "high", c: "#2f7d63",      label: "Factible (4–5)" },
              { key: "med",  c: "#c8861a",      label: "Probable (3)" },
              { key: "low",  c: "#c0392b",      label: "Fuera (1–2)" },
            ].map(f => {
              const active = feasFilter === f.key;
              return (
                <button key={String(f.key)} onClick={() => setFeasFilter(active ? null : f.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 12, cursor: "pointer", fontSize: 10,
                    fontWeight: active ? 700 : 400,
                    border: `1.5px solid ${active ? f.c : "var(--line)"}`,
                    background: active ? f.c + "22" : "transparent",
                    color: active ? f.c : "var(--text-3)",
                    transition: "all 0.15s",
                  }}>
                  {f.key && <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}><circle cx="4" cy="4" r="3" fill="none" stroke={f.c} strokeWidth="1.8"/></svg>}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Axes */}
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="var(--line)" />
        {/* Threshold lines + value labels */}
        <line x1={x(volThreshPct)} y1={P} x2={x(volThreshPct)} y2={H - P} stroke="var(--text-3)" strokeDasharray="4 3" strokeWidth="1" />
        <text x={x(volThreshPct)} y={P - 4} textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="Trebuchet MS" fontStyle="italic">
          {fmtMoney(tc.highVolumeAmount, client.currency, { compact: true })}
        </text>
        <line x1={P} y1={y(savThreshPct)} x2={W - P} y2={y(savThreshPct)} stroke="var(--text-3)" strokeDasharray="4 3" strokeWidth="1" />
        <text x={W - P + 4} y={y(savThreshPct) + 3} textAnchor="start" fontSize="9" fill="var(--text-3)" fontFamily="Trebuchet MS" fontStyle="italic">
          {tc.highSavingsPct}%
        </text>
        {/* Axis labels */}
        <text x={W / 2} y={H - 10} fontSize="11" fill="var(--text-2)" textAnchor="middle" fontFamily="Trebuchet MS" fontWeight="700">% del gasto total →</text>
        <text x={14} y={H / 2} fontSize="11" fill="var(--text-2)" textAnchor="middle" fontFamily="Trebuchet MS" fontWeight="700" transform={`rotate(-90 14 ${H / 2})`}>% ahorro estimado →</text>
        {/* Tick marks */}
        {[0, 5, 10, 15, 20].filter(v => v <= maxShare).map(v => (
          <g key={"x" + v}>
            <line x1={x(v)} y1={H - P} x2={x(v)} y2={H - P + 4} stroke="var(--text-3)" />
            <text x={x(v)} y={H - P + 15} fontSize="9" fill="var(--text-3)" textAnchor="middle" fontFamily="Trebuchet MS">{v}%</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25].filter(v => v <= maxSav).map(v => (
          <g key={"y" + v}>
            <line x1={P - 4} y1={y(v)} x2={P} y2={y(v)} stroke="var(--text-3)" />
            <text x={P - 6} y={y(v) + 3} fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="Trebuchet MS">{v}%</text>
          </g>
        ))}
        {/* Bubbles — render in two passes: circles first, then labels on top */}
        {visibleGroups.map(g => {
          const share = total > 0 ? g.total / total * 100 : 0;
          const bx = x(share), by = y(g.avgSavingsPct);
          const radius = r(g.total);
          const tk = tierFor(g, tc);
          const fullName = t.categories[g.category?.key] || g.category?.label || g.category?.key || "—";
          return (
            <circle
              key={"c-" + g.categoryId}
              cx={bx} cy={by} r={radius}
              fill={g.category?.color || "#ccc"} fillOpacity="0.75"
              stroke={feasColor(g.avgFeasibility)} strokeWidth="3"
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
              onClick={() => onCategoryClick && onCategoryClick(g.categoryId)}
            >
              <title>{fullName} [{t.profiling[`tier${tk}`]}]: {fmtMoney(g.total, client.currency, { compact: true })} · {fmtPct(g.avgSavingsPct)} ahorro · factibilidad {g.avgFeasibility.toFixed(1)}</title>
            </circle>
          );
        })}
        {/* Labels pass — on top of all circles */}
        {visibleGroups.map(g => {
          const share = total > 0 ? g.total / total * 100 : 0;
          const bx = x(share), by = y(g.avgSavingsPct);
          const radius = r(g.total);
          if (radius <= 8) return null;
          const tk = tierFor(g, tc);
          const fullName = t.categories[g.category?.key] || g.category?.label || g.category?.key || "—";
          const shortName = fullName.length > 15 ? fullName.slice(0, 13) + "…" : fullName;
          const isAbove = labelPos(by, radius) === "above";
          const labelY = isAbove ? by - radius - 5 : by + radius + 13;
          const labelAnchor = bx < W * 0.15 ? "start" : bx > W * 0.85 ? "end" : "middle";
          const TIER_COLORS = { A: "#b8893a", B: "#0F2724", C: "#2A5FA5", D: "#888" };
          const bgW = shortName.length * 5 + 14, bgH = 13;
          const bgX = labelAnchor === "start" ? bx - 2 : labelAnchor === "end" ? bx - bgW + 2 : bx - bgW / 2;
          const bgY = isAbove ? labelY - bgH + 3 : labelY - bgH + 2;
          return (
            <g key={"l-" + g.categoryId}
               style={{ cursor: onCategoryClick ? "pointer" : "default" }}
               onClick={() => onCategoryClick && onCategoryClick(g.categoryId)}>
              <rect x={bgX} y={bgY} width={bgW} height={bgH} rx={2} fill="var(--surface)" fillOpacity="0.92" />
              <rect x={bgX} y={bgY} width={4} height={bgH} rx={2} fill={TIER_COLORS[tk] || "#888"} />
              <text x={bgX + 7} y={labelY - 1} fontSize="9" fill="var(--ink)"
                textAnchor="start" fontFamily="Trebuchet MS" fontWeight="600">
                {shortName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

Object.assign(window, { ProfilingView, ProfilingMatrix, MiniSparkline, CategoryDrawer });
