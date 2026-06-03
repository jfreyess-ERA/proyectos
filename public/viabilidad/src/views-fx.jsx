/* ============================================================
   FX View — Tipo de cambio vs. USD
   API: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@DATE/v1/currencies/usd.json
   ============================================================ */

function FXView() {
  const { t } = useI18n();
  const ft = (t && t.fx) || {};

  const CURRENCIES_FX = [
    { code: "clp", label: "Peso chileno",     flag: "🇨🇱", display: "CLP" },
    { code: "ars", label: "Peso argentino",   flag: "🇦🇷", display: "ARS" },
    { code: "cop", label: "Peso colombiano",  flag: "🇨🇴", display: "COP" },
    { code: "uyu", label: "Peso uruguayo",    flag: "🇺🇾", display: "UYU" },
    { code: "pyg", label: "Guaraní paraguayo",flag: "🇵🇾", display: "PYG" },
  ];

  const [rates, setRates] = React.useState(null);
  const [history, setHistory] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [lastUpdated, setLastUpdated] = React.useState(null);

  function apiUrl(date) {
    const d = date || "latest";
    return "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@" + d + "/v1/currencies/usd.json";
  }

  function getPastMonthDate(monthsAgo) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  async function fetchRates() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("latest"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const usd = json.usd || {};
      const current = {};
      CURRENCIES_FX.forEach(function(c) { current[c.code] = usd[c.code] || null; });
      setRates(current);
      setLastUpdated(json.date || new Date().toISOString().slice(0, 10));

      const months = [];
      for (var i = 12; i >= 1; i--) months.push(getPastMonthDate(i));

      const results = await Promise.all(months.map(function(date) {
        return fetch(apiUrl(date))
          .then(function(r) { return r.ok ? r.json() : null; })
          .catch(function() { return null; });
      }));

      const hist = {};
      CURRENCIES_FX.forEach(function(c) { hist[c.code] = []; });

      results.forEach(function(json) {
        if (!json) {
          CURRENCIES_FX.forEach(function(c) { hist[c.code].push(null); });
          return;
        }
        const usdH = json.usd || {};
        CURRENCIES_FX.forEach(function(c) { hist[c.code].push(usdH[c.code] || null); });
      });

      setHistory(hist);
    } catch (e) {
      setError(e.message || "Error al cargar tasas");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(function() { fetchRates(); }, []);

  function Sparkline({ values }) {
    const pts = (values || []).filter(function(v) { return v != null; });
    if (pts.length < 2) {
      return React.createElement("svg", { width: 120, height: 40, viewBox: "0 0 120 40" },
        React.createElement("text", { x: 60, y: 24, textAnchor: "middle", fontSize: 10, fill: "var(--text-3)" }, "—")
      );
    }
    const min = Math.min.apply(null, pts);
    const max = Math.max.apply(null, pts);
    const range = max - min || 1;
    const w = 120, h = 40, pad = 4;
    const step = (w - pad * 2) / (pts.length - 1);
    const points = pts.map(function(v, i) {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return React.createElement("svg", {
      width: w, height: h, viewBox: "0 0 " + w + " " + h,
      style: { display: "block" }
    },
      React.createElement("polyline", {
        points: points,
        fill: "none",
        stroke: "var(--accent)",
        strokeWidth: 1.5,
        strokeLinejoin: "round",
        strokeLinecap: "round",
      })
    );
  }

  function fmtRate(v, code) {
    if (v == null) return "—";
    if (code === "ars" || code === "cop" || code === "pyg") {
      return v.toLocaleString("es-CL", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
    }
    return v.toLocaleString("es-CL", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  function calcVariation(current, histValues) {
    if (!histValues || histValues.length === 0) return null;
    const oldest = histValues.find(function(v) { return v != null; });
    if (oldest == null || current == null) return null;
    return ((current - oldest) / oldest) * 100;
  }

  if (loading) {
    return React.createElement("main", null,
      React.createElement("div", { className: "row between", style: { marginBottom: 24 } },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "ERA Group"),
          React.createElement("h1", { className: "h1" }, ft.title || "Tipo de cambio"),
          React.createElement("p", { className: "lede" }, ft.subtitle || "Evolución vs. USD")
        )
      ),
      React.createElement("div", { style: { padding: "40px 0", textAlign: "center", color: "var(--text-2)" } },
        ft.loading || "Cargando tasas…"
      )
    );
  }

  if (error) {
    return React.createElement("main", null,
      React.createElement("div", { className: "row between", style: { marginBottom: 24 } },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "ERA Group"),
          React.createElement("h1", { className: "h1" }, ft.title || "Tipo de cambio")
        ),
        React.createElement("button", { className: "btn ghost sm", onClick: fetchRates }, ft.update || "↻ Actualizar")
      ),
      React.createElement("div", { style: { padding: "40px 0", textAlign: "center", color: "#c00" } },
        "Error: " + error
      )
    );
  }

  return React.createElement("main", null,
    React.createElement("div", { className: "row between", style: { marginBottom: 24 } },
      React.createElement("div", null,
        React.createElement("div", { className: "eyebrow" }, "ERA Group"),
        React.createElement("h1", { className: "h1" }, ft.title || "Tipo de cambio · USD"),
        React.createElement("p", { className: "lede" }, ft.subtitle || "Evolución vs. USD")
      ),
      React.createElement("button", { className: "btn ghost sm", onClick: fetchRates }, ft.update || "↻ Actualizar")
    ),

    React.createElement("div", { className: "grid cols-3", style: { gap: 16, marginBottom: 24 } },
      CURRENCIES_FX.map(function(cur) {
        const currentRate = rates && rates[cur.code];
        const histValues = history && history[cur.code];
        const variation = calcVariation(currentRate, histValues);
        const rateUp = variation != null && variation > 0;
        const varColor = rateUp ? "var(--negative, #c00)" : "var(--positive-2, #1a7f4b)";
        const varArrow = rateUp ? "↑" : "↓";

        return React.createElement("div", { key: cur.code, className: "card", style: { display: "flex", flexDirection: "column", gap: 10 } },
          React.createElement("div", { className: "row between" },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("span", { style: { fontSize: 24, lineHeight: 1 } }, cur.flag),
              React.createElement("div", null,
                React.createElement("div", { style: { fontWeight: 700, fontSize: 14, color: "var(--text-1)" } }, cur.label),
                React.createElement("div", { style: { fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: 0.5 } }, cur.display)
              )
            )
          ),

          React.createElement("div", { style: { fontVariantNumeric: "tabular-nums" } },
            React.createElement("div", { style: { fontSize: 11, color: "var(--text-3)", marginBottom: 2 } }, "1 USD ="),
            React.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: "var(--text-1)" } },
              fmtRate(currentRate, cur.code) + " " + cur.display
            )
          ),

          variation != null && React.createElement("div", {
            style: { fontSize: 13, fontWeight: 600, color: varColor }
          },
            varArrow + " " + Math.abs(variation).toFixed(1) + "% " + (ft.vs12m || "vs. hace 12 meses")
          ),

          React.createElement(Sparkline, { values: histValues })
        );
      })
    ),

    React.createElement("div", { style: { fontSize: 12, color: "var(--text-3)", marginTop: 8 } },
      (ft.source || "Fuente: ECB / Frankfurter API") +
      (lastUpdated ? " · " + (ft.updated || "Actualizado") + ": " + lastUpdated : "")
    )
  );
}

Object.assign(window, { FXView });
