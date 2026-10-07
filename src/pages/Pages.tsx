import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { CalendarDays, Download, Info, LoaderCircle, Pencil, Play, Plus, RotateCcw, Search, Settings2, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { filterCombinationsByNumbers, pad } from "../analytics";
import { LOTTERY_GAMES } from "../domain";
import type { CandidateCombination, Draw, PairStats, SingleNumberStats, TripleStats } from "../domain";
import { settingsForPreset, useAnalytics } from "../hooks";
import { useLotteryStore } from "../store";
import { Button, Card, CardHeader, NumberBall, ScoreBadge, Select } from "../ui";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import GameSwitch from "../GameSwitch";
import DataTable from "../DataTable";

type BacktestPayload={result:ReturnType<typeof import("../analytics").backtestRange>;rolling:ReturnType<typeof import("../analytics").runRollingBacktest>};
const backtestCache=new Map<string,BacktestPayload>();

const drawSchema = z.object({
  date: z.string().min(10),
  numbers: z.string().refine(value => { const nums=value.split(/[ ,;-]+/).map(Number); return nums.length === 6 && new Set(nums).size === 6 && nums.every(n => n >= 1); }, "Enter 6 unique positive numbers"),
  bonus: z.number().optional(),
  jackpot: z.number().min(0),
  jackpot2: z.number().min(0).optional(),
});
type DrawForm = z.infer<typeof drawSchema>;

function PageTitle({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) { return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>; }

function useTableLabels(){
  const {t}=useI18n();
  return {
    filterColumn:t("table.filterColumn"),sortAscending:t("table.sortAscending"),sortDescending:t("table.sortDescending"),filterValues:t("table.filterValues"),filterPlaceholder:t("table.filterPlaceholder"),filterHint:t("table.filterHint"),clearColumn:t("table.clearColumn"),resetFilters:t("table.resetFilters"),rowsShown:t("table.rowsShown"),close:t("table.close"),noMatches:t("table.noMatches"),
  };
}

export function HistoryPage() {
  const {t}=useI18n();
  const { draws:megaDraws,powerDraws,selectedGame,addDraw,updateDraw,removeDraw,importData,resetData,settings } = useLotteryStore();
  const gameConfig=LOTTERY_GAMES[selectedGame];
  const draws=selectedGame==="power655"?powerDraws:megaDraws;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, setError, formState:{errors} } = useForm<DrawForm>({ resolver:zodResolver(drawSchema), defaultValues:{date:new Date().toISOString().slice(0,10),numbers:"",bonus:undefined,jackpot:0,jackpot2:undefined} });
  const submit = (values: DrawForm) => {
    const parsed = drawSchema.parse(values);
    if (draws.some(d=>d.date===parsed.date&&d.id!==editingId)) return;
    const numbers=parsed.numbers.split(/[ ,;-]+/).map(Number).sort((a,b)=>a-b) as Draw["numbers"];
    if(numbers.some(number=>number>gameConfig.maxNumber)){setError("numbers",{message:`Numbers must be from 1 to ${gameConfig.maxNumber}`});return;}
    if(selectedGame==="power655"&&(!parsed.bonus||parsed.bonus>55)){setError("bonus",{message:"Enter a bonus number from 1 to 55"});return;}
    const draw:Draw={id:editingId??crypto.randomUUID(),date:parsed.date,numbers,jackpot:parsed.jackpot,...(selectedGame==="power655"?{bonus:parsed.bonus,jackpot2:parsed.jackpot2??0}:{})};
    if(editingId) updateDraw(editingId,draw); else addDraw(draw);
    reset(); setEditingId(null); setOpen(false);
  };
  const startAdd=()=>{ setEditingId(null); reset({date:new Date().toISOString().slice(0,10),numbers:"",bonus:undefined,jackpot:0,jackpot2:undefined}); setOpen(true); };
  const startEdit=(draw:Draw)=>{ setEditingId(draw.id); reset({date:draw.date,numbers:draw.numbers.map(pad).join(" "),bonus:draw.bonus,jackpot:draw.jackpot,jackpot2:draw.jackpot2}); setOpen(true); };
  const exportData = () => { const blob=new Blob([JSON.stringify({version:1,game:selectedGame,draws,settings},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${selectedGame}-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); };
  const onImport = async (file?: File) => { if(!file)return; try { const data=JSON.parse(await file.text()); const valid=z.object({version:z.number(),draws:z.array(z.object({id:z.string(),date:z.string(),numbers:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]),bonus:z.number().optional(),jackpot:z.number().min(0),jackpot2:z.number().optional()}))}).parse(data); importData({draws:valid.draws,settings:data.settings}); } catch { alert("Invalid data file"); } };
  return <><PageTitle title="Draw history" subtitle={`${gameConfig.name}: ${draws.length} draws, ordered oldest to newest`} actions={<><GameSwitch/><Button onClick={startAdd}><Plus size={15}/>Add draw</Button><Button className="secondary" onClick={()=>inputRef.current?.click()}><Upload size={15}/>Import JSON</Button><input ref={inputRef} hidden type="file" accept="application/json" onChange={e=>onImport(e.target.files?.[0])}/><Button className="secondary" onClick={exportData}><Download size={15}/>Export</Button><Button className="secondary" onClick={resetData}><RotateCcw size={15}/>Reset</Button></>} />
  {open&&<Card className="form-card"><CardHeader title={editingId?"Update draw":"Add a draw"} subtitle={`Numbers are validated from 1 to ${gameConfig.maxNumber}`}/><form onSubmit={handleSubmit(submit)} className="draw-form"><label>Date<input type="date" {...register("date")}/></label><label>Six numbers<input placeholder="05 14 22 28 32 39" {...register("numbers")}/><small>{errors.numbers?.message}</small></label>{selectedGame==="power655"&&<label>Bonus<input type="number" min="1" max="55" {...register("bonus",{setValueAs:value=>value===""?undefined:Number(value)})}/><small>{errors.bonus?.message}</small></label>}<label>{selectedGame==="power655"?t("common.jackpot1"):"Jackpot"} (VND)<input type="number" {...register("jackpot",{valueAsNumber:true})}/></label>{selectedGame==="power655"&&<label>{t("common.jackpot2")} (VND)<input type="number" {...register("jackpot2",{setValueAs:value=>value===""?undefined:Number(value)})}/></label>}<Button type="submit">{editingId?"Save changes":"Save draw"}</Button></form></Card>}
  <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>Date</th>{[1,2,3,4,5,6].map(n=><th key={n}>N{n}</th>)}{selectedGame==="power655"&&<th>{t("common.bonus")}</th>}<th>{selectedGame==="power655"?t("common.jackpot1"):"Jackpot"}</th>{selectedGame==="power655"&&<th>{t("common.jackpot2")}</th>}<th>Actions</th></tr></thead><tbody>{[...draws].reverse().map(draw=><tr key={draw.id}><td>{format(parseISO(draw.date),"dd/MM/yyyy")}</td>{draw.numbers.map((n,i)=><td key={n}><NumberBall number={n} index={i} small/></td>)}{selectedGame==="power655"&&<td>{draw.bonus?<NumberBall number={draw.bonus} index={5} small/>:"-"}</td>}<td>{draw.jackpot?`${draw.jackpot.toLocaleString("en-US")} VND`:t("common.unavailable")}</td>{selectedGame==="power655"&&<td>{draw.jackpot2?`${draw.jackpot2.toLocaleString("en-US")} VND`:t("common.unavailable")}</td>}<td><div className="row-actions"><Button className="icon secondary" aria-label={`Edit draw ${draw.date}`} onClick={()=>startEdit(draw)}><Pencil size={14}/></Button><Button className="icon danger" aria-label={`Delete draw ${draw.date}`} onClick={()=>removeDraw(draw.id)}><Trash2 size={15}/></Button></div></td></tr>)}</tbody></table></div></Card></>;
}

export function SinglesPage() {
  const {t}=useI18n();
  const labels=useTableLabels();
  const { singles, filtered }=useAnalytics();
  const columns=useMemo<ColumnDef<SingleNumberStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank"),cell:info=>`#${info.getValue<number>()}`},
    {accessorKey:"number",header:t("common.number"),cell:info=><NumberBall number={info.getValue<number>()} small/>},
    {accessorKey:"totalCount",header:t("common.count")},
    {id:"rate",accessorFn:row=>row.frequencyRate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},
    {id:"inside",accessorFn:row=>row.inside?t("common.inside"):t("common.outside"),header:t("pages.io")},
    {id:"parity",accessorFn:row=>row.parity==="EVEN"?t("common.even"):t("common.odd"),header:t("pages.eo")},
    {accessorKey:"currentGap",header:t("pages.gap")},{accessorKey:"averageGap",header:t("pages.avgGap"),cell:info=>info.getValue<number>().toFixed(1)},{accessorKey:"maxGap",header:t("pages.maxGap")},{accessorKey:"countLast10",header:t("pages.last10")},{accessorKey:"countLast30",header:t("common.last30")},{accessorKey:"trend30",header:t("pages.trend"),cell:info=>info.getValue<number>().toFixed(2)},
    {accessorKey:"state",header:t("pages.state"),cell:info=>{const state=info.getValue<SingleNumberStats["state"]>();return <span className={`state state-${state.toLowerCase()}`}>{t(`state.${state}` as TranslationKey)}</span>;}},
    {accessorKey:"technicalScore",header:t("common.score"),cell:info=><ScoreBadge score={info.getValue<number>()}/>},
  ],[t]);
  return <><PageTitle title={t("pages.singlesTitle")} subtitle={t("pages.singlesSubtitle",{count:filtered.length})} actions={<GameSwitch/>}/><DataTable data={singles} columns={columns} labels={labels}/></>;
}

export function PairsPage(){
  const {t}=useI18n(); const labels=useTableLabels(); const {pairs,filtered}=useAnalytics();
  const columns=useMemo<ColumnDef<PairStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank")},{accessorKey:"key",header:t("common.pair")},{accessorKey:"count",header:t("common.count")},{id:"rate",accessorFn:row=>row.rate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},
  ],[t]);
  return <><PageTitle title={t("pages.pairsTitle")} subtitle={t("pages.pairsSubtitle",{count:filtered.length})} actions={<GameSwitch/>}/><DataTable data={pairs} columns={columns} labels={labels} maxRows={250}/></>;
}
export function TriplesPage(){
  const {t}=useI18n(); const labels=useTableLabels(); const {triples,filtered}=useAnalytics();
  const columns=useMemo<ColumnDef<TripleStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank")},{accessorKey:"key",header:t("common.triple")},{accessorKey:"count",header:t("common.count")},{id:"rate",accessorFn:row=>row.rate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},
  ],[t]);
  return <><PageTitle title={t("pages.triplesTitle")} subtitle={t("pages.triplesSubtitle",{triples:triples.length,count:filtered.length})} actions={<GameSwitch/>}/><DataTable data={triples} columns={columns} labels={labels} maxRows={250}/></>;
}
export function CombinationsPage(){
  const {t}=useI18n();
  const labels=useTableLabels();
  const {dashboardFilters,updateDashboardFilters}=useLotteryStore();
  const {predictions}=useAnalytics();
  const [query,setQuery]=useState("");
  const visiblePredictions=filterCombinationsByNumbers(predictions,query);
  const columns=useMemo<ColumnDef<CandidateCombination>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank")},{id:"combination",accessorFn:row=>row.numbers.map(pad).join(" - "),header:t("common.combination")},{accessorKey:"total",header:t("pages.sum")},{accessorKey:"digitalRoot",header:t("pages.root")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{accessorKey:"singleScore",header:t("pages.single"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"pairScore",header:t("common.pair"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"tripleScore",header:t("common.triple"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"structureScore",header:t("prediction.structure"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"totalScore",header:t("pages.totalScore"),cell:info=>info.getValue<number>().toFixed(2)},
  ],[t]);
  const presets:[string,TranslationKey][]=[["Default","preset.default"],["Balanced","preset.balanced"],["Hot","preset.hot"],["Gap","preset.gap"],["Pair","preset.pair"],["Triple","preset.triple"],["Custom","preset.custom"]];
  const presetControl=<label className="page-preset-control"><span>{t("dashboard.scoringPreset")}</span><Select aria-label={t("dashboard.scoringPreset")} value={dashboardFilters.scoringPreset} onChange={e=>updateDashboardFilters({scoringPreset:e.target.value})}>{presets.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>;
  return <><PageTitle title={t("pages.combinationsTitle")} subtitle={t("pages.combinationsSubtitle")} actions={<><GameSwitch/>{presetControl}</>}/><Card className="notice">{t("pages.combinationsNotice")}</Card><div className="combination-search"><label><span>{t("pages.searchCombinationLabel")}</span><div className="combination-search-field"><Search size={15} aria-hidden="true"/><input type="search" inputMode="numeric" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("pages.searchCombination")} aria-describedby="combination-search-count"/></div></label><span id="combination-search-count" aria-live="polite">{t("pages.combinationMatches",{count:visiblePredictions.length,total:predictions.length})}</span></div><DataTable data={visiblePredictions} columns={columns} labels={labels} onReset={()=>setQuery("")}/></>;
}
export function BacktestPage(){
  const {t}=useI18n();
  const {draws:megaDraws,powerDraws,selectedGame,settings}=useLotteryStore();
  const draws=selectedGame==="power655"?powerDraws:megaDraws;
  const maxNumber=LOTTERY_GAMES[selectedGame].maxNumber;
  const defaultRange=()=>({from:draws.at(-4)?.date??draws[0]?.date??"",to:draws.at(-1)?.date??""});
  const initial=defaultRange();
  const [fromDate,setFromDate]=useState(initial.from);
  const [toDate,setToDate]=useState(initial.to);
  const [trainingDraws,setTrainingDraws]=useState(50);
  const [preset,setPreset]=useState("Balanced");
  const [predictionCount,setPredictionCount]=useState(5);
  const [data,setData]=useState<BacktestPayload|null>(null);
  const [running,setRunning]=useState(false);
  const [failed,setFailed]=useState(false);
  const workerRef=useRef<Worker|null>(null);
  useEffect(()=>{const next=defaultRange();setFromDate(next.from);setToDate(next.to);setData(null);setFailed(false);},[selectedGame]);
  useEffect(()=>()=>workerRef.current?.terminate(),[]);
  const presets:[string,TranslationKey][]=[["Default","preset.default"],["Balanced","preset.balanced"],["Hot","preset.hot"],["Gap","preset.gap"],["Pair","preset.pair"],["Triple","preset.triple"],["Custom","preset.custom"]];
  const run=()=>{
    if(!fromDate||!toDate||fromDate>toDate){setFailed(true);setData(null);return;}
    workerRef.current?.terminate();
    setRunning(true);setFailed(false);setData(null);
    const effectiveSettings=settingsForPreset(settings,preset);
    const cacheKey=JSON.stringify([selectedGame,draws.map(draw=>[draw.id,draw.date,draw.numbers]),effectiveSettings,fromDate,toDate,trainingDraws,predictionCount]);
    const cached=backtestCache.get(cacheKey);
    if(cached){setData(cached);setRunning(false);return;}
    const worker=new Worker(new URL("../backtest.worker.ts",import.meta.url),{type:"module"});
    workerRef.current=worker;
    worker.onmessage=({data:payload}:MessageEvent<BacktestPayload>)=>{backtestCache.set(cacheKey,payload);setData(payload);setRunning(false);worker.terminate();workerRef.current=null;};
    worker.onerror=()=>{setFailed(true);setRunning(false);worker.terminate();workerRef.current=null;};
    worker.postMessage({draws,settings:effectiveSettings,maxNumber,fromDate,toDate,trainingDraws,predictionCount});
  };
  return <div className="backtest-page">
    <PageTitle title={t("pages.backtestTitle")} subtitle={t("pages.backtestSubtitle")}/>
    <Card className="backtest-setup">
      <CardHeader title={t("pages.backtestSetup")} action={<Settings2 size={17} aria-hidden="true"/>}/>
      <div className="backtest-controls">
        <div className="backtest-field backtest-game"><span>{t("pages.game")}</span><GameSwitch/></div>
        <fieldset className="backtest-dates"><legend><CalendarDays size={14}/>{t("pages.testDateRange")}</legend><label><span>{t("pages.fromDate")}</span><input type="date" min={draws[0]?.date} max={toDate||draws.at(-1)?.date} value={fromDate} onChange={event=>setFromDate(event.target.value)}/></label><label><span>{t("pages.toDate")}</span><input type="date" min={fromDate||draws[0]?.date} max={draws.at(-1)?.date} value={toDate} onChange={event=>setToDate(event.target.value)}/></label></fieldset>
        <label className="backtest-field"><span>{t("pages.trainingWindow")}</span><Select value={trainingDraws} onChange={event=>setTrainingDraws(Number(event.target.value))}><option value={30}>{t("pages.previousDraws",{count:30})}</option><option value={50}>{t("pages.previousDraws",{count:50})}</option><option value={100}>{t("pages.previousDraws",{count:100})}</option></Select></label>
        <label className="backtest-field"><span>{t("dashboard.scoringPreset")}</span><Select value={preset} onChange={event=>setPreset(event.target.value)}>{presets.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>
        <label className="backtest-field"><span>{t("dashboard.predictionCount")}</span><Select value={predictionCount} onChange={event=>setPredictionCount(Number(event.target.value))}>{[5,10,20].map(count=><option value={count} key={count}>Top {count}</option>)}</Select></label>
      </div>
      <div className="backtest-note"><Info size={15}/><span>{t("pages.backtestNote")}</span></div>
      <Button onClick={run} disabled={running}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={15}/>} {running?t("pages.backtestLoading"):t("pages.runBacktest")}</Button>
    </Card>
    {failed&&<Card className="backtest-loading" role="alert">{t("pages.backtestError")}</Card>}
    {!data&&!failed&&!running&&<Card className="backtest-loading">{t("pages.backtestReady")}</Card>}
    {running&&<Card className="backtest-loading" role="status"><LoaderCircle className="spin" size={18}/>{t("pages.backtestLoading")}</Card>}
    {data&&<>
      <div className="kpi-grid backtest-kpis"><Card><span>{t("pages.tests")}</span><b>{data.result.tests}</b></Card><Card><span>{t("pages.averageMatches")}</span><b>{data.result.average.toFixed(2)}/6</b></Card><Card><span>{t("pages.bestMatch")}</span><b>{data.result.best}/6</b></Card><Card><span>{t("pages.modelHitRate")}</span><b>{(data.rolling.modelTop10HitRate*100).toFixed(1)}%</b></Card></div>
      <Card className="table-card backtest-results"><CardHeader title={t("pages.backtestResults")} subtitle={t("pages.backtestResultsSubtitle")} action={<span>{t("pages.drawsShown",{count:data.result.rows.length})}</span>}/><div className="table-scroll"><table><thead><tr><th>{t("pages.drawDate")}</th><th>{t("pages.proposedSets",{count:predictionCount})}</th><th>{t("pages.matchCount")}</th><th>{t("pages.actualResult")}</th><th>{t("pages.evaluation")}</th></tr></thead><tbody>{data.result.rows.map(row=><tr key={row.targetId}><td>{format(parseISO(row.date),"dd/MM/yyyy")}</td><td><div className="backtest-predictions">{row.predictions.map((numbers,index)=><span key={index}><b>#{index+1}</b>{numbers.map(pad).join("-")}</span>)}</div></td><td><strong className="backtest-match">{row.bestMatches}/6</strong></td><td><div className="backtest-actual">{row.actual.map((number,index)=><NumberBall key={number} number={number} index={index} small/>)}</div></td><td><span className={`backtest-grade grade-${Math.min(row.bestMatches,3)}`}>{t(row.bestMatches>=3?"pages.goodResult":"pages.referenceOnly")}</span></td></tr>)}{!data.result.rows.length&&<tr><td colSpan={5}><div className="empty-state">{t("pages.noBacktestRows")}</div></td></tr>}</tbody></table></div></Card>
      <p className="disclaimer"><Info size={14}/>{t("pages.backtestDisclaimer")}</p>
    </>}
  </div>;
}
export function SettingsPage(){ const {settings,updateSettings,resetData}=useLotteryStore(); return <><PageTitle title="Settings" subtitle="Changes update predictions and analytics immediately"/><div className="settings-grid"><Card><CardHeader title="Candidate generation"/><label>Candidate pool size<input type="number" min="10" max="18" value={settings.candidatePoolSize} onChange={e=>updateSettings({candidatePoolSize:Number(e.target.value)})}/></label><label>Minimum total<input type="number" value={settings.minTotal} onChange={e=>updateSettings({minTotal:Number(e.target.value)})}/></label><label>Maximum overlap<input type="number" min="0" max="5" value={settings.maxCombinationOverlap} onChange={e=>updateSettings({maxCombinationOverlap:Number(e.target.value)})}/></label></Card><Card><CardHeader title="Model support"/><label>Weighted-frequency half-life<input type="number" min="1" value={settings.weightedFrequencyHalfLife} onChange={e=>updateSettings({weightedFrequencyHalfLife:Number(e.target.value)})}/></label><label>Minimum pair support<input type="number" min="1" value={settings.minPairSupport} onChange={e=>updateSettings({minPairSupport:Number(e.target.value)})}/></label><label>Minimum transition support<input type="number" min="1" value={settings.minTransitionSupport} onChange={e=>updateSettings({minTransitionSupport:Number(e.target.value)})}/></label><label>Backtest training draws<input type="number" min="10" value={settings.backtestMinTrainingDraws} onChange={e=>updateSettings({backtestMinTrainingDraws:Number(e.target.value)})}/></label></Card><Card><CardHeader title="Consensus weights"/>{Object.entries(settings.consensusWeights).map(([key,value])=><label key={key}>{key}<input type="number" min="0" value={value} onChange={e=>updateSettings({consensusWeights:{...settings.consensusWeights,[key]:Number(e.target.value)}})}/></label>)}</Card><Card><CardHeader title="Combination V2 weights"/>{Object.entries(settings.comboWeightsV2).map(([key,value])=><label key={key}>{key}<input type="number" min="0" value={value} onChange={e=>updateSettings({comboWeightsV2:{...settings.comboWeightsV2,[key]:Number(e.target.value)}})}/></label>)}</Card></div><Button className="secondary settings-reset" onClick={resetData}><RotateCcw size={15}/>Restore defaults</Button></> }
