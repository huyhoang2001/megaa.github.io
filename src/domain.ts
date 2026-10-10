export type Draw = {
  id: string;
  date: string;
  numbers: [number, number, number, number, number, number];
  bonus?: number;
  jackpot: number;
  jackpot2?: number;
};

export type PeriodPreset = "last10" | "last20" | "last30" | "last50" | "last100" | "last6months" | "last1year" | "all" | "custom";
export type LotteryGame = "mega645" | "power655";
export type ThemeMode = "light" | "dark" | "system";
export type LanguageMode = "vi" | "en";
export type NumberState = "HOT" | "NEUTRAL" | "COOL" | "DUE" | "DROUGHT";

export type DashboardFilters = {
  period: PeriodPreset;
  analysisView: string;
  scoringPreset: string;
  predictionCount: 5 | 10 | 20;
  fromDate?: string;
  toDate?: string;
};

export type AnalysisSettings = {
  candidatePoolSize: number;
  minTotal: number;
  allowedDigitalRoots: number[];
  allowedParity: string[];
  allowedInsideOutside: string[];
  singleWeights: { frequency: number; gap: number; trend: number; inside: number };
  combinationWeights: { single: number; pair: number; triple: number; structure: number };
  maxCombinationOverlap: number;
  topCombinationCount: number;
  weightedFrequencyHalfLife: number;
  minPairSupport: number;
  minTransitionSupport: number;
  frequencyZAlertThreshold: number;
  recentZAlertThreshold: number;
  gapPercentileAlertThreshold: number;
  gapZAlertThreshold: number;
  consensusWeights: { frequency: number; momentum: number; gap: number; association: number };
  comboWeightsV2: { consensus: number; pair: number; triple: number; structure: number; novelty: number };
  backtestMinTrainingDraws: number;
};

export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type ModelSignal = { rawScore: number; normalizedScore: number; percentileRank: number; rank: number; confidence: Confidence; explanation: string[] };
export type RollingFrequency = { last10: number; last20: number; last30: number; last50: number; last100: number; all: number };
export type GapStats = { gaps: number[]; currentGap: number; meanGap: number; medianGap: number; minGap: number; maxGap: number; stdGap: number; q1: number; q3: number; gapPercentile: number; gapZ: number; gapCV: number };

export type SingleNumberStats = {
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
  state: NumberState;
  technicalScore: number;
  rank: number;
  weightedFrequency: number;
  rolling: RollingFrequency;
  expectedCount: number;
  lower95: number;
  upper95: number;
  frequencyZ: number;
  recentZ30: number;
  gap: GapStats;
  momentum: { ratio10vs30: number; ratio10vs50: number; ratio30vs100: number; label: "ACCELERATING" | "RISING" | "STABLE" | "FALLING" };
  models: { frequency: ModelSignal; momentum: ModelSignal; gap: ModelSignal; association: ModelSignal; consensus: ModelSignal };
  modelAgreement: number;
  confidence: Confidence;
};

export type PairStats = { a: number; b: number; key: string; count: number; rate: number; lift: number; recentCount: number; recentLift: number; confidence: Confidence; insideCount: number; outsideCount: number; evenCount: number; oddCount: number; rank: number };
export type TripleStats = { numbers: [number, number, number]; key: string; count: number; rate: number; lift: number; confidence: Confidence; insideCount: number; outsideCount: number; evenCount: number; oddCount: number; rank: number };
export type CandidateCombination = { numbers: number[]; total: number; digitalRoot: number; evenCount: number; oddCount: number; insideCount: number; outsideCount: number; singleScore: number; pairScore: number; tripleScore: number; structureScore: number; noveltyScore: number; maxHistoricalOverlap: number; totalScore: number; confidence: Confidence; valid: boolean; rank?: number };

export const LOTTERY_GAMES={
  mega645:{id:"mega645",name:"Mega 6/45",shortName:"MEGA",maxNumber:45},
  power655:{id:"power655",name:"Power 6/55",shortName:"POWER",maxNumber:55},
} as const satisfies Record<LotteryGame,{id:LotteryGame;name:string;shortName:string;maxNumber:number}>;

export const INSIDE_SET = new Set([2,3,4,5,6,7,8,9,10,11,13,14,15,16,18,21,22,23,24,26,29,34,35,36,37,39,42,47,55]);

export const DEFAULT_SETTINGS: AnalysisSettings = {
  candidatePoolSize: 14,
  minTotal: 55,
  allowedDigitalRoots: [1, 3, 5, 8],
  allowedParity: ["3/3", "4/2", "2/4"],
  allowedInsideOutside: ["4/2", "3/3"],
  singleWeights: { frequency: 45, gap: 25, trend: 20, inside: 10 },
  combinationWeights: { single: 40, pair: 25, triple: 15, structure: 20 },
  maxCombinationOverlap: 4,
  topCombinationCount: 12,
  weightedFrequencyHalfLife: 30,
  minPairSupport: 2,
  minTransitionSupport: 15,
  frequencyZAlertThreshold: 2,
  recentZAlertThreshold: 2,
  gapPercentileAlertThreshold: 95,
  gapZAlertThreshold: 2,
  consensusWeights: { frequency: 25, momentum: 25, gap: 25, association: 25 },
  comboWeightsV2: { consensus: 30, pair: 20, triple: 10, structure: 25, novelty: 15 },
  backtestMinTrainingDraws: 50,
};

export const DEFAULT_FILTERS: DashboardFilters = { period: "last1year", analysisView: "Overview", scoringPreset: "Default", predictionCount: 5 };
