# Mega / Power / Lotto Analytics

A **local-first** React + Vite dashboard for exploring historical results of Vietnamese lottery games:

| Game        | Format   | Numbers |
|-------------|----------|---------|
| **Mega 6/45**   | 6 of 45  | 1–45    |
| **Power 6/55**  | 6 of 55 (+ bonus) | 1–55 |
| **Lotto 5/35**  | 5 of 35 (+ special) | 1–35 |

**Live demo:** [huyhoang2001.github.io/megaa.github.io](https://huyhoang2001.github.io/megaa.github.io/)

> **Important:** Lottery draws are independent random events. All scores and rankings describe *historical patterns only*. They are **not** win probabilities and must never be treated as predictions of future results.

---

## Features

### Dashboard
- Latest draw with number balls, jackpot, parity, inside/outside, digital root
- Top predictions (ranked combinations with multi-component scores)
- Frequency buckets, top numbers, occurrence timeline, draws-by-month
- Gap vs frequency scatter, last-period frequency, top pairs & triples
- Score history charts (single / pair / triple / structure / total) recalculated from the dashboard’s selected period (up to 100 prior draws), with MA20
- Jackpot history charts
- Period filters: last 30/50/100 draws, last year, and all draws
- Scoring presets: Default, Balanced, Hot, Gap, Custom

### Single Numbers
- Frequency, weighted frequency, Z-score, rolling windows
- Gap stats (current, mean, max, percentile, Z)
- Momentum ratios and labels
- Multi-model consensus (frequency / momentum / gap / association)
- HOT / DUE / DROUGHT / COOL / NEUTRAL state classification
- Anomaly detection

### Pairs & Triples
- Count, rate, lift, recent lift
- Confidence levels based on support
- Inside/outside and even/odd breakdowns

### Suggested Combinations
- Candidate generation from consensus ranking
- Multi-component scoring:
  - Single (chance-adjusted + consensus)
  - Pair association
  - Gap
  - Structure (sum / parity / inside distribution)
  - Novelty (historical overlap penalty)
- Portfolio selection with overlap limits and parity coverage
- Experimental coverage mode for Power 6/55
- Independent score filters

### Ticket Filter
- Paste or import compact tickets
- Filter by score ranges and structural constraints
- Compare against main proposal ranking

### Backtest
- Rolling-window backtests over a date range
- Configurable training size (30 / 50 / 100)
- Hit-rate distribution and confidence intervals
- Manual ticket evaluation mode

### History & Settings
- Full draw history table (add / edit / delete / import / export)
- Per-game analysis weights and constraints
- Theme (light / dark / system) and language (English / Vietnamese)
- All user data persisted in `localStorage` only

---

## Tech Stack

| Layer        | Choice                                      |
|--------------|---------------------------------------------|
| UI           | React 18, TypeScript, Vite                  |
| Styling      | Tailwind CSS, lucide-react                  |
| Charts       | Recharts                                    |
| State        | Zustand (+ persist middleware)              |
| Forms        | React Hook Form + Zod                       |
| Tables       | TanStack Table                              |
| Workers      | Web Workers (`scoreTimeline`, `backtest`)   |
| Tests        | Vitest + jsdom                              |
| i18n         | Custom dictionary (`en` / `vi`)             |

**No backend.** No auth, no database, no external API at runtime. Data is bundled JSON + optional local edits stored in the browser.

---

## Quick Start

```bash
# Install
npm ci

# Development server
npm run dev

# Type-check + production build
npm run build

# Unit tests
npm test -- --run
# or watch mode
npm run test:watch
```

Open the URL printed by Vite (usually `http://localhost:5173`).

---

## Data

Historical draws are bundled under `src/data/`:

- `mega645-history.json`
- `power655-history.json`
- `lotto535-history.json`
- `default-settings.json`

Source of truth for official results: [NhanAZ-Data/vietlott-research](https://github.com/NhanAZ-Data/vietlott-research/tree/main/datasets).

### Refresh data

```bash
npm run sync:data          # all three games
npm run sync:mega645       # Mega only
npm run sync:power655      # Power only
npm run sync:lotto535      # Lotto only
```

Sync scripts validate:

- Draw counts and date continuity
- Number ranges and uniqueness
- Bonus / special number rules
- Jackpot values

before replacing the bundled JSON files.

User edits (added/edited draws, settings, filters) are stored under the `localStorage` key:

```
mega645-analytics-data
```

Derived analytics are **never** persisted; they are recalculated on every load.

---

## Project Structure

```
src/
├── analytics.ts              # Core scoring, frequency, gap, pairs, triples, timeline, backtest
├── domain.ts                 # Types, game configs, default settings
├── store.ts                  # Zustand store + localStorage persistence
├── hooks.ts                  # useAnalytics, scoring presets
├── i18n.ts                   # English / Vietnamese translations
├── ui.tsx                    # Shared UI primitives
├── DataTable.tsx             # Generic table component
├── GameSwitch.tsx            # Mega / Power / Lotto switcher
├── scoreTimeline.worker.ts   # Off-main-thread score history
├── backtest.worker.ts        # Off-main-thread backtests
├── ticketFilter.ts           # Ticket parsing & filtering
├── data/                     # Bundled history + default settings
└── pages/
    ├── Dashboard.tsx         # Main BI dashboard
    ├── Pages.tsx             # History, Singles, Pairs, Triples, Combinations, Backtest, Settings
    └── TicketFilterPage.tsx  # Ticket filter tool
```

---

## Scoring Overview (V2)

Combination score is a weighted average of five components, then calibrated:

```
proposalScore = weightedAverage(
  [single, pair, gap, structure, novelty],
  [38, 28, 18, 10, 6]          // comboWeightsV2 defaults
)

totalScore = 50 + 0.8 × (proposalScore − 50)   // calibrateProposalScore
```

| Component   | Meaning |
|-------------|---------|
| **Single**  | Chance-adjusted frequency + consensus model |
| **Pair**    | Average chance-adjusted pair lift |
| **Gap**     | Average gap-model score of the six numbers |
| **Structure** | How typical the sum / parity / inside counts are |
| **Novelty** | Penalty for high overlap with historical draws |

`tripleScore` is computed and shown on its own history chart, but is **not** included in `totalScore`.

---

## Score History Period

Score-history charts show target draws within the selected dashboard period. Each point is calculated using only earlier draws; the rolling training window follows the selected period’s draw count and is capped at 100 draws. MA20 is calculated over the displayed score points. This applies consistently to Pair, Triple, Total, Single, and Structure score history.

---

## GitHub Pages Deployment

Workflow: `.github/workflows/deploy-pages.yml`

1. Deploys on every push to `main`
2. Checks the Mega 6/45, Power 6/55, and Lotto 5/35 source datasets hourly
3. Commits changed, validated JSON via the GitHub Actions bot
4. Runs tests, builds, and deploys only when data changed (or after a code push)
5. Skips rebuilding when the source data is unchanged

**One-time setup:** Repository → Settings → Pages → Source = **GitHub Actions**.

You can also trigger a refresh manually from the Actions tab. New source data is picked up on the next hourly check; GitHub Actions schedule delays are possible during platform load.

---

## Scripts Reference

| Script              | Description                          |
|---------------------|--------------------------------------|
| `npm run dev`       | Start Vite dev server                |
| `npm run build`     | Type-check + production build        |
| `npm test`          | Run Vitest once                      |
| `npm run test:watch`| Vitest watch mode                    |
| `npm run sync:data` | Sync all three lottery datasets      |
| `npm run sync:mega645`  | Sync Mega 6/45 only              |
| `npm run sync:power655` | Sync Power 6/55 only             |
| `npm run sync:lotto535` | Sync Lotto 5/35 only             |

---

## Disclaimer

This application is an educational analytics tool. It does **not**:

- Guarantee or improve lottery odds
- Provide financial or gambling advice
- Claim that any score represents a true probability of winning

Use it to explore historical patterns and to understand statistical properties of the games. Play responsibly.

---

## License

Private / personal project. All rights reserved unless otherwise stated by the repository owner.
