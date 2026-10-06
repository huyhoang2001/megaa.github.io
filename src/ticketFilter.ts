export const ALLOWED_TAILS = new Set([2,3,4,5,6,7,8,9,10,11,13,14,15,16,18,21,22,23,24,26,29,34,35,36,37,39,42,47,55,56,57,58,60,63,68,76,89,90,91,92,94,97]);

export type TicketRejectReason="INVALID_FORMAT"|"DUPLICATE"|"TAIL_NOT_ALLOWED"|"SUM_TOO_LOW"|"ROOT_NOT_ALLOWED"|"PARITY_NOT_ALLOWED";
export type TicketLog={level:"INFO"|"WARN"|"ERROR";message:string};
export type TicketFilterResult={code:string;tail?:number;tailAllowed?:boolean;parts?:[number,number,number];pairSum?:number;digitalRoot?:number;evenDigits?:number;oddDigits?:number;parity?:string;accepted:boolean;rejectReasons:TicketRejectReason[];inputIndex:number;rank?:number};
export type TicketFilterSettings={allowedTails?:Set<number>;minimumSum?:number;allowedRoots?:number[];allowedParity?:string[]};
export type TicketFilterSummary={input:number;accepted:number;rejected:number;tailFailed:number;sumFailed:number;rootFailed:number;parityFailed:number;errors:number;duplicates:number};

const ROOT_PRIORITY:Record<number,number>={8:4,5:3,3:2,1:1};
const PARITY_PRIORITY:Record<string,number>={"3/3":2,"4/2":1};

export function parseTicketInput(input:string){return input.replace(/\r?\n/g,",").split(",").map(value=>value.trim()).filter(Boolean);}
export const getTicketTail=(code:string)=>Number(code.slice(-2));
export function splitTicket(code:string):[number,number,number]{return [Number(code.slice(0,2)),Number(code.slice(2,4)),Number(code.slice(4,6))];}
export function ticketDigitalRoot(value:number){return value===0?0:1+((value-1)%9);}
export function getDigitParity(code:string){const even=[...code].map(Number).filter(digit=>digit%2===0).length;const odd=6-even;return {even,odd,key:`${even}/${odd}`};}

export function filterTickets(input:string,settings:TicketFilterSettings={}){
  const values=parseTicketInput(input),seen=new Set<string>(),accepted:TicketFilterResult[]=[],rejected:TicketFilterResult[]=[],logs:TicketLog[]=[];
  const allowedTails=settings.allowedTails??ALLOWED_TAILS,minimumSum=settings.minimumSum??50,allowedRoots=settings.allowedRoots??[1,3,5,8],allowedParity=settings.allowedParity??["3/3","4/2"];
  const summary:TicketFilterSummary={input:values.length,accepted:0,rejected:0,tailFailed:0,sumFailed:0,rootFailed:0,parityFailed:0,errors:0,duplicates:0};
  logs.push({level:"INFO",message:`Parsed ${values.length} input values.`});
  values.forEach((code,inputIndex)=>{
    if(seen.has(code)){summary.duplicates++;logs.push({level:"WARN",message:`Duplicate ignored: ${code}`});return;}
    seen.add(code);
    const result:TicketFilterResult={code,accepted:false,rejectReasons:[],inputIndex};
    if(!/^\d{6}$/.test(code)){result.rejectReasons.push("INVALID_FORMAT");rejected.push(result);summary.errors++;logs.push({level:"ERROR",message:`${code} rejected: ticket must contain exactly 6 digits.`});return;}
    result.tail=getTicketTail(code);result.tailAllowed=allowedTails.has(result.tail);
    if(!result.tailAllowed){result.rejectReasons.push("TAIL_NOT_ALLOWED");rejected.push(result);summary.tailFailed++;logs.push({level:"WARN",message:`${code} rejected at Tail Filter: tail ${String(result.tail).padStart(2,"0")} is not allowed.`});return;}
    result.parts=splitTicket(code);result.pairSum=result.parts.reduce((sum,value)=>sum+value,0);
    if(result.pairSum<minimumSum){result.rejectReasons.push("SUM_TOO_LOW");rejected.push(result);summary.sumFailed++;logs.push({level:"WARN",message:`${code} rejected: sum ${result.pairSum} is below ${minimumSum}.`});return;}
    result.digitalRoot=ticketDigitalRoot(result.pairSum);
    if(!allowedRoots.includes(result.digitalRoot)){result.rejectReasons.push("ROOT_NOT_ALLOWED");rejected.push(result);summary.rootFailed++;logs.push({level:"WARN",message:`${code} rejected: digital root ${result.digitalRoot} is not allowed.`});return;}
    const parity=getDigitParity(code);result.evenDigits=parity.even;result.oddDigits=parity.odd;result.parity=parity.key;
    if(!allowedParity.includes(result.parity)){result.rejectReasons.push("PARITY_NOT_ALLOWED");rejected.push(result);summary.parityFailed++;logs.push({level:"WARN",message:`${code} rejected: parity ${result.parity} is not allowed.`});return;}
    result.accepted=true;accepted.push(result);logs.push({level:"INFO",message:`${code} accepted.`});
  });
  accepted.sort((a,b)=>(ROOT_PRIORITY[b.digitalRoot??0]??0)-(ROOT_PRIORITY[a.digitalRoot??0]??0)||(PARITY_PRIORITY[b.parity??""]??0)-(PARITY_PRIORITY[a.parity??""]??0)||(b.pairSum??0)-(a.pairSum??0)||a.code.localeCompare(b.code)).forEach((result,index)=>result.rank=index+1);
  summary.accepted=accepted.length;summary.rejected=rejected.length;
  logs.push({level:"INFO",message:`Accepted: ${summary.accepted}`});logs.push({level:"INFO",message:`Rejected: ${summary.rejected}`});
  return {accepted,rejected,logs,summary};
}

export function ticketResultsToCsv(results:TicketFilterResult[]){
  const header="rank,ticket,tail,a,b,c,sum,root,parity,status";
  return [header,...results.map(result=>[result.rank??"",result.code,result.tail===undefined?"":String(result.tail).padStart(2,"0"),...(result.parts??["","",""]).map(value=>typeof value==="number"?String(value).padStart(2,"0"):value),result.pairSum??"",result.digitalRoot??"",result.parity??"",result.accepted?"PASS":"REJECT"].join(","))].join("\n");
}

export function filterTicketResultsByNumber(results:TicketFilterResult[],query:string){
  const digits=query.replace(/\D/g,"").slice(0,6);
  if(!digits)return results;
  return results.filter(result=>digits.length===6?result.code===digits:result.code.includes(digits));
}
