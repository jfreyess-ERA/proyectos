/* ============================================================
   Views: expenses (manual / paste / table)
   ============================================================ */

function ExpensesView({ client }) {
  const { t, lang } = useI18n();
  const store = useStore();
  const [mode, setMode] = React.useState("table");
  const [showAddCat, setShowAddCat] = React.useState(false);

  const expenses = client.expenses;
  const total = totalSpend(client);
  const sav = totalSavings(client);

  const update = (idx, patch) => {
    const next = expenses.map((e, i) => i === idx ? { ...e, ...patch } : e);
    store.setExpenses(client.id, next);
  };
  const remove = (idx) => {
    store.setExpenses(client.id, expenses.filter((_, i) => i !== idx));
  };
  const duplicate = (idx) => {
    const copy = { ...expenses[idx], id: uid("e") };
    const next = [...expenses.slice(0, idx + 1), copy, ...expenses.slice(idx + 1)];
    store.setExpenses(client.id, next);
  };
  const addRow = (categoryId) => {
    store.setExpenses(client.id, [...expenses, blankExpense(categoryId || client.categories[0]?.id)]);
  };

  const catLabel = (cat) => {
    if (!cat) return "—";
    return t.categories[cat.key] || cat.key;
  };

  return (
    <div className="stack lg">
      <div className="row between">
        <div>
          <div className="eyebrow">{t.nav.expenses}</div>
          <h2 className="h2">{t.expenses.title}</h2>
          <p className="lede" style={{ marginTop: 4 }}>{t.expenses.lede}</p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setShowAddCat(true)}>+ {t.actions.addCategory}</button>
          <button className="btn primary" onClick={() => addRow()}>+ {t.actions.addRow}</button>
        </div>
      </div>

      <div className="grid cols-2">
        <Stat label={t.expenses.total} value={fmtMoney(total, client.currency, { compact: true })} sub={`${expenses.length} ${t.expenses.rowCount}`} variant="dark" />
        <Stat label={t.dashboard.categoriesAnalyzed} value={new Set(expenses.map(e => e.categoryId)).size} sub={`/ ${client.categories.length} ${t.clients.categories}`} />
      </div>

      <Tabs
        active={mode}
        onChange={setMode}
        tabs={[
          { id: "table",  label: t.expenses.modes.table },
          { id: "manual", label: t.expenses.modes.manual },
          { id: "paste",  label: t.expenses.modes.paste },
          { id: "excel",  label: "Excel" },
        ]}
      />

      {mode === "table" && (
        <ExpenseTable client={client} expenses={expenses} update={update} remove={remove} duplicate={duplicate} catLabel={catLabel} />
      )}
      {mode === "manual" && (
        <ManualEntry client={client} catLabel={catLabel} onAdd={(exp) => store.addExpense(client.id, exp)} />
      )}
      {mode === "paste" && (
        <PasteImport client={client} catLabel={catLabel} onImport={(rows) => {
          store.setExpenses(client.id, [...expenses, ...rows]);
          setMode("table");
        }} />
      )}
      {mode === "excel" && (
        <ExcelImport client={client} catLabel={catLabel} onImport={(rows) => {
          store.setExpenses(client.id, [...expenses, ...rows]);
          setMode("table");
        }} />
      )}

      <AddCategoryModal
        open={showAddCat}
        onClose={() => setShowAddCat(false)}
        onCreate={(name) => {
          store.addCategory(client.id, { id: uid("cat"), key: name.toLowerCase().replace(/\s+/g, "_"), label: name, color: "#6E2D4A" });
          setShowAddCat(false);
        }}
      />
    </div>
  );
}

function ExpenseTable({ client, expenses, update, remove, duplicate, catLabel }) {
  const { t } = useI18n();
  if (expenses.length === 0) {
    return <Empty icon="◯" title={t.dashboard.empty} hint={t.expenses.lede} />;
  }
  const total = totalSpend(client);
  const totalSav = totalSavings(client);

  return (
    <div className="card flat" style={{ padding: 0, overflow: "hidden" }}>
      <table className="t">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>{t.expenses.cols.category}</th>
            <th>{t.expenses.cols.subcategory}</th>
            <th>{t.expenses.cols.supplier}</th>
            <th className="right">{t.expenses.cols.amount}</th>
            <th className="right">{t.expenses.cols.suppliers}</th>
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => {
            const cat = client.categories.find(c => c.id === e.categoryId);
            const pot = (+e.amount || 0) * (+e.savingsPct || 0) / 100;
            return (
              <tr key={e.id}>
                <td style={{ paddingLeft: 12 }}>
                  <span style={{ width: 6, height: 24, background: cat?.color || "#ccc", display: "block", borderRadius: 2 }} />
                </td>
                <td>
                  <select className="select" value={e.categoryId} onChange={ev => update(i, { categoryId: ev.target.value })}>
                    {client.categories.map(c => (
                      <option key={c.id} value={c.id}>{catLabel(c)}</option>
                    ))}
                  </select>
                </td>
                <td><input className="input" value={e.subcategory} onChange={ev => update(i, { subcategory: ev.target.value })} /></td>
                <td><input className="input" value={e.supplier} onChange={ev => update(i, { supplier: ev.target.value })} /></td>
                <td className="right">
                  <input className="input right" type="number" value={e.amount}
                    onChange={ev => update(i, { amount: +ev.target.value || 0 })} />
                </td>
                <td className="right">
                  <input className="input right" type="number" value={e.suppliers}
                    onChange={ev => update(i, { suppliers: +ev.target.value || 0 })} style={{ width: 60 }} />
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn ghost sm" onClick={() => duplicate(i)} title="Duplicar">⎘</button>
                  <button className="btn ghost sm danger" onClick={() => remove(i)} title="Eliminar">×</button>
                </td>
              </tr>
            );
          })}
          <tr className="totals">
            <td></td>
            <td colSpan={3}>{t.expenses.total}</td>
            <td className="right">{fmtMoney(total, client.currency)}</td>
            <td className="right">{expenses.reduce((s, e) => s + (+e.suppliers || 0), 0)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ManualEntry({ client, catLabel, onAdd }) {
  const { t } = useI18n();
  const [exp, setExp] = React.useState(() => blankExpense(client.categories[0]?.id));
  const set = (patch) => setExp(p => ({ ...p, ...patch }));

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3 className="h3">+ {t.actions.addRow}</h3>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <Field label={t.expenses.cols.category}>
          <select className="select" value={exp.categoryId} onChange={e => set({ categoryId: e.target.value })}>
            {client.categories.map(c => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t.expenses.cols.subcategory}>
          <input className="input" value={exp.subcategory} onChange={e => set({ subcategory: e.target.value })} />
        </Field>
        <Field label={t.expenses.cols.supplier} span={2}>
          <input className="input" value={exp.supplier} onChange={e => set({ supplier: e.target.value })} />
        </Field>
        <Field label={`${t.expenses.cols.amount} (${client.currency})`}>
          <input className="input right" type="number" value={exp.amount} onChange={e => set({ amount: +e.target.value || 0 })} />
        </Field>
        <Field label={t.expenses.cols.suppliers}>
          <input className="input right" type="number" value={exp.suppliers} onChange={e => set({ suppliers: +e.target.value || 0 })} />
        </Field>
        <Field label={t.expenses.cols.contract}>
          <input className="input" type="month" value={exp.contractUntil} onChange={e => set({ contractUntil: e.target.value })} />
        </Field>
        <Field label={t.expenses.cols.notes} span={2}>
          <input className="input" value={exp.notes} onChange={e => set({ notes: e.target.value })} />
        </Field>
      </div>
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="btn primary" onClick={() => {
          onAdd(exp);
          setExp(blankExpense(exp.categoryId));
        }}>+ {t.actions.addRow}</button>
      </div>
    </div>
  );
}

function PasteImport({ client, catLabel, onImport }) {
  const { t } = useI18n();
  const [text, setText] = React.useState("");
  const [parsed, setParsed] = React.useState([]);

  const parse = (raw) => {
    if (!raw.trim()) return [];
    const sep = raw.includes("\t") ? "\t" : ",";
    const lines = raw.trim().split(/\r?\n/);
    const out = [];
    for (const line of lines) {
      const cols = line.split(sep).map(c => c.trim());
      if (cols.length < 2) continue;
      // First 3 cols: category, subcategory, supplier. Then numeric periods.
      // If only one amount + maybe suppliers, also supported.
      const [catGuess, sub, sup, ...rest] = cols;
      const nums = rest.map(v => parseFloat((v || "0").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0);
      // Detect: if rest.length >= 3 and most are numeric, treat as period series
      let monthly = null, amount = 0, suppliers = 1;
      if (nums.length >= 3) {
        monthly = nums;
        amount = nums.reduce((a, b) => a + b, 0);
      } else {
        // Legacy mode: amount, suppliers
        amount = nums[0] || 0;
        suppliers = parseInt(rest[1] || "1") || 1;
      }
      const catId = client.categories.find(c =>
        (t.categories[c.key] || c.key || "").toLowerCase().includes((catGuess || "").toLowerCase()) ||
        (catGuess || "").toLowerCase().includes((t.categories[c.key] || c.key || "").toLowerCase())
      )?.id || client.categories[0]?.id;
      out.push({
        ...blankExpense(catId),
        subcategory: sub || "",
        supplier: sup || "",
        amount,
        suppliers,
        ...(monthly ? { monthly } : {}),
      });
    }
    return out;
  };

  React.useEffect(() => { setParsed(parse(text)); }, [text]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3 className="h3">{t.expenses.modes.paste}</h3>
        <p className="lede" style={{ fontSize: 12, marginBottom: 10 }}>
          Columnas: Categoría, Subcategoría, Proveedor, y luego <strong>N columnas numéricas</strong> (uno por período: 6, 12, 18, 24 meses, lo que cargues). El sistema toma la cantidad de períodos del primer pegado.
        </p>
        <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder={"Energía\tElectricidad\tIberdrola\t98000\t102000\t110000\t...\nTelco\tFijo + datos\tMovistar\t15000\t15200\t14800\t..."} />
        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end", gap: 8 }}>
          <button className="btn ghost" onClick={() => setText("")}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={parsed.length === 0} onClick={() => onImport(parsed)}>
            {t.actions.apply} ({parsed.length})
          </button>
        </div>
      </div>
      <div className="card">
        <h3 className="h3">Vista previa · {parsed.length}</h3>
        {parsed.length === 0 ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: "20px 0" }}>—</div>
        ) : (
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table className="t" style={{ fontSize: 12 }}>
              <thead><tr>
                <th>{t.expenses.cols.category}</th>
                <th>{t.expenses.cols.supplier}</th>
                <th className="right">{t.expenses.cols.amount}</th>
                <th className="right">Períodos</th>
              </tr></thead>
              <tbody>
                {parsed.map((p, i) => {
                  const cat = client.categories.find(c => c.id === p.categoryId);
                  return (
                    <tr key={i}>
                      <td><CategorySwatch color={cat?.color || "#ccc"} label={catLabel(cat)} /></td>
                      <td>{p.supplier}</td>
                      <td className="right">{fmtMoney(p.amount, client.currency)}</td>
                      <td className="right tabular">{p.monthly ? p.monthly.length : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCategoryModal({ open, onClose, onCreate }) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  React.useEffect(() => { if (open) setName(""); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.actions.addCategory}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>{t.actions.save}</button>
        </>
      }
    >
      <Field label={t.expenses.cols.category}>
        <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Excel Import ──────────────────────────────────────────────────

const IMPORT_FIELDS = [
  { id: "skip",          label: "— No importar —",       type: "skip" },
  { id: "category",      label: "Categoría",              type: "text" },
  { id: "subcategory",   label: "Subcategoría",           type: "text" },
  { id: "supplier",      label: "Proveedor",              type: "text" },
  { id: "amount",        label: "Monto total",            type: "number" },
  { id: "suppliers",     label: "N° proveedores",         type: "number" },
  { id: "savingsPct",    label: "% Ahorro estimado",      type: "number" },
  { id: "savingsMinPct", label: "% Ahorro mínimo",        type: "number" },
  { id: "savingsMaxPct", label: "% Ahorro máximo",        type: "number" },
  { id: "scopePct",      label: "% Alcance",              type: "number" },
  { id: "feasibility",   label: "Factibilidad (1–5)",     type: "number" },
  { id: "months",        label: "Meses implementación",   type: "number" },
  { id: "notes",         label: "Notas",                  type: "text"   },
  { id: "monthly",       label: "Serie mensual (M1…Mn)",  type: "series" },
];

function autoDetectField(header) {
  const h = (header || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/categ/.test(h))                           return "category";
  if (/sub/.test(h))                             return "subcategory";
  if (/prov|supplier|vendor/.test(h))            return "supplier";
  if (/monto|amount|total|gasto|costo|spend/.test(h)) return "amount";
  if (/n.?prov|num.*prov|#.*prov/.test(h))       return "suppliers";
  if (/min.*ah|ah.*min|saving.*min|min.*sav/.test(h)) return "savingsMinPct";
  if (/max.*ah|ah.*max|saving.*max|max.*sav/.test(h)) return "savingsMaxPct";
  if (/ahorro|saving|saving_pct|sav/.test(h))    return "savingsPct";
  if (/alcance|scope/.test(h))                   return "scopePct";
  if (/fact|feasib/.test(h))                     return "feasibility";
  if (/mes.*impl|impl.*mes|month.*impl/.test(h)) return "months";
  if (/nota|note|obs/.test(h))                   return "notes";
  if (/^m\d+$|^mes\s*\d+$|^month\s*\d+$|^period\s*\d+$/.test(h)) return "monthly";
  return "skip";
}

function parseNum(v) {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function ExcelImport({ client, catLabel, onImport }) {
  const [step, setStep]       = React.useState(1); // 1=upload 2=map 3=preview
  const [headers, setHeaders] = React.useState([]);
  const [rows, setRows]       = React.useState([]);   // raw string rows from Excel
  const [mapping, setMapping] = React.useState({});   // colIndex -> fieldId
  const [fileName, setFileName] = React.useState("");
  const [error, setError]     = React.useState("");

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!data || data.length < 2) { setError("El archivo no tiene suficientes filas."); return; }
        const hdrs = data[0].map(h => String(h ?? "").trim());
        const dataRows = data.slice(1).filter(r => r.some(c => c !== "" && c != null));
        setHeaders(hdrs);
        setRows(dataRows);
        // Auto-detect mapping
        const autoMap = {};
        hdrs.forEach((h, i) => { autoMap[i] = autoDetectField(h); });
        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        setError("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildExpenses() {
    // Find which cols map to 'monthly' series
    const seriesCols = Object.entries(mapping)
      .filter(([, f]) => f === "monthly")
      .map(([i]) => parseInt(i));

    return rows.map(row => {
      const exp = { ...blankExpense(client.categories[0]?.id) };

      Object.entries(mapping).forEach(([colIdx, fieldId]) => {
        if (fieldId === "skip" || fieldId === "monthly") return;
        const val = row[parseInt(colIdx)];
        if (fieldId === "category") {
          const catId = client.categories.find(c => {
            const label = (catLabel(c) || "").toLowerCase();
            return label.includes((String(val) || "").toLowerCase()) ||
              (String(val) || "").toLowerCase().includes(label);
          })?.id || client.categories[0]?.id;
          exp.categoryId = catId;
        } else if (["subcategory", "supplier", "notes"].includes(fieldId)) {
          exp[fieldId] = String(val ?? "");
        } else {
          exp[fieldId] = parseNum(val);
        }
      });

      if (seriesCols.length > 0) {
        const monthly = seriesCols.map(i => parseNum(row[i]));
        exp.monthly = monthly;
        exp.amount  = monthly.reduce((a, b) => a + b, 0);
      }

      return exp;
    });
  }

  const preview = step >= 2 ? buildExpenses() : [];

  // ── Step 1: Upload ─────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="card" style={{ maxWidth: 520 }}>
        <h3 className="h3">Importar desde Excel</h3>
        <p className="lede" style={{ marginBottom: 16 }}>
          Sube un archivo <strong>.xlsx</strong> o <strong>.xls</strong>. Se tomará la primera hoja del libro.
          Luego podrás elegir qué columna corresponde a cada campo.
        </p>
        <label style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "32px 24px", border: "2px dashed var(--line)", borderRadius: 10,
          cursor: "pointer", background: "var(--surface-2)", transition: "background .15s",
        }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}
        >
          <span style={{ fontSize: 36 }}>📊</span>
          <span style={{ fontWeight: 600, color: "var(--text-1)" }}>Haz clic o arrastra tu archivo aquí</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>.xlsx / .xls / .csv</span>
          <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFile} />
        </label>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  // ── Step 2 + 3: Map + Preview ──────────────────────────────────
  const seriesCount = Object.values(mapping).filter(f => f === "monthly").length;

  return (
    <div className="stack lg">
      {/* Header */}
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div>
          <h3 className="h3">Mapear campos · <span style={{ fontWeight: 400, color: "var(--text-3)" }}>{fileName}</span></h3>
          <p className="lede" style={{ marginBottom: 0 }}>
            {rows.length} filas detectadas. Asigna cada columna del Excel al campo correspondiente.
          </p>
        </div>
        <button className="btn ghost" onClick={() => { setStep(1); setHeaders([]); setRows([]); setFileName(""); }}>
          ← Cambiar archivo
        </button>
      </div>

      {/* Mapping table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="t" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>#</th>
              <th>Columna en Excel</th>
              <th>Muestra de valores</th>
              <th style={{ width: 220 }}>Campo destino</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const sample = rows.slice(0, 3).map(r => r[i]).filter(v => v !== "" && v != null).join(" · ");
              const fieldId = mapping[i] || "skip";
              return (
                <tr key={i} style={{ background: fieldId !== "skip" ? "var(--surface-2)" : "" }}>
                  <td style={{ textAlign: "center", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{h || <span style={{ color: "var(--text-3)" }}>(sin nombre)</span>}</td>
                  <td style={{ color: "var(--text-3)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sample || "—"}
                  </td>
                  <td>
                    <select
                      className="select"
                      value={fieldId}
                      onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}
                      style={{ width: "100%" }}
                    >
                      {IMPORT_FIELDS.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {seriesCount > 0 && (
        <div className="pill" style={{ alignSelf: "flex-start", background: "var(--accent-bg)", color: "var(--accent)" }}>
          📅 {seriesCount} columna{seriesCount !== 1 ? "s" : ""} de serie mensual detectadas
        </div>
      )}

      {/* Preview */}
      <div>
        <h4 className="h3" style={{ marginBottom: 10 }}>Vista previa · {preview.length} filas</h4>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            <table className="t" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Subcategoría</th>
                  <th>Proveedor</th>
                  <th className="right">Monto</th>
                  <th className="right">% Ahorro</th>
                  {seriesCount > 0 && <th className="right">Períodos</th>}
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((p, i) => {
                  const cat = client.categories.find(c => c.id === p.categoryId);
                  return (
                    <tr key={i}>
                      <td><CategorySwatch color={cat?.color || "#ccc"} label={catLabel(cat)} /></td>
                      <td>{p.subcategory || "—"}</td>
                      <td>{p.supplier || "—"}</td>
                      <td className="right tabular">{fmtMoney(p.amount, client.currency)}</td>
                      <td className="right tabular">{p.savingsPct > 0 ? p.savingsPct.toFixed(1) + "%" : "—"}</td>
                      {seriesCount > 0 && <td className="right tabular">{p.monthly?.length ?? "—"}</td>}
                      <td style={{ color: "var(--text-3)", fontSize: 11 }}>{p.notes || "—"}</td>
                    </tr>
                  );
                })}
                {preview.length > 20 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "8px 0" }}>
                    +{preview.length - 20} filas más…
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn ghost" onClick={() => { setStep(1); setHeaders([]); setRows([]); setFileName(""); }}>
          Cancelar
        </button>
        <button
          className="btn primary"
          disabled={preview.length === 0}
          onClick={() => onImport(preview)}
        >
          Importar {preview.length} fila{preview.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ExpensesView, ExpenseTable, ManualEntry, PasteImport, ExcelImport, AddCategoryModal });
