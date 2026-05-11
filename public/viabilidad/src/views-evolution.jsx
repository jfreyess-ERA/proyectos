/* ============================================================
   Evolution view: 12-month time series
   ============================================================ */

function EvolutionView({ client }) {
  const { t, lang } = useI18n();
  const n = periodCount(client);
  const months = periodLabels(n, lang);
  const groups = monthlyByCategory(client);
  const totals = monthlyTotals(client);
  const total = totals.reduce((a, b) => a + b, 0);

  const [chartType, setChartType] = React.useState("stacked");
  const [selectedCats, setSelectedCats] = React.useState(null); // null => all
  const [trendType, setTrendType] = React.useState("linear"); // none|linear|ma3|exp|poly
  const [showTrendOnTotal, setShowTrendOnTotal] = React.useState(true);
  const [showTrendOnLines, setShowTrendOnLines] = React.useState(false);

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

  const isOn = (id) => selectedCats == null || selectedCats.includes(id);
  const toggleCat = (id) => {
    const cur = selectedCats == null ? groups.map(g => g.categoryId) : selectedCats;
    setSelectedCats(cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]);
  };

  const visibleGroups = groups.filter(g => isOn(g.categoryId));
  const visibleTotals = months.map((_, m) => visibleGroups.reduce((s, g) => s + g.months[m], 0));

  const avg = total / 12;
  const peak = Math.max(...totals);
  const low = Math.min(...totals);
  const peakIdx = totals.indexOf(peak);
  const lowIdx = totals.indexOf(low);
  const trend = totals[0] > 0 ? ((totals[totals.length - 1] - totals[0]) / totals[0]) * 100 : 0;

  const catLabel = (cat) => cat ? (t.categories[cat.key] || cat.key) : "—";

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.nav.evolution}</div>
          <h2 className="h2">{t.evolution.title}</h2>
          <p className="lede" style={{ marginTop: 4 }}>{t.evolution.lede}</p>
        </div>
        <div className="btn-row no-print">
          <button className="btn" onClick={() => window.print()}>⎙ {t.actions.print}</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4">
        <Stat label={t.evolution.avgMonth} value={fmtMoney(avg, client.currency, { compact: true })} sub={`${fmtMoney(total, client.currency, { compact: true })} total`} variant="dark" />
        <Stat label={t.evolution.peakMonth} value={fmtMoney(peak, client.currency, { compact: true })} sub={months[peakIdx]} />
        <Stat label={t.evolution.lowMonth} value={fmtMoney(low, client.currency, { compact: true })} sub={months[lowIdx]} />
        <Stat
          label={t.evolution.yoyTrend}
          value={(trend >= 0 ? "+" : "") + fmtPct(trend, 1)}
          sub={t.evolution.lastVsFirst}
          variant={Math.abs(trend) > 10 ? "accent" : ""}
        />
      </div>

      {/* Trendline controls */}
      <div className="card flat" style={{ background: "var(--surface-2)", padding: "12px 16px" }}>
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700, marginRight: 4 }}>
            {lang === "en" ? "Trend line" : "Línea de tendencia"}:
          </span>
          {[
            { id: "none", label: lang === "en" ? "None" : "Ninguna" },
            { id: "linear", label: lang === "en" ? "Linear" : "Lineal" },
            { id: "ma3", label: lang === "en" ? "Moving avg (3)" : "Media móvil (3)" },
            { id: "exp", label: lang === "en" ? "Exponential" : "Exponencial" },
            { id: "poly", label: lang === "en" ? "Polynomial (2)" : "Polinómica (2)" },
          ].map(opt => (
            <button key={opt.id}
                    className={"btn sm " + (trendType === opt.id ? "" : "ghost")}
                    onClick={() => setTrendType(opt.id)}>
              {opt.label}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showTrendOnTotal} onChange={e => setShowTrendOnTotal(e.target.checked)} />
            {lang === "en" ? "On total" : "Sobre total"}
          </label>
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showTrendOnLines} onChange={e => setShowTrendOnLines(e.target.checked)} />
            {lang === "en" ? "Per category" : "Por categoría"}
          </label>
        </div>
      </div>

      {/* Total line chart */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="h3" style={{ margin: 0 }}>{t.evolution.total}</h3>
          <Pill variant={trend >= 0 ? "warning" : "positive"}>
            {trend >= 0 ? "↑" : "↓"} {fmtPct(Math.abs(trend), 1)}
          </Pill>
        </div>
        <LineChart
          months={months}
          series={[
            { name: t.evolution.total, values: totals, color: "var(--ink)", fill: true },
            ...(showTrendOnTotal && trendType !== "none" ? [{
              name: trendLabel(trendType, lang),
              values: computeTrend(totals, trendType),
              color: "#FF9C00",
              fill: false,
              dashed: true,
            }] : []),
          ]}
          currency={client.currency}
          showLegend={showTrendOnTotal && trendType !== "none"}
        />
      </div>

      {/* Chart switcher */}
      <Tabs
        active={chartType}
        onChange={setChartType}
        tabs={[
          { id: "stacked", label: t.evolution.stacked },
          { id: "lines", label: t.evolution.lines },
        ]}
      />

      {/* Category filter */}
      <div className="card flat" style={{ background: "var(--surface-2)", padding: "12px 16px" }}>
        <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700, marginRight: 4 }}>
            {t.evolution.filter}:
          </span>
          <button className="btn ghost sm" onClick={() => setSelectedCats(null)}>{t.evolution.all}</button>
          <button className="btn ghost sm" onClick={() => setSelectedCats([])}>{t.evolution.none}</button>
          <span style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
          {groups.map(g => {
            const on = isOn(g.categoryId);
            return (
              <button
                key={g.categoryId}
                className="btn sm"
                onClick={() => toggleCat(g.categoryId)}
                style={{
                  background: on ? g.category?.color || "var(--ink)" : "var(--surface)",
                  color: on ? "#fff" : "var(--text-2)",
                  borderColor: on ? g.category?.color || "var(--ink)" : "var(--line)",
                  opacity: on ? 1 : 0.6,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.category?.color || "#ccc", display: on ? "none" : "inline-block" }} />
                {catLabel(g.category)}
              </button>
            );
          })}
        </div>
      </div>

      {chartType === "stacked" && (
        <div className="card">
          <h3 className="h3">{t.evolution.stacked}</h3>
          <StackedAreaChart months={months} groups={visibleGroups} currency={client.currency} catLabel={catLabel} />
        </div>
      )}

      {chartType === "lines" && (
        <div className="card">
          <h3 className="h3">{t.evolution.lines}</h3>
          <LineChart
            months={months}
            series={[
              ...visibleGroups.map(g => ({
                name: catLabel(g.category),
                values: g.months,
                color: g.category?.color || "#888",
                fill: false,
              })),
              ...(showTrendOnLines && trendType !== "none" ? visibleGroups.map(g => ({
                name: catLabel(g.category) + " · " + trendLabel(trendType, lang),
                values: computeTrend(g.months, trendType),
                color: g.category?.color || "#888",
                fill: false,
                dashed: true,
              })) : []),
            ]}
            currency={client.currency}
            showLegend
          />
        </div>
      )}

      {/* Per-category sparklines */}
      <div className="card">
        <h3 className="h3">{t.dashboard.breakdown}</h3>
        <table className="t">
          <thead><tr>
            <th>{t.expenses.cols.category}</th>
            <th>12 meses</th>
            <th className="right">{t.evolution.avgMonth}</th>
            <th className="right">{t.evolution.peakMonth}</th>
            <th className="right">{t.evolution.yoyTrend}</th>
            <th className="right">Total</th>
          </tr></thead>
          <tbody>
            {groups.map(g => {
              const gAvg = g.total / 12;
              const gPeak = Math.max(...g.months);
              const gPeakIdx = g.months.indexOf(gPeak);
              const gTrend = g.months[0] > 0 ? ((g.months[11] - g.months[0]) / g.months[0]) * 100 : 0;
              return (
                <tr key={g.categoryId}>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td style={{ width: 200 }}>
                    <Sparkline values={g.months} color={g.category?.color || "var(--ink)"} />
                  </td>
                  <td className="right tabular">{fmtMoney(gAvg, client.currency, { compact: true })}</td>
                  <td className="right tabular">{fmtMoney(gPeak, client.currency, { compact: true })} <span style={{ fontSize: 10, color: "var(--text-3)" }}>{months[gPeakIdx]}</span></td>
                  <td className="right tabular" style={{ color: gTrend >= 0 ? "var(--warning)" : "var(--positive-2)", fontWeight: 700 }}>
                    {gTrend >= 0 ? "↑" : "↓"} {fmtPct(Math.abs(gTrend), 1)}
                  </td>
                  <td className="right tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency, { compact: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineChart({ months, series, currency = "EUR", showLegend = false }) {
  const W = 900, H = 320, P = { l: 70, r: 24, t: 16, b: 36 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;

  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1);
  const min = 0;

  const x = (i) => P.l + (i / 11) * innerW;
  const y = (v) => P.t + innerH - ((v - min) / (max - min)) * innerH;

  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i);

  const pathFor = (vals) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaFor = (vals) => pathFor(vals) + ` L${x(11)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Grid */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} y1={y(v)} x2={W - P.r} y2={y(v)} stroke="var(--line-soft)" strokeDasharray={i === 0 ? "" : "2 3"} />
            <text x={P.l - 8} y={y(v) + 3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="Trebuchet MS">
              {fmtMoney(v, currency, { compact: true })}
            </text>
          </g>
        ))}
        {/* X labels */}
        {months.map((m, i) => (
          <text key={i} x={x(i)} y={H - P.b + 16} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Trebuchet MS">{m}</text>
        ))}
        {/* Series */}
        {series.map((s, si) => (
          <g key={si}>
            {s.fill && (
              <path d={areaFor(s.values)} fill={s.color} fillOpacity="0.10" />
            )}
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={s.dashed ? "2" : "2"}
                  strokeDasharray={s.dashed ? "6 4" : ""}
                  strokeLinejoin="round" opacity={s.dashed ? 0.9 : 1} />
            {!s.dashed && s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color}>
                <title>{months[i]}: {fmtMoney(v, currency)}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {showLegend && series.length > 0 && (
        <div className="row wrap" style={{ marginTop: 8, gap: 14 }}>
          {series.map((s, i) => (
            <span key={i} style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 16, height: 0, borderTop: `2px ${s.dashed ? "dashed" : "solid"} ${s.color}`,
                display: "inline-block",
              }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Trend lines
// ============================================================
function trendLabel(type, lang) {
  const en = lang === "en";
  return ({
    linear: en ? "Linear trend" : "Tendencia lineal",
    ma3:    en ? "Moving avg (3)" : "Media móvil (3)",
    exp:    en ? "Exponential trend" : "Tendencia exponencial",
    poly:   en ? "Polynomial (2)" : "Polinómica (2)",
  })[type] || "";
}

function computeTrend(values, type) {
  const n = values.length;
  if (n === 0) return values;
  if (type === "ma3") {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let s = 0, c = 0;
      for (let j = a; j <= b; j++) { s += values[j]; c++; }
      out.push(s / c);
    }
    return out;
  }
  // Linear: y = a + b·x
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  if (type === "linear") {
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (values[i] - meanY); den += (xs[i] - meanX) ** 2; }
    const b = den === 0 ? 0 : num / den;
    const a = meanY - b * meanX;
    return xs.map(x => a + b * x);
  }
  if (type === "exp") {
    // y = a * e^(b·x) -> ln(y) = ln(a) + b·x
    const safe = values.map(v => v > 0 ? v : Math.max(1, meanY * 0.01));
    const ly = safe.map(v => Math.log(v));
    const meanLY = ly.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (ly[i] - meanLY); den += (xs[i] - meanX) ** 2; }
    const b = den === 0 ? 0 : num / den;
    const lnA = meanLY - b * meanX;
    return xs.map(x => Math.exp(lnA + b * x));
  }
  if (type === "poly") {
    // Quadratic least squares y = a + b·x + c·x²
    // Solve normal equations via 3x3 matrix
    let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = values[i];
      S1 += x; S2 += x*x; S3 += x*x*x; S4 += x*x*x*x;
      T0 += y; T1 += x*y; T2 += x*x*y;
    }
    // Solve 3x3
    const M = [[S0, S1, S2, T0], [S1, S2, S3, T1], [S2, S3, S4, T2]];
    for (let i = 0; i < 3; i++) {
      let piv = M[i][i];
      if (Math.abs(piv) < 1e-12) continue;
      for (let j = i; j < 4; j++) M[i][j] /= piv;
      for (let k = 0; k < 3; k++) {
        if (k === i) continue;
        const f = M[k][i];
        for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
      }
    }
    const a = M[0][3], b = M[1][3], c = M[2][3];
    return xs.map(x => a + b * x + c * x * x);
  }
  return values;
}

function StackedAreaChart({ months, groups, currency, catLabel }) {
  const W = 900, H = 360, P = { l: 70, r: 24, t: 16, b: 36 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;

  // Build stacked layers
  const stacks = months.map((_, m) => {
    let cumulative = 0;
    return groups.map(g => {
      const lo = cumulative;
      cumulative += g.months[m];
      return { lo, hi: cumulative };
    });
  });

  const max = Math.max(...stacks.map(layer => layer.length > 0 ? layer[layer.length - 1].hi : 0), 1);
  const x = (i) => P.l + (i / 11) * innerW;
  const y = (v) => P.t + innerH - (v / max) * innerH;

  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i);

  // Each group's path: top edge forward then bottom edge backward
  const groupPaths = groups.map((g, gi) => {
    const top = stacks.map((layer, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(layer[gi].hi).toFixed(1)}`).join(" ");
    const bottom = stacks.map((layer, m) => `L${x(11 - m).toFixed(1)},${y(stacks[11 - m][gi].lo).toFixed(1)}`).join(" ");
    return top + " " + bottom + " Z";
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} y1={y(v)} x2={W - P.r} y2={y(v)} stroke="var(--line-soft)" strokeDasharray={i === 0 ? "" : "2 3"} />
            <text x={P.l - 8} y={y(v) + 3} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="Trebuchet MS">
              {fmtMoney(v, currency, { compact: true })}
            </text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={i} x={x(i)} y={H - P.b + 16} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Trebuchet MS">{m}</text>
        ))}
        {groups.map((g, gi) => (
          <path key={g.categoryId} d={groupPaths[gi]}
                fill={g.category?.color || "#888"} fillOpacity="0.85"
                stroke="var(--surface)" strokeWidth="0.5" />
        ))}
      </svg>
      <div className="row wrap" style={{ marginTop: 12, gap: 12 }}>
        {groups.map(g => (
          <span key={g.categoryId} style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: g.category?.color || "#ccc", borderRadius: 2 }} />
            {catLabel(g.category)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ values, color = "currentColor", w = 180, h = 32 }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i) => (i / (values.length - 1)) * w;
  const y = (v) => h - ((v - min) / (max - min || 1)) * h;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = path + ` L${x(values.length - 1)},${h} L${x(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, display: "block" }}>
      <path d={area} fill={color} fillOpacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

Object.assign(window, { EvolutionView, LineChart, StackedAreaChart, Sparkline, computeTrend, trendLabel });
