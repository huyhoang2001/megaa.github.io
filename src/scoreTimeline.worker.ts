import { calculateScoreTimeline } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request={draws:Draw[];targetDrawIds:string[];settings:AnalysisSettings;maxNumber:number;insideNumbers:number[];trainingWindow:number};

self.onmessage=({data}:MessageEvent<Request>)=>{
  self.postMessage(calculateScoreTimeline(data.draws,data.settings,data.maxNumber,data.targetDrawIds,data.trainingWindow,data.insideNumbers));
};
