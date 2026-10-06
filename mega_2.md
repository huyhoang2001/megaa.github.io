# MEGA 6/45 ANALYTICS — ADVANCED ANALYTICS UPDATE
## Addendum for the Existing React Agent Specification

> Extend the existing Mega 6/45 React app.
>
> Keep:
> - React + TypeScript + Vite
> - Tailwind + shadcn/ui
> - Recharts
> - Zustand
> - local JSON + localStorage only
> - no backend/auth/database
>
> This update replaces a single opaque Technical Score with explainable multi-model analytics.
>
> Important: lottery draws are independent random events. These models describe historical patterns only and must never be presented as true future win probabilities.

---

# 1. Main Goal

Upgrade the analytics engine from:

```text
frequency
gap
pair count
triple count
single composite score
```

to:

```text
Weighted Frequency
Momentum
Frequency Z-Score
Gap Percentile
Gap Stability
Pair Lift
Transition Association
Structure Analytics
Consensus Ranking
Model Agreement
Model Confidence
Statistical Anomaly Detection
Backtesting
```

---

# 2. Multi-Model Number Analytics

Create independent models:

```text
Frequency Model
Momentum Model
Gap Model
Association Model
Consensus Model
```

Each model returns:

```ts
type ModelSignal = {
  rawScore: number;
  normalizedScore: number; // 0..100
  percentileRank: number;  // 0..100
  rank: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  explanation: string[];
};
```

Do not combine incompatible raw scores directly.

---

# 3. Weighted Frequency

Use exponential decay:

```ts
weight(age) = Math.exp(-lambda * age);
lambda = Math.log(2) / halfLife;
```

Default:

```text
halfLife = 30 draws
```

Where:

```text
age=0 latest draw
age=1 previous draw
...
```

```ts
weightedFrequency =
  sum(drawContainsNumber ? weight(age) : 0);

weightedFrequencyScore =
  weightedFrequency / maxWeightedFrequency * 100;
```

Setting:

```ts
weightedFrequencyHalfLife: 30
```

---

# 4. Rolling Frequency

Calculate:

```text
Last 10
Last 20
Last 30
Last 50
Last 100
Selected Period
```

```ts
type RollingFrequency = {
  last10: number;
  last20: number;
  last30: number;
  last50: number;
  last100: number;
  all: number;
};
```

Use available draw count when history is shorter than the requested window.

---

# 5. Momentum Model

```ts
rate10 =
  countLast10 / Math.min(10, totalDraws);

rate30 =
  countLast30 / Math.min(30, totalDraws);

momentum10vs30 =
  rate30 > 0 ? rate10 / rate30 : 0;
```

Interpretation:

```text
>1.40      ACCELERATING
1.10–1.40  RISING
0.90–1.10  STABLE
<0.90      FALLING
```

Also compute:

```text
10 vs 50
30 vs 100
```

Default normalized score:

```ts
momentumScore =
  clamp(momentum10vs30 / 1.5 * 100, 0, 100);
```

---

# 6. Uniform Baseline

For Mega 6/45:

```ts
p = 6 / 45;
```

For `N` draws:

```ts
expectedCount = N * p;
variance = N * p * (1 - p);
sigma = Math.sqrt(variance);
```

---

# 7. Frequency Z-Score

```ts
frequencyZ =
  sigma > 0
    ? (observedCount - expectedCount) / sigma
    : 0;
```

Interpretation:

```text
z >= +2      unusually high
+1..+2       above expectation
-1..+1       normal range
-2..-1       below expectation
z <= -2      unusually low
```

UI must show:

```text
Observed
Expected
Z-Score
```

---

# 8. Expected 95% Band

```ts
lower95 = Math.max(0, expectedCount - 1.96 * sigma);
upper95 = expectedCount + 1.96 * sigma;
```

Use in rolling-frequency charts:

```text
Observed
Expected
95% Lower
95% Upper
```

---

# 9. Global Uniformity Test

Calculate a chi-square-style statistic across all 45 numbers:

```ts
chiSquare =
  sum((observed - expected) ** 2 / expected);
```

```text
df = 44
```

Preferred:
use a small statistics dependency to compute p-value.

UI:

```text
Chi-square
Degrees of freedom
p-value
```

Wording:

```text
Tests whether the observed frequency distribution deviates more than expected under a uniform model.
```

Do not imply significance means predictability.

---

# 10. Gap Distribution

```ts
type GapStats = {
  gaps: number[];
  currentGap: number;
  meanGap: number;
  medianGap: number;
  minGap: number;
  maxGap: number;
  stdGap: number;
  q1: number;
  q3: number;
  gapPercentile: number;
  gapZ: number;
  gapCV: number;
};
```

---

# 11. Gap Percentile

```ts
gapPercentile =
  percentileRank(historicalGaps, currentGap);
```

Range:

```text
0..100
```

Interpretation:

```text
50 = typical
90 = longer than 90% of historical gaps
99 = highly unusual
```

Never state:

```text
99th percentile => more likely next draw
```

Allowed:

```text
Current gap is unusually long relative to this number's own history.
```

---

# 12. Gap Z-Score

```ts
gapZ =
  stdGap > 0
    ? (currentGap - meanGap) / stdGap
    : 0;
```

---

# 13. Gap Stability

```ts
gapCV =
  meanGap > 0
    ? stdGap / meanGap
    : 0;
```

Interpretation:

```text
low CV  = more stable historical intervals
high CV = irregular intervals
```

Normalize to a `gapStabilityScore` 0..100.

---

# 14. Gap Model

Do NOT implement a "cold rebound probability".

Use:

```text
Gap Position Model
```

Inputs:

```text
Gap Percentile
Gap Z-Score
Gap Stability
```

Example:

```ts
gapModelScore =
  0.50 * normalizedGapPercentile +
  0.25 * normalizedAbsGapZ +
  0.25 * gapStabilityScore;
```

Ranking signal only.

---

# 15. Pair Lift

For pair `(A,B)`:

```ts
pA = countA / N;
pB = countB / N;

actualPairRate = pairCount / N;
expectedPairRate = pA * pB;

pairLift =
  expectedPairRate > 0
    ? actualPairRate / expectedPairRate
    : 0;
```

Interpretation:

```text
Lift = 1   roughly independent
Lift > 1   co-occurred more than expected
Lift < 1   co-occurred less than expected
```

Default support requirement:

```text
pairCount >= 2
```

---

# 16. Pair Confidence

Default:

```ts
pairConfidence =
  pairCount >= 6
    ? "HIGH"
    : pairCount >= 3
      ? "MEDIUM"
      : "LOW";
```

Make thresholds configurable.

---

# 17. Pair Heatmap

Add a 45×45 matrix.

Metric selector:

```text
Count
Rate
Lift
Last 30 Count
Last 30 Lift
```

Rows/columns:

```text
01..45
```

Diagonal:

```text
blank
```

Tooltip:

```text
Pair
Count
Rate
Lift
Support Confidence
```

---

# 18. Triple Lift

Optional advanced signal:

```ts
expectedRate = pA * pB * pC;
actualRate = tripleCount / N;

tripleLift =
  expectedRate > 0
    ? actualRate / expectedRate
    : 0;
```

Triple data is sparse; default confidence is low and weight must stay small.

---

# 19. Next-Draw Transition Association

Do not label this as Markov prediction probability.

Use label:

```text
Next-Draw Transition Association
```

For A in draw `t`, count B in draw `t+1`:

```ts
transitionCount[A][B]
```

```ts
transitionRate[A][B] =
  transitionCount[A][B] /
  eligibleOccurrencesOfA;
```

Baseline:

```ts
baselineB = countB / N;
```

Transition lift:

```ts
transitionLift[A][B] =
  baselineB > 0
    ? transitionRate[A][B] / baselineB
    : 0;
```

---

# 20. Transition Minimum Support

Default:

```ts
minTransitionSupport = 15;
```

If:

```text
eligibleOccurrencesOfA < 15
```

then:

```text
confidence = LOW
```

Low-confidence transition data should be heavily downweighted.

---

# 21. Association Model

Recommended weights:

```text
Pair Lift          45%
Recent Pair Lift   25%
Transition Lift    20%
Triple Lift        10%
```

Normalize all components first.

---

# 22. Structure Analytics

For every draw:

```ts
type DrawStructure = {
  sum: number;
  mean: number;
  median: number;

  min: number;
  max: number;
  spread: number; // max-min

  evenCount: number;
  oddCount: number;

  insideCount: number;
  outsideCount: number;

  lowCount: number;
  highCount: number;

  consecutivePairs: number;

  digitalRoot: number;

  decadeDistribution: number[];
};
```

---

# 23. Low / High

Default:

```text
Low = 01..22
High = 23..45
```

Analyze historical distributions:

```text
3/3
4/2
2/4
etc.
```

---

# 24. Sum Distribution

Calculate:

```text
mean
median
stdDev
min
max
Q1
Q3
```

Suggested histogram bins:

```text
<=80
81–100
101–120
121–140
141–160
161–180
181+
```

Candidate sum Z:

```ts
sumZ =
  sumStd > 0
    ? (candidateSum - historicalSumMean) / sumStd
    : 0;
```

Default preferred region:

```text
-1.5 <= sumZ <= +1.5
```

Keep existing hard rule:

```text
sum >= 55
```

---

# 25. Historical Parity Distribution

Analyze draw-level parity:

```text
0/6
1/5
2/4
3/3
4/2
5/1
6/0
```

Do not confuse this with the static 22-even / 23-odd count of the 1..45 universe.

Structure scoring should use empirical historical distribution.

---

# 26. Historical Inside/Outside Distribution

Analyze:

```text
0/6
1/5
2/4
3/3
4/2
5/1
6/0
```

Keep existing hard filter:

```text
4/2
3/3
```

but show full historical distribution.

---

# 27. Consecutive Analysis

For each draw count adjacent pairs:

```text
14-15
20-21
31-32
```

Distribution:

```text
0 pairs
1 pair
2 pairs
3+ pairs
```

Optional component of Structure Score.

---

# 28. Spread Analysis

```ts
spread = maxNumber - minNumber;
```

Analyze historical distribution and candidate percentile.

---

# 29. Digital Root Distribution

Calculate roots:

```text
1..9
```

Show count and percentage.

Keep user preference:

```text
8 > 5 > 3 > 1
```

but expose the actual historical distribution.

---

# 30. Gini / Lorenz

Advanced Statistics only.

Calculate frequency Lorenz curve and Gini coefficient.

Use for distribution diagnostics only.

Do not include in default prediction scoring.

---

# 31. Gap Boxplots

Add a Gap Distribution view with:

```text
Q1
Median
Q3
Whiskers
Outliers
Current Gap marker
```

If Recharts lacks boxplot support, use custom SVG or a lightweight chart library only for this component.

---

# 32. Anomaly Detection

```ts
type StatisticalAnomaly = {
  number: number;
  type:
    | "FREQUENCY_HIGH"
    | "FREQUENCY_LOW"
    | "GAP_HIGH"
    | "RECENT_HIGH"
    | "RECENT_LOW";

  severity:
    | "INFO"
    | "WARNING"
    | "STRONG";

  zScore?: number;
  percentile?: number;

  explanation: string;
};
```

---

# 33. Frequency Anomaly

Trigger:

```text
|frequencyZ| >= 2
```

---

# 34. Gap Anomaly

Trigger:

```text
gapPercentile >= 95
```

or:

```text
gapZ >= 2
```

---

# 35. Recent Frequency Anomaly

For last 30:

```ts
expected30 =
  Math.min(30, N) * p;

sigma30 =
  Math.sqrt(
    Math.min(30, N) *
    p *
    (1-p)
  );

recentZ =
  sigma30 > 0
    ? (countLast30 - expected30) / sigma30
    : 0;
```

Trigger:

```text
|recentZ| >= 2
```

---

# 36. Anomaly Panel

Add:

```text
STATISTICAL ANOMALIES
```

Example:

```text
31  Recent Z +2.31
05  Gap Percentile 99%
08  Recent Z -2.04
```

Always show:

```text
Historical anomaly only. Not a prediction guarantee.
```

---

# 37. Number Models

Create:

```text
Frequency Model
Momentum Model
Gap Model
Association Model
Consensus Model
```

Each returns 0..100 normalized score + percentile + rank.

---

# 38. Frequency Model

Recommended:

```text
Long-term Frequency Z     35%
Weighted Frequency        40%
Rolling Frequency Rank    25%
```

---

# 39. Momentum Model

Recommended:

```text
10 vs 30 momentum         50%
30 vs 100 momentum        30%
Recent Frequency Z        20%
```

---

# 40. Gap Model

Recommended:

```text
Gap Percentile            50%
|Gap Z|                   25%
Gap Stability             25%
```

This measures unusual historical position only.

---

# 41. Association Model

Recommended:

```text
Pair Lift                 45%
Recent Pair Lift          25%
Transition Association    20%
Triple Lift               10%
```

---

# 42. Consensus Model

Do not average raw model scores.

Convert each model to percentile rank first.

```ts
consensusScore =
  weightedMean([
    frequencyPercentile,
    momentumPercentile,
    gapPercentileRank,
    associationPercentile
  ]);
```

Default:

```text
25 / 25 / 25 / 25
```

Allow configuration.

---

# 43. Consensus Candidate Pool

New default:

```text
Top 14 numbers by Consensus Score
```

This replaces:

```text
Top 14 by old Technical Score
```

Keep old method as a Legacy preset.

---

# 44. Model Agreement

Default Top-K:

```text
K = 10
```

```ts
agreementCount =
  number of component models
  ranking the number in Top K;
```

Example:

```text
3/4 models
```

UI may show:

```text
★★★☆
```

---

# 45. Model Confidence

This measures data support, NOT chance of winning.

Example:

```ts
if (
  agreement >= 3 &&
  totalDraws >= 100 &&
  associationSupportGood
) HIGH;

else if (
  agreement >= 2 &&
  totalDraws >= 50
) MEDIUM;

else LOW;
```

Tooltip:

```text
Confidence reflects sample support and model agreement, not win probability.
```

---

# 46. Advanced Number Model

```ts
type AdvancedNumberStats = {
  number: number;

  totalCount: number;
  frequencyRate: number;

  weightedFrequency: number;

  rolling: {
    last10: number;
    last20: number;
    last30: number;
    last50: number;
    last100: number;
  };

  frequencyZ: number;
  recentZ30: number;

  gap: GapStats;

  momentum: {
    ratio10vs30: number;
    ratio30vs100: number;
  };

  models: {
    frequency: ModelSignal;
    momentum: ModelSignal;
    gap: ModelSignal;
    association: ModelSignal;
    consensus: ModelSignal;
  };

  modelAgreement: number;

  confidence:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
};
```

---

# 47. Combination Engine V2

Keep hard filters:

```text
6 unique
sum >= 55
root 8/5/3/1
parity 3/3, 4/2, 2/4
inside/outside 4/2, 3/3
```

Change candidate selection:

```text
Top N Consensus Score
```

Default:

```text
Top 14
```

---

# 48. Combination Score V2

Recommended:

```text
Consensus Number Quality   30%
Pair Association           20%
Triple Association         10%
Structure                  25%
Diversity / Novelty        15%
```

```ts
comboScore =
  consensusNumberScore * .30 +
  pairAssociationScore * .20 +
  tripleAssociationScore * .10 +
  structureScore * .25 +
  noveltyScore * .15;
```

Keep existing score as:

```text
Legacy Score
```

---

# 49. Consensus Number Quality

```ts
consensusNumberScore =
  mean(
    comboNumbers.map(
      n =>
        numberStats[n]
          .models
          .consensus
          .normalizedScore
    )
  );
```

---

# 50. Pair Association Score

Use normalized lift rather than raw pair count.

Apply confidence multiplier:

```text
HIGH    1.00
MEDIUM  0.80
LOW     0.50
```

---

# 51. Triple Association Score

Use normalized triple lift.

Apply low weight and confidence penalty because of sparse data.

---

# 52. Structure Score V2

Use empirical historical distributions:

```text
Sum Z / percentile        25%
Parity                    15%
Inside/Outside            15%
Low/High                  10%
Spread                    15%
Consecutive Structure     10%
Digital Root Preference   10%
```

Apply hard filters first.

---

# 53. Novelty Score

Measure:

```text
candidate vs historical draws
candidate vs already-selected predictions
```

```ts
maxHistoricalOverlap =
  max(
    intersectionCount(
      candidate,
      historicalDraw
    )
  );
```

```ts
noveltyScore =
  100 - similarityScore;
```

Keep existing max-overlap rule between selected combinations.

---

# 54. Backtest V2

At target draw index `t`:

```text
training data = draws[0..t-1]
```

Never include target or future data.

For each target:

```text
calculate models
rank numbers
generate candidate combinations
compare to actual target
```

---

# 55. Backtest Metrics

Number models:

```text
Actual numbers in Top 5
Actual numbers in Top 10
Actual numbers in Top 15
Mean rank of actual numbers
```

Combination metrics:

```text
0/6
1/6
2/6
3/6
4/6
5/6
6/6
Average matches
Median matches
Best matches
```

---

# 56. Random Baseline

Backtest must include seeded random baseline.

Compare:

```text
Model Top-10 hit rate
vs
Random Top-10 hit rate
```

and:

```text
Model combination overlap
vs
Random combination overlap
```

Use seeded RNG for reproducibility.

---

# 57. Model Backtest Comparison

Table:

```text
Model
Top-5 Hit
Top-10 Hit
Mean Actual Rank
Stability
```

Models:

```text
Weighted Frequency
Momentum
Gap
Association
Consensus
```

Do not assume Consensus is best; historical backtest determines that.

---

# 58. Rolling Backtest Window

Selector:

```text
Last 30 targets
Last 50
Last 100
All possible
```

Default minimum training history:

```text
50 draws
```

---

# 59. Period Comparison

Add comparison mode:

```text
Period A vs Period B
```

Examples:

```text
Last 50 vs Previous 50
This Year vs Previous Year
Custom vs Custom
```

Compare:

```text
Frequency
Weighted Frequency
Z-Score
Gap
Pair Lift
Structure
```

---

# 60. Dashboard Metric Selector

Add optional selector:

```text
Metric ▼
```

For Pair Heatmap:

```text
Count
Rate
Lift
Recent Count
Recent Lift
```

For Singles:

```text
Count
Weighted Frequency
Z-Score
Momentum
Gap Percentile
Consensus
```

---

# 61. Advanced Analysis Tabs

Use existing `/analysis` route or add tabs:

```text
Frequency
Significance
Gap
Association
Structure
Heatmap
Anomalies
Model Comparison
```

---

# 62. Frequency Tab

Show:

```text
Rolling Frequency
Weighted Frequency
Frequency Z
Expected Count
95% Range
```

Charts:

```text
Rolling Frequency
Expected Band
Top Z-Score Numbers
```

---

# 63. Gap Tab

Show:

```text
Current Gap
Mean
Median
Std
Percentile
Z
CV
```

Charts:

```text
Gap Boxplots
Gap Percentile Ranking
```

---

# 64. Association Tab

Show:

```text
Pair Count
Pair Lift
Recent Pair Lift
Transition Lift
Triple Lift
```

Charts:

```text
45x45 Pair Heatmap
Transition Matrix Heatmap
Top Lift Pairs
```

---

# 65. Structure Tab

Show:

```text
Sum Distribution
Parity Distribution
Inside/Outside Distribution
Low/High Distribution
Spread Distribution
Consecutive Distribution
Digital Root Distribution
```

---

# 66. Anomalies Tab

Filters:

```text
All
Frequency
Recent
Gap
Strong only
```

---

# 67. Model Comparison Tab

Table:

```text
Number
Frequency Rank
Momentum Rank
Gap Rank
Association Rank
Consensus Rank
Agreement
Confidence
```

Sortable by any column.

---

# 68. Explainable Top Predictions

Prediction rows must support expand/click.

Collapsed:

```text
#1
02-15-20-31-36-45
Score 71.42
Confidence MEDIUM
```

Expanded:

```text
Consensus Numbers    78.1
Pair Association     69.2
Triple Association   48.0
Structure            74.5
Novelty              82.0

Root                 5
Parity               3/3
Inside/Outside       3/3
Sum                  149
Sum Z                +0.42
Max historical overlap 4/6
```

---

# 69. Explainability

Every number/model should provide reasons.

Example:

```text
31
Consensus Rank #2

Reasons:
- weighted frequency in 91st percentile
- recent frequency Z = +1.8
- strong pair lift with 16 and 28
- current gap is normal
- 3/4 models rank it Top 10
```

Never generate certainty language.

---

# 70. Automatic Warning Badges

Possible badges:

```text
LOW SAMPLE
SPARSE TRANSITION
HIGH GAP ANOMALY
HIGH FREQUENCY Z
MODEL DISAGREEMENT
```

---

# 71. Utility Functions

Create reusable helpers:

```ts
mean()
median()
variance()
stdDev()
quantile()
percentileRank()
zScore()
clamp()
normalizeMinMax()
rankPercentiles()
```

---

# 72. Required Analytics Functions

Add:

```ts
calculateWeightedFrequency()
calculateRollingFrequency()
calculateFrequencyZ()
calculateExpectedFrequencyBand()
calculateChiSquareUniformity()

calculateGapDistribution()
calculateGapPercentile()
calculateGapZ()
calculateGapStability()

calculatePairLift()
calculateRecentPairLift()
calculateTripleLift()

calculateTransitionMatrix()
calculateTransitionLift()

calculateDrawStructure()
calculateStructureDistribution()
calculateSumZ()

calculateNoveltyScore()

calculateModelAgreement()
calculateModelConfidence()
calculateConsensusModel()

runRollingBacktest()
```

---

# 73. Suggested Files

```text
src/analytics/
├── weightedFrequency.ts
├── significance.ts
├── gapDistribution.ts
├── pairLift.ts
├── tripleLift.ts
├── transition.ts
├── structure.ts
├── consensus.ts
├── anomalyDetection.ts
├── novelty.ts
└── backtest.ts
```

Charts:

```text
src/components/charts/
├── PairHeatmap.tsx
├── TransitionHeatmap.tsx
├── GapBoxplot.tsx
├── FrequencyConfidenceChart.tsx
├── SumHistogram.tsx
├── StructureDistributionChart.tsx
└── ModelComparisonChart.tsx
```

---

# 74. Advanced Settings

```ts
type AdvancedAnalysisSettings = {
  weightedFrequencyHalfLife: number;

  minPairSupport: number;
  minTransitionSupport: number;

  frequencyZAlertThreshold: number;
  recentZAlertThreshold: number;

  gapPercentileAlertThreshold: number;
  gapZAlertThreshold: number;

  consensusWeights: {
    frequency: number;
    momentum: number;
    gap: number;
    association: number;
  };

  comboWeightsV2: {
    consensus: number;
    pair: number;
    triple: number;
    structure: number;
    novelty: number;
  };

  backtestMinTrainingDraws: number;
};
```

Defaults:

```ts
{
  weightedFrequencyHalfLife: 30,

  minPairSupport: 2,
  minTransitionSupport: 15,

  frequencyZAlertThreshold: 2,
  recentZAlertThreshold: 2,

  gapPercentileAlertThreshold: 95,
  gapZAlertThreshold: 2,

  consensusWeights: {
    frequency: 25,
    momentum: 25,
    gap: 25,
    association: 25
  },

  comboWeightsV2: {
    consensus: 30,
    pair: 20,
    triple: 10,
    structure: 25,
    novelty: 15
  },

  backtestMinTrainingDraws: 50
}
```

---

# 75. Confidence Rules

Confidence is based on data support, not future outcome probability.

Suggested:

```text
HIGH:
>=100 draws
good pair/transition support
agreement >=3/4

MEDIUM:
>=50 draws
agreement >=2/4

LOW:
small sample
sparse associations
strong disagreement
```

---

# 76. Global UI Disclaimer

Always show:

```text
Lottery draws are independent random events.
These analytics summarize historical data only
and do not provide true future win probabilities.
```

Top Predictions:

```text
Scores are ranking signals, not probabilities.
```

Anomalies:

```text
Statistical anomaly does not imply future correction.
```

---

# 77. Implementation Priority

## Phase 1 — Mandatory

```text
Weighted Frequency
Rolling Frequency
Frequency Z
Gap Percentile
Gap Z
Pair Lift
Pair Heatmap
Structure Analytics
Consensus Model
Model Agreement
Backtest + Random Baseline
```

## Phase 2

```text
Confidence Bands
Gap Boxplots
Transition Association
Anomaly Detection
Period Comparison
```

## Phase 3

```text
Triple Lift
Gini / Lorenz
Calendar Exploration
Experimental Signals
```

---

# 78. Non-Negotiable Rules

1. Never call a historical score a true prediction probability.
2. Never treat a long gap as evidence that a number is due.
3. Never average incompatible raw model scales.
4. Normalize or percentile-rank before consensus.
5. Association models require support/confidence.
6. Backtests must exclude target/future data.
7. Compare model performance with random baseline.
8. Default candidate pool uses Consensus Rank.
9. Top Predictions must be explainable.
10. All analytics update when history/period/settings change.
11. No hardcoded model results.
12. All advanced analytics derive from JSON draw history.

---

# 79. Acceptance Criteria

- [ ] Weighted Frequency
- [ ] rolling 10/20/30/50/100
- [ ] Frequency Z
- [ ] 95% expected range
- [ ] Uniformity test
- [ ] Gap Percentile
- [ ] Gap Z
- [ ] Gap Stability
- [ ] Pair Lift
- [ ] Recent Pair Lift
- [ ] 45×45 Pair Heatmap
- [ ] Transition Association
- [ ] Transition Confidence
- [ ] Structure Analytics
- [ ] Sum Histogram
- [ ] Historical Parity Distribution
- [ ] Historical Inside/Outside Distribution
- [ ] Spread Distribution
- [ ] Digital Root Distribution
- [ ] Anomaly Detection
- [ ] Model Agreement
- [ ] Model Confidence
- [ ] Consensus Ranking
- [ ] Candidate Pool uses Consensus
- [ ] Combination Score V2
- [ ] Novelty Score
- [ ] Rolling Backtest
- [ ] Seeded Random Baseline
- [ ] No future leakage
- [ ] Explainable Predictions
- [ ] Disclaimer visible

---

# 80. Final Agent Update Prompt

```text
Update the existing Mega 6/45 React application with this advanced analytics addendum.

Do not rebuild the app from scratch unless necessary.

Preserve:
- React + TypeScript + Vite
- local JSON + localStorage
- existing dashboard/selectors/pages

Add:
1. Weighted Frequency
2. Rolling Frequency
3. Frequency Z-Scores
4. 95% expected frequency bands
5. Global uniformity test
6. Gap percentile/Z/stability
7. Pair Lift and Recent Pair Lift
8. 45x45 Pair Heatmap
9. Next-Draw Transition Association with minimum support
10. Structure Analytics
11. Statistical Anomaly Detection
12. Frequency/Momentum/Gap/Association models
13. Consensus Rank from normalized/percentile ranks
14. Model Agreement and data-support Confidence
15. Combination Score V2
16. Novelty / similarity control
17. Rolling Backtest
18. Seeded random baseline
19. Explainable Top Predictions

Statistical rules:
- lottery draws are independent random events
- no model output is a true win probability
- long gaps must not be described as due
- sparse pair/triple/transition signals must be confidence-penalized
- consensus must combine normalized or percentile ranks
- all backtests use only past data before each target draw
- compare model results to a random baseline

Add analysis tabs:
Frequency
Significance
Gap
Association
Structure
Heatmap
Anomalies
Model Comparison

All advanced analytics must update automatically when:
- history changes
- period changes
- analysis settings change
```

# END
