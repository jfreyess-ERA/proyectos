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
        return cc?.eraId === categoryId;
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
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.25)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 301,
        width: "min(520px, calc(100vw - 48px))",
        background: "var(--surface)", borderLeft: "1px solid var(--line)",
        boxShadow: "-8px 0 40px rgba(0,0,0,.18)",
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
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Gasto total", value: fmtMoney(total, client.currency, { compact: true }), accent: false },
              { label: "Ahorro potencial", value: savMax > 0 ? `${fmtMoney(savMin, client.currency, { compact: true })} – ${fmtMoney(savMax, client.currency, { compact: true })}` : "—", accent: true },
              { label: "Factibilidad media", value: avgFeas > 0 ? avgFeas.toFixed(1) + " / 5" : "—", accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: accent ? "var(--positive-2)" : "var(--text-1)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Monthly sparkline */}
          {monthlyData.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
                Evolución mensual · {monthlyData.length} períodos
              </div>
              <MiniSparkline data={monthlyData} currency={client.currency} color={(isEraMode ? era?.color : cat?.color) || "var(--accent)"} />
            </div>
          )}

          {/* Suppliers breakdown */}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
            {expenses.length} línea{expenses.length !== 1 ? "s" : ""} · {suppliers.length} proveedor{suppliers.length !== 1 ? "es" : ""}
          </div>
          <div className="card flat" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
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
                    <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.supplier || "—"}</td>
                    <td style={{ color: "var(--text-2)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subcategory || "—"}</td>
                    <td className="right tabular">{fmtMoney(+e.amount || 0, client.currency)}</td>
                    <td className="right tabular" style={{ color: +e.savingsPct > 0 ? "var(--positive-2)" : "var(--text-3)" }}>
                      {+e.savingsPct > 0 ? (+e.savingsPct).toFixed(1) + "%" : "—"}
                    </td>
                  </tr>
                ))}
                {expenses.length > 1 && (
                  <tr className="totals">
                    <td colSpan={2}>Total</td>
                    <td className="right tabular">{fmtMoney(total, client.currency)}</td>
                    <td className="right tabular">{avgSavPct > 0 ? avgSavPct.toFixed(1) + "%" : "—"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Notes — client category mode only */}
          {!isEraMode && cat?.notes && (
            <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Notas</div>
              {cat.notes}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProfilingView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const groups = aggregateByEra(client, eraCategories);
  const total = totalSpend(client);
  const totalSav = totalSavings(client);
  const [drawerCatId, setDrawerCatId] = React.useState(null);

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.profiling.none} hint={t.expenses.lede} />;
  }

  const tiers = { A: [], B: [], C: [], D: [] };
  groups.forEach(g => { tiers[tierFor(g, total)].push(g); });

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
                +{fmtMoney(savSum, client.currency, { compact: true })} {t.profiling.potential.toLowerCase()}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, lineHeight: 1.4 }}>
                {t.profiling.tierExplain[tk]}
              </div>
            </div>
          );
        })}
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
              const tk = tierFor(g, total);
              const share = total > 0 ? (g.total / total) * 100 : 0;
              return (
                <tr key={g.categoryId} style={{ cursor: "pointer" }} onClick={() => setDrawerCatId(g.categoryId)}>
                  <td><span className={"tier " + tk}>{tk}</span></td>
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
      <ProfilingMatrix groups={groups} total={total} client={client} onCategoryClick={setDrawerCatId} />

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

function ProfilingMatrix({ groups, total, client, onCategoryClick }) {
  const { t } = useI18n();
  const W = 720, H = 420, P = 54;
  const maxShare = Math.max(...groups.map(g => total > 0 ? g.total / total * 100 : 0), 20);
  const maxSav = Math.max(...groups.map(g => g.avgSavingsPct), 25);

  const x = (share) => P + (share / maxShare) * (W - P * 2);
  const y = (sav) => H - P - (sav / maxSav) * (H - P * 2);
  const r = (vol) => Math.max(6, Math.min(28, 6 + Math.sqrt(vol / 1000) * 0.8));

  // Label: above if cy > H*0.55 (bubble is in lower part), below if near top
  const labelPos = (cy, radius) => cy > H * 0.55 ? "above" : "below";

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h3 className="h3" style={{ margin: 0 }}>Matriz volumen × ahorro</h3>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>● tamaño = ahorro potencial · clic para detalle</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Quadrant fills */}
        <rect x={x(8)} y={P} width={W - P - x(8)} height={y(10) - P} fill="rgba(184,137,58,0.08)" />
        <rect x={x(8)} y={y(10)} width={W - P - x(8)} height={H - P - y(10)} fill="rgba(15,39,36,0.04)" />
        {/* Axes */}
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="var(--line)" />
        {/* Threshold lines */}
        <line x1={x(8)} y1={P} x2={x(8)} y2={H - P} stroke="var(--line)" strokeDasharray="3 3" />
        <line x1={P} y1={y(10)} x2={W - P} y2={y(10)} stroke="var(--line)" strokeDasharray="3 3" />
        {/* Quadrant labels */}
        <text x={x(8) + 8} y={P + 16} fontSize="10" fill="var(--champagne-2)" fontWeight="700" fontFamily="Trebuchet MS">QUICK WIN</text>
        <text x={P + 6} y={P + 16} fontSize="10" fill="var(--text-3)" fontFamily="Trebuchet MS">BAJO IMPACTO</text>
        <text x={x(8) + 8} y={H - P - 8} fontSize="10" fill="var(--text-3)" fontFamily="Trebuchet MS">ESTRATÉGICA</text>
        <text x={P + 6} y={H - P - 8} fontSize="10" fill="var(--text-3)" fontFamily="Trebuchet MS">DESCARTAR</text>
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
        {groups.map(g => {
          const share = total > 0 ? g.total / total * 100 : 0;
          const cx = x(share), cy = y(g.avgSavingsPct);
          const radius = r(g.potentialSavings);
          const fullName = t.categories[g.category?.key] || g.category?.label || g.category?.key || "—";
          return (
            <circle
              key={"c-" + g.categoryId}
              cx={cx} cy={cy} r={radius}
              fill={g.category?.color || "#ccc"} fillOpacity="0.80"
              stroke={g.category?.color || "#ccc"} strokeWidth="1.5"
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
              onClick={() => onCategoryClick && onCategoryClick(g.categoryId)}
            >
              <title>{fullName}: {fmtMoney(g.total, client.currency, { compact: true })} · {fmtPct(g.avgSavingsPct)} ahorro</title>
            </circle>
          );
        })}
        {/* Labels pass — on top of all circles */}
        {groups.map(g => {
          const share = total > 0 ? g.total / total * 100 : 0;
          const cx = x(share), cy = y(g.avgSavingsPct);
          const radius = r(g.potentialSavings);
          if (radius <= 8) return null;
          const fullName = t.categories[g.category?.key] || g.category?.label || g.category?.key || "—";
          const shortName = fullName.length > 15 ? fullName.slice(0, 13) + "…" : fullName;
          const isAbove = labelPos(cy, radius) === "above";
          const labelY = isAbove ? cy - radius - 5 : cy + radius + 13;
          const labelAnchor = cx < W * 0.15 ? "start" : cx > W * 0.85 ? "end" : "middle";
          const bgW = shortName.length * 6 + 8, bgH = 13;
          const bgX = labelAnchor === "start" ? cx - 2 : labelAnchor === "end" ? cx - bgW + 2 : cx - bgW / 2;
          const bgY = isAbove ? labelY - bgH + 3 : labelY - bgH + 2;
          return (
            <g key={"l-" + g.categoryId}
               style={{ cursor: onCategoryClick ? "pointer" : "default" }}
               onClick={() => onCategoryClick && onCategoryClick(g.categoryId)}>
              <rect x={bgX} y={bgY} width={bgW} height={bgH} rx={2} fill="var(--surface)" fillOpacity="0.88" />
              <text x={cx} y={labelY} fontSize="10" fill="var(--ink)" textAnchor={labelAnchor} fontFamily="Trebuchet MS" fontWeight="600">
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
