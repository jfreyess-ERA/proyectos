/* ============================================================
   Profiling view: feasibility of optimization per category
   ============================================================ */

function ProfilingView({ client }) {
  const { t } = useI18n();
  const groups = aggregateByCategory(client);
  const total = totalSpend(client);
  const totalSav = totalSavings(client);

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.profiling.none} hint={t.expenses.lede} />;
  }

  const tiers = { A: [], B: [], C: [], D: [] };
  groups.forEach(g => { tiers[tierFor(g, total)].push(g); });

  const catLabel = (cat) => cat ? (t.categories[cat.key] || cat.key) : "—";

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
                <tr key={g.categoryId}>
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
      <ProfilingMatrix groups={groups} total={total} client={client} />
    </div>
  );
}

function ProfilingMatrix({ groups, total, client }) {
  const { t } = useI18n();
  const W = 720, H = 420, P = 50;
  const maxShare = Math.max(...groups.map(g => total > 0 ? g.total / total * 100 : 0), 20);
  const maxSav = Math.max(...groups.map(g => g.avgSavingsPct), 25);

  const x = (share) => P + (share / maxShare) * (W - P * 2);
  const y = (sav) => H - P - (sav / maxSav) * (H - P * 2);
  const r = (vol) => 6 + Math.sqrt(vol / 1000) * 0.8;

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h3 className="h3" style={{ margin: 0 }}>Matriz volumen × ahorro</h3>
        <div className="row" style={{ gap: 14, fontSize: 11, color: "var(--text-3)" }}>
          <span>● tamaño = ahorro potencial</span>
        </div>
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
        <text x={x(8) + 8} y={P + 16} fontSize="11" fill="var(--champagne-2)" fontWeight="700" fontFamily="Trebuchet MS">QUICK WIN</text>
        <text x={P + 8} y={P + 16} fontSize="11" fill="var(--text-3)" fontFamily="Trebuchet MS">BAJO IMPACTO</text>
        <text x={x(8) + 8} y={H - P - 6} fontSize="11" fill="var(--text-3)" fontFamily="Trebuchet MS">ESTRATÉGICA</text>
        <text x={P + 8} y={H - P - 6} fontSize="11" fill="var(--text-3)" fontFamily="Trebuchet MS">DESCARTAR</text>

        {/* Axis labels */}
        <text x={W / 2} y={H - 12} fontSize="11" fill="var(--text-2)" textAnchor="middle" fontFamily="Trebuchet MS" fontWeight="700">% del gasto total →</text>
        <text x={14} y={H / 2} fontSize="11" fill="var(--text-2)" textAnchor="middle" fontFamily="Trebuchet MS" fontWeight="700" transform={`rotate(-90 14 ${H / 2})`}>% ahorro estimado →</text>

        {/* Tick marks */}
        {[0, 5, 10, 15, 20].map(v => v <= maxShare && (
          <g key={"x"+v}>
            <line x1={x(v)} y1={H - P} x2={x(v)} y2={H - P + 4} stroke="var(--text-3)" />
            <text x={x(v)} y={H - P + 16} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Trebuchet MS">{v}%</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25].map(v => v <= maxSav && (
          <g key={"y"+v}>
            <line x1={P - 4} y1={y(v)} x2={P} y2={y(v)} stroke="var(--text-3)" />
            <text x={P - 8} y={y(v) + 3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="Trebuchet MS">{v}%</text>
          </g>
        ))}

        {/* Bubbles */}
        {groups.map(g => {
          const share = total > 0 ? g.total / total * 100 : 0;
          const cx = x(share), cy = y(g.avgSavingsPct);
          return (
            <g key={g.categoryId}>
              <circle cx={cx} cy={cy} r={r(g.potentialSavings)} fill={g.category?.color || "#ccc"} fillOpacity="0.75" stroke={g.category?.color || "#ccc"} strokeWidth="1.5" />
              <text x={cx} y={cy - r(g.potentialSavings) - 4} fontSize="10" fill="var(--ink)" textAnchor="middle" fontFamily="Trebuchet MS" fontWeight="700">
                {(t.categories[g.category?.key] || g.category?.key || "").slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

Object.assign(window, { ProfilingView, ProfilingMatrix });
