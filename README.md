# Budget Monitor

Minimal personal budget tracker. 12 months, two categories (Transport 200 lei/mo, Benefits 400 lei/mo). Active Mar–Dec 2026.

Live: https://pamfilpaul381.github.io/budget-monitor/

## Updating numbers

Edit `data.json`:

```json
"4": { "transport": 190, "benefits": 2000 }
```

Commit + push to `main`. GitHub Pages redeploys in ~1 minute.

- `currentMonth` controls which month the two status cards read from.
- Jan and Feb are shown greyed out (pre-employment).
- Exceeding a cap is fine — the bar shows an overflow segment and the status flips to red.

## Stack

Plain HTML/CSS/JS. No build. Served by GitHub Pages from repo root.
