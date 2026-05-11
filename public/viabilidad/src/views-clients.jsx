/* ============================================================
   Views: client list + client form
   ============================================================ */

function ClientsView({ onOpen }) {
  const { t } = useI18n();
  const store = useStore();
  const [search, setSearch] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);

  const filtered = store.state.clients.filter(c =>
    !search ||
    (c.legalName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.tradeName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.sector || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">{t.brand}</div>
          <h1 className="h1">{t.clients.title}</h1>
          <p className="lede">{t.clients.lede}</p>
        </div>
        <div className="btn-row">
          <button className="btn ghost sm" onClick={() => store.resetAll()}>{t.actions.reset}</button>
          <button className="btn" onClick={() => store.seedDemo()}>{t.actions.seed}</button>
          <button className="btn primary" onClick={() => setShowNew(true)}>+ {t.actions.newClient}</button>
        </div>
      </div>

      {store.state.clients.length > 0 && (
        <div style={{ marginBottom: 20, maxWidth: 360 }}>
          <input
            className="input"
            placeholder={t.clients.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {store.state.clients.length === 0 ? (
        <Empty
          icon="◇"
          title={t.clients.empty}
          hint={t.clients.emptyHint}
          action={
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <button className="btn" onClick={() => store.seedDemo()}>{t.actions.seed}</button>
              <button className="btn primary" onClick={() => setShowNew(true)}>+ {t.actions.newClient}</button>
            </div>
          }
        />
      ) : (
        <div className="grid cols-3">
          {filtered.map(c => {
            const spend = totalSpend(c);
            const sav = totalSavings(c);
            return (
              <div key={c.id} className="client-card" onClick={() => onOpen(c.id)}>
                <div className="row between">
                  <div>
                    <div className="name">{c.legalName || "—"}</div>
                    <div className="meta">{c.sector || ""} {c.country ? "· " + c.country : ""}</div>
                  </div>
                  <Pill variant={["muted","champagne","positive","muted"][c.stage]}>
                    {t.client.stages[c.stage]}
                  </Pill>
                </div>
                <div className="stats">
                  <div>
                    <div className="v">{fmtMoney(c.revenue, c.currency, { compact: true })}</div>
                    <div className="l">{t.clients.revenue}</div>
                  </div>
                  <div>
                    <div className="v">{fmtMoney(spend, c.currency, { compact: true })}</div>
                    <div className="l">{t.clients.spend}</div>
                  </div>
                  <div>
                    <div className="v" style={{ color: "var(--positive-2)" }}>{fmtMoney(sav, c.currency, { compact: true })}</div>
                    <div className="l">{t.clients.savings}</div>
                  </div>
                </div>
                <div className="meta" style={{ paddingTop: 8 }}>
                  {c.expenses.length} {t.expenses.rowCount} · {c.categories.length} {t.clients.categories}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewClientModal open={showNew} onClose={() => setShowNew(false)} onCreate={(name) => {
        const id = store.addClient(name);
        setShowNew(false);
        onOpen(id);
      }} />
    </main>
  );
}

function NewClientModal({ open, onClose, onCreate }) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  React.useEffect(() => { if (open) setName(""); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.actions.newClient}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>{t.actions.cancel}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>{t.actions.save}</button>
        </>
      }
    >
      <Field label={t.client.legalName}>
        <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ============================================================
// Client data form (general info)
// ============================================================
function ClientDataView({ client }) {
  const { t } = useI18n();
  const store = useStore();
  const update = (patch) => store.updateClient(client.id, patch);
  const updateContact = (patch) => update({ contact: { ...client.contact, ...patch } });

  return (
    <div className="stack lg">
      <div>
        <div className="eyebrow">{t.client.general}</div>
        <h2 className="h2">{client.legalName || "—"}</h2>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 className="h3">{t.client.general}</h3>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <Field label={t.client.legalName} span={2}>
              <input className="input" value={client.legalName || ""} onChange={e => update({ legalName: e.target.value })} />
            </Field>
            <Field label={t.client.tradeName}>
              <input className="input" value={client.tradeName || ""} onChange={e => update({ tradeName: e.target.value })} />
            </Field>
            <Field label={t.client.taxId}>
              <input className="input" value={client.taxId || ""} onChange={e => update({ taxId: e.target.value })} />
            </Field>
            <Field label={t.client.sector} span={2}>
              <input className="input" value={client.sector || ""} onChange={e => update({ sector: e.target.value })} />
            </Field>
            <Field label={t.client.employees}>
              <input className="input right" type="number" value={client.employees ?? ""} onChange={e => update({ employees: e.target.value === "" ? null : +e.target.value })} />
            </Field>
            <Field label={t.client.sites}>
              <input className="input right" type="number" value={client.sites ?? ""} onChange={e => update({ sites: e.target.value === "" ? null : +e.target.value })} />
            </Field>
            <Field label={t.client.country}>
              <input className="input" value={client.country || ""} onChange={e => update({ country: e.target.value })} />
            </Field>
            <Field label={t.client.currency}>
              <CurrencySelect value={client.currency} onChange={v => update({ currency: v })} />
            </Field>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3 className="h3">Facturación</h3>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <Field label={t.client.year}>
                <input className="input right" type="number" value={client.year ?? ""} onChange={e => update({ year: +e.target.value })} />
              </Field>
              <Field label={t.client.stage}>
                <select className="select" value={client.stage} onChange={e => update({ stage: +e.target.value })}>
                  {t.client.stages.map((s, i) => <option key={i} value={i}>{s}</option>)}
                </select>
              </Field>
              <Field label={`${t.client.revenue} (${client.currency})`} span={2}>
                <input className="input right" type="number" value={client.revenue ?? ""} onChange={e => update({ revenue: e.target.value === "" ? null : +e.target.value })} />
              </Field>
              <Field label={`${t.client.ebitda} (${client.currency})`} span={2}>
                <input className="input right" type="number" value={client.ebitda ?? ""} onChange={e => update({ ebitda: e.target.value === "" ? null : +e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card">
            <h3 className="h3">{t.client.contact}</h3>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <Field label={t.client.contact} span={2}>
                <input className="input" value={client.contact?.name || ""} onChange={e => updateContact({ name: e.target.value })} />
              </Field>
              <Field label={t.client.contactRole}>
                <input className="input" value={client.contact?.role || ""} onChange={e => updateContact({ role: e.target.value })} />
              </Field>
              <Field label={t.client.phone}>
                <input className="input" value={client.contact?.phone || ""} onChange={e => updateContact({ phone: e.target.value })} />
              </Field>
              <Field label={t.client.email} span={2}>
                <input className="input" value={client.contact?.email || ""} onChange={e => updateContact({ email: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="h3">{t.client.notes}</h3>
        <textarea className="textarea" value={client.notes || ""} onChange={e => update({ notes: e.target.value })} placeholder="…" />
      </div>

      <div className="row between">
        <div className="meta" style={{ fontSize: 12, color: "var(--text-3)" }}>
          {t.clients.created}: {new Date(client.createdAt).toLocaleDateString()} · {t.clients.lastEdit}: {new Date(client.updatedAt).toLocaleString()}
        </div>
        <button className="btn danger" onClick={() => {
          if (confirm(t.common.confirmDelete)) {
            store.deleteClient(client.id);
          }
        }}>{t.actions.delete}</button>
      </div>
    </div>
  );
}

Object.assign(window, { ClientsView, ClientDataView, NewClientModal });
