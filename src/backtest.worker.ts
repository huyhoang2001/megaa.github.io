import { backtest, runRollingBacktest } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request = { draws: Draw[]; settings: AnalysisSettings; maxNumber?:number };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  // Combination generation is substantially heavier than number-model ranking.
  // Keep the interactive summary focused on the five latest targets; the worker
  // prevents this CPU work from blocking navigation or controls.
  const maxNumber=data.maxNumber??45;
  const result = backtest(data.draws,data.settings,5,maxNumber);
  const rolling = runRollingBacktest(data.draws,data.settings,30,645,maxNumber);
  self.postMessage({ result, rolling });
};
