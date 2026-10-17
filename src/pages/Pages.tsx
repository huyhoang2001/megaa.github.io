import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { CalendarDays, Download, Info, LoaderCircle, Pencil, Play, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { calculateSingles, calculatePairs, calculateTriples, combinationScoreKeys, filterCombinationsByNumbers, getBacktestTrainingWindows, pad, parseCompactCombinations, scoreCandidateCombinations, selectFilteredPortfolio, validCombinationScoreRanges } from "../analytics";
import type { CombinationScoreRanges } from "../analytics";
import { LOTTERY_GAMES } from "../domain";
import type { CandidateCombination, Draw, PairStats, SingleNumberStats, TripleStats } from "../domain";
import { settingsForPreset, useAnalytics } from "../hooks";
import { useLotteryStore } from "../store";
import { Button, Card, CardHeader, NumberBall, ScoreBadge, Select } from "../ui";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import DataTable from "../DataTable";

type BacktestPayload={result:ReturnType<typeof import("../analytics").backtestRange>;rolling:ReturnType<typeof import("../analytics").runRollingBacktest>;manualMode?:boolean};
type PortfolioRollingResult=ReturnType<typeof import("../analytics").runPortfolioRollingBacktest>;
type BacktestTableRow={rank:number;combination:string;rate:number;sum:number;root:number;evenOdd:string;insideOutside:string;single:number;pair:number;triple:number;structure:number;totalScore:number;matches:number;actual:number[];evaluation:string};
const backtestCache=new Map<string,BacktestPayload>();

const drawSchema = z.object({
  date: z.string().min(10),
  numbers: z.string().refine(value => { const nums=value.split(/[ ,;-]+/).map(Number); return nums.length > 0 && new Set(nums).size === nums.length && nums.every(n => Number.isInteger(n)&&n >= 1); }, "Enter unique positive numbers"),
  bonus: z.number().optional(),
  jackpot: z.number().min(0),
  jackpot2: z.number().min(0).optional(),
});
type DrawForm = z.infer<typeof drawSchema>;

function PageTitle({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) { return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>; }

function PeriodControl(){
  const {t}=useI18n();
  const {dashboardFilters,updateDashboardFilters}=useLotteryStore();
  const periods:[typeof dashboardFilters.period,TranslationKey][]=[
    ["last30","shell.last30"],["last50","selector.last50"],["last100","selector.last100"],
    ["last1year","shell.lastYear"],["all","shell.allDraws"],
  ];
  return <label className="page-preset-control page-period-control"><span>{t("dashboard.period")}</span><Select value={dashboardFilters.period} onChange={event=>updateDashboardFilters({period:event.target.value as typeof dashboardFilters.period})}>{periods.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</Select></label>;
}

function ScoringPresetControl(){
  const {t}=useI18n();
  const {dashboardFilters,updateDashboardFilters}=useLotteryStore();
  const presets:[string,TranslationKey][]=[["Default","preset.default"],["Balanced","preset.balanced"],["Hot","preset.hot"],["Legacy Gap","preset.legacyGap"],["Gap + Frequency","preset.gapFrequency"],["Pair","preset.pair"],["Custom","preset.custom"]];
  return <label className="page-preset-control"><span>{t("dashboard.scoringPreset")}</span><Select value={dashboardFilters.scoringPreset} onChange={event=>updateDashboardFilters({scoringPreset:event.target.value})}>{presets.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</Select></label>;
}

function useTableLabels(){
  const {t}=useI18n();
  return {
    filterColumn:t("table.filterColumn"),sortAscending:t("table.sortAscending"),sortDescending:t("table.sortDescending"),filterValues:t("table.filterValues"),filterPlaceholder:t("table.filterPlaceholder"),filterHint:t("table.filterHint"),clearColumn:t("table.clearColumn"),resetFilters:t("table.resetFilters"),rowsShown:t("table.rowsShown"),close:t("table.close"),noMatches:t("table.noMatches"),
  };
}

export function HistoryPage() {
  const {t}=useI18n();
  const { draws:megaDraws,powerDraws,lottoDraws,selectedGame,addDraw,updateDraw,removeDraw,importData,resetData,settings } = useLotteryStore();
  const gameConfig=LOTTERY_GAMES[selectedGame];
  const draws=selectedGame==="mega645"?megaDraws:selectedGame==="power655"?powerDraws:lottoDraws;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, setError, formState:{errors} } = useForm<DrawForm>({ resolver:zodResolver(drawSchema), defaultValues:{date:new Date().toISOString().slice(0,10),numbers:"",bonus:undefined,jackpot:0,jackpot2:undefined} });
  const submit = (values: DrawForm) => {
    const parsed = drawSchema.parse(values);
    if (draws.some(d=>d.date===parsed.date&&d.id!==editingId)) return;
    const numbers=parsed.numbers.split(/[ ,;-]+/).map(Number).sort((a,b)=>a-b) as Draw["numbers"];
    if(numbers.length!==gameConfig.drawSize){setError("numbers",{message:`Enter ${gameConfig.drawSize} unique numbers`});return;}
    if(numbers.some(number=>number>gameConfig.maxNumber)){setError("numbers",{message:`Numbers must be from 1 to ${gameConfig.maxNumber}`});return;}
    if(gameConfig.specialMax&&(!parsed.bonus||parsed.bonus>gameConfig.specialMax)){setError("bonus",{message:`Enter a special number from 1 to ${gameConfig.specialMax}`});return;}
    const draw:Draw={id:editingId??crypto.randomUUID(),date:parsed.date,numbers,jackpot:parsed.jackpot,...(gameConfig.specialMax?{bonus:parsed.bonus}:{}),...(selectedGame==="power655"?{jackpot2:parsed.jackpot2??0}:{})};
    if(editingId) updateDraw(editingId,draw); else addDraw(draw);
    reset(); setEditingId(null); setOpen(false);
  };
  const startAdd=()=>{ setEditingId(null); reset({date:new Date().toISOString().slice(0,10),numbers:"",bonus:undefined,jackpot:0,jackpot2:undefined}); setOpen(true); };
  const startEdit=(draw:Draw)=>{ setEditingId(draw.id); reset({date:draw.date,numbers:draw.numbers.map(pad).join(" "),bonus:draw.bonus,jackpot:draw.jackpot,jackpot2:draw.jackpot2}); setOpen(true); };
  const exportData = () => { const blob=new Blob([JSON.stringify({version:1,game:selectedGame,draws,settings},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${selectedGame}-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); };
  const onImport = async (file?: File) => { if(!file)return; try { const data=JSON.parse(await file.text()); const valid=z.object({version:z.number(),draws:z.array(z.object({id:z.string(),date:z.string(),numbers:z.array(z.number()),bonus:z.number().optional(),jackpot:z.number().min(0),jackpot2:z.number().optional()}))}).parse(data); importData({draws:valid.draws,settings:data.settings}); } catch { alert("Invalid data file"); } };
  return <><PageTitle title="Draw history" subtitle={`${gameConfig.name}: ${draws.length} draws, ordered oldest to newest`} actions={<><Button onClick={startAdd}><Plus size={15}/>Add draw</Button><Button className="secondary" onClick={()=>inputRef.current?.click()}><Upload size={15}/>Import JSON</Button><input ref={inputRef} hidden type="file" accept="application/json" onChange={e=>onImport(e.target.files?.[0])}/><Button className="secondary" onClick={exportData}><Download size={15}/>Export</Button><Button className="secondary" onClick={resetData}><RotateCcw size={15}/>Reset</Button></>} />
  {open&&<Card className="form-card"><CardHeader title={editingId?"Update draw":"Add a draw"} subtitle={`Numbers are validated from 1 to ${gameConfig.maxNumber}`}/><form onSubmit={handleSubmit(submit)} className="draw-form"><label>Date<input type="date" {...register("date")}/></label><label>{gameConfig.drawSize} numbers<input placeholder={gameConfig.drawSize===5?"03 08 12 22 24":"05 14 22 28 32 39"} {...register("numbers")}/><small>{errors.numbers?.message}</small></label>{gameConfig.specialMax>0&&<label>{t("common.bonus")}<input type="number" min="1" max={gameConfig.specialMax} {...register("bonus",{setValueAs:value=>value===""?undefined:Number(value)})}/><small>{errors.bonus?.message}</small></label>}<label>{selectedGame==="power655"?t("common.jackpot1"):"Jackpot"} (VND)<input type="number" {...register("jackpot",{valueAsNumber:true})}/></label>{selectedGame==="power655"&&<label>{t("common.jackpot2")} (VND)<input type="number" {...register("jackpot2",{setValueAs:value=>value===""?undefined:Number(value)})}/></label>}<Button type="submit">{editingId?"Save changes":"Save draw"}</Button></form></Card>}
  <Card className="table-card"><div className="table-scroll"><table><thead><tr><th>Date</th>{Array.from({length:gameConfig.drawSize},(_,i)=><th key={i}>N{i+1}</th>)}{gameConfig.specialMax>0&&<th>{t("common.bonus")}</th>}<th>{selectedGame==="power655"?t("common.jackpot1"):"Jackpot"}</th>{selectedGame==="power655"&&<th>{t("common.jackpot2")}</th>}<th>Actions</th></tr></thead><tbody>{[...draws].reverse().map(draw=><tr key={draw.id}><td>{format(parseISO(draw.date),"dd/MM/yyyy")}</td>{draw.numbers.map((n,i)=><td key={n}><NumberBall number={n} index={i} small/></td>)}{gameConfig.specialMax>0&&<td>{draw.bonus?<NumberBall number={draw.bonus} index={5} small/>:"-"}</td>}<td>{draw.jackpot?`${draw.jackpot.toLocaleString("en-US")} VND`:t("common.unavailable")}</td>{selectedGame==="power655"&&<td>{draw.jackpot2?`${draw.jackpot2.toLocaleString("en-US")} VND`:t("common.unavailable")}</td>}<td><div className="row-actions"><Button className="icon secondary" aria-label={`Edit draw ${draw.date}`} onClick={()=>startEdit(draw)}><Pencil size={14}/></Button><Button className="icon danger" aria-label={`Delete draw ${draw.date}`} onClick={()=>removeDraw(draw.id)}><Trash2 size={15}/></Button></div></td></tr>)}</tbody></table></div></Card></>;
}

export function SinglesPage() {
  const {t}=useI18n();
  const labels=useTableLabels();
  const { singles, filtered, effectiveSettings }=useAnalytics(undefined,true);
  const [query,setQuery]=useState("");
  const queryNumbers=[...new Set((query.match(/\d{1,2}/g)??[]).map(Number))];
  const visibleSingles=singles.filter(item=>!query.trim()||queryNumbers.includes(item.number));
  const minCompletedGaps=effectiveSettings.minCompletedGaps??4;
  const columns=useMemo<ColumnDef<SingleNumberStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank"),cell:info=>`#${info.getValue<number>()}`},
    {accessorKey:"number",header:t("common.number"),cell:info=><NumberBall number={info.getValue<number>()} small/>},
    {accessorKey:"totalCount",header:t("pages.occurrences")},
    {id:"rate",accessorFn:row=>row.frequencyRate*100,header:t("pages.frequencyPercent"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},
    {id:"last10",accessorFn:row=>row.rolling.last10,header:t("pages.last10")},
    {id:"last30",accessorFn:row=>row.rolling.last30,header:t("common.last30")},
    {id:"last50",accessorFn:row=>row.rolling.last50,header:t("pages.last50")},
    {accessorKey:"currentGap",header:t("pages.gap"),cell:info=>`${info.row.original.gap.gapCensored?"≥":""}${info.getValue<number>()}`},
    {accessorKey:"averageGap",header:t("pages.avgGap"),cell:info=>info.getValue<number|null>()?.toFixed(1)??"—"},
    {accessorKey:"gapRatio",header:t("pages.gapRatio"),cell:info=>info.getValue<number|null>()?.toFixed(2)??"—"},
    {id:"gapPercentile",accessorFn:row=>row.gap.gapPercentile,header:t("pages.gapPercentile"),cell:info=>info.getValue<number|null>()?.toFixed(1)??"—"},
    {id:"completedGaps",accessorFn:row=>row.gap.completedGapCount,header:t("pages.completedGaps")},
    {id:"gapScore",accessorFn:row=>row.models.gap.normalizedScore,header:()=><span title={t(effectiveSettings.gapModelVersion==="v2"?"pages.gapEngineV2":"pages.gapEngineLegacy")}>{t("pages.gapScore")}</span>,cell:info=>info.getValue<number>().toFixed(2)},
    {accessorKey:"technicalScore",header:t("pages.aggregateScore"),cell:info=><ScoreBadge score={info.getValue<number>()}/>},
    {id:"support",accessorFn:row=>row.gap.completedGapCount>=minCompletedGaps*2?"HIGH":row.gap.completedGapCount>=minCompletedGaps?"MEDIUM":"LOW",header:t("pages.dataSupport"),cell:info=>t(`confidence.${String(info.getValue()).toLowerCase()}` as TranslationKey)},
    {accessorKey:"maxGap",header:t("pages.maxGap"),cell:info=>info.getValue<number|null>()??"—"},
    {id:"inside",accessorFn:row=>row.inside?t("common.inside"):t("common.outside"),header:t("pages.io")},
    {id:"parity",accessorFn:row=>row.parity==="EVEN"?t("common.even"):t("common.odd"),header:t("pages.eo")},
    {accessorKey:"state",header:t("pages.state"),cell:info=>{const state=info.getValue<SingleNumberStats["state"]>();return <span className={`state state-${state.toLowerCase()}`}>{t(`state.${state}` as TranslationKey)}</span>;}},
  ],[t,minCompletedGaps,effectiveSettings.gapModelVersion]);
  return <><PageTitle title={t("pages.singlesTitle")} subtitle={t("pages.singlesSubtitle",{count:filtered.length})} actions={<><PeriodControl/><ScoringPresetControl/></>}/><div className="combination-search single-number-search"><div className="combination-search-controls"><label><span>{t("pages.searchNumberLabel")}</span><div className="combination-search-field"><Search size={15} aria-hidden="true"/><input type="search" inputMode="numeric" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("pages.searchNumber")} aria-describedby="single-number-search-count"/></div></label></div><span id="single-number-search-count" aria-live="polite">{t("pages.numberMatches",{count:visibleSingles.length,total:singles.length})}</span></div><DataTable data={visibleSingles} columns={columns} labels={labels} initialSorting={[{id:"rank",desc:false}]} onReset={()=>setQuery("")}/></>;
}

export function PairsPage(){
  const {t}=useI18n(); const labels=useTableLabels(); const {pairs,filtered}=useAnalytics(undefined,true);
  const columns=useMemo<ColumnDef<PairStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank")},{accessorKey:"key",header:t("common.pair")},{accessorKey:"count",header:t("common.count")},{id:"rate",accessorFn:row=>row.rate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},
  ],[t]);
  return <><PageTitle title={t("pages.pairsTitle")} subtitle={t("pages.pairsSubtitle",{count:filtered.length})} actions={<PeriodControl/>}/><DataTable data={pairs} columns={columns} labels={labels} maxRows={250}/></>;
}
export function TriplesPage(){
  const {t}=useI18n(); const labels=useTableLabels(); const {triples,filtered}=useAnalytics(undefined,true);
  const columns=useMemo<ColumnDef<TripleStats>[]>(()=>[
    {accessorKey:"rank",header:t("common.rank")},{accessorKey:"key",header:t("common.triple")},{accessorKey:"count",header:t("common.count")},{id:"rate",accessorFn:row=>row.rate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},
  ],[t]);
  return <><PageTitle title={t("pages.triplesTitle")} subtitle={t("pages.triplesSubtitle",{triples:triples.length,count:filtered.length})} actions={<PeriodControl/>}/><DataTable data={triples} columns={columns} labels={labels} maxRows={250}/></>;
}
const blankScoreRanges=():CombinationScoreRanges=>({singleScore:{min:"",max:""},pairScore:{min:"",max:""},gapScore:{min:"",max:""},structureScore:{min:"",max:""},totalScore:{min:"",max:""}});
const scoreLabels:Record<(typeof combinationScoreKeys)[number],TranslationKey>={singleScore:"pages.single",pairScore:"common.pair",gapScore:"pages.gapScore",structureScore:"prediction.structure",totalScore:"pages.totalScore"};

export function CombinationsPage(){
  const {t}=useI18n();
  const labels=useTableLabels();
  const [predictionCount,setPredictionCount]=useState<20|50>(20);
  const {predictions,candidateUniverse,filtered,draws}=useAnalytics(predictionCount);
  const {settings,independentFilterConfig,updateIndependentFilterConfig,selectedGame,powerSuggestionMode,setPowerSuggestionMode}=useLotteryStore();
  const [query,setQuery]=useState("");
  const [filterOpen,setFilterOpen]=useState(false);
  const [draftRanges,setDraftRanges]=useState(()=>independentFilterConfig.ranges);
  const [draftPreset,setDraftPreset]=useState(independentFilterConfig.preset);
  const [draftCount,setDraftCount]=useState<20|50>(independentFilterConfig.resultCount);
  const [draftSort,setDraftSort]=useState<"proposal"|"filter">(independentFilterConfig.sort);
  const [rangeError,setRangeError]=useState(false);
  const hasScoreFilters=independentFilterConfig.enabled;
  const activeRangeSummary=combinationScoreKeys.flatMap(key=>{const range=independentFilterConfig.ranges[key];return range.min!==""||range.max!==""?[`${t(scoreLabels[key])}: ${range.min||"0"}–${range.max||"100"}`]:[];}).join(" · ");
  const visiblePredictions=filterCombinationsByNumbers(predictions.slice(0,predictionCount),query);
  const filteredPortfolio=useMemo(()=>{
    if(!independentFilterConfig.enabled)return null;
    const filterSettings=settingsForPreset(settings,independentFilterConfig.preset);
    const {maxNumber,insideNumbers}=LOTTERY_GAMES[selectedGame];
    const singles=calculateSingles(filtered,filterSettings,maxNumber,insideNumbers);
    const pairs=calculatePairs(filtered,maxNumber,insideNumbers);
    const triples=calculateTriples(filtered,maxNumber,insideNumbers);
    const scores=scoreCandidateCombinations(candidateUniverse.map(item=>item.numbers),singles,pairs,triples,filterSettings,filtered,insideNumbers,draws);
    return selectFilteredPortfolio(candidateUniverse,scores,predictions,independentFilterConfig.ranges,filterSettings,independentFilterConfig.resultCount,independentFilterConfig.sort);
  },[independentFilterConfig,settings,selectedGame,filtered,draws,candidateUniverse,predictions]);
  const applyRanges=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!validCombinationScoreRanges(draftRanges)){setRangeError(true);return;}updateIndependentFilterConfig({enabled:true,preset:draftPreset,ranges:draftRanges,resultCount:draftCount,sort:draftSort});setRangeError(false);setFilterOpen(false);};
  const clearRanges=()=>{const ranges=blankScoreRanges();setDraftRanges(ranges);updateIndependentFilterConfig({enabled:false,ranges});setRangeError(false);};
  const columns=useMemo<ColumnDef<CandidateCombination>[]>(()=>[
    {accessorKey:"rank",header:t("pages.mainRank")},{id:"combination",accessorFn:row=>row.numbers.map(pad).join(" - "),header:t("common.combination")},{accessorKey:"total",header:t("pages.sum")},{accessorKey:"digitalRoot",header:t("pages.root")},{id:"evenOdd",accessorFn:row=>`${row.evenCount}/${row.oddCount}`,header:t("common.evenOdd")},{id:"insideOutside",accessorFn:row=>`${row.insideCount}/${row.outsideCount}`,header:t("common.insideOutside")},{accessorKey:"singleScore",header:t("pages.single"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"pairScore",header:t("common.pair"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"gapScore",header:t("pages.gapScore"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"structureScore",header:t("prediction.structure"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"totalScore",header:t("pages.proposalScore"),cell:info=>info.getValue<number>().toFixed(2)},
    ...(selectedGame==="power655"&&powerSuggestionMode==="experimental"?[{id:"selectionReason",accessorFn:(row:CandidateCombination)=>row.selectionReason==="coverage"?t("pages.reasonCoverage"):t("pages.reasonScore"),header:t("pages.selectionReason")},{id:"selectionScore",accessorFn:(row:CandidateCombination)=>row.selectionScore??null,header:t("pages.selectionScore"),cell:(info:{getValue:()=>unknown})=>info.getValue()===null?"—":Number(info.getValue()).toFixed(2)}]:[]),
    {accessorKey:"maxHistoricalOverlap",header:t("prediction.maxOverlap"),cell:info=>`${info.getValue<number>()}/${LOTTERY_GAMES[selectedGame].drawSize}`},{accessorKey:"dataSupport",header:t("pages.dataSupport"),cell:info=>t(`confidence.${String(info.getValue()).toLowerCase()}` as TranslationKey)},
  ],[t,selectedGame,powerSuggestionMode]);
  const filteredColumns=useMemo<ColumnDef<NonNullable<typeof filteredPortfolio>["rows"][number]>[]>(()=>[
    {accessorKey:"filteredRank",header:t("common.rank")},{accessorKey:"mainRank",header:t("pages.mainRank"),cell:info=>info.getValue<number|null>()??t("pages.outsideMain")},{id:"candidateRank",accessorFn:row=>row.proposal.candidateRank??"",header:t("pages.candidateRank")},{id:"combination",accessorFn:row=>row.proposal.numbers.map(pad).join(" - "),header:t("common.combination")},{id:"proposalScore",accessorFn:row=>row.proposal.totalScore,header:t("pages.proposalScore"),cell:info=>info.getValue<number>().toFixed(2)},
    ...combinationScoreKeys.map(key=>({id:key,accessorFn:(row:NonNullable<typeof filteredPortfolio>["rows"][number])=>row.filter[key],header:t(scoreLabels[key]),cell:(info:{getValue:()=>unknown})=>Number(info.getValue()).toFixed(2)})),
  ],[t]);
  return <>
    <PageTitle title={t("pages.combinationsTitle")} subtitle={t("pages.combinationsSubtitle")} actions={<><PeriodControl/><ScoringPresetControl/>{selectedGame==="power655"&&<label className="page-preset-control"><span>{t("pages.selectionMethod")}</span><Select value={powerSuggestionMode} onChange={event=>setPowerSuggestionMode(event.target.value as "standard"|"experimental")}><option value="standard">{t("pages.methodStandard")}</option><option value="experimental">{t("pages.methodPowerExperimental")}</option></Select></label>}<label className="page-preset-control"><span>{t("dashboard.predictionCount")}</span><Select value={predictionCount} onChange={event=>setPredictionCount(Number(event.target.value) as 20|50)}><option value={20}>Top 20</option><option value={50}>Top 50</option></Select></label></>}/>
    <Card className="notice">{t("pages.combinationsNotice")}</Card><p className="disclaimer"><Info size={14}/>{t("pages.technicalScoreDisclaimer")}</p>
    {selectedGame==="power655"&&powerSuggestionMode==="experimental"&&<p className="disclaimer"><Info size={14}/>{t("pages.selectionScoreHelp")}</p>}
    <div className="combination-search"><div className="combination-search-controls"><label><span>{t("pages.searchCombinationLabel")}</span><div className="combination-search-field"><Search size={15} aria-hidden="true"/><input type="search" inputMode="numeric" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("pages.searchCombination")} aria-describedby="combination-search-count"/></div></label><Button type="button" className={`secondary combination-filter-toggle${hasScoreFilters?" active":""}`} aria-expanded={filterOpen} aria-controls="combination-score-filters" onClick={()=>{if(!filterOpen){setDraftRanges(independentFilterConfig.ranges);setDraftPreset(independentFilterConfig.preset);setDraftCount(independentFilterConfig.resultCount);setDraftSort(independentFilterConfig.sort);setRangeError(false);}setFilterOpen(!filterOpen);}}><SlidersHorizontal size={16}/>{t("pages.customFilters")}</Button></div><span id="combination-search-count" aria-live="polite">{t("pages.combinationMatches",{count:visiblePredictions.length,total:Math.min(predictions.length,predictionCount)})}</span></div>
    {filterOpen&&<form id="combination-score-filters" className="combination-score-filters" onSubmit={applyRanges} noValidate><div className="combination-score-grid"><label>{t("dashboard.scoringPreset")}<Select value={draftPreset} onChange={event=>setDraftPreset(event.target.value)}>{["Default","Balanced","Hot","Legacy Gap","Gap + Frequency","Pair","Custom"].map(preset=><option key={preset} value={preset}>{t(({"Legacy Gap":"preset.legacyGap","Gap + Frequency":"preset.gapFrequency"} as Record<string,TranslationKey>)[preset]??(`preset.${preset.toLowerCase()}` as TranslationKey))}</option>)}</Select></label><label>{t("dashboard.predictionCount")}<Select value={draftCount} onChange={event=>setDraftCount(Number(event.target.value) as 20|50)}><option value={20}>Top 20</option><option value={50}>Top 50</option></Select></label><label>{t("pages.filterSort")}<Select value={draftSort} onChange={event=>setDraftSort(event.target.value as "proposal"|"filter")}><option value="proposal">{t("pages.sortProposal")}</option><option value="filter">{t("pages.sortFilter")}</option></Select></label>{combinationScoreKeys.map(key=><fieldset key={key}><legend>{t(scoreLabels[key])}</legend><label>{t("pages.scoreMinimum")}<input type="number" min="0" max="100" step="any" value={draftRanges[key].min} onChange={event=>{setDraftRanges(current=>({...current,[key]:{...current[key],min:event.target.value}}));setRangeError(false);}}/></label><label>{t("pages.scoreMaximum")}<input type="number" min="0" max="100" step="any" value={draftRanges[key].max} onChange={event=>{setDraftRanges(current=>({...current,[key]:{...current[key],max:event.target.value}}));setRangeError(false);}}/></label></fieldset>)}</div>{rangeError&&<p className="combination-filter-error" role="alert">{t("pages.invalidScoreRange")}</p>}<div className="combination-filter-actions"><Button type="button" className="secondary" onClick={clearRanges}>{t("pages.clearScoreFilters")}</Button><Button type="submit">{t("pages.applyScoreFilters")}</Button></div></form>}
    <DataTable data={visiblePredictions} columns={columns} labels={labels} onReset={()=>setQuery("")}/>
    {selectedGame==="power655"&&powerSuggestionMode==="experimental"&&predictions.length<predictionCount&&<Card className="notice" role="status">{t("pages.portfolioShortfall",{count:predictions.length,requested:predictionCount,overlap:settings.maxCombinationOverlap})}</Card>}
    {filteredPortfolio&&<Card><CardHeader title={t("pages.filteredResults")} subtitle={`${t("pages.filteredCount",{count:filteredPortfolio.rows.length,total:filteredPortfolio.passing})} · ${independentFilterConfig.preset}${activeRangeSummary?` · ${activeRangeSummary}`:""}`}/><DataTable data={filteredPortfolio.rows} columns={filteredColumns} labels={labels} onReset={clearRanges}/></Card>}
  </>;
}
export function BacktestPage(){
  const {t}=useI18n();
  const labels=useTableLabels();
  const {draws:megaDraws,powerDraws,lottoDraws,selectedGame,settings,powerSuggestionMode,setPowerSuggestionMode}=useLotteryStore();
  const draws=selectedGame==="mega645"?megaDraws:selectedGame==="power655"?powerDraws:lottoDraws;
  const {maxNumber,drawSize,insideNumbers}=LOTTERY_GAMES[selectedGame];
  const defaultRange=()=>({from:draws.at(-51)?.date??draws[0]?.date??"",to:draws.at(-1)?.date??""});
  const initial=defaultRange();
  const [fromDate,setFromDate]=useState(initial.from);
  const [toDate,setToDate]=useState(initial.to);
  const [trainingDraws,setTrainingDraws]=useState(50);
  const [preset,setPreset]=useState("Balanced");
  const [predictionCount,setPredictionCount]=useState(5);
  const [manualInput,setManualInput]=useState("");
  const [manualError,setManualError]=useState(false);
  const [resultCount,setResultCount]=useState(5);
  const [data,setData]=useState<BacktestPayload|null>(null);
  const [running,setRunning]=useState(false);
  const [failed,setFailed]=useState(false);
  const [portfolioData,setPortfolioData]=useState<PortfolioRollingResult|null>(null);
  const [portfolioRunning,setPortfolioRunning]=useState(false);
  const [portfolioFailed,setPortfolioFailed]=useState(false);
  const workerRef=useRef<Worker|null>(null);
  const portfolioWorkerRef=useRef<Worker|null>(null);
  const lastManualSetsRef=useRef<number[][]|undefined>(undefined);
  useEffect(()=>{const next=defaultRange();setFromDate(next.from);setToDate(next.to);setData(null);setFailed(false);lastManualSetsRef.current=undefined;},[selectedGame]);
  useEffect(()=>()=>{workerRef.current?.terminate();portfolioWorkerRef.current?.terminate();},[]);
  useEffect(()=>{portfolioWorkerRef.current?.terminate();setPortfolioData(null);setPortfolioRunning(false);setPortfolioFailed(false);},[draws,settings,selectedGame,fromDate,toDate,trainingDraws,preset,predictionCount,powerSuggestionMode]);
  const presets:[string,TranslationKey][]=[["Default","preset.default"],["Balanced","preset.balanced"],["Hot","preset.hot"],["Legacy Gap","preset.legacyGap"],["Gap + Frequency","preset.gapFrequency"],["Pair","preset.pair"],["Triple","preset.triple"],["Custom","preset.custom"]];
  const parsedManual=useMemo(()=>parseCompactCombinations(manualInput,maxNumber,drawSize),[manualInput,maxNumber,drawSize]);
  const trainingAvailability=useMemo(()=>getBacktestTrainingWindows(draws,fromDate,toDate),[draws,fromDate,toDate]);
  const fullMode=trainingAvailability.windows.includes(trainingDraws);
  useEffect(()=>{if(!trainingAvailability.windows.includes(trainingDraws))setTrainingDraws(trainingAvailability.windows[0]??30);},[trainingAvailability,trainingDraws]);
  const run=(override:{preset?:string;predictionCount?:number;trainingDraws?:number;manualProposedSets?:number[][]|null}={})=>{
    const activeTrainingDraws=override.trainingDraws??trainingDraws;
    if(!fromDate||!toDate||fromDate>toDate||!trainingAvailability.windows.includes(activeTrainingDraws)){setFailed(true);setData(null);return;}
    workerRef.current?.terminate();
    setRunning(true);setFailed(false);setData(null);
    const activePreset=override.preset??preset;
    const activePredictionCount=override.predictionCount??predictionCount;
    const activeManualSets=override.manualProposedSets===null?undefined:override.manualProposedSets??lastManualSetsRef.current;
    lastManualSetsRef.current=activeManualSets;
    setResultCount(activeManualSets?.length??activePredictionCount);
    const effectiveSettings=settingsForPreset(settings,activePreset);
    const cacheKey=JSON.stringify([selectedGame,draws.map(draw=>[draw.id,draw.date,draw.numbers]),effectiveSettings,fromDate,toDate,activeTrainingDraws,activePredictionCount,activeManualSets,powerSuggestionMode]);
    const cached=backtestCache.get(cacheKey);
    if(cached){setData(cached);setRunning(false);return;}
    const worker=new Worker(new URL("../backtest.worker.ts",import.meta.url),{type:"module"});
    workerRef.current=worker;
    worker.onmessage=({data:payload}:MessageEvent<BacktestPayload>)=>{backtestCache.set(cacheKey,payload);setData(payload);setRunning(false);worker.terminate();workerRef.current=null;};
    worker.onerror=()=>{setFailed(true);setRunning(false);worker.terminate();workerRef.current=null;};
    worker.postMessage({draws,settings:effectiveSettings,maxNumber,drawSize,insideNumbers,fromDate,toDate,trainingDraws:activeTrainingDraws,predictionCount:activePredictionCount,manualProposedSets:activeManualSets,powerSuggestionMode});
  };
  const runManual=()=>{if(!parsedManual.valid||!fullMode){setManualError(true);return;}setManualError(false);run({manualProposedSets:parsedManual.combinations});};
  const runPortfolio=()=>{
    if(!fromDate||!toDate||fromDate>toDate)return;
    portfolioWorkerRef.current?.terminate();setPortfolioData(null);setPortfolioRunning(true);setPortfolioFailed(false);
    const worker=new Worker(new URL("../backtest.worker.ts",import.meta.url),{type:"module"});portfolioWorkerRef.current=worker;
    worker.onmessage=({data:payload}:MessageEvent<{portfolioRolling:PortfolioRollingResult}>)=>{setPortfolioData(payload.portfolioRolling);setPortfolioRunning(false);worker.terminate();portfolioWorkerRef.current=null;};
    worker.onerror=()=>{setPortfolioFailed(true);setPortfolioRunning(false);worker.terminate();portfolioWorkerRef.current=null;};
    worker.postMessage({draws,settings:settingsForPreset(settings,preset),maxNumber,drawSize,insideNumbers,fromDate,toDate,trainingDraws,predictionCount,portfolioRolling:true,powerSuggestionMode});
  };
  const tableRows=useMemo<BacktestTableRow[]>(()=>data?.result.rows.flatMap(row=>row.predictions.map((prediction,index)=>({rank:index+1,combination:prediction.numbers.map(pad).join("-"),rate:prediction.rate,sum:prediction.total,root:prediction.digitalRoot,insideOutside:`${prediction.insideCount}/${prediction.outsideCount}`,evenOdd:`${prediction.evenCount}/${prediction.oddCount}`,single:prediction.singleScore,pair:prediction.pairScore,triple:prediction.tripleScore,structure:prediction.structureScore,totalScore:prediction.totalScore,matches:prediction.matches,actual:row.actual,evaluation:t(prediction.matches>=3?"pages.goodResult":"pages.referenceOnly")})))??[],[data,t]);
  const resultColumns=useMemo<ColumnDef<BacktestTableRow>[]>(()=>[
    {accessorKey:"combination",header:t("pages.proposedSets",{count:resultCount}),cell:info=><span className="backtest-combination"><b>#{info.row.original.rank}</b>{info.getValue<string>()}</span>},
    {id:"rate",accessorFn:row=>row.rate*100,header:t("pages.rate"),cell:info=>`${info.getValue<number>().toFixed(2)}%`},{accessorKey:"sum",header:t("pages.sum")},{accessorKey:"root",header:t("pages.root")},
    {accessorKey:"evenOdd",header:t("common.evenOdd")},{accessorKey:"insideOutside",header:t("common.insideOutside")},
    {accessorKey:"single",header:t("pages.single"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"pair",header:t("common.pair"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"triple",header:t("common.triple"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"structure",header:t("prediction.structure"),cell:info=>info.getValue<number>().toFixed(2)},{accessorKey:"totalScore",header:t("pages.totalScore"),cell:info=>info.getValue<number>().toFixed(2)},
    {accessorKey:"matches",header:t("pages.matchCount"),cell:info=><strong className="backtest-match">{info.getValue<number>()}/{drawSize}</strong>},
    {id:"actual",accessorFn:row=>row.actual.map(pad).join("-"),header:t("pages.actualResult"),cell:info=><div className="backtest-actual">{info.row.original.actual.map((number,index)=><NumberBall key={number} number={number} index={index} small/>)}</div>},
    {accessorKey:"evaluation",header:t("pages.evaluation"),cell:info=><span className={`backtest-grade grade-${Math.min(info.row.original.matches,3)}`}>{info.getValue<string>()}</span>},
  ],[resultCount,t,drawSize]);
  return <div className="backtest-page">
    <PageTitle title={t("pages.backtestTitle")} subtitle={t("pages.backtestSubtitle")}/>
    <Card className="backtest-setup">
      <CardHeader title={t("pages.backtestSetup")} action={<Settings2 size={17} aria-hidden="true"/>}/>
      <div className="backtest-controls">
        <fieldset className="backtest-dates"><legend><CalendarDays size={14}/>{t("pages.testDateRange")}</legend><label><span>{t("pages.fromDate")}</span><input type="date" min={draws[0]?.date} max={toDate||draws.at(-1)?.date} value={fromDate} onChange={event=>{setFromDate(event.target.value);setData(null);setFailed(false);}}/></label><label><span>{t("pages.toDate")}</span><input type="date" min={fromDate||draws[0]?.date} max={draws.at(-1)?.date} value={toDate} onChange={event=>{setToDate(event.target.value);setData(null);setFailed(false);}}/></label></fieldset>
        <label className="backtest-field"><span>{t("pages.trainingWindow")}</span><Select value={trainingDraws} disabled={!trainingAvailability.windows.length} onChange={event=>{const next=Number(event.target.value);setTrainingDraws(next);if(data||running)run({trainingDraws:next});}}>{[30,50,100].map(count=><option value={count} disabled={!trainingAvailability.windows.includes(count)} key={count}>{t("pages.previousDraws",{count})}</option>)}</Select></label>
        <label className="backtest-field"><span>{t("dashboard.scoringPreset")}</span><Select value={preset} onChange={event=>{const next=event.target.value;setPreset(next);if(data||running)run({preset:next});}}>{presets.map(([value,key])=><option value={value} key={value}>{t(key)}</option>)}</Select></label>
        <label className="backtest-field"><span>{t("dashboard.predictionCount")}</span><Select value={predictionCount} onChange={event=>{const next=Number(event.target.value);setPredictionCount(next);if(data||running)run({predictionCount:next});}}>{[5,10,20].map(count=><option value={count} key={count}>Top {count}</option>)}</Select></label>
        {selectedGame==="power655"&&<label className="backtest-field"><span>{t("pages.selectionMethod")}</span><Select value={powerSuggestionMode} onChange={event=>{workerRef.current?.terminate();setRunning(false);setData(null);setPowerSuggestionMode(event.target.value as "standard"|"experimental");}}><option value="standard">{t("pages.methodStandard")}</option><option value="experimental">{t("pages.methodPowerExperimental")}</option></Select></label>}
      </div>
      <div className="backtest-note"><Info size={15}/><span>{t("pages.backtestNote")}</span></div>
      <div className={`backtest-mode ${fullMode?"ready":"invalid"}`} role={fullMode?"status":"alert"}>{fullMode?t("pages.fullModeReady",{count:trainingAvailability.priorDraws}):t("pages.trainingRangeError",{count:trainingAvailability.priorDraws})}</div>
      <div className="manual-test"><label><span>{t("pages.manualInput")}</span><input value={manualInput} onChange={event=>{setManualInput(event.target.value);setManualError(false);}} className={manualError?"invalid":""} aria-invalid={manualError} aria-describedby="manual-test-help" placeholder={drawSize===5?"0308122224":"101436374143"}/></label><Button className="secondary" onClick={runManual} disabled={running||!fullMode}><Play size={15}/>{t("pages.runTest")}</Button><small id="manual-test-help">{t(drawSize===5?"pages.manualInputHintLotto":"pages.manualInputHint")}</small>{manualError&&<><div className="manual-invalid-values">{parsedManual.entries.map((entry,entryIndex)=>{const compact=entry.replace(/[\s-]+/g,"");return new RegExp(`^\\d{${drawSize*2}}$`).test(compact)?<span className="manual-entry" key={`${entry}-${entryIndex}`}>{(compact.match(/\d{2}/g)??[]).map((chunk,chunkIndex)=><b className={parsedManual.issues.some(issue=>issue.entryIndex===entryIndex&&(issue.chunkIndex===chunkIndex||issue.chunkIndex===undefined))?"invalid":""} key={chunkIndex}>{chunk}</b>)}</span>:<b className="invalid" key={`${entry}-${entryIndex}`}>{entry}</b>;})}</div><p className="manual-error" role="alert">{!parsedManual.valid?t(drawSize===5?"pages.manualInputErrorLotto":"pages.manualInputError",{max:maxNumber}):t("pages.manualInputRangeError")}</p></>}</div>
      <Button onClick={()=>run({manualProposedSets:null})} disabled={running||!fullMode}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={15}/>} {running?t("pages.backtestLoading"):t("pages.runBacktest")}</Button>
      <Button className="secondary" onClick={runPortfolio} disabled={portfolioRunning||!fromDate||!toDate||fromDate>toDate}>{portfolioRunning?<LoaderCircle className="spin" size={15}/>:<Play size={15}/>} {t("pages.runRollingPortfolio")}</Button>
    </Card>
    {portfolioRunning&&<Card role="status">{t("pages.rollingLoading")}</Card>}
    {portfolioFailed&&<Card role="alert">{t("pages.backtestError")}</Card>}
    {portfolioData&&<Card><CardHeader title={t("pages.rollingPortfolioResults")} subtitle={t("pages.rollingPortfolioScope",{evaluated:portfolioData.evaluatedTargetCount,skipped:portfolioData.skippedTrainingCount,window:portfolioData.trainingWindow,tickets:portfolioData.requestedTicketCount})}/><div className="kpi-grid backtest-kpis">{([3,4,5,6] as const).filter(threshold=>threshold<=drawSize).map(threshold=>{const key=threshold===6?"six":`atLeast${threshold}` as "atLeast3"|"atLeast4"|"atLeast5";return <Card key={threshold}><span>≥{threshold}/{drawSize}</span><b>{(portfolioData.hitRates[key]*100).toFixed(1)}%</b><small>95% CI {(portfolioData.confidence95[key][0]*100).toFixed(1)}–{(portfolioData.confidence95[key][1]*100).toFixed(1)}%</small></Card>;})}</div><p>{t("pages.rollingTicketCount",{min:portfolioData.minimumTicketCount,mean:portfolioData.meanTicketCount.toFixed(1),requested:portfolioData.requestedTicketCount})}</p></Card>}
    {failed&&<Card className="backtest-loading" role="alert">{t("pages.backtestError")}</Card>}
    {!data&&!failed&&!running&&<Card className="backtest-loading">{t("pages.backtestReady")}</Card>}
    {running&&<Card className="backtest-loading" role="status"><LoaderCircle className="spin" size={18}/>{t("pages.backtestLoading")}</Card>}
    {data&&<>
      <div className="kpi-grid backtest-kpis"><Card><span>{t("pages.tests")}</span><b>{data.result.tests}</b></Card><Card><span>{t("pages.averageMatches")}</span><b>{data.result.average.toFixed(2)}/{drawSize}</b></Card><Card><span>{t("pages.bestMatch")}</span><b>{data.result.best}/{drawSize}</b></Card>{!data.manualMode&&<Card><span>{t("pages.modelHitRate")}</span><b>{(data.rolling.modelTop10HitRate*100).toFixed(1)}%</b></Card>}</div>
      <section className="backtest-results" aria-labelledby="backtest-results-title"><div className="backtest-results-heading"><div><h2 id="backtest-results-title">{t("pages.backtestResults")}</h2><p>{t("pages.backtestResultsSubtitle")}</p></div></div><DataTable data={tableRows} columns={resultColumns} labels={labels} hideRowCount/></section>
      <p className="disclaimer"><Info size={14}/>{t("pages.backtestDisclaimer")}</p>
    </>}
  </div>;
}
export function SettingsPage(){
  const {settings,updateSettings,resetSettings,selectedGame}=useLotteryStore();
  const {drawSize,maxNumber}=LOTTERY_GAMES[selectedGame];
  const maxTotal=drawSize*maxNumber-drawSize*(drawSize-1)/2;
  const [invalidTotal,setInvalidTotal]=useState(false);
  useEffect(()=>setInvalidTotal(false),[selectedGame]);
  const {t}=useI18n();
  const consensusLabels={frequency:"settings.frequency",momentum:"settings.momentum",gap:"settings.gap",association:"settings.association"} as const;
  const singleLabels={frequency:"settings.frequency",zScore:"settings.zScore",momentum:"settings.momentum",gap:"settings.gap"} as const;
  const combinationLabels={single:"pages.single",pair:"settings.pair",gap:"pages.gapScore",structure:"settings.structure",novelty:"settings.novelty"} as const;
  return <><PageTitle title={t("settings.title")} subtitle={t("settings.subtitle")}/><div className="settings-grid"><Card><CardHeader title={t("settings.candidateGeneration")}/><label>{t("settings.candidatePoolSize")}<input type="number" min="6" max="18" value={settings.candidatePoolSize} onChange={e=>updateSettings({candidatePoolSize:Number(e.target.value)})}/></label><label>{t("settings.minimumTotal")}<input type="number" min="0" max={maxTotal} value={settings.minTotal} aria-describedby="settings-total-limit" onChange={e=>{const value=Number(e.target.value);setInvalidTotal(value>maxTotal);if(value<=maxTotal)updateSettings({minTotal:value});}}/></label><small id="settings-total-limit" role={invalidTotal||settings.minTotal>maxTotal?"alert":undefined}>{t("settings.totalLimit",{max:maxTotal})}</small><label>{t("settings.maximumOverlap")}<input type="number" min="0" max="5" value={settings.maxCombinationOverlap} onChange={e=>updateSettings({maxCombinationOverlap:Number(e.target.value)})}/></label><label>{t("settings.suggestedParity")}<output>{settings.allowedParity.join(", ")}</output></label></Card><Card><CardHeader title={t("settings.modelSupport")}/><label>{t("settings.weightedFrequencyHalfLife")}<input type="number" min="1" value={settings.weightedFrequencyHalfLife} onChange={e=>updateSettings({weightedFrequencyHalfLife:Number(e.target.value)})}/></label><label>{t("settings.minimumPairSupport")}<input type="number" min="1" value={settings.minPairSupport} onChange={e=>updateSettings({minPairSupport:Number(e.target.value)})}/></label><label>{t("settings.completedGapMinimum")}<input type="number" min="1" value={settings.minCompletedGaps??4} onChange={e=>updateSettings({minCompletedGaps:Number(e.target.value)})}/></label><label>{t("settings.backtestTrainingDraws")}<input type="number" min="10" value={settings.backtestMinTrainingDraws} onChange={e=>updateSettings({backtestMinTrainingDraws:Number(e.target.value)})}/></label></Card><Card><CardHeader title={t("settings.singleScoreWeights")}/>{Object.entries(settings.singleScoreWeights).map(([key,value])=><label key={key}>{t(singleLabels[key as keyof typeof singleLabels])}<input type="number" min="0" value={value} onChange={e=>updateSettings({singleScoreWeights:{...settings.singleScoreWeights,[key]:Number(e.target.value)}})}/></label>)}</Card><Card><CardHeader title={t("settings.consensusWeights")}/>{Object.entries(settings.consensusWeights).map(([key,value])=><label key={key}>{t(consensusLabels[key as keyof typeof consensusLabels])}<input type="number" min="0" value={value} onChange={e=>updateSettings({consensusWeights:{...settings.consensusWeights,[key]:Number(e.target.value)}})}/></label>)}</Card><Card><CardHeader title={t("settings.combinationWeights")}/>{Object.entries(settings.comboWeightsV2).map(([key,value])=><label key={key}>{t(combinationLabels[key as keyof typeof combinationLabels])}<input type="number" min="0" value={value} onChange={e=>updateSettings({comboWeightsV2:{...settings.comboWeightsV2,[key]:Number(e.target.value)}})}/></label>)}</Card></div><Button className="secondary settings-reset" onClick={resetSettings}><RotateCcw size={15}/>{t("settings.restoreDefaults")}</Button></>;
}
