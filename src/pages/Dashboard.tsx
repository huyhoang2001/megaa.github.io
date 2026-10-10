import { format, parseISO } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, Brush, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChevronLeft, ChevronRight, Info, Maximize2, X } from "lucide-react";
import { calculateMonthlyDraws, calculateOccurrenceTimeline, calculateScoreTimeline, digitalRoot, filterCompleteCalendarMonths, pad, round2 } from "../analytics";
import { INSIDE_SET } from "../domain";
import type { Draw } from "../domain";
import { useAnalytics } from "../hooks";
import { useLotteryStore } from "../store";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import { Card, CardHeader, EmptyState, NumberBall, ScoreBadge, Select } from "../ui";
import GameSwitch from "../GameSwitch";

const COLORS = ["#d43d28", "#f0a92f", "#2a68a8", "#1f8b63", "#7a5aa6"];
const money = new Intl.NumberFormat("en-US");
type ScatterPoint = { number:number; currentGap:number; totalCount:number; countLast30:number; technicalScore:number; gapX:number; frequencyY:number; totalX:number; recentY:number; label:string; state:string };
const axisStyle={fontSize:10,fill:"var(--muted)"};
const xAxisLabel=(value:string)=>({value,position:"insideBottom" as const,offset:-5,style:axisStyle});
const yAxisLabel=(value:string)=>({value,position:"insideLeft" as const,angle:-90,offset:8,style:axisStyle});
const chartTextKeys:Record<string,TranslationKey>={"Frequency buckets":"dashboard.frequencyBuckets","Number counts by range":"dashboard.countsByRange","Top 10 numbers":"dashboard.topNumbers","Occurrences in selected period":"dashboard.occurrencesPeriod","Occurrence timeline":"dashboard.timeline","Historical frequency and 20-draw moving average":"dashboard.timelineSubtitle","Draws by month":"dashboard.drawsMonth","Number of draws in each complete calendar month":"dashboard.monthSubtitle","Gap vs frequency":"dashboard.gapFrequency","Bubble size and tone represent Consensus Score":"dashboard.gapSubtitle","Last 30 frequency":"dashboard.last30Frequency","Recent frequency with Consensus Score sizing":"dashboard.last30Subtitle","Top 10 pairs":"dashboard.topPairs","Most observed pairs":"dashboard.pairsSubtitle","Top 10 triples":"dashboard.topTriples","Most observed triples":"dashboard.triplesSubtitle"};

function technicalScoreColor(score:number,min:number,max:number) {
  const light=[171,226,205];
  const dark=[15,96,70];
  const progress=max===min ? .5 : Math.min(1,Math.max(0,(score-min)/(max-min)));
  return `rgb(${light.map((channel,index)=>Math.round(channel+(dark[index]-channel)*progress)).join(",")})`;
}

function rankedBarColor(index:number,total:number,palette:[number[],number[]]) {
  const progress=total<=1?0:index/(total-1);
  return `rgb(${palette[0].map((channel,i)=>Math.round(channel+(palette[1][i]-channel)*progress)).join(",")})`;
}

function ScatterTooltip({active,payload,mode}:{active?:boolean;payload?:Array<{payload:ScatterPoint}>;mode:"gap"|"recent"}) {
  const {t}=useI18n();
  const point=payload?.[0]?.payload;
  if(!active||!point)return null;
  return <div className="chart-tooltip"><b>{pad(point.number)}</b><span>{t("common.consensusScore")} <strong>{point.technicalScore.toFixed(2)}</strong></span>{mode==="gap"?<><span>{t("common.frequency")} <strong>{point.totalCount}</strong></span><span>{t("common.currentGap")} <strong>{point.currentGap}</strong></span></>:<><span>{t("common.totalCount")} <strong>{point.totalCount}</strong></span><span>{t("common.last30")} <strong>{point.countLast30}</strong></span></>}</div>;
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode|((expanded:boolean)=>React.ReactNode) }) {
  const {t}=useI18n();
  const localizedTitle=chartTextKeys[title]?t(chartTextKeys[title]):title;
  const localizedSubtitle=subtitle&&chartTextKeys[subtitle]?t(chartTextKeys[subtitle]):subtitle;
  const [expanded,setExpanded]=useState(false);
  const titleId=`chart-${useId().replace(/:/g,"")}`;
  const openButton=useRef<HTMLButtonElement>(null);
  const closeButton=useRef<HTMLButtonElement>(null);
  const close=()=>{setExpanded(false);requestAnimationFrame(()=>openButton.current?.focus());};
  const chart=(enlarged:boolean)=>typeof children==="function"?children(enlarged):children;

  useEffect(()=>{
    if(!expanded)return;
    const previousOverflow=document.body.style.overflow;
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
    document.body.style.overflow="hidden";
    document.addEventListener("keydown",onKeyDown);
    requestAnimationFrame(()=>closeButton.current?.focus());
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",onKeyDown);};
  },[expanded]);

  return <>
    <Card className="chart-card"><CardHeader title={localizedTitle} subtitle={localizedSubtitle} action={<button ref={openButton} type="button" className="chart-action" onClick={()=>setExpanded(true)} aria-label={t("common.enlarge",{title:localizedTitle})} title={t("common.enlarge",{title:localizedTitle})}><Maximize2 size={15}/></button>} /><div className="chart-body">{chart(false)}</div></Card>
    {expanded&&createPortal(<div className="chart-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className="chart-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="chart-modal-header"><div><h2 id={titleId}>{localizedTitle}</h2>{localizedSubtitle&&<p>{localizedSubtitle}</p>}</div><button ref={closeButton} type="button" className="chart-action chart-close" onClick={close} aria-label={t("common.close",{title:localizedTitle})} title={t("common.closeExpanded")}><X size={19}/></button></div><div className="chart-modal-body">{chart(true)}</div></section></div>,document.body)}
  </>;
}

export function MiniPieInfo({title,info}:{title:string;info:string}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const popupId=`mini-pie-${useId().replace(/:/g,"")}`;
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:Event)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",dismiss);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};
  },[open]);
  return <div ref={root} className={`mini-pie-info ${open?"open":""}`}><button type="button" onClick={()=>setOpen(value=>!value)} aria-label={`${title}: ${info}`} aria-expanded={open} aria-controls={popupId} title={info}><Info size={13}/></button>{open&&<div id={popupId} role="tooltip">{info}</div>}</div>;
}

function DistributionPie({ title, info, data,total }: { title: string; info:string; data: { name: string; value: number }[];total:number }) {
  const {t}=useI18n();
  return <div className="mini-pie"><div className="mini-pie-title"><span>{title}</span><MiniPieInfo title={title} info={info}/></div><ResponsiveContainer width="100%" height={128}><PieChart><Pie data={data} innerRadius={33} outerRadius={52} dataKey="value" paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v) => [`${v} (${((Number(v)/total)*100).toFixed(1)}%)`, t("common.count")]} /></PieChart></ResponsiveContainer><div className="pie-legend">{data.map((x,i)=><span key={x.name}><i style={{background:COLORS[i]}} />{x.name} {x.value}</span>)}</div></div>;
}

type ScoreTimeline = ReturnType<typeof calculateScoreTimeline>;
type ScoreValueKey = "single"|"pair"|"triple"|"structure"|"total";

export function scoreAxisMaximum(values:number[],padding:number){
  return Math.ceil(Math.max(0,...values.filter(Number.isFinite))+padding);
}

export function jackpotHistoryData(draws:Draw[],key:"jackpot"|"jackpot2"){
  return draws.filter(draw=>Number(draw[key])>0);
}

function JackpotHistoryChart({draws,valueKey,title,color}:{draws:Draw[];valueKey:"jackpot"|"jackpot2";title:string;color:string}){
  const {language,t}=useI18n();
  const dateLocale=language==="vi"?vi:enUS;
  const history=jackpotHistoryData(draws,valueKey);
  return <ChartCard title={title} subtitle={t("dashboard.jackpotHistorySubtitle")}>{(enlarged:boolean)=>history.length?<ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{left:10,right:14,top:12,bottom:24}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" minTickGap={35} tickFormatter={value=>format(parseISO(String(value)),"MM/yyyy",{locale:dateLocale})} label={xAxisLabel(t("common.drawDate"))}/><YAxis width={52} domain={[0,(maximum:number)=>Math.ceil(maximum/1e9*1.1)*1e9]} tickFormatter={value=>money.format(Number(value)/1e9)} label={yAxisLabel(t("dashboard.billionVnd"))}/><Tooltip labelFormatter={value=>format(parseISO(String(value)),"dd/MM/yyyy",{locale:dateLocale})} formatter={value=>[`${money.format(Number(value))} VND`,title]}/><Line type="linear" dataKey={valueKey} name={title} stroke={color} strokeWidth={2} dot={false} activeDot={{r:4}} isAnimationActive={false}/>{enlarged&&<Brush ariaLabel={t("dashboard.jackpotNavigator")} dataKey="date" height={34} travellerWidth={9} stroke={color} fill="var(--chart-surface)" tickFormatter={value=>format(parseISO(String(value)),"MM/yyyy",{locale:dateLocale})}><LineChart><Line type="linear" dataKey={valueKey} stroke={color} strokeWidth={1} dot={false} isAnimationActive={false}/></LineChart></Brush>}</LineChart></ResponsiveContainer>:<EmptyState/>}</ChartCard>;
}

function ScoreHistoryChart({title,data,valueKey,color,loading}:{title:string;data:ScoreTimeline;valueKey:ScoreValueKey;color:string;loading:boolean}){
  const {language,t}=useI18n();
  const dateLocale=language==="vi"?vi:enUS;
  const maKey=`${valueKey}Ma20` as keyof ScoreTimeline[number];
  const hasDynamicScale=valueKey==="pair"||valueKey==="triple";
  const padding=hasDynamicScale?10:0;
  const maximum=scoreAxisMaximum(data.flatMap(point=>[Number(point[valueKey]),Number(point[maKey])]),padding);
  const domain:[number,number]=hasDynamicScale?[0,maximum]:[0,100];
  const margin=hasDynamicScale?{left:10,right:12,top:18,bottom:34}:{left:10,right:12,top:8,bottom:24};
  return <ChartCard title={title} subtitle={t("dashboard.scoreHistorySubtitle")}>{(enlarged:boolean)=>loading?<div className="empty-state">{t("dashboard.scoreHistoryLoading")}</div>:<ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={margin}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" minTickGap={28} tickFormatter={value=>format(parseISO(String(value)),"MM/yyyy",{locale:dateLocale})} label={xAxisLabel(t("common.drawDate"))}/><YAxis width={45} domain={domain} allowDataOverflow={hasDynamicScale} label={yAxisLabel(t("common.value"))}/><Tooltip labelFormatter={value=>format(parseISO(String(value)),"dd/MM/yyyy",{locale:dateLocale})} formatter={(value,name)=>[Number(value).toFixed(2),name]}/><Legend iconType="line" iconSize={10} wrapperStyle={{fontSize:9}}/><Line type="monotone" dataKey={valueKey} name={t("common.value")} stroke={color} strokeWidth={2} dot={false} activeDot={{r:4,strokeWidth:2,fill:"var(--chart-surface)"}}/><Line type="monotone" dataKey={maKey} name="MA20" stroke="#ef5b3f" strokeWidth={2.2} strokeDasharray="7 5" dot={false}/>{enlarged&&<Brush ariaLabel={t("dashboard.chartNavigator")} dataKey="date" height={34} travellerWidth={9} stroke={color} fill="var(--chart-surface)" tickFormatter={value=>format(parseISO(String(value)),"MM/yyyy",{locale:dateLocale})}><LineChart><Line type="monotone" dataKey={valueKey} stroke={color} dot={false} isAnimationActive={false}/><Line type="monotone" dataKey={maKey} stroke="#ef5b3f" dot={false} isAnimationActive={false}/></LineChart></Brush>}</LineChart></ResponsiveContainer>}</ChartCard>;
}

export default function Dashboard() {
  const {language,t}=useI18n();
  const dateLocale=language==="vi"?vi:enUS;
  const { draws,filtered,singles,pairs,triples,predictions,selectedGame,gameConfig,effectiveSettings } = useAnalytics();
  const { dashboardFilters: filters, updateDashboardFilters } = useLotteryStore();
  const latest = filtered.at(-1);
  const [selectedDrawId,setSelectedDrawId]=useState<string|null>(null);
  const selectedDrawIndex=selectedDrawId===null?-1:filtered.findIndex(draw=>draw.id===selectedDrawId);
  const displayedDrawIndex=selectedDrawIndex<0?filtered.length-1:selectedDrawIndex;
  const displayedDraw=filtered[displayedDrawIndex];
  useEffect(()=>setSelectedDrawId(null),[selectedGame,filters.period]);
  const topNumbers = [...singles].sort((a,b)=>b.totalCount-a.totalCount || a.number-b.number).slice(0,10);
  const frequencyBuckets = [
    { name: ">=20", value: singles.filter(x=>x.totalCount>=20).length },
    { name: "16-19", value: singles.filter(x=>x.totalCount>=16&&x.totalCount<20).length },
    { name: "12-15", value: singles.filter(x=>x.totalCount>=12&&x.totalCount<16).length },
    { name: "8-11", value: singles.filter(x=>x.totalCount>=8&&x.totalCount<12).length },
    { name: "<=7", value: singles.filter(x=>x.totalCount<=7).length },
  ];
  const monthlySource=filters.period==="last6months"?filterCompleteCalendarMonths(draws,6):filters.period==="last1year"?filterCompleteCalendarMonths(draws,12):filters.period==="all"?filterCompleteCalendarMonths(draws):filtered;
  const monthly = calculateMonthlyDraws(monthlySource);
  const insideTotal=Array.from({length:gameConfig.maxNumber},(_,index)=>index+1).filter(number=>INSIDE_SET.has(number)).length;
  const insideNumbers=Array.from(INSIDE_SET).filter(number=>number<=gameConfig.maxNumber).map(pad).join(", ");
  const visibleDrawIds=new Set(filtered.map(draw=>draw.id));
  const timeline = calculateOccurrenceTimeline(draws).filter(point=>visibleDrawIds.has(point.id));
  const [scoreTimeline,setScoreTimeline]=useState<ScoreTimeline>([]);
  const [scoreTimelineLoading,setScoreTimelineLoading]=useState(true);
  useEffect(()=>{
    const worker=new Worker(new URL("../scoreTimeline.worker.ts",import.meta.url),{type:"module"});
    setScoreTimelineLoading(true);
    worker.onmessage=({data}:MessageEvent<ScoreTimeline>)=>{setScoreTimeline(data);setScoreTimelineLoading(false);worker.terminate();};
    worker.onerror=()=>{setScoreTimeline([]);setScoreTimelineLoading(false);worker.terminate();};
    worker.postMessage({draws,targetDrawIds:filtered.map(draw=>draw.id),settings:effectiveSettings,maxNumber:gameConfig.maxNumber});
    return()=>worker.terminate();
  },[draws,filtered,effectiveSettings,gameConfig.maxNumber]);
  const scoreCharts:[string,ScoreValueKey,string][]=[
    [t("dashboard.singleScoreHistory"),"single","#2f7fc1"],
    [t("dashboard.pairScoreHistory"),"pair","#e9822a"],
    [t("dashboard.tripleScoreHistory"),"triple","#238b68"],
    [t("dashboard.structureScoreHistory"),"structure","#7a5aa6"],
    [t("dashboard.totalScoreHistory"),"total","#173f56"],
  ];
  const stateColors: Record<string,string> = {HOT:"#d43d28",DUE:"#e9822a",DROUGHT:"#7b8794",NEUTRAL:"#1f8b63",COOL:"#2a68a8"};
  const scatterData: ScatterPoint[] = singles.map(item=>{
    const xJitter=(((item.number*17)%7)-3)*.12;
    const yJitter=(((item.number*11)%7)-3)*.1;
    return {...item,technicalScore:round2(item.technicalScore),gapX:Math.max(0,item.currentGap+xJitter),frequencyY:Math.max(0,item.totalCount+yJitter),totalX:Math.max(0,item.totalCount+xJitter),recentY:Math.max(0,item.countLast30+yJitter),label:item.rank<=5?pad(item.number):""};
  });
  const gapScatterData=scatterData.filter(item=>item.totalCount>0).sort((a,b)=>a.number-b.number);
  const last30ScatterData=scatterData.filter(item=>item.countLast30>0).sort((a,b)=>a.number-b.number);
  const scoreRange={min:Math.min(...gapScatterData.map(item=>item.technicalScore)),max:Math.max(...gapScatterData.map(item=>item.technicalScore))};
  const periodOptions:[typeof filters.period,TranslationKey][]=[["last10","shell.last10"],["last20","selector.last20"],["last30","shell.last30"],["last50","selector.last50"],["last100","selector.last100"],["last6months","selector.last6Months"],["last1year","shell.lastYear"],["all","shell.allDraws"]];
  const viewOptions:[string,TranslationKey][]=[["Overview","selector.overview"],["Single Frequency","selector.singleFrequency"],["Gap & Trend","selector.gapTrend"],["Pairs","selector.pairs"],["Triples","selector.triples"],["Combinations","selector.combinations"],["Jackpot","selector.jackpot"]];
  const presetOptions:[string,TranslationKey][]=[["Default","preset.default"],["Balanced","preset.balanced"],["Hot","preset.hot"],["Gap","preset.gap"],["Pair","preset.pair"],["Triple","preset.triple"],["Custom","preset.custom"]];
  const analysisView=filters.analysisView==="Backtest"?"Overview":filters.analysisView;
  useEffect(()=>{if(filters.analysisView==="Backtest")updateDashboardFilters({analysisView:"Overview"});},[filters.analysisView,updateDashboardFilters]);
  const show = (kind:string) => {
    const view=analysisView;
    if(view==="Overview") return true;
    if(view==="Single Frequency") return ["numbers","last30"].includes(kind);
    if(view==="Gap & Trend") return ["timeline","gap","last30"].includes(kind);
    if(view==="Pairs") return kind==="pairs";
    if(view==="Triples") return kind==="triples";
    if(view==="Jackpot") return ["timeline","monthly"].includes(kind);
    return false;
  };

  return <div className="dashboard">
    <div className="dashboard-game-row"><GameSwitch/></div>
    <section className="hero-banner">
      <div><div className="brand-mark">{gameConfig.shortName} <span>6/{gameConfig.maxNumber}</span></div><h1>{t("dashboard.title")}</h1><p>{filtered.length ? t("dashboard.drawBasis",{count:filtered.length}) : t("dashboard.noHistory")}</p></div>
      <div className="banner-kpis"><div><b>{filtered.length}</b><span>{t("dashboard.totalDraws")}</span></div><div><b>{filtered[0] ? format(parseISO(filtered[0].date),"dd/MM/yyyy") : "-"}</b><span>{t("dashboard.from")}</span></div><div><b>{latest ? format(parseISO(latest.date),"dd/MM/yyyy") : "-"}</b><span>{t("dashboard.to")}</span></div></div>
    </section>

    <div className="selectors" aria-label={t("dashboard.filters")}>
      <label>{t("dashboard.period")}<Select value={filters.period} onChange={e=>updateDashboardFilters({period:e.target.value as typeof filters.period})}>{periodOptions.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>
      <label>{t("dashboard.analysisView")}<Select value={analysisView} onChange={e=>updateDashboardFilters({analysisView:e.target.value})}>{viewOptions.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>
      <label>{t("dashboard.scoringPreset")}<Select value={filters.scoringPreset} onChange={e=>updateDashboardFilters({scoringPreset:e.target.value})}>{presetOptions.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>
      <label>{t("dashboard.predictionCount")}<Select value={filters.predictionCount} onChange={e=>updateDashboardFilters({predictionCount:Number(e.target.value) as 5|10|20})}>{[5,10,20].map(x=><option value={x} key={x}>Top {x}</option>)}</Select></label>
    </div>

    <section className="overview-grid">
      <Card className="latest-card"><CardHeader title={t("dashboard.latestDraw")} subtitle={displayedDraw ? format(parseISO(displayedDraw.date),"dd/MM/yyyy") : undefined} />{displayedDraw ? <><div className="latest-draw-carousel"><button type="button" className="latest-draw-nav" aria-label={t("dashboard.previousDraw")} title={t("dashboard.previousDraw")} disabled={displayedDrawIndex<=0} onClick={()=>setSelectedDrawId(filtered[displayedDrawIndex-1].id)}><ChevronLeft size={24}/></button><div className="balls">{displayedDraw.numbers.map((n,i)=><NumberBall key={n} number={n} index={i} />)}{selectedGame==="power655"&&displayedDraw.bonus&&<><span className="bonus-separator">+</span><NumberBall number={displayedDraw.bonus} index={5}/></>}</div><button type="button" className="latest-draw-nav" aria-label={t("dashboard.nextDraw")} title={t("dashboard.nextDraw")} disabled={displayedDrawIndex>=filtered.length-1} onClick={()=>setSelectedDrawId(filtered[displayedDrawIndex+1].id)}><ChevronRight size={24}/></button></div><div className={`jackpot ${selectedGame==="power655"?"power-jackpots":""}`}><div><span>{selectedGame==="power655"?t("common.jackpot1"):t("common.jackpot")}</span><b>{displayedDraw.jackpot?`${money.format(displayedDraw.jackpot)} VND`:t("common.unavailable")}</b></div>{selectedGame==="power655"&&<div><span>{t("common.jackpot2")}</span><b>{displayedDraw.jackpot2?`${money.format(displayedDraw.jackpot2)} VND`:t("common.unavailable")}</b></div>}</div><div className="metric-strip"><div><span>{t("common.total")}</span><b>{displayedDraw.numbers.reduce((a,b)=>a+b,0)}</b></div><div><span>{t("common.digitalRoot")}</span><b>{digitalRoot(displayedDraw.numbers.reduce((a,b)=>a+b,0))}</b></div><div><span>{t("common.evenOdd")}</span><b>{displayedDraw.numbers.filter(n=>n%2===0).length}/{displayedDraw.numbers.filter(n=>n%2!==0).length}</b></div><div><span>{t("common.insideOutside")}</span><b>{displayedDraw.numbers.filter(n=>INSIDE_SET.has(n)).length}/{displayedDraw.numbers.filter(n=>!INSIDE_SET.has(n)).length}</b></div></div></> : <EmptyState />}</Card>
      <Card className="predictions-card"><CardHeader title={t("dashboard.topPredictions")} subtitle={t("dashboard.topByConsensus",{count:filters.predictionCount})} action={<span title={t("dashboard.disclaimer")}><Info size={16}/></span>} /><div className="prediction-table"><div className="prediction-head"><span>{t("common.rank")}</span><span>{t("common.combination")}</span><span>{t("common.score")}</span></div>{predictions.slice(0,filters.predictionCount).map((p,i)=><details className="prediction-detail" key={p.numbers.join("-")}><summary className="prediction-row"><b className={`rank rank-${i+1}`}>{i+1}</b><span className="combo">{p.numbers.map(pad).join("-")} <small>{p.confidence}</small></span><ScoreBadge score={p.totalScore}/></summary><div className="prediction-breakdown"><span>{t("prediction.consensusNumbers")} <b>{p.singleScore.toFixed(1)}</b></span><span>{t("prediction.pairAssociation")} <b>{p.pairScore.toFixed(1)}</b></span><span>{t("prediction.tripleAssociation")} <b>{p.tripleScore.toFixed(1)}</b></span><span>{t("prediction.structure")} <b>{p.structureScore.toFixed(1)}</b></span><span>{t("prediction.novelty")} <b>{p.noveltyScore.toFixed(1)}</b></span><span>{t("prediction.maxOverlap")} <b>{p.maxHistoricalOverlap}/6</b></span></div></details>)}</div></Card>
      <ChartCard title="Frequency buckets" subtitle="Number counts by range"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={frequencyBuckets} innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={3}>{frequencyBuckets.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={value=>[value,t("common.count")]}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:9}}/></PieChart></ResponsiveContainer></ChartCard>
      <Card className="distribution-card"><CardHeader title={t("dashboard.numberDistribution")} subtitle={t("dashboard.fullSpace",{max:gameConfig.maxNumber})} /><div className="distribution-pies"><DistributionPie total={gameConfig.maxNumber} title={t("common.insideOutside")} info={t("dashboard.insideOutsideInfo",{numbers:insideNumbers})} data={[{name:t("common.inside"),value:insideTotal},{name:t("common.outside"),value:gameConfig.maxNumber-insideTotal}]} /><DistributionPie total={gameConfig.maxNumber} title={t("common.evenOdd")} info={t("dashboard.evenOddInfo")} data={[{name:t("common.even"),value:Math.floor(gameConfig.maxNumber/2)},{name:t("common.odd"),value:Math.ceil(gameConfig.maxNumber/2)}]} /></div></Card>
    </section>

    <section className="chart-grid score-history-grid" aria-label={t("dashboard.scoreHistoryGroup")}>
      {scoreCharts.map(([title,valueKey,color])=><ScoreHistoryChart key={valueKey} title={title} data={scoreTimeline} valueKey={valueKey} color={color} loading={scoreTimelineLoading}/>)}
      {(analysisView==="Overview"||analysisView==="Jackpot")&&<>
        <JackpotHistoryChart draws={draws} valueKey="jackpot" title={t(selectedGame==="power655"?"common.jackpot1":"common.jackpot")} color="#e9822a"/>
        {selectedGame==="power655"&&<JackpotHistoryChart draws={draws} valueKey="jackpot2" title={t("common.jackpot2")} color="#2f7fc1"/>}
      </>}
    </section>

    {analysisView==="Combinations"&&<Card className="view-note"><b>{t("dashboard.combinationView")}</b><span>{t("dashboard.combinationViewNote")}</span></Card>}
    <section className="chart-grid">
      {show("numbers")&&<ChartCard title="Top 10 numbers" subtitle="Occurrences in selected period"><ResponsiveContainer width="100%" height="100%"><BarChart data={topNumbers} layout="vertical" margin={{left:20,right:18,top:4,bottom:24}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fontSize:9}} label={xAxisLabel(t("common.occurrences"))}/><YAxis type="category" dataKey="number" width={38} tickFormatter={pad} label={yAxisLabel(t("common.number"))}/><Tooltip formatter={value=>[value,t("common.occurrences")]} labelFormatter={value=>`${t("common.number")} ${pad(Number(value))}`}/><Bar dataKey="totalCount" radius={[0,4,4,0]}>{topNumbers.map((item,index)=><Cell key={item.number} fill={rankedBarColor(index,topNumbers.length,[[28,91,143],[130,184,222]])}/>)}</Bar></BarChart></ResponsiveContainer></ChartCard>}
      {show("timeline")&&<ChartCard title="Occurrence timeline" subtitle="Historical frequency and 20-draw moving average">{(enlarged:boolean)=><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline} margin={{left:10,right:12,top:8,bottom:24}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={value=>format(parseISO(value),"MM/yyyy",{locale:dateLocale})} minTickGap={28} label={xAxisLabel(t("common.drawDate"))}/><YAxis width={42} domain={[0,"dataMax + 4"]} allowDecimals={false} label={yAxisLabel(t("common.frequencyScore"))}/><Tooltip labelFormatter={value=>format(parseISO(String(value)),"dd/MM/yyyy",{locale:dateLocale})} formatter={(value,name)=>[Number(value).toFixed(name==="MA20"?2:0),name]}/><Line type="linear" dataKey="historicalFrequency" name={t("common.historicalFrequency")} stroke="#38a169" strokeWidth={2.4} dot={false} activeDot={{r:4,strokeWidth:2,fill:"var(--chart-surface)"}}/><Line type="monotone" dataKey="ma20" name="MA20" stroke="#ef4444" strokeWidth={2.2} strokeDasharray="7 5" dot={false}/>{enlarged&&<Brush ariaLabel={t("dashboard.chartNavigator")} dataKey="date" height={34} travellerWidth={9} stroke="#38a169" fill="var(--chart-surface)" tickFormatter={value=>format(parseISO(String(value)),"MM/yyyy",{locale:dateLocale})}><LineChart><Line type="linear" dataKey="historicalFrequency" stroke="#38a169" dot={false} isAnimationActive={false}/><Line type="monotone" dataKey="ma20" stroke="#ef4444" dot={false} isAnimationActive={false}/></LineChart></Brush>}</LineChart></ResponsiveContainer>}</ChartCard>}
      {show("monthly")&&<ChartCard title="Draws by month" subtitle="Number of draws in each complete calendar month"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{left:10,right:8,top:20,bottom:24}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}} tickFormatter={value=>format(parseISO(`${value}-01`),"MM/yy",{locale:dateLocale})} interval="preserveStartEnd" label={xAxisLabel(t("common.month"))}/><YAxis width={48} allowDecimals={false} domain={[0,"dataMax + 2"]} label={yAxisLabel(t("common.numberOfDraws"))}/><Tooltip labelFormatter={value=>format(parseISO(`${String(value)}-01`),"MMMM yyyy",{locale:dateLocale})} formatter={value=>[value,t("common.numberOfDraws")]}/><Bar dataKey="draws" fill="#3f8fe8" radius={[4,4,0,0]} maxBarSize={30}><LabelList dataKey="draws" position="top" className="bar-label"/></Bar></BarChart></ResponsiveContainer></ChartCard>}
      {show("gap")&&<ChartCard title="Gap vs frequency" subtitle="Bubble size and tone represent Consensus Score"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{left:12,right:16,top:12,bottom:24}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="gapX" name={t("common.currentGap")} allowDecimals={false} domain={[0,(maximum:number)=>Math.ceil(maximum+1)]} label={xAxisLabel(t("common.currentGapDraws"))}/><YAxis width={44} type="number" dataKey="frequencyY" name={t("common.count")} allowDecimals={false} domain={[0,(maximum:number)=>Math.ceil(maximum+1)]} label={yAxisLabel(t("common.totalOccurrences"))}/><ZAxis type="number" dataKey="technicalScore" domain={[0,100]} range={[36,520]}/><Tooltip cursor={{strokeDasharray:"3 3"}} content={<ScatterTooltip mode="gap"/>}/><Scatter data={gapScatterData} shape="circle">{gapScatterData.map(x=><Cell key={x.number} fill={technicalScoreColor(x.technicalScore,scoreRange.min,scoreRange.max)} fillOpacity={.9} stroke="var(--chart-surface)" strokeWidth={2.5}/>)}</Scatter></ScatterChart></ResponsiveContainer></ChartCard>}
      {show("last30")&&<ChartCard title="Last 30 frequency" subtitle="Recent frequency with Consensus Score sizing"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{left:12,right:16,top:12,bottom:24}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="totalX" name={t("common.total")} allowDecimals={false} domain={[0,(maximum:number)=>Math.ceil(maximum+1)]} label={xAxisLabel(t("common.totalOccurrences"))}/><YAxis width={44} type="number" dataKey="recentY" name={t("common.last30")} allowDecimals={false} domain={[0,(maximum:number)=>Math.ceil(maximum+1)]} label={yAxisLabel(t("common.last30Draws"))}/><ZAxis type="number" dataKey="technicalScore" domain={[0,100]} range={[36,520]}/><Tooltip cursor={{strokeDasharray:"3 3"}} content={<ScatterTooltip mode="recent"/>}/><Scatter data={last30ScatterData} shape="circle">{last30ScatterData.map(x=><Cell key={x.number} fill={stateColors[x.state]} fillOpacity={.82} stroke="var(--chart-surface)" strokeWidth={3}/>)}</Scatter></ScatterChart></ResponsiveContainer></ChartCard>}
      {show("pairs")&&<ChartCard title="Top 10 pairs" subtitle="Most observed pairs"><ResponsiveContainer width="100%" height="100%"><BarChart data={pairs.slice(0,10)} layout="vertical" margin={{left:20,right:18,top:4,bottom:24}}><XAxis type="number" allowDecimals={false} tick={{fontSize:9}} label={xAxisLabel(t("common.occurrences"))}/><YAxis type="category" dataKey="key" width={58} tick={{fontSize:10}} label={yAxisLabel(t("common.pair"))}/><Tooltip formatter={value=>[value,t("common.occurrences")]} labelFormatter={value=>`${t("common.pair")} ${value}`}/><Bar dataKey="count" radius={[0,4,4,0]}>{pairs.slice(0,10).map((item,index)=><Cell key={item.key} fill={rankedBarColor(index,10,[[202,84,22],[248,182,102]])}/>)}</Bar></BarChart></ResponsiveContainer></ChartCard>}
      {show("triples")&&<ChartCard title="Top 10 triples" subtitle="Most observed triples"><ResponsiveContainer width="100%" height="100%"><BarChart data={triples.slice(0,10)} layout="vertical" margin={{left:20,right:18,top:4,bottom:24}}><XAxis type="number" allowDecimals={false} tick={{fontSize:9}} label={xAxisLabel(t("common.occurrences"))}/><YAxis type="category" dataKey="key" width={76} tick={{fontSize:10}} label={yAxisLabel(t("common.triple"))}/><Tooltip formatter={value=>[value,t("common.occurrences")]} labelFormatter={value=>`${t("common.triple")} ${value}`}/><Bar dataKey="count" radius={[0,4,4,0]}>{triples.slice(0,10).map((item,index)=><Cell key={item.key} fill={rankedBarColor(index,10,[[20,116,80],[128,202,169]])}/>)}</Bar></BarChart></ResponsiveContainer></ChartCard>}
    </section>
    <p className="disclaimer"><Info size={14}/> {t("dashboard.disclaimer")}</p>
  </div>;
}
