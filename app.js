const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATS = [
  { key: "transport", label: "Transport" },
  { key: "benefits",  label: "Benefits" },
];
const STORAGE_KEY = "budgetMonitor.spending.v1";

const fmt = (n) => `${Math.round(n).toLocaleString("en-US")} lei`;

let DATA = null;

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }

function getSpent(month, cat) {
  const o = loadOverrides();
  if (o?.[month]?.[cat] != null) return Number(o[month][cat]) || 0;
  return Number(DATA.spending?.[month]?.[cat]) || 0;
}
function setSpent(month, cat, value) {
  const o = loadOverrides();
  o[month] = o[month] || {};
  o[month][cat] = value;
  saveOverrides(o);
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

async function init() {
  const res = await fetch("./data.json", { cache: "no-store" });
  DATA = await res.json();

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
  const addMode = document.getElementById("addMode");
  const addForm = document.getElementById("addForm");

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
    addMode.checked = true;
    addDialog.showModal();
    setTimeout(() => addAmount.focus(), 0);
  });
  document.getElementById("addCancelBtn").addEventListener("click", () => {
    addDialog.close();
  });
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amt = Math.max(0, Number(addAmount.value) || 0);
    const month = addMonthSel.value;
    const cat = addCatSel.value;
    const current = getSpent(month, cat);
    const next = addMode.checked ? current + amt : amt;
    setSpent(month, cat, next);
    applyAll();
    addDialog.close();
  });

  applyAll();
}

init().catch((e) => {
  document.body.innerHTML = `<pre style="color:#f87171;padding:20px">Failed to load data.json\n${e}</pre>`;
});
