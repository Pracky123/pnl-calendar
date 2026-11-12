/* PNL Calendar — vanilla PWA, same behavior as the canvas page. */
"use strict";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

let DATA = null;
let state = {
  month: null,
  unit: "USD",
  selected: null,
  filter: "all",
  openList: false,
  boxW: 360,
  loading: false,
  error: "",
  newOnchain: 0,
};

function berlinToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function monthParts(ym) {
  const p = ym.split("-").map(Number);
  return { y: p[0] || 2026, m: p[1] || 1 };
}

function monthLabelEn(ym) {
  const { y, m } = monthParts(ym);
  return (MONTH_EN[m - 1] || ym) + " " + y;
}

function monthLabelDe(ym) {
  const { m } = monthParts(ym);
  return MONTH_DE[m - 1] || ym;
}

function dayLabelDe(iso) {
  const p = iso.split("-").map(Number);
  const y = p[0] || 2026, m = p[1] || 1, d = p[2] || 1;
  return d + ". " + (MONTH_DE[m - 1] || iso) + " " + y;
}

function formatBerlinTime(ts) {
  if (ts == null || ts <= 0) return "—";
  return new Date(ts * 1000).toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStand(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactUsd(n) {
  const sign = n > 0.004999 ? "+" : n < -0.004999 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 100000) return sign + "$" + Math.round(a / 1000) + "K";
  if (a >= 10000) return sign + "$" + (a / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (a >= 1000) {
    const k = a / 1000;
    const s = k >= 10 ? k.toFixed(1) : k.toFixed(2);
    return sign + "$" + s.replace(/0+$/, "").replace(/\.$/, "") + "K";
  }
  if (a >= 100) {
    const rounded = Math.round(a * 10) / 10;
    if (Math.abs(a - Math.round(a)) < 0.05) return sign + "$" + Math.round(a);
    return sign + "$" + rounded.toFixed(1);
  }
  if (a >= 10) return sign + "$" + a.toFixed(1);
  if (a >= 1) return (sign + "$" + a.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")).replace(/\.$/, "");
  return sign + "$" + a.toFixed(2);
}

function compactSol(n) {
  const sign = n > 0.0000005 ? "+" : n < -0.0000005 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1) return sign + a.toFixed(2);
  if (a >= 0.1) return sign + a.toFixed(3);
  return sign + a.toFixed(4);
}

function compactUsdNarrow(n) {
  const sign = n > 0.004999 ? "+" : n < -0.004999 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 100000) return sign + Math.round(a / 1000) + "K";
  if (a >= 1000) {
    const k = a / 1000;
    const s = k >= 10 ? String(Math.round(k)) : k.toFixed(1).replace(/\.0$/, "");
    return sign + s + "K";
  }
  if (a >= 10) return sign + Math.round(a);
  if (a === 0) return "0";
  return sign + (Math.round(a * 10) / 10).toFixed(1);
}

function compactSolNarrow(n) {
  const sign = n > 0.0000005 ? "+" : n < -0.0000005 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1) return sign + a.toFixed(1);
  if (a >= 0.1) return sign + a.toFixed(2);
  return sign + a.toFixed(3);
}

function fmt(n, unit) {
  return unit === "SOL" ? compactSol(n) : compactUsd(n);
}

function fmtTile(n, unit, narrow) {
  if (!narrow) return fmt(n, unit);
  return unit === "SOL" ? compactSolNarrow(n) : compactUsdNarrow(n);
}

function dayValue(stat, unit) {
  if (!stat) return null;
  return unit === "SOL" ? stat.sol : stat.pnl;
}

function cellsForMonth(ym) {
  const { y, m } = monthParts(ym);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: ym + "-" + String(d).padStart(2, "0") });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null });
  return cells;
}

function tileTint(pnl, maxAbs, kind) {
  const t = maxAbs <= 0 ? 0 : Math.min(1, Math.abs(pnl) / maxAbs);
  const a = 0.1 + t * 0.42;
  return kind === "pos" ? "rgba(14, 140, 90, " + a + ")" : "rgba(170, 28, 48, " + a + ")";
}

function tradeAmount(t, unit, px) {
  if (t.u == null) return null;
  if (unit === "USD") return t.u;
  return px ? t.u / px : null;
}

function tradePnl(t, unit, px) {
  if (t.k !== "s" || t.p == null) return null;
  if (unit === "USD") return t.p;
  return px ? t.p / px : null;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k === "text") node.textContent = v;
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    });
  }
  (children || []).forEach((c) => {
    if (c == null || c === false) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function tradeGroup(t) {
  return t && t.g === "bot" ? "bot" : "me";
}

function streaksFor(dates, pnlByDay) {
  const trading = dates.filter((d) => Object.prototype.hasOwnProperty.call(pnlByDay, d));
  let best = 0, cur = 0, lastLen = 0, lastEnd = null;
  for (let i = 0; i < trading.length; i++) {
    const d = trading[i];
    if (pnlByDay[d] > 1e-9) {
      cur += 1;
      if (cur >= best) best = cur;
      lastLen = cur;
      lastEnd = d;
    } else {
      cur = 0;
      lastLen = 0;
      lastEnd = null;
    }
  }
  const last = trading.length ? trading[trading.length - 1] : null;
  const current = lastEnd === last && lastLen > 0 ? lastLen : 0;
  return { current: current, best: best };
}

function buildView(filter) {
  const trades = {};
  const src = (DATA && DATA.trades) || {};
  Object.keys(src).forEach((day) => {
    const kept = src[day].filter((t) => filter === "all" || tradeGroup(t) === filter);
    if (kept.length) trades[day] = kept;
  });
  const daily = {};
  Object.keys(trades).forEach((day) => {
    let pnl = 0, sells = 0, buys = 0;
    trades[day].forEach((t) => {
      if (t.k === "s") {
        sells += 1;
        if (t.p != null) pnl += t.p;
      } else buys += 1;
    });
    const px = DATA.daily && DATA.daily[day] ? DATA.daily[day].px : null;
    daily[day] = {
      pnl: Math.round(pnl * 10000) / 10000,
      sol: px ? Math.round((pnl / px) * 1e6) / 1e6 : null,
      sells: sells,
      buys: buys,
      px: px,
    };
  });
  const monthsOrder = (DATA && DATA.monthsOrder) || [];
  const months = {};
  monthsOrder.forEach((key) => {
    const days = Object.keys(daily).filter((d) => d.slice(0, 7) === key).sort();
    let pnl = 0, greenDays = 0, redDays = 0, greenSum = 0, redSum = 0;
    let solPnl = 0, greenSol = 0, redSol = 0, solOk = true;
    const pnlMap = {};
    const sells = [];
    days.forEach((d) => {
      const st = daily[d];
      pnl += st.pnl;
      if (st.sol == null) solOk = false;
      else solPnl += st.sol;
      if (st.sells > 0 || Math.abs(st.pnl) > 1e-9) {
        pnlMap[d] = st.pnl;
        if (st.pnl > 1e-9) {
          greenDays += 1; greenSum += st.pnl;
          if (st.sol != null) greenSol += st.sol;
        } else if (st.pnl < -1e-9) {
          redDays += 1; redSum += st.pnl;
          if (st.sol != null) redSol += st.sol;
        }
      }
      (trades[d] || []).forEach((t) => {
        if (t.k === "s" && t.p != null) sells.push({ s: t.s, p: t.p, d: d });
      });
    });
    sells.sort((a, b) => b.p - a.p);
    const st = streaksFor(days, pnlMap);
    months[key] = {
      pnl: Math.round(pnl * 10000) / 10000,
      pnlSol: solOk ? Math.round(solPnl * 1e6) / 1e6 : null,
      greenDays: greenDays,
      greenSum: Math.round(greenSum * 10000) / 10000,
      greenSol: solOk ? Math.round(greenSol * 1e6) / 1e6 : null,
      redDays: redDays,
      redSum: Math.round(redSum * 10000) / 10000,
      redSol: solOk ? Math.round(redSol * 1e6) / 1e6 : null,
      currentStreak: st.current,
      bestStreak: st.best,
      bestTrades: sells.slice(0, 5),
      worstTrades: sells.slice(-5).reverse(),
    };
  });
  return { daily: daily, months: months, trades: trades, monthsOrder: monthsOrder };
}

async function loadData() {
  const url = "data.json?t=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("data.json " + res.status);
  DATA = await res.json();
  const months = DATA.monthsOrder || [];
  if (!state.month || months.indexOf(state.month) < 0) {
    state.month = months[months.length - 1] || null;
  }
  state.error = "";
  state.newOnchain = 0;
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  state.error = "";
  render();
  try {
    await loadData();
  } catch (e) {
    state.error = "Aktualisierung fehlgeschlagen";
  }
  state.loading = false;
  render();
}

function render() {
  const root = document.getElementById("app");
  if (!DATA || !state.month || !DATA.months[state.month]) {
    root.replaceChildren(el("div", { class: "boot" }, [state.error || "Lade PNL Calendar…"]));
    return;
  }

  const view = buildView(state.filter || "all");
  const narrow = state.boxW < 520;
  const tight = state.boxW < 380;
  const unit = state.unit;
  const month = state.month;
  const months = view.monthsOrder;
  const mo = view.months[month] || {
    pnl: 0, pnlSol: 0, greenDays: 0, greenSum: 0, greenSol: 0,
    redDays: 0, redSum: 0, redSol: 0, currentStreak: 0, bestStreak: 0,
    bestTrades: [], worstTrades: [],
  };
  const idx = months.indexOf(month);
  const today = berlinToday();
  const cells = cellsForMonth(month);
  let maxAbs = 1;
  cells.forEach((c) => {
    if (!c.iso) return;
    const v = dayValue(view.daily[c.iso], unit);
    if (v != null) maxAbs = Math.max(maxAbs, Math.abs(v));
  });

  const monthPnl = unit === "SOL" ? mo.pnlSol : mo.pnl;
  const greenSum = unit === "SOL" ? mo.greenSol : mo.greenSum;
  const redSum = unit === "SOL" ? mo.redSol : mo.redSum;
  const greenShare = mo.greenDays + mo.redDays === 0 ? 0.5 : mo.greenDays / (mo.greenDays + mo.redDays);

  const shell = el("div", { class: "shell" + (narrow ? " narrow" : "") + (tight ? " tight" : "") });

  const header = el("header", { class: "top" }, [
    el("div", { class: "brand", text: "PNL Calendar" }),
    el("div", { class: "top-right" }, [
      el("div", { class: "month-nav" }, [
        el("button", {
          class: "nav-btn", type: "button", "aria-label": "Voriger Monat",
          disabled: idx <= 0,
          onClick: () => { if (idx > 0) { state.month = months[idx - 1]; state.selected = null; render(); } },
        }, ["‹"]),
        el("div", { class: "month-label", text: monthLabelEn(month) }),
        el("button", {
          class: "nav-btn", type: "button", "aria-label": "Nächster Monat",
          disabled: idx >= months.length - 1,
          onClick: () => { if (idx < months.length - 1) { state.month = months[idx + 1]; state.selected = null; render(); } },
        }, ["›"]),
      ]),
      el("button", {
        class: "unit-btn", type: "button", "aria-label": "Währung wechseln",
        onClick: () => { state.unit = unit === "USD" ? "SOL" : "USD"; render(); },
      }, ["⇅ " + unit]),
      el("button", {
        class: "refresh-btn" + (state.loading ? " busy" : ""),
        type: "button", "aria-label": "Aktualisieren",
        onClick: () => refresh(),
      }, ["↻"]),
    ]),
  ]);

  const filters = el("div", { class: "filter-bar", role: "tablist", "aria-label": "Wallet-Filter" },
    [["all", "Alle"], ["me", "Ich"], ["bot", "Bot"]].map(([id, label]) =>
      el("button", {
        class: "filter-btn" + (state.filter === id ? " on" : ""),
        type: "button",
        role: "tab",
        "aria-selected": state.filter === id ? "true" : "false",
        "aria-pressed": state.filter === id ? "true" : "false",
        onClick: () => { state.filter = id; state.selected = null; render(); },
      }, [label])
    )
  );

  const total = el("div", {
    class: "month-total " + (monthPnl != null && monthPnl >= 0 ? "pos" : "neg"),
    text: monthPnl == null ? "—" : fmt(monthPnl, unit),
  });

  const labels = el("div", { class: "bar-labels" }, [
    el("div", { class: "pos", text: mo.greenDays + " / " + (greenSum == null ? "—" : fmt(greenSum, unit)) }),
    el("div", { class: "neg", text: mo.redDays + " / " + (redSum == null ? "—" : fmt(redSum, unit)) }),
  ]);
  const bar = el("div", { class: "bar" }, [
    el("div", { class: "g", style: { width: greenShare * 100 + "%" } }),
    el("div", { class: "r" }),
  ]);

  const wds = el("div", { class: "weekdays" },
    WEEKDAYS.map((d, i) => el("div", { class: "wd", text: d, key: i }))
  );

  const days = el("div", { class: "days" });
  cells.forEach((c, i) => {
    if (c.day == null || !c.iso) {
      days.appendChild(el("div"));
      return;
    }
    const stat = view.daily[c.iso];
    const value = dayValue(stat, unit);
    const has = value != null && (stat && stat.sells ? stat.sells : 0) > 0;
    const isToday = c.iso === today;
    const isSel = c.iso === state.selected;
    const positive = has && value > 0;
    const negative = has && value < 0;
    const cls = [
      "tile",
      has && positive ? "has-pos" : "",
      has && negative ? "has-neg" : "",
      has ? "" : "empty",
      isToday ? "today" : "",
      isSel ? "selected" : "",
    ].filter(Boolean).join(" ");
    const bg = isToday && !has ? null : positive ? tileTint(value, maxAbs, "pos") : negative ? tileTint(value, maxAbs, "neg") : null;
    const btn = el("button", {
      class: cls,
      type: "button",
      "data-iso": c.iso,
      "aria-pressed": isSel ? "true" : "false",
      "aria-label": c.day + ". " + (has ? fmtTile(value, unit, narrow) : "Keine Trades"),
      style: bg ? { background: bg } : null,
    }, [
      el("div", { class: "dnum", text: String(c.day) }),
      el("div", { class: "pval", text: has ? fmtTile(value, unit, narrow) : "" }),
    ]);
    days.appendChild(btn);
  });
  days.addEventListener("click", (e) => {
    const btn = e.target.closest("button.tile");
    if (!btn || !days.contains(btn)) return;
    const iso = btn.getAttribute("data-iso");
    if (!iso) return;
    state.selected = state.selected === iso ? null : iso;
    render();
  });

  const pills = el("div", { class: "pills" }, [
    el("span", { class: "pill", text: "Aktuelle Plus-Serie: " + mo.currentStreak + " " + (mo.currentStreak === 1 ? "Tag" : "Tage") }),
    el("span", { class: "pill", text: "Beste Plus-Serie im " + monthLabelDe(month) + ": " + mo.bestStreak + " " + (mo.bestStreak === 1 ? "Tag" : "Tage") }),
  ]);

  const toggle = el("button", {
    class: "lists-toggle", type: "button",
    onClick: () => { state.openList = !state.openList; render(); },
  }, [(state.openList ? "▾ " : "▸ ") + "Beste / schlechteste Trades"]);

  const lists = state.openList ? el("div", { class: "lists" }, [
    miniList("Beste", mo.bestTrades, unit, mo, view),
    miniList("Schlechteste", mo.worstTrades, unit, mo, view),
  ]) : null;

  const stand = formatStand(DATA.generatedAt || DATA.periodEnd);
  const status = el("div", { class: "status-row" }, [
    el("div", {}, [
      "Stand: " + stand + " (Europe/Berlin)",
      state.newOnchain ? el("div", { text: state.newOnchain + " neue On-Chain-Signatur(en) — aktualisiere in Kürze über die Pipeline." }) : null,
      state.error ? el("div", { class: "err", text: state.error }) : null,
    ]),
  ]);

  const hint = (!isStandalone()) ? el("div", { class: "install-hint" }, [
    "Zum Home-Bildschirm: in Safari teilen (□↑), dann „Zum Home-Bildschirm“.",
  ]) : null;

  shell.append(header, filters, total, labels, bar, wds, days, pills, toggle);
  if (lists) shell.append(lists);
  shell.append(status);
  if (hint) shell.append(hint);

  root.replaceChildren(shell);
  if (state.selected) root.appendChild(renderSheet(narrow, unit, view));
  measure();
}

function miniList(title, rows, unit, mo, view) {
  const pxFallback = mo && mo.pnl && mo.pnlSol ? mo.pnl / mo.pnlSol : null;
  const wrap = el("div", {}, [el("h3", { text: title })]);
  (rows || []).forEach((r) => {
    const day = (view && view.daily[r.d]) || (DATA.daily && DATA.daily[r.d]);
    const v = unit === "SOL" ? (day && day.px ? r.p / day.px : pxFallback ? r.p / pxFallback : null) : r.p;
    wrap.appendChild(el("div", { class: "row" }, [
      el("span", {}, [r.s + " ", el("span", { class: "when", text: r.d.slice(8) + "." + r.d.slice(5, 7) + "." })]),
      el("span", { class: v != null && v >= 0 ? "pos" : "neg", style: { fontWeight: "600" }, text: v == null ? "—" : fmt(v, unit) }),
    ]));
  });
  return wrap;
}

function renderSheet(narrow, unit, view) {
  const selected = state.selected;
  const selectedStat = (view && view.daily[selected]) || (DATA.daily && DATA.daily[selected]);
  const dayTrades = (view && view.trades && view.trades[selected]) || [];
  const totalVal = selectedStat ? dayValue(selectedStat, unit) : null;

  const backdrop = el("div", {
    class: "sheet-backdrop",
    role: "presentation",
    onClick: () => { state.selected = null; render(); },
  });
  const sheet = el("div", {
    class: "sheet",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": dayLabelDe(selected),
    onClick: (e) => e.stopPropagation(),
  });

  const head = el("div", { class: "sheet-head" }, [
    el("div", {}, [
      el("div", { class: "sheet-title", text: dayLabelDe(selected) }),
      el("div", { class: "sheet-sub", text: selectedStat ? (selectedStat.buys + " Käufe, " + selectedStat.sells + " Verkäufe") : "Keine Trades" }),
    ]),
    el("div", { class: "sheet-head-right" }, [
      el("div", {
        class: "sheet-total " + (totalVal != null && totalVal >= 0 ? "pos" : "neg"),
        text: totalVal == null ? "—" : fmt(totalVal, unit),
      }),
      el("button", {
        class: "close-x", type: "button", "aria-label": "Schließen",
        onClick: () => { state.selected = null; render(); },
      }, ["×"]),
    ]),
  ]);

  sheet.append(el("div", { class: "handle" }), head);

  if (dayTrades.length === 0) {
    sheet.appendChild(el("div", { class: "empty-day", text: "Keine Trades" }));
  } else {
    const list = el("div", { class: "trades" });
    const cols = el("div", { class: "cols-h" }, [
      el("span", { text: "Token / Zeit" }),
      el("span", { text: "Betrag / PnL" }),
    ]);
    const px = selectedStat && selectedStat.px != null ? selectedStat.px : null;
    dayTrades.forEach((tr, i) => {
      const amount = tradeAmount(tr, unit, px);
      const pnl = tradePnl(tr, unit, px);
      const pnlColor = pnl == null ? "var(--muted)" : pnl >= 0 ? "var(--green)" : "var(--red)";
      list.appendChild(el("div", { class: "trade" }, [
        el("div", { class: "trade-top" }, [
          el("div", { class: "trade-left" }, [
            el("span", { class: "kind", style: { color: tr.k === "s" ? pnlColor : "var(--weekday)" }, text: tr.k === "s" ? "Verkauf" : "Kauf" }),
            el("span", { class: "sym", text: tr.s }),
          ]),
          el("span", { class: "tm", text: formatBerlinTime(tr.t) }),
        ]),
        el("div", { class: "trade-bot" }, [
          el("span", { text: amount == null ? "—" : fmt(amount, unit) }),
          el("span", { style: { color: pnlColor, fontWeight: "600" }, text: tr.k === "s" ? (pnl == null ? "—" : fmt(pnl, unit)) : "—" }),
        ]),
      ]));
    });
    sheet.append(cols, list);
  }

  sheet.appendChild(el("button", {
    class: "close-bar", type: "button",
    onClick: () => { state.selected = null; render(); },
  }, ["Schließen"]));

  backdrop.appendChild(sheet);
  return backdrop;
}

function measure() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const w = shell.clientWidth;
  if (w && Math.abs(w - state.boxW) > 1) {
    state.boxW = w;
    render();
  }
}

/* Pull-to-refresh when already at top. Never hijack taps on day tiles. */
let ptrStartY = null;
let ptrTracking = false;

function setupPtr() {
  const ptrMin = 56;

  function ensurePtr() {
    let ptr = document.querySelector(".ptr");
    if (!ptr) {
      ptr = el("div", { class: "ptr", text: "Loslassen zum Aktualisieren" });
      document.body.prepend(ptr);
    }
    return ptr;
  }

  window.addEventListener("touchstart", (e) => {
    const t = e.target;
    const onControl = !!(t && t.closest && t.closest("button, a, input, textarea, select, .sheet, .sheet-backdrop"));
    if (onControl || window.scrollY > 2 || state.selected) {
      ptrStartY = null;
      ptrTracking = false;
      return;
    }
    ptrStartY = e.touches[0].clientY;
    ptrTracking = true;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!ptrTracking || ptrStartY == null) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy > 12) {
      const ptr = ensurePtr();
      ptr.style.height = Math.min(72, dy) + "px";
    }
  }, { passive: true });

  /* preventDefault only after a real pull past the threshold, never on a tap. */
  window.addEventListener("touchmove", (e) => {
    if (!ptrTracking || ptrStartY == null) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy > ptrMin && window.scrollY <= 0 && e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener("touchend", (e) => {
    const dy = ptrTracking && ptrStartY != null && e.changedTouches[0]
      ? e.changedTouches[0].clientY - ptrStartY
      : 0;
    const shouldRefresh = ptrTracking && dy > ptrMin;
    ptrStartY = null;
    ptrTracking = false;
    const ptr = document.querySelector(".ptr");
    if (ptr) ptr.style.height = "0px";
    if (shouldRefresh) refresh();
  }, { passive: true });
}

if ("serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

window.addEventListener("resize", () => measure());
setupPtr();

loadData()
  .then(() => render())
  .catch((e) => {
    state.error = "Daten konnten nicht geladen werden.";
    document.getElementById("app").replaceChildren(
      el("div", { class: "boot" }, [state.error])
    );
  });
