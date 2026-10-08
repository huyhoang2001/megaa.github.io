import { calculateScoreTimeline } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request={draws:Draw[];settings:AnalysisSettings;maxNumber:number};

self.onmessage=({data}:MessageEvent<Request>)=>{
  self.postMessage(calculateScoreTimeline(data.draws,data.settings,data.maxNumber));
};
