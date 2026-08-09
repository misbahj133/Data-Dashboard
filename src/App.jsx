import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { ArrowUp, ArrowDown, Mountain, RefreshCw } from "lucide-react";

/* ---------------------------------------------------------------
   TOKENS
   bg (ink)      #16211B  deep pine ink — header / nav
   paper         #E8E6DA  stone paper — page background
   surface       #F5F3EA  card surface, slightly lighter than paper
   ink           #1C2620  primary text
   muted         #7C8577  secondary text
   line          #D6D2C4  hairlines
   moss (accent) #5C7A46  primary data accent
   amber         #D69A3C  secondary accent
   clay          #A8503A  negative / alert accent
   fog           #A9B6A4  tertiary muted accent (unselected bars)
   Display face: "Oswald" (condensed, trailhead signage feel)
   Body face:    "Inter"
   Mono face:    "IBM Plex Mono" (all figures / stats)
------------------------------------------------------------------*/

const COLORS = {
  bg: "#16211B",
  paper: "#E8E6DA",
  surface: "#F5F3EA",
  ink: "#1C2620",
  muted: "#7C8577",
  line: "#D6D2C4",
  moss: "#5C7A46",
  amber: "#D69A3C",
  clay: "#A8503A",
  fog: "#A9B6A4",
};

const CATEGORIES = ["Footwear", "Apparel", "Camping", "Accessories"];
const CATEGORY_BASE = { Footwear: 1400, Apparel: 1100, Camping: 900, Accessories: 600 };
const CATEGORY_AOV = { Footwear: 95, Apparel: 65, Camping: 150, Accessories: 40 };
const CHANNELS = ["Direct", "Marketplace", "Retail Partners", "Social"];
const CHANNEL_WEIGHT = { Direct: 0.35, Marketplace: 0.30, "Retail Partners": 0.20, Social: 0.15 };
const CHANNEL_COLOR = { Direct: COLORS.moss, Marketplace: COLORS.amber, "Retail Partners": COLORS.clay, Social: COLORS.fog };

// ---- seeded PRNG so the "backend" data is stable across renders ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateRawRows() {
  const rand = mulberry32(20260809);
  const rows = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAYS = 365;

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (DAYS - 1 - d));
    const dow = date.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.25 : 1;
    const growth = 1 + (d / DAYS) * 0.3;
    const seasonal = 1 + 0.22 * Math.sin((2 * Math.PI * d) / 180);

    CATEGORIES.forEach((cat) => {
      const noise = 1 + (rand() - 0.5) * 0.32;
      const revenue = Math.max(
        40,
        CATEGORY_BASE[cat] * growth * seasonal * weekendBoost * noise
      );
      const aovNoise = CATEGORY_AOV[cat] * (1 + (rand() - 0.5) * 0.15);
      const orders = Math.max(1, Math.round(revenue / aovNoise));
      const convRate = 0.024 + rand() * 0.018;
      const visits = Math.round(orders / convRate);

      const channelShare = {};
      let remaining = 1;
      CHANNELS.forEach((ch, i) => {
        if (i === CHANNELS.length - 1) {
          channelShare[ch] = remaining;
        } else {
          const share = Math.max(
            0.02,
            CHANNEL_WEIGHT[ch] * (1 + (rand() - 0.5) * 0.4)
          );
          channelShare[ch] = Math.min(share, remaining - 0.02);
          remaining -= channelShare[ch];
        }
      });

      rows.push({
        date: date.toISOString().slice(0, 10),
        dateObj: date,
        category: cat,
        revenue,
        orders,
        visits,
        channelShare,
      });
    });
  }
  return rows;
}

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, ytd: null };

function daysSinceYtd() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - jan1) / 86400000) + 1;
}

function isoWeek(dateObj) {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ---- simulated backend endpoint: filters + aggregates server-side ----
function fetchDashboardData(allRows, { range, category }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const days = range === "ytd" ? daysSinceYtd() : RANGE_DAYS[range];
      const uniqueDates = [...new Set(allRows.map((r) => r.date))].sort();
      const windowDates = new Set(uniqueDates.slice(-days));
      const prevWindowDates = new Set(
        uniqueDates.slice(Math.max(0, uniqueDates.length - days * 2), uniqueDates.length - days)
      );

      const inWindow = (r) => windowDates.has(r.date);
      const inPrevWindow = (r) => prevWindowDates.has(r.date);
      const inCategory = (r) => category === "all" || r.category === category;

      const current = allRows.filter((r) => inWindow(r) && inCategory(r));
      const previous = allRows.filter((r) => inPrevWindow(r) && inCategory(r));
      const currentAllCats = allRows.filter(inWindow);

      const sum = (arr, key) => arr.reduce((a, r) => a + r[key], 0);

      const stats = {
        revenue: sum(current, "revenue"),
        orders: sum(current, "orders"),
        visits: sum(current, "visits"),
      };
      const prevStats = {
        revenue: sum(previous, "revenue"),
        orders: sum(previous, "orders"),
        visits: sum(previous, "visits"),
      };
      const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0);

      const statCards = {
        revenue: { value: stats.revenue, change: pctChange(stats.revenue, prevStats.revenue) },
        orders: { value: stats.orders, change: pctChange(stats.orders, prevStats.orders) },
        aov: {
          value: stats.orders ? stats.revenue / stats.orders : 0,
          change: pctChange(
            stats.orders ? stats.revenue / stats.orders : 0,
            prevStats.orders ? prevStats.revenue / prevStats.orders : 0
          ),
        },
        conv: {
          value: stats.visits ? (stats.orders / stats.visits) * 100 : 0,
          change: pctChange(
            stats.visits ? (stats.orders / stats.visits) * 100 : 0,
            prevStats.visits ? (prevStats.orders / prevStats.visits) * 100 : 0
          ),
        },
      };

      // time series — daily if short range, weekly if long, in chosen category
      const groupByWeek = days > 60;
      const bucket = {};
      current.forEach((r) => {
        const key = groupByWeek ? isoWeek(r.dateObj) : r.date;
        bucket[key] = (bucket[key] || 0) + r.revenue;
      });
      const timeSeries = Object.entries(bucket)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, revenue]) => ({
          label: groupByWeek ? key.split("-W")[1] ? `Wk ${key.split("-W")[1]}` : key : key.slice(5),
          revenue: Math.round(revenue),
        }));

      // category comparison bar — always all categories for the date window
      const byCategory = CATEGORIES.map((cat) => ({
        category: cat,
        revenue: Math.round(sum(currentAllCats.filter((r) => r.category === cat), "revenue")),
      }));

      // channel donut — respects both filters
      const byChannel = CHANNELS.map((ch) => ({
        channel: ch,
        revenue: Math.round(current.reduce((a, r) => a + r.revenue * r.channelShare[ch], 0)),
      }));

      resolve({ statCards, timeSeries, byCategory, byChannel, days });
    }, 450);
  });
}

const money = (n) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
const moneyFull = (n) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

function Trend({ change }) {
  const positive = change >= 0;
  const color = positive ? COLORS.moss : COLORS.clay;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function StatCard({ label, value, change, format, loading }) {
  return (
    <div
      className="flex flex-col gap-2 p-4 sm:p-5 rounded-sm"
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
    >
      <span
        className="text-[11px] tracking-widest uppercase"
        style={{ color: COLORS.muted, fontFamily: "'Oswald', sans-serif" }}
      >
        {label}
      </span>
      {loading ? (
        <div className="h-7 w-24 rounded-sm animate-pulse" style={{ background: COLORS.line }} />
      ) : (
        <span
          className="text-2xl sm:text-3xl font-semibold"
          style={{ color: COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {format(value)}
        </span>
      )}
      {!loading && <Trend change={change} />}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div
      className={`p-4 sm:p-5 rounded-sm flex flex-col ${className}`}
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
    >
      <h3
        className="text-sm uppercase tracking-wide mb-4"
        style={{ color: COLORS.ink, fontFamily: "'Oswald', sans-serif" }}
      >
        {title}
      </h3>
      <div className="flex-1 min-h-[220px]">{children}</div>
    </div>
  );
}

function SelectPill({ options, value, onChange, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm px-3 py-2 rounded-sm outline-none cursor-pointer"
      style={{
        background: COLORS.surface,
        color: COLORS.ink,
        border: `1px solid ${COLORS.line}`,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const tooltipStyle = {
  background: COLORS.bg,
  border: "none",
  borderRadius: 2,
  color: COLORS.paper,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
};

export default function Dashboard() {
  const rawRows = useMemo(() => generateRawRows(), []);
  const [range, setRange] = useState("30d");
  const [category, setCategory] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchDashboardData(rawRows, { range, category }).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [rawRows, range, category]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel =
    { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", ytd: "Year to date" }[range];

  return (
    <div
      className="w-full min-h-full"
      style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* header */}
      <div
        className="px-4 sm:px-8 py-6 sm:py-8"
        style={{ background: COLORS.bg }}
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Mountain size={22} style={{ color: COLORS.amber }} />
              <div>
                <h1
                  className="text-xl sm:text-2xl leading-tight"
                  style={{ color: COLORS.paper, fontFamily: "'Oswald', sans-serif", fontWeight: 500, letterSpacing: "0.02em" }}
                >
                  TRAILHEAD SUPPLY CO.
                </h1>
                <p className="text-xs sm:text-sm" style={{ color: COLORS.fog }}>
                  Operations dashboard — {rangeLabel}{category !== "all" ? ` · ${category}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-sm"
              style={{ border: `1px solid ${COLORS.fog}`, color: COLORS.paper }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-3">
            <SelectPill
              ariaLabel="Date range"
              value={range}
              onChange={setRange}
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
                { value: "ytd", label: "Year to date" },
              ]}
            />
            <SelectPill
              ariaLabel="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "All categories" },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-5">
        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Revenue"
            value={data?.statCards.revenue.value ?? 0}
            change={data?.statCards.revenue.change ?? 0}
            format={moneyFull}
            loading={loading}
          />
          <StatCard
            label="Orders"
            value={data?.statCards.orders.value ?? 0}
            change={data?.statCards.orders.change ?? 0}
            format={(n) => Math.round(n).toLocaleString("en-US")}
            loading={loading}
          />
          <StatCard
            label="Avg order value"
            value={data?.statCards.aov.value ?? 0}
            change={data?.statCards.aov.change ?? 0}
            format={(n) => `$${n.toFixed(2)}`}
            loading={loading}
          />
          <StatCard
            label="Conversion rate"
            value={data?.statCards.conv.value ?? 0}
            change={data?.statCards.conv.change ?? 0}
            format={(n) => `${n.toFixed(2)}%`}
            loading={loading}
          />
        </div>

        {/* revenue over time */}
        <ChartCard title="Revenue over time">
          {loading || !data ? (
            <div className="h-full w-full animate-pulse rounded-sm" style={{ background: COLORS.line, minHeight: 220 }} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.timeSeries} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tickFormatter={money} tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => moneyFull(v)} contentStyle={tooltipStyle} labelStyle={{ color: COLORS.fog }} />
                <Line type="monotone" dataKey="revenue" stroke={COLORS.moss} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* bar + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Revenue by category">
            {loading || !data ? (
              <div className="h-full w-full animate-pulse rounded-sm" style={{ background: COLORS.line, minHeight: 220 }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byCategory} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.line} vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                  <YAxis tickFormatter={money} tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => moneyFull(v)} contentStyle={tooltipStyle} labelStyle={{ color: COLORS.fog }} />
                  <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
                    {data.byCategory.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={category === "all" || category === entry.category ? COLORS.moss : COLORS.fog}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Revenue by channel">
            {loading || !data ? (
              <div className="h-full w-full animate-pulse rounded-sm" style={{ background: COLORS.line, minHeight: 220 }} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.byChannel}
                    dataKey="revenue"
                    nameKey="channel"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.byChannel.map((entry) => (
                      <Cell key={entry.channel} fill={CHANNEL_COLOR[entry.channel]} stroke={COLORS.surface} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => moneyFull(v)} contentStyle={tooltipStyle} labelStyle={{ color: COLORS.fog }} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(v) => <span style={{ color: COLORS.ink, fontSize: 12 }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <p className="text-[11px] text-center pt-2" style={{ color: COLORS.muted }}>
          Data refreshes from the aggregation endpoint whenever filters change · simulated network latency ~450ms
        </p>
      </div>
    </div>
  );
}