import React, { useState, useEffect, useCallback, useRef } from "react";

const SECTOR_MAP = {
  NIO: "Consumer Cyclical", VALE: "Basic Materials", INTC: "Technology",
  SOFI: "Financial Services", AMD: "Technology", COIN: "Financial Services",
  PLTR: "Technology", NVDA: "Technology", F: "Consumer Cyclical",
  AAL: "Industrials", NVTS: "Technology", AAPL: "Technology",
  MSFT: "Technology", TSLA: "Consumer Cyclical", BAC: "Financial Services",
  T: "Communication", SNAP: "Communication", HOOD: "Financial Services",
  LCID: "Consumer Cyclical", RIVN: "Consumer Cyclical", MARA: "Financial Services",
  RIOT: "Financial Services", CLF: "Basic Materials", CCL: "Consumer Cyclical",
  PLUG: "Industrials", SIRI: "Communication", WBD: "Communication",
  GRAB: "Technology", DNA: "Healthcare", OPEN: "Real Estate",
  SKLZ: "Technology", RIG: "Energy", ET: "Energy", KMI: "Energy",
  MRO: "Energy", HAL: "Energy", SLB: "Energy", OXY: "Energy",
  DVN: "Energy", FANG: "Energy", PBR: "Energy",
};

const TIER_CONFIG = {
  core: { label: "Core", color: "#22c55e", tickers: ["NIO","VALE","INTC","SOFI"] },
  mid: { label: "Mid-Tier", color: "#f59e0b", tickers: ["AMD","COIN","SNAP","HOOD","F"] },
  premium: { label: "Premium", color: "#8b5cf6", tickers: ["PLTR","NVDA","AAPL","MSFT","TSLA"] },
};

const STATUS_COLORS = {
  "Active Put": { bg: "#1e3a5f", text: "#60a5fa", border: "#2563eb" },
  "Active Call": { bg: "#1a3d2e", text: "#4ade80", border: "#16a34a" },
  "Assigned": { bg: "#4a2030", text: "#f472b6", border: "#db2777" },
  "Closed - Profit": { bg: "#14352a", text: "#34d399", border: "#059669" },
  "Closed - Loss": { bg: "#451a1a", text: "#f87171", border: "#dc2626" },
  "Rolled": { bg: "#3b2f1a", text: "#fbbf24", border: "#d97706" },
};

function getStoredPositions() {
  try {
    const stored = localStorage.getItem("wheel_positions");
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return null;
}

const DEFAULT_POSITIONS = [
  { id: 1, ticker: "SOFI", type: "Cash-Secured Put", strike: 8.5, premium: 0.32, contracts: 3, dte: 34, expiry: "2026-03-06", status: "Active Put", openDate: "2026-01-28", delta: 0.20, iv: 52.3 },
  { id: 2, ticker: "NIO", type: "Cash-Secured Put", strike: 4.5, premium: 0.18, contracts: 5, dte: 41, expiry: "2026-03-13", status: "Active Put", openDate: "2026-01-26", delta: 0.18, iv: 68.1 },
  { id: 3, ticker: "VALE", type: "Covered Call", strike: 11.0, premium: 0.25, contracts: 2, dte: 27, expiry: "2026-02-27", status: "Active Call", openDate: "2026-01-25", delta: 0.22, iv: 35.7 },
  { id: 4, ticker: "INTC", type: "Cash-Secured Put", strike: 20.0, premium: 0.55, contracts: 1, dte: 48, expiry: "2026-03-20", status: "Active Put", openDate: "2026-01-27", delta: 0.19, iv: 44.8 },
  { id: 5, ticker: "SOFI", type: "Cash-Secured Put", strike: 9.0, premium: 0.28, contracts: 3, dte: -5, expiry: "2026-01-23", status: "Closed - Profit", openDate: "2026-01-02", delta: 0.21, iv: 49.1 },
  { id: 6, ticker: "NIO", type: "Covered Call", strike: 5.0, premium: 0.15, contracts: 5, dte: -12, expiry: "2026-01-16", status: "Closed - Profit", openDate: "2025-12-18", delta: 0.23, iv: 71.2 },
];

function formatCurrency(val) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function formatPct(val) {
  return (val >= 0 ? "+" : "") + val.toFixed(2) + "%";
}

function getTier(ticker) {
  for (const [key, cfg] of Object.entries(TIER_CONFIG)) {
    if (cfg.tickers.includes(ticker)) return { key, ...cfg };
  }
  return { key: "core", label: "Other", color: "#6b7280" };
}

function SparkLine({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function SectorChart({ positions }) {
  const sectorTotals = {};
  positions.filter(p => p.status.startsWith("Active")).forEach(p => {
    const sector = SECTOR_MAP[p.ticker] || "Other";
    const capital = p.strike * 100 * p.contracts;
    sectorTotals[sector] = (sectorTotals[sector] || 0) + capital;
  });

  const total = Object.values(sectorTotals).reduce((a, b) => a + b, 0) || 1;
  const sectors = Object.entries(sectorTotals)
    .map(([name, val]) => ({ name, val, pct: (val / total) * 100 }))
    .sort((a, b) => b.val - a.val);

  const sectorColors = {
    "Technology": "#8b5cf6", "Financial Services": "#3b82f6",
    "Consumer Cyclical": "#f59e0b", "Basic Materials": "#10b981",
    "Industrials": "#6366f1", "Communication": "#ec4899",
    "Energy": "#ef4444", "Healthcare": "#14b8a6",
    "Real Estate": "#f97316", "Other": "#6b7280",
  };

  let cumAngle = 0;
  const slices = sectors.map(s => {
    const angle = (s.pct / 100) * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { ...s, start, angle, color: sectorColors[s.name] || "#6b7280" };
  });

  function polarToCartesian(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const s = polarToCartesian(cx, cy, r, startAngle);
    const e = polarToCartesian(cx, cy, r, endAngle);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
  }

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        {slices.map((s, i) => (
          <path key={i} d={arcPath(90, 90, 85, s.start, s.start + s.angle - 0.5)}
            fill={s.color} opacity={0.85} stroke="#0f1117" strokeWidth={2}>
            <title>{s.name}: {s.pct.toFixed(1)}%</title>
          </path>
        ))}
        <circle cx={90} cy={90} r={40} fill="#0f1117" />
        <text x={90} y={86} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="inherit">SECTORS</text>
        <text x={90} y={102} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight={700} fontFamily="inherit">{sectors.length}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {sectors.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: sectorColors[s.name] || "#6b7280", flexShrink: 0 }} />
            <span style={{ color: "#94a3b8", fontSize: 12, flex: 1 }}>{s.name}</span>
            <div style={{ width: 100, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${s.pct}%`, height: "100%", background: sectorColors[s.name] || "#6b7280", borderRadius: 3 }} />
            </div>
            <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, width: 42, textAlign: "right" }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const est = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = est.getHours();
  const m = est.getMinutes();
  const mins = h * 60 + m;
  const isOpen = mins >= 570 && mins < 960;
  const isPremarket = mins >= 240 && mins < 570;
  const isSafe = mins >= 630;

  let status, statusColor;
  if (isOpen && isSafe) { status = "MARKET OPEN — SAFE TO TRADE"; statusColor = "#22c55e"; }
  else if (isOpen && !isSafe) { status = "MARKET OPEN — WAIT UNTIL 10:30 AM"; statusColor = "#f59e0b"; }
  else if (isPremarket) { status = "PRE-MARKET"; statusColor = "#60a5fa"; }
  else { status = "MARKET CLOSED"; statusColor = "#ef4444"; }

  const timeStr = est.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const pctThrough = isOpen ? Math.min(100, ((mins - 570) / 390) * 100) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", background: "#0c0f16", borderRadius: 10, border: `1px solid ${statusColor}33`, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        <span style={{ color: statusColor, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>{status}</span>
      </div>
      <span style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto" }}>{timeStr} EST</span>
      {isOpen && (
        <div style={{ width: 120, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pctThrough}%`, height: "100%", background: statusColor, borderRadius: 2, transition: "width 1s linear" }} />
        </div>
      )}
    </div>
  );
}

function AddPositionModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    ticker: "", type: "Cash-Secured Put", strike: "", premium: "",
    contracts: 1, expiry: "", delta: 0.20, iv: "",
  });

  const handleSubmit = () => {
    if (!form.ticker || !form.strike || !form.premium || !form.expiry) return;
    const exp = new Date(form.expiry + "T00:00:00");
    const now = new Date();
    const dte = Math.ceil((exp - now) / 86400000);
    onAdd({
      id: Date.now(),
      ticker: form.ticker.toUpperCase(),
      type: form.type,
      strike: parseFloat(form.strike),
      premium: parseFloat(form.premium),
      contracts: parseInt(form.contracts),
      dte,
      expiry: form.expiry,
      status: form.type === "Cash-Secured Put" ? "Active Put" : "Active Call",
      openDate: new Date().toISOString().split("T")[0],
      delta: parseFloat(form.delta),
      iv: parseFloat(form.iv) || 0,
    });
    onClose();
  };

  const inputStyle = {
    background: "#1e293b", border: "1px solid #334155", borderRadius: 6,
    padding: "8px 12px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: "#141821", border: "1px solid #2a3040", borderRadius: 16, padding: 28, width: 440, maxHeight: "90vh", overflow: "auto" }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#e2e8f0", margin: "0 0 20px", fontSize: 18, fontFamily: "inherit" }}>New Position</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Ticker", key: "ticker", placeholder: "e.g. SOFI" },
            { label: "Strike", key: "strike", type: "number", placeholder: "8.50" },
            { label: "Premium", key: "premium", type: "number", placeholder: "0.32" },
            { label: "Contracts", key: "contracts", type: "number" },
            { label: "Expiry", key: "expiry", type: "date" },
            { label: "Delta", key: "delta", type: "number", placeholder: "0.20" },
            { label: "IV %", key: "iv", type: "number", placeholder: "52.3" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{f.label}</label>
              <input type={f.type || "text"} style={inputStyle} placeholder={f.placeholder}
                value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Type</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option>Cash-Secured Put</option>
              <option>Covered Call</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Add Position</button>
        </div>
      </div>
    </div>
  );
}

function EditPositionModal({ position, onSave, onDelete, onClose }) {
  const [status, setStatus] = useState(position.status);

  const inputStyle = {
    background: "#1e293b", border: "1px solid #334155", borderRadius: 6,
    padding: "8px 12px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: "#141821", border: "1px solid #2a3040", borderRadius: 16, padding: 28, width: 380 }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#e2e8f0", margin: "0 0 6px", fontSize: 18, fontFamily: "inherit" }}>
          Edit {position.ticker} — ${position.strike.toFixed(2)} {position.type === "Cash-Secured Put" ? "CSP" : "CC"}
        </h3>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>Opened {position.openDate} · Expires {position.expiry}</p>

        <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Status</label>
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option>Active Put</option>
          <option>Active Call</option>
          <option>Assigned</option>
          <option>Closed - Profit</option>
          <option>Closed - Loss</option>
          <option>Rolled</option>
        </select>

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
          <button onClick={() => { onDelete(position.id); onClose(); }}
            style={{ padding: "8px 18px", background: "#451a1a", color: "#f87171", border: "1px solid #dc262644", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            Delete
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "8px 18px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => { onSave(position.id, { status }); onClose(); }}
              style={{ padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────
export default function WheelTracker() {
  const [tab, setTab] = useState("positions");
  const [positions, setPositions] = useState(() => getStoredPositions() || DEFAULT_POSITIONS);
  const [prices, setPrices] = useState({});
  const [sparkData, setSparkData] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPosition, setEditPosition] = useState(null);
  const [sortCol, setSortCol] = useState("dte");
  const [sortDir, setSortDir] = useState(1);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  // Persist positions to localStorage
  useEffect(() => {
    try { localStorage.setItem("wheel_positions", JSON.stringify(positions)); } catch (e) {}
  }, [positions]);

  // Recalculate DTEs on load
  useEffect(() => {
    const now = new Date();
    setPositions(prev => prev.map(p => {
      const exp = new Date(p.expiry + "T00:00:00");
      const dte = Math.ceil((exp - now) / 86400000);
      return { ...p, dte };
    }));
  }, []);

  const allTickers = [...new Set([
    ...positions.map(p => p.ticker),
    ...Object.values(TIER_CONFIG).flatMap(t => t.tickers),
    "SPY", "QQQ", "IWM", "VIX"
  ])];

  const fetchPrices = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Use Yahoo Finance v8 quote API via a CORS proxy
      const symbols = allTickers.join(",");
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${allTickers[0]}`;

      // Fetch each ticker individually (Yahoo v8 is per-symbol)
      const results = {};
      const batchSize = 5;
      for (let i = 0; i < allTickers.length; i += batchSize) {
        const batch = allTickers.slice(i, i + batchSize);
        const promises = batch.map(async (ticker) => {
          try {
            const vixTicker = ticker === "VIX" ? "^VIX" : ticker;
            const resp = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${vixTicker}?interval=1d&range=1mo`,
              { headers: { "User-Agent": "Mozilla/5.0" } }
            );
            if (!resp.ok) return;
            const data = await resp.json();
            const result = data?.chart?.result?.[0];
            if (!result) return;

            const meta = result.meta;
            const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose;
            const change = price - prevClose;
            const changePct = prevClose ? (change / prevClose) * 100 : 0;

            results[ticker] = {
              price,
              change: parseFloat(change.toFixed(2)),
              changePct: parseFloat(changePct.toFixed(2)),
              high: meta.regularMarketDayHigh || null,
              low: meta.regularMarketDayLow || null,
              volume: meta.regularMarketVolume
                ? (meta.regularMarketVolume / 1e6).toFixed(1) + "M"
                : null,
              closes: closes.slice(-20),
            };
          } catch (e) {
            console.warn(`Failed to fetch ${ticker}:`, e);
          }
        });
        await Promise.all(promises);
      }

      setPrices(results);
      setSparkData(prev => {
        const next = { ...prev };
        for (const [t, d] of Object.entries(results)) {
          if (d.closes?.length) {
            next[t] = d.closes;
          } else if (d.price) {
            next[t] = [...(prev[t] || []), d.price].slice(-20);
          }
        }
        return next;
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Price fetch error:", err);
      setError("Could not fetch prices. Yahoo Finance may be rate-limiting. Try again in a moment.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [allTickers.join(",")]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPosition = (pos) => {
    setPositions(prev => [...prev, pos]);
  };

  const handleEditSave = (id, updates) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleDelete = (id) => {
    setPositions(prev => prev.filter(p => p.id !== id));
  };

  const activePositions = positions.filter(p => p.status.startsWith("Active"));
  const closedPositions = positions.filter(p => p.status.startsWith("Closed") || p.status === "Rolled");

  const totalPremium = positions.reduce((s, p) => s + p.premium * 100 * p.contracts, 0);
  const activePremium = activePositions.reduce((s, p) => s + p.premium * 100 * p.contracts, 0);
  const totalCapitalAtRisk = activePositions.reduce((s, p) => s + p.strike * 100 * p.contracts, 0);
  const avgDelta = activePositions.length ? (activePositions.reduce((s, p) => s + p.delta, 0) / activePositions.length) : 0;
  const avgDTE = activePositions.length ? Math.round(activePositions.reduce((s, p) => s + Math.max(0, p.dte), 0) / activePositions.length) : 0;
  const winRate = closedPositions.length ? ((closedPositions.filter(p => p.status === "Closed - Profit").length / closedPositions.length) * 100) : 0;

  const sorted = [...positions].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === "string") return va.localeCompare(vb) * sortDir;
    return ((va || 0) - (vb || 0)) * sortDir;
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(1); }
  };

  const indexTickers = ["SPY", "QQQ", "IWM", "VIX"];

  const tabs = [
    { key: "positions", label: "Positions", icon: "📊" },
    { key: "summary", label: "Summary", icon: "📈" },
    { key: "market", label: "Market", icon: "🌐" },
  ];

  const uniqueTickers = [...new Set(positions.map(p => p.ticker))];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0d14",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e2e8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 3px; }
        input:focus, select:focus { border-color: #3b82f6 !important; }
        button { transition: filter 0.15s; }
        button:hover { filter: brightness(1.15); }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fade-in 0.35s ease-out; }
        .row-hover { transition: background 0.15s; cursor: pointer; }
        .row-hover:hover { background: #161b26 !important; }
      `}</style>

      {/* ─── HEADER ─── */}
      <div style={{ background: "#0c0f16", borderBottom: "1px solid #1a1f2e", padding: "16px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚙</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: "#f1f5f9" }}>WHEEL STRATEGY COMMAND CENTER</h1>
              <p style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase" }}>Premium Collection • Systematic Income</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastUpdate && (
              <span style={{ color: "#475569", fontSize: 11 }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button onClick={fetchPrices} disabled={loading}
              style={{
                padding: "7px 16px", background: loading ? "#1e293b" : "#1e3a5f",
                color: loading ? "#475569" : "#60a5fa", border: "1px solid #2563eb44",
                borderRadius: 6, cursor: loading ? "default" : "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}>
              {loading ? "Fetching…" : "↻ Refresh Prices"}
            </button>
          </div>
        </div>
        <MarketClock />
        {error && (
          <div style={{ marginTop: 8, padding: "8px 14px", background: "#451a1a", border: "1px solid #dc262644", borderRadius: 6, color: "#f87171", fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      {/* ─── INDEX BAR ─── */}
      <div style={{ display: "flex", gap: 1, background: "#0c0f16", borderBottom: "1px solid #1a1f2e", padding: "0 28px", overflowX: "auto" }}>
        {indexTickers.map(t => {
          const d = prices[t];
          const isUp = d?.changePct >= 0;
          return (
            <div key={t} style={{ flex: 1, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 180, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>{t === "VIX" ? "^VIX" : t}</span>
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {d?.price ? d.price.toFixed(2) : "—"}
                </span>
              </div>
              {d?.changePct !== undefined && (
                <span style={{ color: t === "VIX" ? (isUp ? "#f87171" : "#4ade80") : (isUp ? "#4ade80" : "#f87171"), fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatPct(d.changePct)}
                </span>
              )}
              <SparkLine data={sparkData[t]} color={isUp ? "#22c55e" : "#ef4444"} width={60} height={22} />
            </div>
          );
        })}
      </div>

      {/* ─── TABS ─── */}
      <div style={{ display: "flex", gap: 0, padding: "0 28px", background: "#0c0f16", borderBottom: "1px solid #1a1f2e" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "12px 24px", background: "none", border: "none",
              borderBottom: tab === t.key ? "2px solid #3b82f6" : "2px solid transparent",
              color: tab === t.key ? "#e2e8f0" : "#64748b",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: 28 }} className="fade-in">

        {/* ═══ POSITIONS TAB ═══ */}
        {tab === "positions" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Premium", value: formatCurrency(totalPremium), color: "#22c55e" },
                { label: "Active Premium", value: formatCurrency(activePremium), color: "#60a5fa" },
                { label: "Capital at Risk", value: formatCurrency(totalCapitalAtRisk), color: "#f59e0b" },
                { label: "Avg Delta", value: avgDelta.toFixed(2), color: "#8b5cf6" },
                { label: "Avg DTE", value: `${avgDTE}d`, color: "#14b8a6" },
                { label: "Win Rate", value: `${winRate.toFixed(0)}%`, color: winRate >= 70 ? "#22c55e" : "#f59e0b" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5 }}>ALL POSITIONS <span style={{ color: "#475569", fontWeight: 400 }}>— click row to edit</span></h2>
              <button onClick={() => setShowAddModal(true)}
                style={{ padding: "8px 18px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                + New Position
              </button>
            </div>

            <div style={{ background: "#0f1117", borderRadius: 12, border: "1px solid #1a1f2e", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0c0e15" }}>
                      {[
                        { key: "ticker", label: "TICKER" }, { key: "type", label: "TYPE" },
                        { key: "strike", label: "STRIKE" }, { key: "premium", label: "PREMIUM" },
                        { key: "contracts", label: "QTY" }, { key: "dte", label: "DTE" },
                        { key: "status", label: "STATUS" }, { key: null, label: "MKT PRICE" },
                        { key: null, label: "P/L" }, { key: "delta", label: "Δ" },
                        { key: "iv", label: "IV%" }, { key: null, label: "TREND" },
                      ].map((h, i) => (
                        <th key={i} onClick={() => h.key && handleSort(h.key)}
                          style={{
                            padding: "10px 12px", textAlign: "left", color: "#475569",
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                            borderBottom: "1px solid #1a1f2e", cursor: h.key ? "pointer" : "default",
                            userSelect: "none", whiteSpace: "nowrap",
                          }}>
                          {h.label} {sortCol === h.key ? (sortDir === 1 ? "↑" : "↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(pos => {
                      const tier = getTier(pos.ticker);
                      const sc = STATUS_COLORS[pos.status] || { bg: "#1e293b", text: "#94a3b8", border: "#475569" };
                      const mktPrice = prices[pos.ticker]?.price;
                      const totalPrem = pos.premium * 100 * pos.contracts;

                      let plValue = null;
                      if (mktPrice && pos.status.startsWith("Active")) {
                        if (pos.type === "Cash-Secured Put") {
                          plValue = mktPrice > pos.strike ? totalPrem : (pos.strike - mktPrice + pos.premium) * 100 * pos.contracts;
                          if (mktPrice < pos.strike - pos.premium) plValue = (mktPrice - pos.strike + pos.premium) * 100 * pos.contracts;
                        } else {
                          plValue = totalPrem;
                        }
                      }

                      const dteColor = pos.dte <= 0 ? "#ef4444" : pos.dte <= 7 ? "#ef4444" : pos.dte <= 14 ? "#f59e0b" : "#22c55e";

                      return (
                        <tr key={pos.id} className="row-hover" style={{ borderBottom: "1px solid #141821" }}
                          onClick={() => setEditPosition(pos)}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 3, height: 24, borderRadius: 2, background: tier.color }} />
                              <div>
                                <span style={{ color: "#f1f5f9", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pos.ticker}</span>
                                <div style={{ fontSize: 9, color: tier.color, fontWeight: 600, marginTop: 1 }}>{tier.label}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", color: pos.type === "Cash-Secured Put" ? "#60a5fa" : "#4ade80", fontSize: 12, fontWeight: 500 }}>
                            {pos.type === "Cash-Secured Put" ? "CSP" : "CC"}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>${pos.strike.toFixed(2)}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#22c55e" }}>${pos.premium.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: "#64748b" }}>{formatCurrency(totalPrem)} total</div>
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>{pos.contracts}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ color: dteColor, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                              {pos.dte > 0 ? pos.dte : "EXP"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              display: "inline-block", padding: "3px 10px", borderRadius: 20,
                              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}44`,
                              fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap",
                            }}>{pos.status}</span>
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                            {mktPrice ? `$${mktPrice.toFixed(2)}` : <span style={{ color: "#475569" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {plValue !== null ? (
                              <span style={{ color: plValue >= 0 ? "#4ade80" : "#f87171", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                {plValue >= 0 ? "+" : ""}{formatCurrency(plValue)}
                              </span>
                            ) : pos.status.startsWith("Closed") ? (
                              <span style={{ color: "#22c55e", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatCurrency(totalPrem)}</span>
                            ) : <span style={{ color: "#475569" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: "#8b5cf6", fontWeight: 500 }}>{pos.delta.toFixed(2)}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: pos.iv > 50 ? "#f59e0b" : "#94a3b8" }}>{pos.iv.toFixed(1)}%</td>
                          <td style={{ padding: "10px 12px" }}>
                            <SparkLine data={sparkData[pos.ticker]} color={prices[pos.ticker]?.changePct >= 0 ? "#22c55e" : "#ef4444"} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ SUMMARY TAB ═══ */}
        {tab === "summary" && (
          <div className="fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Portfolio Value (at risk)", value: formatCurrency(totalCapitalAtRisk), sub: `${activePositions.length} active positions`, color: "#3b82f6", icon: "💰" },
                { label: "Total Premium Collected", value: formatCurrency(totalPremium), sub: `${positions.length} total trades`, color: "#22c55e", icon: "📈" },
                { label: "Annualized ROI", value: totalCapitalAtRisk > 0 ? `${((totalPremium / totalCapitalAtRisk) * (365 / Math.max(avgDTE, 1)) * 100).toFixed(1)}%` : "—", sub: "Projected annual return", color: "#8b5cf6", icon: "🎯" },
                { label: "Win Rate", value: `${winRate.toFixed(0)}%`, sub: `${closedPositions.filter(p => p.status === "Closed - Profit").length}W / ${closedPositions.filter(p => p.status === "Closed - Loss").length}L`, color: winRate >= 70 ? "#22c55e" : "#f59e0b", icon: "🏆" },
              ].map((card, i) => (
                <div key={i} style={{ background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 14, padding: 20, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 14, right: 16, fontSize: 24, opacity: 0.3 }}>{card.icon}</div>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{card.label}</div>
                  <div style={{ color: card.color, fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{card.value}</div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 6 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 14, padding: 24 }}>
                <h3 style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18 }}>Sector Allocation</h3>
                <SectorChart positions={positions} />
              </div>

              <div style={{ background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 14, padding: 24 }}>
                <h3 style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18 }}>Tier Breakdown</h3>
                {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
                  const tierPositions = activePositions.filter(p => cfg.tickers.includes(p.ticker));
                  const tierCapital = tierPositions.reduce((s, p) => s + p.strike * 100 * p.contracts, 0);
                  const tierPremium = tierPositions.reduce((s, p) => s + p.premium * 100 * p.contracts, 0);
                  const pct = totalCapitalAtRisk > 0 ? (tierCapital / totalCapitalAtRisk) * 100 : 0;
                  return (
                    <div key={key} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.color }} />
                          <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{cfg.label}</span>
                          <span style={{ color: "#475569", fontSize: 11 }}>({tierPositions.length})</span>
                        </div>
                        <span style={{ color: cfg.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13 }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: 4, transition: "width 0.5s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#475569" }}>Capital: {formatCurrency(tierCapital)}</span>
                        <span style={{ color: "#22c55e" }}>Premium: {formatCurrency(tierPremium)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 14, padding: 24 }}>
              <h3 style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18 }}>Per-Ticker Performance</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {uniqueTickers.map(ticker => {
                  const tp = positions.filter(p => p.ticker === ticker);
                  const prem = tp.reduce((s, p) => s + p.premium * 100 * p.contracts, 0);
                  const trades = tp.length;
                  const wins = tp.filter(p => p.status === "Closed - Profit").length;
                  const active = tp.filter(p => p.status.startsWith("Active")).length;
                  const tier = getTier(ticker);
                  const mp = prices[ticker];
                  return (
                    <div key={ticker} style={{ background: "#141821", borderRadius: 10, padding: 16, border: `1px solid ${tier.color}22` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#f1f5f9", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{ticker}</span>
                          <span style={{ fontSize: 9, color: tier.color, fontWeight: 600, background: `${tier.color}15`, padding: "2px 6px", borderRadius: 4 }}>{tier.label}</span>
                        </div>
                        {mp && (
                          <span style={{ color: mp.changePct >= 0 ? "#4ade80" : "#f87171", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                            ${mp.price?.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <SparkLine data={sparkData[ticker]} color={tier.color} width={170} height={30} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Premium: <span style={{ color: "#22c55e", fontWeight: 600 }}>{formatCurrency(prem)}</span></div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Trades: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{trades}</span></div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Active: <span style={{ color: "#60a5fa", fontWeight: 600 }}>{active}</span></div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Wins: <span style={{ color: "#4ade80", fontWeight: 600 }}>{wins}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MARKET TAB ═══ */}
        {tab === "market" && (
          <div className="fade-in">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 16 }}>WATCHLIST & MARKET DATA</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {[...uniqueTickers, ...Object.values(TIER_CONFIG).flatMap(t => t.tickers)].filter((v, i, a) => a.indexOf(v) === i).map(ticker => {
                const d = prices[ticker];
                const tier = getTier(ticker);
                const isUp = d?.changePct >= 0;
                return (
                  <div key={ticker} style={{
                    background: "#0f1117", border: "1px solid #1a1f2e", borderRadius: 12, padding: 18,
                    borderLeft: `3px solid ${tier.color}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#f1f5f9", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 16 }}>{ticker}</span>
                          <span style={{ fontSize: 9, color: tier.color, fontWeight: 600, background: `${tier.color}15`, padding: "2px 6px", borderRadius: 4 }}>{tier.label}</span>
                        </div>
                        <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>{SECTOR_MAP[ticker] || "—"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                          {d?.price ? `$${d.price.toFixed(2)}` : "—"}
                        </div>
                        {d?.changePct !== undefined && (
                          <div style={{ color: isUp ? "#4ade80" : "#f87171", fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                            {isUp ? "▲" : "▼"} {formatPct(d.changePct)}
                          </div>
                        )}
                      </div>
                    </div>
                    <SparkLine data={sparkData[ticker]} color={isUp ? "#22c55e" : "#ef4444"} width={240} height={32} />
                    {d && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                        {d.high && <div style={{ fontSize: 10, color: "#64748b" }}>H: <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>${d.high.toFixed(2)}</span></div>}
                        {d.low && <div style={{ fontSize: 10, color: "#64748b" }}>L: <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>${d.low.toFixed(2)}</span></div>}
                        {d.volume && <div style={{ fontSize: 10, color: "#64748b" }}>Vol: <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{d.volume}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAddModal && <AddPositionModal onAdd={handleAddPosition} onClose={() => setShowAddModal(false)} />}
      {editPosition && <EditPositionModal position={editPosition} onSave={handleEditSave} onDelete={handleDelete} onClose={() => setEditPosition(null)} />}
    </div>
  );
}
