const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATS = [
  { key: "transport", label: "Transport" },
  { key: "benefits",  label: "Benefits" },
];
const STORAGE_KEY = "budgetMonitor.spending.v1";
const LOG_KEY = "budgetMonitor.log.v1";

const fmt = (n) => `${Math.round(n).toLocaleString("en-US")} lei`;

let DATA = null;

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
  catch { return []; }
}
function saveLog(arr) { localStorage.setItem(LOG_KEY, JSON.stringify(arr)); }

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function getSpent(month, cat) {
  const o = loadOverrides();
  const base = o?.[month]?.[cat] != null
    ? Number(o[month][cat]) || 0
    : Number(DATA.spending?.[month]?.[cat]) || 0;
  const logSum = loadLog()
    .filter(e => e.month === String(month) && e.cat === cat)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return base + logSum;
}

function addLogEntry(month, cat, amount) {
  const log = loadLog();
  log.push({
    id: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    ts: Date.now(),
    month: String(month),
    cat,
    amount: Number(amount) || 0,
  });
  saveLog(log);
}

function deleteLogEntry(id) {
  saveLog(loadLog().filter(e => e.id !== id));
}

function statusClass(spent, cap) {
  if (spent > cap) return "bad";
  if (cap > 0 && spent / cap >= 0.8) return "warn";
  return "ok";
}

function buildBar() {
  const wrap = document.createElement("div");
  wrap.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  wrap.appendChild(fill);
  const over = document.createElement("div");
  over.className = "bar-overflow";
  over.style.display = "none";
  wrap.appendChild(over);
  return wrap;
}

function updateBar(wrap, spent, cap) {
  const fill = wrap.querySelector(".bar-fill");
  const over = wrap.querySelector(".bar-overflow");
  const pct = cap > 0 ? Math.min(spent, cap) / cap : 0;
  fill.style.width = `${pct * 100}%`;
  fill.classList.remove("ok", "warn", "bad");
  fill.classList.add(statusClass(spent, cap));
  if (spent > cap && cap > 0) {
    over.style.display = "";
    over.style.width = `${Math.min((spent - cap) / cap, 1) * 100}%`;
  } else {
    over.style.display = "none";
  }
}

function renderMonth(monthIdx, active) {
  const row = document.createElement("div");
  row.className = "month-row" + (active ? "" : " inactive");

  const label = document.createElement("div");
  label.className = "month-label";
  label.textContent = MONTH_NAMES[monthIdx - 1];
  row.appendChild(label);

  const bars = document.createElement("div");
  bars.className = "bars";

  const totalEl = document.createElement("div");
  totalEl.className = "month-total";

  const refs = [];
  for (const c of CATS) {
    const cap = DATA.limits[c.key];
    const br = document.createElement("div");
    br.className = "bar-row";

    const lbl = document.createElement("div");
    lbl.className = "bar-label";
    lbl.textContent = c.label;
    br.appendChild(lbl);

    const bar = buildBar();
    br.appendChild(bar);

    const val = document.createElement("div");
    val.className = "bar-value";

    const input = document.createElement("span");
    input.className = "bar-input readonly";
    input.textContent = getSpent(String(monthIdx), c.key);

    const cap_ = document.createElement("span");
    cap_.className = "bar-cap";
    cap_.textContent = `/ ${fmt(cap)}`;

    val.appendChild(input);
    val.appendChild(cap_);
    br.appendChild(val);

    bars.appendChild(br);
    refs.push({ cat: c.key, cap, bar, input, val });
  }
  row.appendChild(bars);
  row.appendChild(totalEl);

  row._refs = refs;
  row._totalEl = totalEl;
  row._month = String(monthIdx);
  return row;
}

function refreshMonth(row) {
  let total = 0;
  for (const r of row._refs) {
    const spent = getSpent(row._month, r.cat);
    updateBar(r.bar, spent, r.cap);
    r.val.classList.toggle("over", spent > r.cap);
    r.input.classList.toggle("over", spent > r.cap);
    r.input.textContent = spent;
    total += spent;
  }
  row._totalEl.textContent = fmt(total);
}

function renderStatusCard(catLabel, monthSpent, cap) {
  const card = document.getElementById(`status${catLabel}`);
  const line = card.querySelector('[data-role="line"]');
  const sub = card.querySelector('[data-role="sub"]');
  const cls = statusClass(monthSpent, cap);
  line.classList.remove("ok", "warn", "bad");
  line.classList.add(cls);
  if (monthSpent > cap) {
    line.textContent = `Exceeded by ${fmt(monthSpent - cap)}`;
  } else {
    line.textContent = `Up to date — ${fmt(cap - monthSpent)} left`;
  }
  sub.textContent = `This month: ${fmt(monthSpent)} spent of ${fmt(cap)} cap`;
}

function refreshYearTotals(activeMonths) {
  const target = document.getElementById("yearTotals");
  target.innerHTML = "";
  const totals = { transport: 0, benefits: 0 };
  for (const m of activeMonths) {
    for (const c of CATS) totals[c.key] += getSpent(m, c.key);
  }
  const grand = totals.transport + totals.benefits;
  const items = [
    { label: "Transport YTD", value: fmt(totals.transport) },
    { label: "Benefits YTD",  value: fmt(totals.benefits) },
    { label: "Total YTD",     value: fmt(grand) },
  ];
  for (const it of items) {
    const el = document.createElement("div");
    el.className = "total-item";
    el.innerHTML = `<div class="label">${it.label}</div><div class="value">${it.value}</div>`;
    target.appendChild(el);
  }
}

let ROWS = [];
let ACTIVE_MONTHS = [];

function applyAll() {
  for (const row of ROWS) refreshMonth(row);
  const cur = String(DATA.currentMonth ?? (new Date().getMonth() + 1));
  renderStatusCard("Transport", getSpent(cur, "transport"), DATA.limits.transport);
  renderStatusCard("Benefits",  getSpent(cur, "benefits"),  DATA.limits.benefits);
  refreshYearTotals(ACTIVE_MONTHS);
}

function migrateOverridesToLog() {
  const o = loadOverrides();
  if (!o || Object.keys(o).length === 0) return;
  if (loadLog().length > 0) return;
  const log = [];
  for (const [month, cats] of Object.entries(o)) {
    for (const [cat, val] of Object.entries(cats || {})) {
      const base = Number(DATA.spending?.[month]?.[cat]) || 0;
      const delta = (Number(val) || 0) - base;
      if (delta > 0) {
        log.push({
          id: `migrated-${month}-${cat}`,
          ts: Date.now(),
          month: String(month),
          cat,
          amount: delta,
        });
      }
    }
  }
  saveLog(log);
  localStorage.removeItem(STORAGE_KEY);
}

async function init() {
  const res = await fetch("./data.json", { cache: "no-store" });
  DATA = await res.json();
  migrateOverridesToLog();

  document.getElementById("yearLabel").textContent = `${DATA.year}`;

  const startMonth = DATA.employmentStartMonth ?? 1;
  const list = document.getElementById("monthsList");
  list.innerHTML = "";
  ROWS = [];
  ACTIVE_MONTHS = [];
  for (let m = 1; m <= 12; m++) {
    const active = m >= startMonth && m <= 12;
    if (active) ACTIVE_MONTHS.push(String(m));
    const row = renderMonth(m, active);
    list.appendChild(row);
    ROWS.push(row);
  }

  const addDialog = document.getElementById("addDialog");
  const addMonthSel = document.getElementById("addMonth");
  const addCatSel = document.getElementById("addCategory");
  const addAmount = document.getElementById("addAmount");
  const addForm = document.getElementById("addForm");
  const historyDialog = document.getElementById("historyDialog");
  const historyList = document.getElementById("historyList");

  addMonthSel.innerHTML = "";
  for (const m of ACTIVE_MONTHS) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = MONTH_NAMES[Number(m) - 1];
    addMonthSel.appendChild(opt);
  }
  const cur = String(DATA.currentMonth ?? (new Date().getMonth() + 1));
  if (ACTIVE_MONTHS.includes(cur)) addMonthSel.value = cur;

  document.getElementById("addBtn").addEventListener("click", () => {
    addAmount.value = "";
    addDialog.showModal();
    setTimeout(() => addAmount.focus(), 0);
  });
  document.getElementById("addCancelBtn").addEventListener("click", () => {
    addDialog.close();
  });
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amt = Math.max(0, Number(addAmount.value) || 0);
    if (amt <= 0) { addDialog.close(); return; }
    addLogEntry(addMonthSel.value, addCatSel.value, amt);
    applyAll();
    addDialog.close();
  });

  function renderHistory() {
    const entries = loadLog().slice().sort((a, b) => b.ts - a.ts);
    historyList.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted small";
      empty.textContent = "No entries yet.";
      historyList.appendChild(empty);
      return;
    }
    const catLabel = { transport: "Transport", benefits: "Benefits" };
    for (const e of entries) {
      const row = document.createElement("div");
      row.className = "history-row";
      const when = new Date(e.ts);
      const whenStr = when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.innerHTML = `<div class="history-main">${MONTH_NAMES[Number(e.month) - 1]} · ${catLabel[e.cat] || e.cat} · <strong>${fmt(e.amount)}</strong></div><div class="history-sub muted small">${whenStr}</div>`;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "ghost";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        deleteLogEntry(e.id);
        applyAll();
        renderHistory();
      });
      row.appendChild(meta);
      row.appendChild(del);
      historyList.appendChild(row);
    }
  }

  document.getElementById("historyBtn").addEventListener("click", () => {
    renderHistory();
    historyDialog.showModal();
  });
  document.getElementById("historyCloseBtn").addEventListener("click", () => {
    historyDialog.close();
  });

  applyAll();
}

init().catch((e) => {
  document.body.innerHTML = `<pre style="color:#f87171;padding:20px">Failed to load data.json\n${e}</pre>`;
});
