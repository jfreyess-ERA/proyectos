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
          { id: "table", label: t.expenses.modes.table },
          { id: "manual", label: t.expenses.modes.manual },
          { id: "paste", label: t.expenses.modes.paste },
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

Object.assign(window, { ExpensesView, ExpenseTable, ManualEntry, PasteImport, AddCategoryModal });
