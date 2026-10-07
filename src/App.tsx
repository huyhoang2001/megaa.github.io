import { useEffect, useState } from "react";
import { BarChart3, ChartNoAxesCombined, ChevronLeft, ChevronRight, Clock3, History, Menu, Monitor, Moon, Network, Settings, Sparkles, Sun, Target, TicketCheck, X } from "lucide-react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Mascot } from "page-mascot";
import Dashboard from "./pages/Dashboard";
import { BacktestPage, CombinationsPage, HistoryPage, PairsPage, SettingsPage, SinglesPage, TriplesPage } from "./pages/Pages";
import { useLotteryStore } from "./store";
import { useI18n } from "./i18n";
import type { TranslationKey } from "./i18n";
import TicketFilterPage from "./pages/TicketFilterPage";
import { LOTTERY_GAMES } from "./domain";

const nav = [
  ["/", "nav.dashboard", BarChart3],
  ["/history", "nav.history", History],
  ["/singles", "nav.singles", Target],
  ["/pairs", "nav.pairs", Network],
  ["/triples", "nav.triples", ChartNoAxesCombined],
  ["/analysis", "nav.analysis", Sparkles],
  ["/combinations", "nav.combinations", Sparkles],
  ["/ticket-filter", "nav.ticketFilter", TicketCheck],
  ["/backtest", "nav.backtest", Clock3],
  ["/settings", "nav.settings", Settings],
] as const;

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: { collapsed:boolean;setCollapsed:(v:boolean)=>void;mobileOpen:boolean;setMobileOpen:(v:boolean)=>void }) {
  const {t}=useI18n();
  const selectedGame=useLotteryStore(state=>state.selectedGame);
  const game=LOTTERY_GAMES[selectedGame];
  const asset=(name:string)=>`${import.meta.env.BASE_URL}${name}`;
  return <aside className={`sidebar ${collapsed?"collapsed":""} ${mobileOpen?"mobile-open":""}`}>
    <div className="logo"><Mascot className="logo-mascot" size={52} directions={asset("tv-directions.webp")} reactions={asset("tv-reactions.webp")} label={t("shell.mascotLabel")}/><div><b>{game.shortName}</b><small>ANALYTICS</small></div><button className="mobile-close" onClick={()=>setMobileOpen(false)} aria-label={t("shell.closeMenu")}><X size={18}/></button></div>
    <nav>{nav.map(([to,labelKey,Icon])=>{const label=t(labelKey as TranslationKey);return <NavLink key={to} to={to} end={to==="/"} onClick={()=>setMobileOpen(false)} title={collapsed?label:undefined}><Icon size={18}/><span>{label}</span></NavLink>;})}</nav>
    <button className="collapse-button" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?t("shell.expandSidebar"):t("shell.collapseSidebar")} title={collapsed?t("shell.expandSidebar"):t("shell.collapseSidebar")}>{collapsed?<ChevronRight size={19}/>:<ChevronLeft size={19}/>}</button>
  </aside>;
}

function Shell(){
  const [collapsed,setCollapsed]=useState(false); const [mobileOpen,setMobileOpen]=useState(false);
  const {dashboardFilters,updateDashboardFilters,themeMode,setThemeMode,languageMode,setLanguageMode,selectedGame}=useLotteryStore();
  const {t}=useI18n();
  const selectedTheme=themeMode||"light";
  const quickPeriods=[{label:t("shell.last10"),value:"last10"},{label:t("shell.last30"),value:"last30"},{label:t("shell.lastYear"),value:"last1year"},{label:t("shell.allDraws"),value:"all"}] as const;
  useEffect(()=>{
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const apply=()=>document.documentElement.dataset.theme=selectedTheme==="system"?(media.matches?"dark":"light"):selectedTheme;
    apply(); media.addEventListener("change",apply); return()=>media.removeEventListener("change",apply);
  },[selectedTheme]);
  useEffect(()=>{document.documentElement.lang=languageMode??"en";},[languageMode]);
  const themes=[{mode:"light" as const,label:t("theme.light"),Icon:Sun},{mode:"dark" as const,label:t("theme.dark"),Icon:Moon},{mode:"system" as const,label:t("theme.system"),Icon:Monitor}];
  return <div className={`app-shell ${collapsed?"sidebar-collapsed":""}`}><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>{mobileOpen&&<button className="scrim" onClick={()=>setMobileOpen(false)} aria-label={t("shell.closeMenu")}/>}<div className="app-main"><header className="topbar"><button className="menu-button" onClick={()=>setMobileOpen(true)} aria-label={t("shell.openMenu")}><Menu size={20}/></button><div className="workspace-title"><b>{LOTTERY_GAMES[selectedGame].name} Analytics</b><span>{t("shell.workspace")}</span></div><div className="quick-periods">{quickPeriods.map(item=><button key={item.value} className={dashboardFilters.period===item.value?"active":""} onClick={()=>updateDashboardFilters({period:item.value})}>{item.label}</button>)}</div><div className="language-control" aria-label={t("shell.language")}>{(["vi","en"] as const).map(language=><button key={language} className={languageMode===language?"active":""} onClick={()=>setLanguageMode(language)} aria-pressed={languageMode===language}>{language.toUpperCase()}</button>)}</div><div className="theme-control" aria-label={t("shell.theme")}>{themes.map(({mode,label,Icon})=><button key={mode} className={selectedTheme===mode?"active":""} onClick={()=>setThemeMode(mode)} aria-label={label} title={label}><Icon size={14}/></button>)}</div><div className="data-chip">{t("shell.private")}</div></header><main><Routes><Route path="/" element={<Dashboard/>}/><Route path="/history" element={<HistoryPage/>}/><Route path="/singles" element={<SinglesPage/>}/><Route path="/pairs" element={<PairsPage/>}/><Route path="/triples" element={<TriplesPage/>}/><Route path="/analysis" element={<SinglesPage/>}/><Route path="/combinations" element={<CombinationsPage/>}/><Route path="/ticket-filter" element={<TicketFilterPage/>}/><Route path="/backtest" element={<BacktestPage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></main></div></div>;
}

export default function App(){ return <Shell/>; }
