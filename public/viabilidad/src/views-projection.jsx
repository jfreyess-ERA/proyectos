/* ============================================================
   Projection (Lámina 7) + Resources (Lámina 8) + Gantt (Lámina 9)
   ============================================================ */

function ProjectionView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const sc = { feePct: 30, feePctOnSavings: 50, feeMonths: 36, projectionYears: 5, includedCategories: null, ...(client.scenario || {}) };
  const groups = aggregateByCategory(client);
  const total = totalSpend(client);

  const included = sc.includedCategories;
  const isIncluded = (catId) => included == null || included.includes(catId);

  const set = (patch) => store.updateClient(client.id, { scenario: { ...sc, ...patch } });

  if (groups.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }

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

  const catLabel = (cat) => cat ? (t.categories[cat.key] || cat.key) : "—";

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
      <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }} className="row between">
          <div>
            <div className="eyebrow">Tabla resumen</div>
            <h3 className="h3" style={{ margin: 0 }}>Factibilidad y proyección de ahorros (anuales)</h3>
          </div>
          <Pill variant="champagne">{inc.length} / {groups.length}</Pill>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th></th>
              <th>{t.projection.cuentas}</th>
              <th className="right">{t.projection.gasto}</th>
              <th className="right">{t.projection.min} %</th>
              <th className="right">{t.projection.max} %</th>
              <th className="right">{t.projection.feas}</th>
              <th className="right">{t.projection.min}</th>
              <th className="right">{t.projection.avg}</th>
              <th className="right">{t.projection.max}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => {
              const included = isIncluded(g.categoryId);
              return (
                <tr key={g.categoryId} style={{ opacity: included ? 1 : 0.45 }}>
                  <td style={{ paddingLeft: 16 }}>
                    <input type="checkbox" checked={included} onChange={() => {
                      const cur = sc.includedCategories == null ? groups.map(x => x.categoryId) : sc.includedCategories;
                      const next = cur.includes(g.categoryId) ? cur.filter(c => c !== g.categoryId) : [...cur, g.categoryId];
                      set({ includedCategories: next });
                    }} />
                  </td>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td className="right tabular" style={{ fontWeight: 700 }}>{fmtMoney(g.total, client.currency)}</td>
                  <td className="right tabular">{fmtPct(g.avgMinPct)}</td>
                  <td className="right tabular">{fmtPct(g.avgMaxPct)}</td>
                  <td className="right"><FeasDots value={Math.round(g.avgFeasibility)} /></td>
                  <td className="right tabular" style={{ color: "var(--text-2)" }}>{fmtMoney(g.minSavings, client.currency)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.potentialSavings, client.currency)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.maxSavings, client.currency)}</td>
                </tr>
              );
            })}
            <tr className="totals">
              <td></td>
              <td>{t.expenses.total}</td>
              <td className="right">{fmtMoney(total, client.currency)}</td>
              <td className="right">—</td>
              <td className="right">—</td>
              <td className="right">—</td>
              <td className="right">{fmtMoney(sumMin, client.currency)}</td>
              <td className="right" style={{ color: "var(--positive-2)" }}>{fmtMoney(sumAvg, client.currency)}</td>
              <td className="right" style={{ color: "var(--positive-2)" }}>{fmtMoney(sumMax, client.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Edit ranges per expense line */}
      <RangeEditor client={client} />

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
      <ProfilingMatrix groups={groups} total={total} client={client} />

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
    </div>
  );
}

function RangeEditor({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const update = (idx, patch) => {
    const next = client.expenses.map((e, i) => i === idx ? { ...e, ...patch } : e);
    store.setExpenses(client.id, next);
  };
  const catLabel = (catId) => {
    const cat = client.categories.find(c => c.id === catId);
    return cat ? (t.categories[cat.key] || cat.key) : "—";
  };

  return (
    <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <h3 className="h3" style={{ margin: 0 }}>Rangos por línea de gasto · ajuste consultor</h3>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
          Monto a optimizar = Gasto × Alcance %. Ahorro mín/máx = Monto a optimizar × Mín/Máx %.
        </div>
      </div>
      <div style={{ maxHeight: 460, overflow: "auto" }}>
      <table className="t">
        <thead>
          <tr>
            <th>{t.expenses.cols.category}</th>
            <th>{t.expenses.cols.subcategory}</th>
            <th className="right">{t.expenses.cols.amount}</th>
            <th className="right">{t.projection.scope}</th>
            <th className="right">{t.projection.optAmt}</th>
            <th className="right">{t.projection.min} %</th>
            <th className="right">{t.projection.max} %</th>
            <th className="right">Ahorro mín</th>
            <th className="right">Ahorro máx</th>
            <th className="right">{t.projection.feas}</th>
          </tr>
        </thead>
        <tbody>
          {client.expenses.map((e, i) => {
            const amt = +e.amount || 0;
            const scope = e.scopePct == null ? 100 : +e.scopePct;
            const optAmt = amt * scope / 100;
            const minSav = optAmt * (+e.savingsMinPct || 0) / 100;
            const maxSav = optAmt * (+e.savingsMaxPct || 0) / 100;
            return (
              <tr key={e.id}>
                <td style={{ fontSize: 12, color: "var(--text-2)" }}>{catLabel(e.categoryId)}</td>
                <td style={{ fontSize: 12 }}>{e.subcategory}</td>
                <td className="right tabular">{fmtMoney(amt, client.currency)}</td>
                <td className="right">
                  <input className="input right" type="number" min="0" max="100" value={scope} onChange={ev => update(i, { scopePct: +ev.target.value || 0 })} style={{ width: 70 }} />
                </td>
                <td className="right tabular" style={{ color: "var(--text-2)" }}>{fmtMoney(optAmt, client.currency)}</td>
                <td className="right">
                  <input className="input right" type="number" value={e.savingsMinPct} onChange={ev => update(i, { savingsMinPct: +ev.target.value || 0 })} style={{ width: 70 }} />
                </td>
                <td className="right">
                  <input className="input right" type="number" value={e.savingsMaxPct} onChange={ev => update(i, { savingsMaxPct: +ev.target.value || 0 })} style={{ width: 70 }} />
                </td>
                <td className="right tabular" style={{ color: "var(--text-2)" }}>{fmtMoney(minSav, client.currency)}</td>
                <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(maxSav, client.currency)}</td>
                <td className="right">
                  <select className="select" value={e.feasibility || 3} onChange={ev => update(i, { feasibility: +ev.target.value })} style={{ width: 60 }}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
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
  const groups = aggregateByCategory(client).filter(g => {
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
        <table className="t" style={{ tableLayout: "fixed", minWidth: 1100 }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 60 }} />
            {STAGE_KEYS.map(k => <col key={"c-" + k} style={{ width: 54 }} />)}
            <col style={{ width: 60 }} />
            {monthsArr.map(m => <col key={m} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan="2" style={{ verticalAlign: "bottom" }}>{t.expenses.cols.category}</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>N°</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>{t.gantt.start}</th>
              <th colSpan={STAGE_KEYS.length} className="right" style={{ textAlign: "center", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Meses por etapa</th>
              <th rowSpan="2" className="right" style={{ verticalAlign: "bottom" }}>Total</th>
              <th colSpan={totalMonths} className="right" style={{ textAlign: "center", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>Cronograma</th>
            </tr>
            <tr>
              {STAGE_KEYS.map(k => (
                <th key={"h-" + k} className="right" style={{ paddingLeft: 4, paddingRight: 4 }}>
                  <span style={{ display: "inline-block", width: 18, height: 4, background: STAGE_COLORS[k], borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                  {t.gantt.stagesShort[k]}
                </th>
              ))}
              {monthsArr.map(m => <th key={m} className="right" style={{ paddingLeft: 6, paddingRight: 6 }}>M{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const p = planFor(g.categoryId);
              const total = STAGE_KEYS.reduce((s, k) => s + (+p.stages[k] || 0), 0);
              // Stage segments: [{stage, from (month idx), to (exclusive)}]
              const segments = [];
              let cursor = p.start;
              for (const k of STAGE_KEYS) {
                const d = +p.stages[k] || 0;
                if (d > 0) segments.push({ stage: k, from: cursor, to: cursor + d });
                cursor += d;
              }
              return (
                <tr key={g.categoryId}>
                  <td><CategorySwatch color={g.category?.color || "#ccc"} label={catLabel(g.category)} /></td>
                  <td className="right tabular">{i + 1}</td>
                  <td className="right">
                    <input className="input right" type="number" min="0" max={totalMonths - 1} value={p.start}
                      onChange={e => setPlan(g.categoryId, { start: Math.max(0, +e.target.value || 0) })}
                      style={{ width: 50 }} />
                  </td>
                  {STAGE_KEYS.map(k => (
                    <td key={"e-" + k} className="right">
                      <input className="input right" type="number" min="0" max="24" value={p.stages[k]}
                        onChange={e => setPlan(g.categoryId, { stages: { [k]: Math.max(0, +e.target.value || 0) } })}
                        style={{ width: 44 }} />
                    </td>
                  ))}
                  <td className="right tabular" style={{ fontWeight: 700 }}>{total}m</td>
                  {monthsArr.map(m => {
                    const monthIdx = m - 1;
                    const seg = segments.find(s => monthIdx >= s.from && monthIdx < s.to);
                    if (!seg) return <td key={m} style={{ padding: 4 }}></td>;
                    return (
                      <td key={m} style={{ padding: 2 }}>
                        <div style={{
                          background: STAGE_COLORS[seg.stage],
                          color: "#fff",
                          textAlign: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "4px 2px",
                          borderRadius: 2,
                          letterSpacing: 0.3,
                        }}>{t.gantt.stagesShort[seg.stage]}</div>
                      </td>
                    );
                  })}
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

Object.assign(window, { ProjectionView, GanttView, RangeEditor, ResourcesPanel });
