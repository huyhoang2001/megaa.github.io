import { useMemo,useState } from "react";
import { Clipboard,Download,ListFilter,RotateCcw,Search,Sparkles } from "lucide-react";
import { Button,Card,CardHeader } from "../ui";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import { filterTicketResultsByNumber,filterTickets,parseTicketInput,ticketResultsToCsv } from "../ticketFilter";
import type { TicketFilterResult } from "../ticketFilter";

const EXAMPLE="110294,890504,291160,223907,607658,021855,653805,971108,020304,426012,abc123";
type ResultTab="accepted"|"rejected"|"all";
const dash="—";
const tail=(result:TicketFilterResult)=>result.tail===undefined?dash:String(result.tail).padStart(2,"0");
const split=(result:TicketFilterResult)=>result.parts?result.parts.map(value=>String(value).padStart(2,"0")).join("+"):dash;

export default function TicketFilterPage(){
  const {t}=useI18n();
  const [input,setInput]=useState("");
  const [result,setResult]=useState<ReturnType<typeof filterTickets>|null>(null);
  const [tab,setTab]=useState<ResultTab>("accepted");
  const [outputQuery,setOutputQuery]=useState("");
  const [copied,setCopied]=useState<string|null>(null);
  const detected=useMemo(()=>parseTicketInput(input).length,[input]);
  const acceptedMatches=useMemo(()=>filterTicketResultsByNumber(result?.accepted??[],outputQuery),[result,outputQuery]);
  const rejectedMatches=useMemo(()=>filterTicketResultsByNumber(result?.rejected??[],outputQuery),[result,outputQuery]);
  const rows=useMemo(()=>tab==="accepted"?acceptedMatches:tab==="rejected"?rejectedMatches:[...acceptedMatches,...rejectedMatches].sort((a,b)=>a.inputIndex-b.inputIndex),[acceptedMatches,rejectedMatches,tab]);
  const run=()=>{setResult(filterTickets(input));setTab("accepted");setOutputQuery("");};
  const clear=()=>{setInput("");setResult(null);setOutputQuery("");setCopied(null);};
  const copy=async(kind:"accepted"|"detailed")=>{if(!acceptedMatches.length)return;const text=kind==="accepted"?acceptedMatches.map(item=>item.code).join(","):acceptedMatches.map(item=>`${item.rank}. ${item.code} | ${tail(item)} | ${split(item)} | ${item.pairSum} | ${item.digitalRoot} | ${item.parity}`).join("\n");await navigator.clipboard.writeText(text);setCopied(kind);window.setTimeout(()=>setCopied(null),1600);};
  const exportCsv=()=>{if(!acceptedMatches.length)return;const blob=new Blob([ticketResultsToCsv(acceptedMatches)],{type:"text/csv;charset=utf-8"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="ticket-filter-accepted.csv";link.click();URL.revokeObjectURL(link.href);};
  const reason=(item:TicketFilterResult)=>item.rejectReasons.length?t(`ticket.reason.${item.rejectReasons[0]}` as TranslationKey):dash;
  return <div className="ticket-page">
    <div className="page-title"><div><h1>{t("ticket.title")}</h1><p>{t("ticket.subtitle")}</p></div></div>
    <div className="ticket-workspace">
      <Card className="ticket-input-card"><CardHeader title={t("ticket.input")} subtitle={t("ticket.inputHint")}/><div className="ticket-input-body"><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder={t("ticket.placeholder")} spellCheck={false}/><div className="ticket-detected">{t("ticket.detected",{count:detected})}</div><div className="ticket-actions"><Button onClick={run} disabled={!detected}><ListFilter size={15}/>{t("ticket.filter")}</Button><Button className="secondary" onClick={clear}><RotateCcw size={15}/>{t("ticket.clear")}</Button><Button className="secondary" onClick={()=>setInput(EXAMPLE)}><Sparkles size={15}/>{t("ticket.pasteExample")}</Button></div><div className="ticket-rule-note">{t("ticket.rules")}</div></div></Card>
      <Card className="ticket-output-card"><CardHeader title={t("ticket.output")} action={result&&<div className="ticket-export-actions"><Button className="secondary" disabled={!acceptedMatches.length} onClick={()=>copy("accepted")}><Clipboard size={14}/>{copied==="accepted"?t("ticket.copied"):t("ticket.copyAccepted")}</Button><Button className="secondary" disabled={!acceptedMatches.length} onClick={()=>copy("detailed")}><Clipboard size={14}/>{copied==="detailed"?t("ticket.copied"):t("ticket.copyDetailed")}</Button><Button className="secondary" disabled={!acceptedMatches.length} onClick={exportCsv}><Download size={14}/>{t("ticket.exportCsv")}</Button></div>}/>{result&&<div className="ticket-output-search"><label className="ticket-search-field"><Search size={16} aria-hidden="true"/><input type="search" inputMode="numeric" maxLength={6} value={outputQuery} onChange={event=>setOutputQuery(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder={t("ticket.searchPlaceholder")} aria-label={t("ticket.searchOutput")}/></label><span>{t("ticket.searchMatches",{count:rows.length})}</span></div>}<div className="ticket-tabs" role="tablist">{(["accepted","rejected","all"] as const).map(value=><button key={value} role="tab" aria-selected={tab===value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{t(`ticket.${value}` as TranslationKey)}{result&&<span>{value==="accepted"?acceptedMatches.length:value==="rejected"?rejectedMatches.length:acceptedMatches.length+rejectedMatches.length}</span>}</button>)}</div><div className="ticket-table-wrap">{!result?<div className="ticket-empty">{t("ticket.noResults")}</div>:!rows.length?<div className="ticket-empty">{t("ticket.noMatches")}</div>:<table className="ticket-table"><thead><tr>{tab==="accepted"&&<th>{t("common.rank")}</th>}<th>{t("ticket.ticket")}</th><th>{t("ticket.tail")}</th><th>{t("ticket.split")}</th><th>{t("ticket.sum")}</th><th>{t("ticket.root")}</th><th>{t("ticket.parity")}</th><th>{t("ticket.status")}</th>{tab!=="accepted"&&<th>{t("ticket.reason")}</th>}</tr></thead><tbody>{rows.map(item=><tr key={`${item.inputIndex}-${item.code}`}><>{tab==="accepted"&&<td>#{item.rank}</td>}</><td className="ticket-code">{item.code}</td><td>{tail(item)}</td><td>{split(item)}</td><td>{item.pairSum??dash}</td><td>{item.digitalRoot??dash}</td><td>{item.parity??dash}</td><td><span className={`ticket-status ${item.accepted?"pass":"reject"}`}>{item.accepted?t("ticket.pass"):t("ticket.reject")}</span></td>{tab!=="accepted"&&<td>{reason(item)}</td>}</tr>)}</tbody></table>}</div></Card>
    </div>
    {result&&<><section className="ticket-summary">{[["ticket.summaryInput",result.summary.input],["ticket.summaryAccepted",result.summary.accepted],["ticket.summaryRejected",result.summary.rejected],["ticket.summaryTailFailed",result.summary.tailFailed],["ticket.summaryErrors",result.summary.errors],["ticket.summaryDuplicates",result.summary.duplicates]].map(([key,value])=><Card key={String(key)}><span>{t(key as TranslationKey)}</span><b>{value}</b></Card>)}</section><Card className="ticket-log"><CardHeader title={t("ticket.processLog")}/><div className="ticket-log-list">{result.logs.map((log,index)=><div key={index} className={`log-${log.level.toLowerCase()}`}><b>[{log.level}]</b><span>{log.message}</span></div>)}</div></Card></>}
  </div>;
}
