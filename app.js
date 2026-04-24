const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATS = [
  { key: "transport", label: "Transport" },
  { key: "benefits",  label: "Benefits" },
];

const fmt = (n) => `${Math.round(n).toLocaleString("en-US")} lei`;

function statusClass(spent, cap) {
  if (spent > cap) return "bad";
  if (cap > 0 && spent / cap >= 0.8) return "warn";
  return "ok";
}

function renderBar(spent, cap) {
  const wrap = document.createElement("div");
  wrap.className = "bar-track";

  const fill = document.createElement("div");
  fill.className = "bar-fill";
  const pct = cap > 0 ? Math.min(spent, cap) / cap : 0;
  fill.style.width = `${pct * 100}%`;
  fill.classList.add(statusClass(spent, cap));
  wrap.appendChild(fill);

  if (spent > cap && cap > 0) {
    const over = document.createElement("div");
    over.className = "bar-overflow";
    const overPct = Math.min((spent - cap) / cap, 1);
    over.style.width = `${overPct * 100}%`;
    wrap.appendChild(over);
  }
  return wrap;
}

function renderMonth(monthIdx, spending, limits, active) {
  const row = document.createElement("div");
  row.className = "month-row" + (active ? "" : " inactive");

  const label = document.createElement("div");
  label.className = "month-label";
  label.textContent = MONTH_NAMES[monthIdx - 1];
  row.appendChild(label);

  const bars = document.createElement("div");
  bars.className = "bars";
  let total = 0;

  for (const c of CATS) {
    const spent = spending?.[c.key] ?? 0;
    const cap = limits[c.key];
    total += spent;

    const br = document.createElement("div");
    br.className = "bar-row";

    const lbl = document.createElement("div");
    lbl.className = "bar-label";
    lbl.textContent = c.label;
    br.appendChild(lbl);

    br.appendChild(renderBar(spent, cap));

    const val = document.createElement("div");
    val.className = "bar-value" + (spent > cap ? " over" : "");
    val.textContent = `${fmt(spent)} / ${fmt(cap)}`;
    br.appendChild(val);

    bars.appendChild(br);
  }
  row.appendChild(bars);

  const totalEl = document.createElement("div");
  totalEl.className = "month-total";
  totalEl.textContent = fmt(total);
  row.appendChild(totalEl);

  return row;
}

function renderStatusCard(catKey, catLabel, monthSpent, cap) {
  const card = document.getElementById(`status${catLabel}`);
  const line = card.querySelector('[data-role="line"]');
  const sub = card.querySelector('[data-role="sub"]');
  const cls = statusClass(monthSpent, cap);
  line.classList.remove("ok", "warn", "bad");
  line.classList.add(cls);

  if (monthSpent > cap) {
    line.textContent = `Exceeded by ${fmt(monthSpent - cap)}`;
    sub.textContent = `This month: ${fmt(monthSpent)} spent of ${fmt(cap)} cap`;
  } else {
    const left = cap - monthSpent;
    line.textContent = `Up to date — ${fmt(left)} left`;
    sub.textContent = `This month: ${fmt(monthSpent)} spent of ${fmt(cap)} cap`;
  }
}

function renderYearTotals(data, activeMonths) {
  const target = document.getElementById("yearTotals");
  target.innerHTML = "";
  const totals = { transport: 0, benefits: 0 };
  for (const m of activeMonths) {
    for (const c of CATS) totals[c.key] += data.spending?.[m]?.[c.key] ?? 0;
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

async function init() {
  const res = await fetch("./data.json", { cache: "no-store" });
  const data = await res.json();

  document.getElementById("yearLabel").textContent = `${data.year}`;

  const startMonth = data.employmentStartMonth ?? 1;
  const currentMonth = data.currentMonth ?? (new Date().getMonth() + 1);

  const list = document.getElementById("monthsList");
  list.innerHTML = "";
  const activeMonths = [];
  for (let m = 1; m <= 12; m++) {
    const active = m >= startMonth && m <= 12;
    if (active) activeMonths.push(String(m));
    list.appendChild(renderMonth(m, data.spending?.[m], data.limits, active));
  }

  const curKey = String(currentMonth);
  const monthData = data.spending?.[curKey] ?? { transport: 0, benefits: 0 };
  renderStatusCard("transport", "Transport", monthData.transport ?? 0, data.limits.transport);
  renderStatusCard("benefits",  "Benefits",  monthData.benefits  ?? 0, data.limits.benefits);

  renderYearTotals(data, activeMonths);
}

init().catch((e) => {
  document.body.innerHTML = `<pre style="color:#f87171;padding:20px">Failed to load data.json\n${e}</pre>`;
});
