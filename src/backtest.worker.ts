import { backtestRange, runRollingBacktest } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request = { draws: Draw[]; settings: AnalysisSettings; maxNumber?:number;fromDate:string;toDate:string;trainingDraws:number;predictionCount:number;manualResults?:number[][] };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  const maxNumber=data.maxNumber??45;
  const result=backtestRange(data.draws,data.settings,{fromDate:data.fromDate,toDate:data.toDate,trainingDraws:data.trainingDraws,predictionCount:data.predictionCount,maxNumber,manualResults:data.manualResults});
  const scopedDraws=data.draws.filter(draw=>data.manualResults?.length?draw.date<data.toDate:draw.date<=data.toDate);
  const rolling=runRollingBacktest(scopedDraws,{...data.settings,backtestMinTrainingDraws:data.trainingDraws},Math.max(1,result.tests),645,maxNumber);
  self.postMessage({ result, rolling });
};
