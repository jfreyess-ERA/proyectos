/* ============================================================
   Projection (Lámina 7) + Resources (Lámina 8) + Gantt (Lámina 9)
   ============================================================ */

function ProjectionView({ client, readonly = false, onGoToRangos }) {
  const { t } = useI18n();
  const store = useStore();
  const eraCategories = store.state.eraCategories || [];
  const [drawerCatId, setDrawerCatId] = React.useState(null);
  const [sort, setSort] = React.useState({ col: null, dir: "desc" });
  const [feasFilter, setFeasFilter] = React.useState(new Set()); // empty = all
  const tableCardRef = React.useRef(null);
  const [downloading, setDownloading] = React.useState(false);
  const [showRangos, setShowRangos] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [showLogic, setShowLogic] = React.useState(false);
  const [activeTier, setActiveTier] = React.useState(null);
  // editDraft: { [categoryId]: { scopePct, feasibility, savingsMinPct, savingsMaxPct } }
  const [editDraft, setEditDraft] = React.useState({});

  const startEdit = () => {
    // Seed draft with current aggregated values per category
    const draft = {};
    groups.forEach(g => {
      draft[g.categoryId] = {
        scopePct:     Math.round(g.avgScopePct),
        feasibility:  Math.round(g.avgFeasibility),
        savingsMinPct: parseFloat(g.avgMinPct.toFixed(1)),
        savingsMaxPct: parseFloat(g.avgMaxPct.toFixed(1)),
      };
    });
    setEditDraft(draft);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditDraft({}); };

  const saveEdit = () => {
    // Build a lookup: clientCategoryId → eraId
    const catToEra = {};
    (client.categories || []).forEach(c => { catToEra[c.id] = c.eraId || "__unassigned__"; });
    const expenses = client.expenses;
    const next = expenses.map(e => {
      const eraId = catToEra[e.categoryId] || "__unassigned__";
      const d = editDraft[eraId];
      if (!d) return e;
      return {
        ...e,
        scopePct:     d.scopePct,
        feasibility:  d.feasibility,
        savingsMinPct: d.savingsMinPct,
        savingsMaxPct: d.savingsMaxPct,
        savingsPct:   parseFloat(((d.savingsMinPct + d.savingsMaxPct) / 2).toFixed(1)),
      };
    });
    store.setExpenses(client.id, next);
    setEditing(false);
    setEditDraft({});
  };

  const patchDraft = (categoryId, patch) => {
    setEditDraft(prev => ({ ...prev, [categoryId]: { ...prev[categoryId], ...patch } }));
  };

  const downloadTableImage = () => {
    if (!tableCardRef.current || downloading) return;
    setDownloading(true);
    try {
      const card = tableCardRef.current;
      const sc2 = { feePct: 30, feePctOnSavings: 50, feeMonths: 36, projectionYears: 5, includedCategories: null, ...(client.scenario || {}) };

      // ── color helpers ──────────────────────────────────────────
      const nc = document.createElement("canvas").getContext("2d");
      const toHex = v => {
        if (!v || v === "none" || v === "transparent") return null;
        if (v.includes("oklch")) { try { nc.fillStyle = v; return nc.fillStyle; } catch(e) { return null; } }
        try { nc.fillStyle = v; return nc.fillStyle; } catch(e) { return null; }
      };
      const cs = el => getComputedStyle(el);

      // ── measure table ──────────────────────────────────────────
      const cardRect = card.getBoundingClientRect();
      const S = 2; // scale
      const W = Math.ceil(cardRect.width);

      // Read header row and data rows from the rendered table
      const table = card.querySelector("table");
      const thead = table.querySelector("thead tr");
      const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));

      const thEls = Array.from(thead.querySelectorAll("th"));
      const colWidths = thEls.map(th => Math.ceil(th.getBoundingClientRect().width));
      const ROW_H = 36, HEAD_H = 32, TOTALS_H = 36;

      // Full header height (title row + filter chips row)
      const headerSection = card.querySelector("div");
      const cardTop = card.getBoundingClientRect().top;
      const headerH = Math.ceil(headerSection.getBoundingClientRect().height);

      // Retorno bar height
      const retornoBar = card.lastElementChild;
      const retornoH = Math.ceil(retornoBar.getBoundingClientRect().height);

      // Data rows (skip totals row which is last)
      const dataRows = tbodyRows.slice(0, -1);
      const totalRow = tbodyRows[tbodyRows.length - 1];

      const tableH = HEAD_H + dataRows.length * ROW_H + TOTALS_H;
      const H = headerH + tableH + retornoH;

      // ── setup canvas ───────────────────────────────────────────
      const cv = document.createElement("canvas");
      cv.width = W * S; cv.height = H * S;
      const ctx = cv.getContext("2d");
      ctx.scale(S, S);

      // palette from computed styles
      const bodyBg = toHex(cs(card).backgroundColor) || "#ffffff";
      const surface2 = toHex(cs(thead).backgroundColor) || "#f5f4f0";
      const lineColor = "#d8d5cc";
      const inkColor = "#0d1f3c";
      const champagne = "#c8861a";
      const positive = "#2f7d63";
      const textMuted = "#6b6860";
      const totalsBg = toHex(cs(totalRow).backgroundColor) || "#f5f1e0";

      // helper: draw filled rect
      const rect = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
      // helper: draw bottom border
      const line = (y, x0, x1, color = lineColor) => { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); };
      // helper: draw text clipped to cell
      const cellText = (text, x, y, w, h, color, align = "left", bold = false, size = 12) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x + 4, y, w - 8, h); ctx.clip();
        ctx.fillStyle = color;
        ctx.font = `${bold ? "600" : "400"} ${size}px "Trebuchet MS", Arial, sans-serif`;
        ctx.textBaseline = "middle";
        const cx = align === "right" ? x + w - 6 : align === "center" ? x + w / 2 : x + 8;
        ctx.textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
        ctx.fillText(String(text || ""), cx, y + h / 2);
        ctx.restore();
      };

      // ── 1. Header section (white bg) ───────────────────────────
      rect(0, 0, W, headerH, "#ffffff");
      // eyebrow
      ctx.fillStyle = champagne; ctx.font = `700 9px "Trebuchet MS", Arial`;
      ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.fillText("TABLA RESUMEN", 20, 16);
      // title
      ctx.fillStyle = inkColor; ctx.font = `700 14px "Trebuchet MS", Arial`;
      ctx.fillText("Factibilidad y proyección de ahorros (anuales)", 20, 34);

      // Filter chips row (Factibilidad: [1][2][3][4][5])
      const filterChipsEl = headerSection.querySelector(".row.between + div");
      const chipBtns = filterChipsEl
        ? Array.from(filterChipsEl.querySelectorAll("button")).filter(b => /^[1-5]$/.test(b.textContent.trim()))
        : [];
      if (chipBtns.length > 0) {
        const chipMidY = filterChipsEl
          ? Math.ceil(filterChipsEl.getBoundingClientRect().top + filterChipsEl.getBoundingClientRect().height / 2 - cardTop)
          : headerH - 18;
        ctx.fillStyle = textMuted; ctx.font = `600 11px "Trebuchet MS", Arial`;
        ctx.textBaseline = "middle"; ctx.textAlign = "left";
        ctx.fillText("Factibilidad:", 20, chipMidY);
        let cfx = 20 + 88;
        const DOT_W = 8, DOT_H = 6, DOT_GAP = 2, CHIP_H = 20;
        chipBtns.forEach(btn => {
          const v = parseInt(btn.textContent.trim());
          // Detect selected: selected border is accent (green), unselected is line (gray)
          const btnBorderColor = getComputedStyle(btn).borderLeftColor;
          const [br, bg] = (btnBorderColor.match(/\d+/g) || [200, 200]).map(Number);
          const isSelected = bg > br + 20; // green accent has higher G than R
          const dotColor = v >= 4 ? "#2f7d63" : "#c8861a";
          const chipBg  = isSelected ? "#e8f5f0" : "#f0eeeb";
          const chipBdr = isSelected ? "#2f7d63" : "#d8d5cc";
          const dotAreaW = v * DOT_W + (v - 1) * DOT_GAP;
          const chipW = 10 + dotAreaW + 6 + 10 + 8;
          // bg
          ctx.fillStyle = chipBg; ctx.beginPath();
          ctx.roundRect(cfx, chipMidY - CHIP_H / 2, chipW, CHIP_H, 10); ctx.fill();
          // border
          ctx.strokeStyle = chipBdr; ctx.lineWidth = 1; ctx.beginPath();
          ctx.roundRect(cfx, chipMidY - CHIP_H / 2, chipW, CHIP_H, 10); ctx.stroke();
          // dots
          let dx = cfx + 8;
          for (let d = 0; d < v; d++) {
            ctx.fillStyle = dotColor; ctx.beginPath();
            ctx.roundRect(dx, chipMidY - DOT_H / 2, DOT_W, DOT_H, 2); ctx.fill();
            dx += DOT_W + DOT_GAP;
          }
          // number
          ctx.fillStyle = isSelected ? "#2f7d63" : "#6b6860";
          ctx.font = `600 11px "Trebuchet MS", Arial`;
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(String(v), dx + 3, chipMidY);
          cfx += chipW + 6;
        });
      }
      line(headerH, 0, W, lineColor);

      // ── 2. Table header row ────────────────────────────────────
      let ty = headerH;
      rect(0, ty, W, HEAD_H, surface2);
      let tx = 0;
      thEls.forEach((th, i) => {
        const w = colWidths[i];
        const text = th.textContent.replace(/[↕↓↑]/g, "").trim();
        const align = i <= 1 ? "left" : "right";
        cellText(text, tx, ty, w, HEAD_H, textMuted, align, true, 10);
        tx += w;
      });
      line(ty + HEAD_H, 0, W, lineColor);
      ty += HEAD_H;

      // ── 3. Data rows ───────────────────────────────────────────
      // Bars are absolute 0–100%
      const maxMinPctVal = 100;
      const maxMaxPctVal = 100;

      dataRows.forEach((tr, ri) => {
        const bg = ri % 2 === 1 ? "#f9f8f6" : "#ffffff";
        rect(0, ty, W, ROW_H, bg);
        const tds = Array.from(tr.querySelectorAll("td"));
        tx = 0;
        tds.forEach((td, i) => {
          const w = colWidths[i];
          if (i === 0) { tx += w; return; } // checkbox col — skip
          const rawColor = toHex(cs(td).color) || inkColor;
          const align = i <= 1 ? "left" : "right";
          const bold = cs(td).fontWeight >= 600;
          // For feasibility dots col, draw colored squares
          if (i === 5) {
            // Feasibility dots — FeasDots uses CSS classes "feas-dot on" (orange) / "feas-dot high" (green)
            const allDots = td.querySelectorAll(".feas-dot");
            const filledDotEls = Array.from(allDots).filter(d => d.classList.contains("on") || d.classList.contains("high"));
            const filledCount = filledDotEls.length;
            const isHighDot = filledDotEls.some(d => d.classList.contains("high"));
            const dotFillColor = isHighDot ? "#2f7d63" : "#c8861a"; // green for 4-5, orange for 1-3
            const dotW = 10, dotH = 8, gap = 3;
            const total5W = 5 * dotW + 4 * gap;
            let dx = tx + (w - total5W) / 2;
            for (let d = 0; d < 5; d++) {
              ctx.fillStyle = d < filledCount ? dotFillColor : "#d8d5cc";
              ctx.beginPath(); ctx.roundRect(dx, ty + ROW_H/2 - dotH/2, dotW, dotH, 2); ctx.fill();
              dx += dotW + gap;
            }
          } else if (i === 6 || i === 7) {
            // % ahorr_min / % ahorr_max — bar fills available space, fill = value% of track
            const span = td.querySelector("span");
            const pctText = span ? span.textContent.trim() : td.textContent.trim();
            const pctVal = parseFloat(pctText) || 0; // e.g. 35 for "35.0%"
            const BAR_H = 6, GAP = 6, NUM_W = 44, PAD = 8;
            // track spans from left edge to right edge minus number - gap - right padding
            const BAR_W = Math.max(20, w - PAD - GAP - NUM_W - PAD);
            const bx = tx + PAD;
            const by = ty + ROW_H / 2 - BAR_H / 2;
            // track bg
            ctx.fillStyle = "#d8d5cc"; ctx.beginPath(); ctx.roundRect(bx, by, BAR_W, BAR_H, 3); ctx.fill();
            // fill
            const fillW = Math.min(BAR_W, (pctVal / 100) * BAR_W);
            if (fillW > 0) { ctx.fillStyle = "#2f7d63"; ctx.beginPath(); ctx.roundRect(bx, by, fillW, BAR_H, 3); ctx.fill(); }
            // text (right-aligned, after bar)
            cellText(pctText, bx + BAR_W + GAP, ty, NUM_W, ROW_H, inkColor, "right", false, 12);
          } else {
            cellText(td.textContent.trim(), tx, ty, w, ROW_H, rawColor, align, bold, 12);
          }
          tx += w;
        });
        line(ty + ROW_H, 0, W, lineColor);
        ty += ROW_H;
      });

      // ── 4. Totals row ──────────────────────────────────────────
      rect(0, ty, W, TOTALS_H, totalsBg);
      const totalTds = Array.from(totalRow.querySelectorAll("td"));
      tx = 0;
      totalTds.forEach((td, i) => {
        const w = colWidths[i];
        const align = i <= 1 ? "left" : "right";
        const c = toHex(cs(td).color) || inkColor;
        cellText(td.textContent.trim(), tx, ty, w, TOTALS_H, c, align, true, 12);
        tx += w;
      });
      ty += TOTALS_H;

      // ── 5. Retorno bar ─────────────────────────────────────────
      const retBg = toHex(cs(retornoBar).backgroundColor) || "#0d2240";
      rect(0, ty, W, retornoH, retBg);

      // left label
      ctx.fillStyle = champagne; ctx.font = `700 9px "Trebuchet MS", Arial`;
      ctx.textBaseline = "middle";
      ctx.fillText(`RETORNO CLIENTE ${sc2.projectionYears} ${sc2.projectionYears === 1 ? "AÑO" : "AÑOS"}`, 20, ty + retornoH * 0.35);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = `400 10px "Trebuchet MS", Arial`;
      ctx.fillText(`ERA ${sc2.feePctOnSavings}% × ${sc2.feeMonths}m · ${client.legalName}`, 20, ty + retornoH * 0.7);

      // center: main values — use direct children to avoid wrong nth-child matches
      const centerDiv = retornoBar.children[1]; // 2nd direct child = center flex div
      const retText = centerDiv?.children[0]?.textContent.trim() || "";   // big number range
      const medioText = centerDiv?.children[1]?.textContent.trim() || ""; // "medio: ..."
      ctx.fillStyle = champagne; ctx.font = `700 18px "Trebuchet MS", Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(retText, W / 2, ty + retornoH * 0.38);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = `400 10px "Trebuchet MS", Arial`;
      ctx.fillText(medioText, W / 2, ty + retornoH * 0.72);
      ctx.textAlign = "left";

      // ERA logo text (right) — just text since img is hard
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = `700 15px "Trebuchet MS", Arial`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText("era GROUP", W - 20, ty + retornoH / 2);
      ctx.textAlign = "left";

      // ── 6. Border around whole image ───────────────────────────
      ctx.strokeStyle = lineColor; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      // ── 7. Download ────────────────────────────────────────────
      const link = document.createElement("a");
      link.download = `tabla-resumen-${(client.legalName || "cliente").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = cv.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[download]", err);
      alert("Error al generar imagen: " + (err.message || err));
    } finally {
      setDownloading(false);
    }
  };
  const tierConfig = store.state.tierConfig || DEFAULT_TIER_CONFIG;
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
  groups.forEach(g => { tiers[tierFor(g, tierConfig)].push(g); });

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
              {!readonly && !editing && (
                <button className="btn ghost sm" onClick={startEdit}>✏ Editar</button>
              )}
              {!readonly && editing && (
                <>
                  <button className="btn primary sm" onClick={saveEdit}>✓ Guardar</button>
                  <button className="btn ghost sm" onClick={cancelEdit}>Cancelar</button>
                </>
              )}
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
            {(() => {
              // Bars: track fills available column space, fill = value% of track (0-100 absolute)
              // value is already 0–100 (e.g. 8.5 for 8.5%), so use directly as CSS %
              const PctBar = ({ value }) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", paddingRight: 4 }}>
                  <div style={{ flex: 1, height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden", minWidth: 20 }}>
                    <div style={{ width: `${Math.min(100, value || 0)}%`, height: "100%", background: "var(--positive-2)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right", flexShrink: 0 }}>{fmtPct(value)}</span>
                </div>
              );
              return sortedGroups.map(g => {
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
                  {editing ? (
                    <td className="right" style={{ padding: "4px 8px" }}>
                      <input type="number" min="0" max="100" step="1"
                        value={editDraft[g.categoryId]?.scopePct ?? Math.round(g.avgScopePct)}
                        onChange={e => patchDraft(g.categoryId, { scopePct: Math.min(100, Math.max(0, +e.target.value)) })}
                        onClick={ev => ev.stopPropagation()}
                        className="input right" style={{ width: 64, padding: "2px 6px", fontSize: 12 }} />
                    </td>
                  ) : (
                    <td className="right tabular">{fmtPct(g.avgScopePct)}</td>
                  )}
                  <td className="right tabular">{fmtMoney(g.optimizationAmount, client.currency)}</td>
                  {editing ? (
                    <td className="right" style={{ padding: "4px 8px" }}>
                      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                        {[1,2,3,4,5].map(v => {
                          const cur = editDraft[g.categoryId]?.feasibility ?? Math.round(g.avgFeasibility);
                          return (
                            <span key={v}
                              onClick={ev => { ev.stopPropagation(); patchDraft(g.categoryId, { feasibility: v }); }}
                              style={{ width: 14, height: 14, borderRadius: 2, cursor: "pointer", flexShrink: 0,
                                background: v <= cur ? (cur >= 4 ? "var(--positive-2)" : cur >= 3 ? "var(--champagne)" : "#c0392b") : "var(--line)" }}
                            />
                          );
                        })}
                      </div>
                    </td>
                  ) : (
                    <td className="right"><FeasDots value={Math.round(g.avgFeasibility)} /></td>
                  )}
                  {editing ? (
                    <td style={{ padding: "4px 8px" }}>
                      <input type="number" min="0" max="100" step="0.5"
                        value={editDraft[g.categoryId]?.savingsMinPct ?? parseFloat(g.avgMinPct.toFixed(1))}
                        onChange={e => patchDraft(g.categoryId, { savingsMinPct: Math.min(100, Math.max(0, +e.target.value)) })}
                        onClick={ev => ev.stopPropagation()}
                        className="input right" style={{ width: 64, padding: "2px 6px", fontSize: 12 }} />
                    </td>
                  ) : (
                    <td style={{ paddingRight: 8 }}><PctBar value={g.avgMinPct} /></td>
                  )}
                  {editing ? (
                    <td style={{ padding: "4px 8px" }}>
                      <input type="number" min="0" max="100" step="0.5"
                        value={editDraft[g.categoryId]?.savingsMaxPct ?? parseFloat(g.avgMaxPct.toFixed(1))}
                        onChange={e => patchDraft(g.categoryId, { savingsMaxPct: Math.min(100, Math.max(0, +e.target.value)) })}
                        onClick={ev => ev.stopPropagation()}
                        className="input right" style={{ width: 64, padding: "2px 6px", fontSize: 12 }} />
                    </td>
                  ) : (
                    <td style={{ paddingRight: 8 }}><PctBar value={g.avgMaxPct} /></td>
                  )}
                  <td className="right tabular" style={{ color: "var(--text-2)" }}>{fmtMoney(g.minSavings, client.currency)}</td>
                  <td className="right tabular" style={{ color: "var(--positive-2)", fontWeight: 700 }}>{fmtMoney(g.maxSavings, client.currency)}</td>
                </tr>
              );
            });
          })()}
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
          padding: "10px 20px",
          background: "var(--ink)",
          color: "var(--on-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}>
          {/* Left: label + subtitle */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase",
              color: "var(--champagne)", fontWeight: 700, marginBottom: 2,
            }}>
              Retorno cliente {sc.projectionYears} {sc.projectionYears === 1 ? "año" : "años"}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>
              ERA {sc.feePctOnSavings}% × {sc.feeMonths}m · {client.legalName}
            </div>
          </div>

          {/* Center: main values */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              fontSize: 22, fontWeight: 700, color: "var(--champagne)",
              fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            }}>
              {fmtMoney(retMin, client.currency)} — {fmtMoney(retMax, client.currency)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              medio: {fmtMoney(retAvg, client.currency)}
            </div>
          </div>

          {/* Right: ERA logo (invert to white for dark bg) */}
          <img
            src="../era-logo-cropped.png"
            alt="ERA Group"
            style={{ height: 30, flexShrink: 0, filter: "brightness(0) invert(1)", opacity: 0.85 }}
          />
        </div>
      </div>


      {/* Tier cards (Quick win / Estratégica / Mantener / Descartar) */}
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
                +{fmtMoney(savSum, client.currency, { compact: true })} ahorro medio
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
                <th>Categoría</th>
                <th className="right">Gasto total</th>
                <th className="right">% gasto</th>
                <th className="right">Ahorro %</th>
                <th className="right">Ahorro potencial</th>
                <th className="right">Factib.</th>
              </tr>
            </thead>
            <tbody>
              {tiers[activeTier].map(g => (
                <tr key={g.categoryId}>
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


// ── Recursive binary-split treemap layout ─────────────────────
function buildTreemap(items, x, y, w, h) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];
  let bestDiff = Infinity, splitIdx = 1, cumSum = 0;
  for (let i = 0; i < items.length - 1; i++) {
    cumSum += items[i].value;
    const diff = Math.abs(cumSum / total - 0.5);
    if (diff < bestDiff) { bestDiff = diff; splitIdx = i + 1; }
  }
  const left = items.slice(0, splitIdx), right = items.slice(splitIdx);
  const lf = left.reduce((s, i) => s + i.value, 0) / total;
  if (w >= h) {
    const lw = w * lf;
    return [...buildTreemap(left, x, y, lw, h), ...buildTreemap(right, x + lw, y, w - lw, h)];
  } else {
    const th = h * lf;
    return [...buildTreemap(left, x, y, w, th), ...buildTreemap(right, x, y + th, w, h - th)];
  }
}

const ROLE_COLORS = ["#E8A838","#1AABAB","#1B3A6B","#7D3C98","#0D5F4A","#4A90D9","#C0392B","#2ECC71"];

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

  // ── Colors ─────────────────────────────────────────────────────
  const ERA_ORANGE = "#E8A838";
  const CLI_BLUE   = "#2A5FA5";
  const ERA_DARK   = "#0F2724";
  const clientName = (client.name || "Cliente").split(" ").slice(0, 3).join(" ");

  const eraPct = totalHH > 0 ? Math.round((eraHH / totalHH) * 100) : 0;
  const cliPct = 100 - eraPct;
  const maxHH  = Math.max(eraHH, clientHH, 1);

  // ── Donut geometry ─────────────────────────────────────────────
  const cx = 110, cy = 110, Ro = 100, Ri = 52;
  const eraAngle = totalHH > 0 ? (eraHH / totalHH) * 2 * Math.PI : 0;

  const pieSlice = (a0, a1) => {
    const span = a1 - a0;
    if (span >= 2 * Math.PI - 0.001)
      return `M${cx},${cy - Ro} A${Ro},${Ro} 0 1 1 ${cx - 0.001},${cy - Ro} Z`;
    if (span <= 0.001) return "";
    const x0 = cx + Ro * Math.sin(a0), y0 = cy - Ro * Math.cos(a0);
    const x1 = cx + Ro * Math.sin(a1), y1 = cy - Ro * Math.cos(a1);
    const lg = span > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x0},${y0} A${Ro},${Ro} 0 ${lg} 1 ${x1},${y1} Z`;
  };

  // ── Treemap ────────────────────────────────────────────────────
  const tmItems = [...r.roles]
    .filter(role => (+role.hours || 0) > 0)
    .sort((a, b) => b.hours - a.hours)
    .map((role, i) => ({ ...role, value: +role.hours, color: ROLE_COLORS[i % ROLE_COLORS.length] }));

  const TW = 200, TH = 280;
  const tiles = buildTreemap(tmItems, 2, 2, TW - 4, TH - 4);

  const EYE = { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700 };
  const CHART_H = 260; // shared height for all charts

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <div className="eyebrow">Lámina · {t.resources.title}</div>
          <h3 className="h3" style={{ margin: 0 }}>{t.resources.title}</h3>
        </div>
      </div>
      <p className="lede" style={{ marginBottom: 20 }}>{t.resources.lede}</p>

      {/* ── TOP: Parameters — 1/3 + 2/3 ──────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, marginBottom: 28, alignItems: "start" }}>

        {/* HH ERA / categoría — prominente */}
        <div>
          <div style={{ ...EYE, marginBottom: 10 }}>HH ERA / Categoría</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input className="input right" type="number" value={r.eraHHPerCat}
              onChange={e => setR({ eraHHPerCat: +e.target.value || 0 })}
              style={{ width: 110, fontSize: 15, fontWeight: 600 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>HH / cat.</span>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Total ERA estimado</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>
              {eraHH.toLocaleString("es-CL")}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-2)", marginLeft: 5 }}>HH</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
              {n} cat. × {r.eraHHPerCat} HH
            </div>
          </div>
        </div>

        {/* Roles table */}
        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={EYE}>Detalle horas por cargo</span>
            <button className="btn ghost sm" onClick={addRole}>+ cargo</button>
          </div>
          <table className="t" style={{ fontSize: 12 }}>
            <thead><tr>
              <th style={{ width: 16 }}></th>
              <th>Cargo</th>
              <th className="right" style={{ width: 80 }}>HH</th>
              <th style={{ width: 36 }}></th>
            </tr></thead>
            <tbody>
              {r.roles.map((role, i) => (
                <tr key={role.id}>
                  <td><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ROLE_COLORS[i % ROLE_COLORS.length], verticalAlign: "middle" }} /></td>
                  <td><input className="input" value={role.title} onChange={e => updRole(i, { title: e.target.value })} /></td>
                  <td className="right"><input className="input right" type="number" value={role.hours} onChange={e => updRole(i, { hours: +e.target.value || 0 })} /></td>
                  <td><button className="btn ghost sm danger" onClick={() => removeRole(i)} title="Eliminar">×</button></td>
                </tr>
              ))}
              <tr className="totals">
                <td></td>
                <td>Total cliente</td>
                <td className="right tabular">{clientHH} HH</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── BOTTOM: 3-col charts — donut | treemap | bars ──────── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 190px", gap: 24, alignItems: "start" }}>

        {/* 1 · Donut */}
        <div>
          <div style={{ ...EYE, marginBottom: 12 }}>Distribución de horas</div>
          <div style={{ height: CHART_H, width: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 220 220" style={{ height: "100%", width: "auto", display: "block", overflow: "visible" }}>
              {totalHH === 0 ? (
                <circle cx={cx} cy={cy} r={Ro} fill="var(--surface-2)" stroke="var(--line)" />
              ) : eraHH === 0 ? (
                <circle cx={cx} cy={cy} r={Ro} fill={CLI_BLUE} />
              ) : clientHH === 0 ? (
                <circle cx={cx} cy={cy} r={Ro} fill={ERA_ORANGE} />
              ) : (
                <>
                  <path d={pieSlice(0, eraAngle)} fill={ERA_ORANGE} stroke="white" strokeWidth="2" />
                  <path d={pieSlice(eraAngle, 2 * Math.PI)} fill={CLI_BLUE} stroke="white" strokeWidth="2" />
                </>
              )}
              {/* Donut hole */}
              <circle cx={cx} cy={cy} r={Ri + 3} fill="white" />
              <circle cx={cx} cy={cy} r={Ri} fill="white" stroke="var(--line)" strokeWidth="1" />
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="9.5" fill="var(--text-3)"
                fontFamily="Trebuchet MS" letterSpacing="0.5" fontWeight="600">TOTAL HH</text>
              <text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fontWeight="800"
                fill="var(--ink)" fontFamily="Trebuchet MS">{totalHH.toLocaleString("es-CL")}</text>
            </svg>
          </div>
        </div>

        {/* 2 · Treemap */}
        <div>
          <div style={{ ...EYE, marginBottom: 12 }}>Horas del cliente por cargo</div>
          {tmItems.length > 0 ? (
            <div style={{ height: CHART_H, maxWidth: 220 }}>
              <svg viewBox={`0 0 ${TW} ${TH}`} width="100%" height="100%"
                preserveAspectRatio="none" style={{ display: "block", borderRadius: 10, overflow: "hidden" }}>
                {tiles.map((tile, i) => {
                  const pad = 9;
                  const showFull = tile.w > 60 && tile.h > 38;
                  const showMin  = !showFull && tile.h > 20;
                  const titleShort = tile.title.length > 20 ? tile.title.slice(0, 19) + "…" : tile.title;
                  const fs = Math.min(13, Math.max(8, tile.h / 4.5));
                  return (
                    <g key={tile.id || i}>
                      <rect x={tile.x + 1.5} y={tile.y + 1.5} width={tile.w - 3} height={tile.h - 3}
                        fill={tile.color} rx="5" />
                      {showFull && (
                        <>
                          <text x={tile.x + pad} y={tile.y + tile.h - pad - fs + 2}
                            fontSize={fs} fontWeight="700" fill="white" fontFamily="Trebuchet MS">
                            {tile.value} HH
                          </text>
                          <text x={tile.x + pad} y={tile.y + tile.h - pad + 2}
                            fontSize={Math.max(7.5, fs - 2.5)} fill="white" fontFamily="Trebuchet MS" opacity="0.78">
                            {titleShort}
                          </text>
                        </>
                      )}
                      {showMin && (
                        <text x={tile.x + tile.w / 2} y={tile.y + tile.h / 2 + 4}
                          fontSize="8.5" fontWeight="700" fill="white" fontFamily="Trebuchet MS"
                          textAnchor="middle">{tile.value}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>Sin cargos con horas definidas.</div>
          )}
        </div>

        {/* 3 · Horizontal bars */}
        <div>
          <div style={{ ...EYE, marginBottom: 18 }}>HH estimadas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* ERA bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>ERA Group</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: ERA_ORANGE, fontVariantNumeric: "tabular-nums" }}>
                  {eraHH.toLocaleString("es-CL")}
                  <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, color: "var(--text-3)" }}>HH</span>
                </span>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 20, overflow: "hidden" }}>
                <div style={{
                  width: `${eraHH / maxHH * 100}%`, background: ERA_ORANGE,
                  height: "100%", borderRadius: 6, transition: "width 0.4s ease"
                }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>{eraPct}% del total</div>
            </div>

            {/* Client bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{clientName}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: CLI_BLUE, fontVariantNumeric: "tabular-nums" }}>
                  {clientHH.toLocaleString("es-CL")}
                  <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3, color: "var(--text-3)" }}>HH</span>
                </span>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 20, overflow: "hidden" }}>
                <div style={{
                  width: `${clientHH / maxHH * 100}%`, background: CLI_BLUE,
                  height: "100%", borderRadius: 6, transition: "width 0.4s ease"
                }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>{cliPct}% del total</div>
            </div>

          </div>
        </div>

      </div>

      <div className="grid cols-2" style={{ marginTop: 24 }}>
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
