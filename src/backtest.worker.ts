import { backtestRange, runPortfolioRollingBacktest, runRollingBacktest } from "./analytics";
import type { AnalysisSettings, Draw } from "./domain";

type Request = { draws: Draw[]; settings: AnalysisSettings; maxNumber?:number;fromDate:string;toDate:string;trainingDraws:number;predictionCount:number;manualProposedSets?:number[][];portfolioRolling?:boolean };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  const maxNumber=data.maxNumber??45;
  if(data.portfolioRolling){self.postMessage({portfolioRolling:runPortfolioRollingBacktest(data.draws,data.settings,{fromDate:data.fromDate,toDate:data.toDate,trainingDraws:data.trainingDraws,predictionCount:data.predictionCount as 5|10|20,maxNumber})});return;}
  const result=backtestRange(data.draws,data.settings,{fromDate:data.fromDate,toDate:data.toDate,trainingDraws:data.trainingDraws,predictionCount:data.predictionCount,maxNumber,manualProposedSets:data.manualProposedSets});
  const ordered=[...data.draws].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const targetIndex=ordered.findIndex(draw=>draw.id===result.rows[0]?.targetId);
  const rolling=runRollingBacktest(targetIndex>=0?ordered.slice(0,targetIndex+1):[],{...data.settings,backtestMinTrainingDraws:data.trainingDraws},Math.max(1,result.tests),645,maxNumber);
  self.postMessage({ result, rolling, manualMode:Boolean(data.manualProposedSets?.length) });
};
