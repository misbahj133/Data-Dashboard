# Trailhead Supply Co. — Operations Dashboard

An interactive analytics dashboard built with React and Recharts, showing revenue, orders, and channel performance for a fictional outdoor-gear retailer. Built to demonstrate turning raw data into an at-a-glance visual dashboard with real filtering.

![Dashboard preview](https://github.com/misbahj133/Data-Dashboard/issues/2#issue-5103593551)

## Features

- **4 stat cards** — revenue, orders, average order value, and conversion rate, each with a period-over-period trend indicator
- **Line chart** — revenue over time, which automatically switches from daily to weekly buckets on longer date ranges
- **Bar chart** — revenue by product category, with the selected category highlighted
- **Donut chart** — revenue by sales channel (Direct, Marketplace, Retail Partners, Social)
- **Interactive filters** — date range (7 days / 30 days / 90 days / year to date) and category, both driving every chart and stat card at once
- **Responsive layout** — stat cards and charts reflow from a 4-column desktop grid down to a single column on mobile
- **Simulated backend** — a mock `fetchDashboardData()` function filters and aggregates a full year of generated daily records and resolves after a short simulated network delay, so the data flow mirrors a real API call

## Tech stack

- [React](https://react.dev/) (Vite)
- [Recharts](https://recharts.org/) for charts
- [Lucide React](https://lucide.dev/) for icons

## Getting started

Clone the repo and install dependencies:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
npm install
```

Run the dev server:

```bash
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) in your browser.

## Project structure

```
src/
├── App.jsx        # dashboard component: layout, filters, charts, mock data + aggregation
├── main.jsx        # React entry point
├── App.css
└── index.css
```

## Data

All data is generated client-side with a seeded random number generator, so numbers are stable across reloads but are not real sales figures. Swap `generateRawRows()` and `fetchDashboardData()` in `App.jsx` for real API calls to connect it to an actual backend — the filtering and aggregation logic (by date range, category, and channel) is written to work the same way against real rows.

## License

MIT
