# MEGA 6/45 ANALYTICS — AGENT RULES
## React + Local JSON + Dashboard Selectors

> Single source of truth for the coding agent.
>
> Goals:
> - React website
> - local JSON + localStorage only
> - no backend/auth/database server
> - professional BI-style dashboard
> - dashboard selectors
> - all analytics calculated dynamically from draw history
> - no hardcoded predictions or chart values
> - Technical Score is NOT lottery win probability

---

# 1. Stack

Use:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Recharts
Zustand
React Hook Form
Zod
Vitest
lucide-react
date-fns
```

Optional:

```text
TanStack Table
Dexie.js
Web Worker
```

Do NOT use:

```text
Supabase
Firebase
PostgreSQL
MySQL
MongoDB
Express backend
Auth/JWT
Dedicated API server
```

---

# 2. Data Source

Default history:

```text
src/data/mega645-history.json
```

Example:

```json
{
  "version": 1,
  "draws": [
    {
      "date": "2025-10-05",
      "numbers": [5,14,22,28,32,39],
      "jackpot": 69356697000
    },
    {
      "date": "2026-10-04",
      "numbers": [15,20,29,37,40,45],
      "jackpot": 199576277000
    }
  ]
}
```

Default settings:

```text
src/data/default-settings.json
```

Persistence:

```text
localStorage key:
mega645-analytics-data
```

Startup:

```text
if localStorage exists
  use it
else
  load default JSON
```

Only persist:

```text
draws
settings
dashboard filter choices
```

Never persist derived analytics.

---

# 3. Draw Model

```ts
type Draw = {
  id: string;
  date: string; // yyyy-MM-dd
  numbers: [number,number,number,number,number,number];
  jackpot: number;
};
```

Validation:

```text
6 unique numbers
1..45
sorted ascending
unique draw date
jackpot >= 0
```

History order:

```text
oldest → newest
```

---

# 4. Inside Set

```ts
const INSIDE_SET = [
  2,3,4,5,6,7,8,9,10,11,
  13,14,15,16,18,
  21,22,23,24,26,
  29,34,35,36,37,39,42
];
```

```text
Inside = 27
Outside = 18
```

---

# 5. App Layout

Desktop:

```text
┌──────────────────────────────────────────────────────┐
│ TOP BAR                                              │
├────────────┬─────────────────────────────────────────┤
│ SIDEBAR    │ DASHBOARD SELECTORS                     │
│            ├─────────────────────────────────────────┤
│ Dashboard  │                                         │
│ History    │ MAIN CONTENT                            │
│ Singles    │                                         │
│ Pairs      │                                         │
│ Triples    │                                         │
│ Analysis   │                                         │
│ Combos     │                                         │
│ Backtest   │                                         │
│ Settings   │                                         │
└────────────┴─────────────────────────────────────────┘
```

Mobile:

```text
sidebar => drawer
selectors => horizontal scroll / wrapped controls
```

---

# 6. Sidebar

Menu:

```text
Dashboard
Draw History
Single Numbers
Pairs
Triples
Analysis
Suggested Combinations
Backtest
Settings
```

---

# 7. Dashboard Selectors

Top toolbar:

```text
[ Period ▼ ]
[ Analysis View ▼ ]
[ Scoring Preset ▼ ]
[ Prediction Count ▼ ]
```

Changes must update the dashboard immediately.

## Period

```text
Last 10 draws
Last 30
Last 50
Last 100
Last 6 months
Last 1 year
All
Custom
```

```ts
type PeriodPreset =
  | "last10"
  | "last30"
  | "last50"
  | "last100"
  | "last6months"
  | "last1year"
  | "all"
  | "custom";
```

Custom:

```text
fromDate
toDate
```

## Analysis View

```text
Overview
Single Frequency
Gap & Trend
Pairs
Triples
Combinations
Jackpot
Backtest
```

## Scoring Preset

```text
Default
Balanced
Hot
Gap
Pair
Triple
Custom
```

## Prediction Count

```text
Top 5
Top 10
Top 20
```

Default:

```text
Top 5
```

---

# 8. Dashboard Overview — Required Visual Structure

The overview must closely follow the supplied reference image.

Do NOT make it look like a spreadsheet.

Required structure:

```text
RED/ORANGE HEADER BANNER

ROW 1
┌────────────────────────┬──────────────────┬──────────────────────┐
│ Latest Draw            │ Top Predictions  │ Distribution         │
│ 6 lottery balls       │ Top 5            │ Inside/Outside Pie   │
│ KPIs below            │                  │ Even/Odd Pie         │
└────────────────────────┴──────────────────┴──────────────────────┘

ROW 2
Frequency Buckets
Top 10 Numbers
Occurrence Timeline
Draws by Month

ROW 3
Gap vs Frequency
Last 30 Frequency
Top 10 Pairs
Top 10 Triples
```

Desktop target:

```text
1440–1600px
```

---

# 9. Header Banner

Style:

```text
red/orange gradient
white title
gold/yellow subtitle
compact KPI panel on right
```

Title:

```text
MEGA 6/45 RESULT STATISTICS & ANALYSIS
```

Subtitle example:

```text
Based on the latest 1-year dataset
05/10/2025 → 04/10/2026
```

Right KPIs:

```text
Total draws
From
To
```

All dynamic.

---

# 10. Latest Draw Card

Header:

```text
LATEST DRAW
```

Show 6 circular balls:

```text
15 20 29 37 40 45
```

Ball colors:

```text
1 yellow
2 green
3 orange
4 blue
5 purple
6 black
```

Ball design:

```text
white center
thick colored border
circle
large bold number
subtle shadow
```

Below:

```text
Jackpot
Total
Digital Root
Even/Odd
Inside/Outside
```

Example:

```text
199,576,277,000 VND
186
6
2/4
3/3
```

---

# 11. Top Predictions Card

Replace the prize table area with:

```text
TOP PREDICTIONS
Top 5 by Technical Score
```

Columns:

```text
Rank
Combination
Score
```

Example:

```text
1  02-15-20-31-36-45  66.31
2  ...
3  ...
4  ...
5  ...
```

Never hardcode.

Rank colors:

```text
1 gold
2 silver
3 bronze
4 blue
5 navy
```

Tooltip:

```text
Technical Score is an internal ranking score,
not actual lottery win probability.
```

---

# 12. Distribution Card

Title:

```text
NUMBER DISTRIBUTION
```

Desktop:

```text
Inside/Outside Pie | Even/Odd Pie
```

Inside/Outside:

```text
Inside 27
Outside 18
```

Even/Odd for 1..45:

```text
Even 22
Odd 23
```

Show count + percentage.

---

# 13. Dashboard Row 2

## A. Frequency Buckets

Pie/Donut buckets:

```text
>=20
16–19
12–15
8–11
<=7
```

Derived from single-number counts.

## B. Top 10 Numbers

Horizontal bar.

Sort:

```text
count DESC
number ASC
```

## C. Occurrence Timeline

Line chart.

Recommended aggregation:

```text
monthly occurrence average
+
rolling average
```

Alternative:

```text
selected number occurrences by month
```

## D. Draws by Month

Bar chart.

Group by:

```text
YYYY-MM
```

---

# 14. Dashboard Row 3

## A. Gap vs Frequency

Bubble/scatter.

```text
X = Current Gap
Y = Total Count
Bubble size = Technical Score
```

Color by state:

```text
HOT red
DUE orange
DROUGHT gray
NEUTRAL green
COOL blue
```

Tooltip:

```text
Number
Count
Current Gap
Average Gap
Trend30
Score
State
```

## B. Last 30 Frequency

Scatter.

```text
X = total count in selected period
Y = count in last 30
Bubble size = technical score
```

## C. Top 10 Pairs

Horizontal bar.

## D. Top 10 Triples

Horizontal bar.

---

# 15. Single Number Stats

```ts
type SingleNumberStats = {
  number: number;

  totalCount: number;
  frequencyRate: number;

  currentGap: number;
  averageGap: number;
  maxGap: number;

  countLast10: number;
  countLast30: number;

  trend30: number;
  gapRatio: number;

  inside: boolean;
  parity: "EVEN" | "ODD";

  state:
    | "HOT"
    | "NEUTRAL"
    | "COOL"
    | "DUE"
    | "DROUGHT";

  technicalScore: number;
  rank: number;
};
```

---

# 16. Frequency

```ts
totalCount =
  draws.filter(d =>
    d.numbers.includes(number)
  ).length;

frequencyRate =
  totalCount / draws.length;
```

---

# 17. Current Gap

```ts
currentGap =
  draws.length - 1 - lastAppearanceIndex;
```

---

# 18. Average Gap

```text
appearance indexes
→ differences
→ mean
```

---

# 19. Max Gap

```ts
maxGap =
  Math.max(...historicalGaps);
```

Do NOT replace historical max gap with current gap.

---

# 20. Gap Ratio

```ts
gapRatio =
  averageGap > 0
    ? currentGap / averageGap
    : 0;
```

Interpretation:

```text
<0.70       short
0.70–1.20   normal
1.20–1.50   above normal
1.50–2.00   due
>=2.00      drought
```

Never interpret drought as "guaranteed soon".

---

# 21. Last 10 / Last 30

```ts
countLast10 =
  draws.slice(-10)
       .filter(d =>
         d.numbers.includes(number)
       ).length;

countLast30 =
  draws.slice(-30)
       .filter(d =>
         d.numbers.includes(number)
       ).length;
```

---

# 22. Trend 30

```ts
recentRate =
  countLast30 /
  Math.min(30, draws.length);

longRate =
  totalCount / draws.length;

trend30 =
  longRate > 0
    ? recentRate / longRate
    : 0;
```

Interpretation:

```text
>=1.30      strong up
1.05–1.30   up
0.80–1.05   stable
<0.80       down
```

---

# 23. Number State

```ts
if (trend30 >= 1.3 && gapRatio < 0.8)
  state = "HOT";
else if (gapRatio >= 2)
  state = "DROUGHT";
else if (gapRatio >= 1.5)
  state = "DUE";
else if (trend30 < 0.8)
  state = "COOL";
else
  state = "NEUTRAL";
```

---

# 24. Single Technical Score

Default weights:

```text
Frequency 45
Gap       25
Trend     20
Inside    10
```

```ts
freqScore =
  totalCount / maxCount * 100;
```

```ts
gapScore =
  Math.max(
    0,
    100 - Math.abs(gapRatio - 1) * 50
  );
```

```ts
trendScore =
  clamp(
    trend30 / 1.5 * 100,
    0,
    100
  );
```

```ts
insideScore =
  inside ? 100 : 0;
```

```ts
technicalScore =
  freqScore * .45 +
  gapScore * .25 +
  trendScore * .20 +
  insideScore * .10;
```

---

# 25. Pair Stats

Full pair space:

```text
C(45,2) = 990
```

```ts
type PairStats = {
  a: number;
  b: number;
  key: string;
  count: number;
  rate: number;
  insideCount: number;
  outsideCount: number;
  evenCount: number;
  oddCount: number;
  rank: number;
};
```

Count:

```ts
count =
  draws.filter(d =>
    d.numbers.includes(a) &&
    d.numbers.includes(b)
  ).length;
```

---

# 26. Triple Stats

Each draw generates:

```text
C(6,3) = 20 triples
```

```ts
type TripleStats = {
  numbers: [number,number,number];
  key: string;
  count: number;
  rate: number;
  insideCount: number;
  outsideCount: number;
  evenCount: number;
  oddCount: number;
  rank: number;
};
```

Key format:

```text
02-09-30
```

Validation:

```ts
/^\d{2}-\d{2}-\d{2}$/
```

Skip invalid values.

Never render:

```text
#REF!
#VALUE!
#ERROR!
NaN
undefined
```

---

# 27. Triple Algorithm

```ts
const map = new Map<string, number>();

for (const draw of draws) {
  for (const triple of combinations(draw.numbers, 3)) {
    const key = [...triple]
      .sort((a,b) => a-b)
      .map(n => String(n).padStart(2,"0"))
      .join("-");

    map.set(
      key,
      (map.get(key) ?? 0) + 1
    );
  }
}
```

Sort:

```text
count DESC
key ASC
```

---

# 28. Digital Root

```ts
function digitalRoot(n: number) {
  if (n <= 0) return 0;
  return 1 + ((n - 1) % 9);
}
```

Allowed:

```text
8
5
3
1
```

Priority:

```text
8 > 5 > 3 > 1
```

This is a user preference, not a mathematical advantage.

---

# 29. Valid Combination Rules

A valid 6-number set must satisfy:

```text
6 unique numbers

sum >= 55

digital root:
8 / 5 / 3 / 1

even/odd:
3/3
4/2
2/4

inside/outside:
4/2
3/3
```

Priority:

```text
Inside/Outside:
4/2 > 3/3
```

---

# 30. Candidate Pool

Default:

```text
Top 14 numbers by Technical Score
```

Then generate:

```text
C(14,6) = 3003
```

Avoid full brute force:

```text
C(45,6) = 8,145,060
```

Candidate pool options:

```text
10
12
14
16
18
```

---

# 31. Combination Model

```ts
type CandidateCombination = {
  numbers: number[];

  total: number;
  digitalRoot: number;

  evenCount: number;
  oddCount: number;

  insideCount: number;
  outsideCount: number;

  singleScore: number;
  pairScore: number;
  tripleScore: number;
  structureScore: number;

  totalScore: number;

  valid: boolean;
  rank?: number;
};
```

---

# 32. Combination Single Score

```ts
singleScore =
  mean(
    numbers.map(
      n => singleStats[n].technicalScore
    )
  );
```

---

# 33. Pair Score

A 6-number combination has:

```text
15 pairs
```

```ts
pairItemScore =
  pair.count / maxPairCount * 100;

pairScore =
  mean(all15PairScores);
```

---

# 34. Triple Score

A 6-number combination has:

```text
20 triples
```

```ts
tripleItemScore =
  triple.count / maxTripleCount * 100;

tripleScore =
  mean(all20TripleScores);
```

Never observed triple:

```text
0
```

---

# 35. Structure Score

Root:

```text
8 => 30
5 => 25
3 => 20
1 => 15
```

Parity:

```text
3/3 => 30
4/2 => 25
2/4 => 25
```

Inside/Outside:

```text
4/2 => 30
3/3 => 25
```

Sum:

```text
>=55 => 10
```

Normalize to:

```text
0–100
```

---

# 36. Final Combination Score

Default:

```text
Single     40
Pair       25
Triple     15
Structure  20
```

```ts
totalScore =
  singleScore * .40 +
  pairScore * .25 +
  tripleScore * .15 +
  structureScore * .20;
```

---

# 37. Diversity

Avoid near-duplicate top results.

Default:

```text
max shared numbers = 4
```

Algorithm:

```ts
const selected = [];

for (const candidate of sortedCandidates) {
  const okay = selected.every(
    existing =>
      intersectionCount(
        candidate.numbers,
        existing.numbers
      ) <= maxOverlap
  );

  if (okay) selected.push(candidate);

  if (selected.length >= targetCount)
    break;
}
```

---

# 38. Dashboard Data Flow

Whenever period changes:

```text
all draws
→ filter selected period
→ recompute singles
→ recompute pairs
→ recompute triples
→ recompute gap/trend
→ recompute scores
→ generate combinations
→ update predictions
→ update all charts
```

Do not reuse analytics from another period.

---

# 39. History Page

Route:

```text
/history
```

Columns:

```text
Date
N1
N2
N3
N4
N5
N6
Jackpot
Actions
```

Actions:

```text
Add Draw
Edit
Delete
Import JSON
Export JSON
Reset
```

---

# 40. Singles Page

Columns:

```text
Number
Count
Rate
Inside/Outside
Even/Odd
Current Gap
Avg Gap
Max Gap
Last 10
Last 30
Trend30
Gap Ratio
State
Technical Score
Rank
```

Filters:

```text
Inside
Outside
Even
Odd
HOT
DUE
DROUGHT
Top N
```

---

# 41. Pairs Page

Columns:

```text
Pair
Count
Rate
Inside/Outside
Even/Odd
Rank
```

Search:

```text
07
07-26
```

---

# 42. Triples Page

Columns:

```text
Triple
Count
Rate
Inside/Outside
Even/Odd
Rank
```

Default:

```text
observed triples only
```

Optional:

```text
Show all possible
```

---

# 43. Combinations Page

Columns:

```text
Rank
Combination
Sum
Root
Even/Odd
Inside/Outside
Single
Pair
Triple
Structure
Total Score
```

Controls:

```text
Candidate Pool
Min Sum
Allowed Roots
Parity Rules
Inside/Outside Rules
Score Weights
Max Overlap
Top Count
```

---

# 44. Backtest

For target draw at index `N`:

```text
use only draws[0...N-1]
```

Never use future data.

Metrics:

```text
0/6
1/6
2/6
3/6
4/6
5/6
6/6
```

Show:

```text
hit distribution
average matches
best historical match
```

---

# 45. Settings

Sections:

```text
Data
Candidate Pool
Single Score Weights
Combination Score Weights
Structure Rules
Diversity
Dashboard Defaults
```

Default settings:

```ts
const DEFAULT_SETTINGS = {
  candidatePoolSize: 14,

  minTotal: 55,

  allowedDigitalRoots: [8,5,3,1],

  allowedParity: [
    "3/3",
    "4/2",
    "2/4"
  ],

  allowedInsideOutside: [
    "4/2",
    "3/3"
  ],

  singleWeights: {
    frequency: 45,
    gap: 25,
    trend: 20,
    inside: 10
  },

  combinationWeights: {
    single: 40,
    pair: 25,
    triple: 15,
    structure: 20
  },

  maxCombinationOverlap: 4,

  topCombinationCount: 12
};
```

---

# 46. Zustand Store

```ts
type LotteryStore = {
  draws: Draw[];
  settings: AnalysisSettings;
  dashboardFilters: DashboardFilters;

  addDraw(draw): void;
  updateDraw(id, draw): void;
  removeDraw(id): void;

  importData(data): void;
  resetData(): void;

  updateSettings(settings): void;
  updateDashboardFilters(filters): void;
};
```

---

# 47. Suggested Project Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
├── data/
│   ├── mega645-history.json
│   └── default-settings.json
├── domain/
│   ├── models.ts
│   ├── constants.ts
│   └── types.ts
├── analytics/
│   ├── filterDraws.ts
│   ├── singleStats.ts
│   ├── pairStats.ts
│   ├── tripleStats.ts
│   ├── gap.ts
│   ├── trend.ts
│   ├── scoring.ts
│   ├── candidatePool.ts
│   ├── combinations.ts
│   ├── diversity.ts
│   └── analytics.worker.ts
├── stores/
│   └── lotteryStore.ts
├── hooks/
│   ├── useAnalytics.ts
│   ├── useFilteredDraws.ts
│   └── usePredictions.ts
├── layouts/
│   └── AppLayout.tsx
├── components/
│   ├── sidebar/
│   ├── selectors/
│   ├── dashboard/
│   ├── charts/
│   ├── tables/
│   ├── forms/
│   └── ui/
├── pages/
│   ├── DashboardPage.tsx
│   ├── HistoryPage.tsx
│   ├── SinglesPage.tsx
│   ├── PairsPage.tsx
│   ├── TriplesPage.tsx
│   ├── CombinationsPage.tsx
│   ├── BacktestPage.tsx
│   └── SettingsPage.tsx
├── services/
│   ├── storage.ts
│   ├── importJson.ts
│   └── exportJson.ts
└── utils/
    ├── math.ts
    ├── date.ts
    ├── format.ts
    └── validation.ts
```

---

# 48. Visual Rules

Reference style:

```text
Vietnam lottery analytics dashboard
red/orange banner
light blue page background
white cards
blue card headers
compact charts
professional BI layout
```

Avoid:

```text
spreadsheet look
generic dark admin dashboard
huge empty padding
oversized cards
dense table borders
```

Card style:

```text
white
rounded 8–12px
light border
subtle shadow
compact padding
```

---

# 49. Responsive

Desktop:

```text
dashboard close to reference image
4 charts per row
```

Tablet:

```text
2 cards per row
```

Mobile:

```text
1 card per row
drawer sidebar
smaller balls
stacked charts
```

---

# 50. Formatting

Numbers:

```text
01
02
...
45
```

Date UI:

```text
dd/MM/yyyy
```

Internal date:

```text
yyyy-MM-dd
```

Jackpot:

```text
199,576,277,000 VND
```

Rate:

```text
20.38%
```

Technical Score:

```text
66.31
```

---

# 51. Error Handling

Never show:

```text
#REF!
#VALUE!
#ERROR!
NaN
undefined
null
```

Show:

```text
No data
Not enough data
Invalid data
—
```

---

# 52. Import / Export

Import JSON:

Validate:

```text
version
draws array
valid date
6 unique numbers
1..45
jackpot >= 0
```

Export:

```json
{
  "version": 1,
  "draws": [],
  "settings": {}
}
```

Filename:

```text
mega645-backup-YYYY-MM-DD.json
```

---

# 53. Performance

Target:

```text
157–1000 draws
45 singles
990 pairs
observed triples
3003 candidate combinations
```

Goal:

```text
<500ms ideal
<1500ms acceptable
```

Move heavy work to Web Worker if needed:

```text
pairs
triples
combination generation
scoring
backtest
```

---

# 54. Required Tests

Test:

```text
period filter
frequency
current gap
average gap
max gap
last10
last30
trend30
pair count
triple count
digital root
parity
inside/outside
combination validation
single score
final combination score
diversity
backtest future-data isolation
```

---

# 55. Non-Negotiable Rules

1. No hardcoded predictions.
2. No hardcoded chart data.
3. No hardcoded Top 10 numbers/pairs/triples.
4. Draw history is the analytics source of truth.
5. Changing period recalculates everything.
6. Changing settings recalculates predictions.
7. No backend.
8. No auth.
9. No database server.
10. JSON + localStorage only.
11. Technical Score is not win probability.
12. Never render raw formula/data errors.
13. Analytics must be independent from React UI.
14. Dashboard must resemble the supplied reference structure.
15. All displayed lottery numbers use 2 digits.

---

# 56. Development Order

```text
1. Data models
2. JSON loading
3. localStorage
4. validation
5. period filtering
6. single analytics
7. pair analytics
8. triple analytics
9. scoring
10. combination generator
11. diversity
12. tests
13. Zustand
14. layout/sidebar
15. selectors
16. Dashboard Overview
17. History
18. Singles
19. Pairs
20. Triples
21. Combinations
22. Backtest
23. Settings
24. UI polish
```

---

# 57. Definition of Done

- [ ] `npm install`
- [ ] `npm run dev`
- [ ] no backend
- [ ] JSON loads
- [ ] localStorage works
- [ ] import/export JSON
- [ ] CRUD draw history
- [ ] dashboard selectors work
- [ ] period filter updates analytics
- [ ] 45 single stats
- [ ] 990 pairs
- [ ] triple stats
- [ ] gap/trend
- [ ] Technical Score
- [ ] candidate pool
- [ ] combinations
- [ ] structural filters
- [ ] scoring
- [ ] diversity
- [ ] Top 5 predictions
- [ ] dashboard matches reference composition
- [ ] pie/donut charts
- [ ] bar charts
- [ ] line chart
- [ ] scatter/bubble charts
- [ ] responsive
- [ ] no raw errors
- [ ] tests pass

---

# 58. Final Coding Agent Prompt

```text
Build the Mega 6/45 Analytics website exactly from this specification.

Stack:
React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts + Zustand.

Persistence:
local JSON + localStorage only.

Do not build:
backend,
authentication,
database server,
API server.

The app must include:
- left sidebar navigation
- dashboard selector toolbar
- period selector
- analysis view selector
- scoring preset selector
- prediction count selector

Dashboard Overview must closely follow the supplied reference image:

1. red/orange Mega 6/45 banner
2. latest draw card with 6 circular balls
3. Top 5 technical predictions in the center
4. Inside/Outside and Even/Odd pie charts on the right
5. 4 analysis charts on row 2
6. 4 analysis charts on row 3

Do not simplify it into spreadsheet cells.

All analytics must be dynamically calculated from the selected draw history.

No prediction, frequency, pair, triple, score, KPI, or chart value may be hardcoded.

When period changes:
recalculate all analytics and predictions.

When history changes:
recalculate all derived values automatically.

Technical Score is an internal ranking score only.
Never describe it as lottery win probability.

Implement analytics tests before final UI polish.
```

# END
