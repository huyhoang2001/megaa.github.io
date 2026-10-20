import { generateBacktestProposals, runPortfolioRollingBacktest } from "./analytics";
import type { AnalysisSettings, Draw, PowerSuggestionMode } from "./domain";

type Request = { draws: Draw[]; settings: AnalysisSettings; maxNumber?:number;drawSize?:number;insideNumbers?:number[];fromDate:string;toDate:string;trainingDraws:number;predictionCount:number;manualProposedSets?:number[][];portfolioRolling?:boolean;powerSuggestionMode?:PowerSuggestionMode;cooldownEnabled?:boolean;cooldown?:AnalysisSettings["recentDrawCooldown"];cooldownSupported?:boolean };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  const maxNumber=data.maxNumber??45;
  if(data.portfolioRolling){self.postMessage({portfolioRolling:runPortfolioRollingBacktest(data.draws,data.settings,{fromDate:data.fromDate,toDate:data.toDate,trainingDraws:data.trainingDraws,predictionCount:data.predictionCount as 5|10|20,maxNumber,insideNumbers:data.insideNumbers,powerSuggestionMode:data.powerSuggestionMode,cooldownEnabled:data.cooldownEnabled})});return;}
  const proposal=generateBacktestProposals(data.draws,data.settings,{fromDate:data.fromDate,toDate:data.toDate,trainingDraws:data.trainingDraws,predictionCount:data.predictionCount,maxNumber,insideNumbers:data.insideNumbers,manualProposedSets:data.manualProposedSets,powerSuggestionMode:data.powerSuggestionMode,cooldown:data.cooldown??{...data.settings.recentDrawCooldown,enabled:false},cooldownSupported:data.cooldownSupported});
  self.postMessage({ proposal, manualMode:Boolean(data.manualProposedSets?.length) });
};
