import { calculateScoreTimeline } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request={draws:Draw[];targets:Draw[];settings:AnalysisSettings;maxNumber:number};

self.onmessage=({data}:MessageEvent<Request>)=>{
  self.postMessage(calculateScoreTimeline(data.draws,data.targets,data.settings,data.maxNumber));
};
