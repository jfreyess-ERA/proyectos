/* ============================================================
   Shared UI components
   ============================================================ */

function Topbar({ children }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="topbar no-print">
      <div className="brand">
        <div
          className="brand-logo-slot"
          dangerouslySetInnerHTML={{ __html: `<image-slot id="era-logo" shape="rect" placeholder="Arrastrá aquí el logo ERA Group (PNG)" style="width:120px;height:36px;background:transparent;border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.7);"></image-slot>` }}
        />
        <span className="brand-sep">·</span>
        <span className="brand-tagline">{t.tagline}</span>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        {children}
        <div className="lang-switch">
          <button className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>ES</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>
    </div>
  );
}

function Crumbs({ items }) {
  return (
    <div className="crumbs no-print">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          {it.onClick ? <a onClick={it.onClick}>{it.label}</a> : <span className="here">{it.label}</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Field({ label, hint, children, span = 1 }) {
  return (
    <div className="field" style={{ gridColumn: `span ${span}` }}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, sub, variant = "" }) {
  return (
    <div className={"stat " + variant}>
      <div className="label">{label}</div>
      <div className="value tabular">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function Pill({ children, variant = "" }) {
  return <span className={"pill " + variant}>{children}</span>;
}

function Tier({ tier }) {
  const { t } = useI18n();
  const labelMap = { A: t.profiling.tierA, B: t.profiling.tierB, C: t.profiling.tierC, D: t.profiling.tierD };
  return <span className={"tier " + tier}>{labelMap[tier]}</span>;
}

function Bar({ value, max, variant = "" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar-track">
      <div className={"bar-fill " + variant} style={{ width: pct + "%" }} />
    </div>
  );
}

function FeasDots({ value }) {
  // value 0..5
  const dots = [0, 1, 2, 3, 4].map(i => (
    <span key={i} className={"feas-dot" + (i < value ? (value >= 4 ? " high" : " on") : "")} />
  ));
  return <span className="feas-dots">{dots}</span>;
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="h2">{title}</div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs no-print">
      {tabs.map(tab => (
        <button key={tab.id} className={active === tab.id ? "on" : ""} onClick={() => onChange(tab.id)}>
          {tab.label}
          {tab.count != null && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

function CurrencySelect({ value, onChange }) {
  return (
    <select className="select" value={value} onChange={e => onChange(e.target.value)}>
      {Object.values(CURRENCIES).map(c => (
        <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
      ))}
    </select>
  );
}

function Empty({ icon = "○", title, hint, action }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 48, color: "var(--line)", marginBottom: 4 }}>{icon}</div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

function CategorySwatch({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
      {label}
    </span>
  );
}

Object.assign(window, {
  Topbar, Crumbs, Field, Stat, Pill, Tier, Bar, FeasDots,
  Modal, Tabs, CurrencySelect, Empty, CategorySwatch,
});
