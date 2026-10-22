import { useState } from "react";
import { referenceTreasuries } from "../bitcoinTreasuriesData";
import type { TreasuryEntry } from "../bitcoinTreasuriesData";
import "./bitcoin-holdings.css";

const WIDTH = 1280;
const HEIGHT = 680;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const OUTER_RADIUS = 235;
const INNER_RADIUS = 145;
const TOTAL_BTC = "1.368.430";

type TreasuryLabel = TreasuryEntry & { midAngle: number; labelY: number; side: "left" | "right" };

export function layoutTreasuryLabels(entries: TreasuryEntry[]): TreasuryLabel[] {
  let angle = -90;
  const labels = entries.map(entry => {
    const midAngle = angle + entry.percentage * 1.8;
    angle += entry.percentage * 3.6;
    const radians = midAngle * Math.PI / 180;
    return { ...entry, midAngle, labelY: CENTER_Y + Math.sin(radians) * (OUTER_RADIUS + 44), side: Math.cos(radians) >= 0 ? "right" as const : "left" as const };
  });

  for (const side of ["left", "right"] as const) {
    const sideLabels = labels.filter(label => label.side === side).sort((a, b) => a.labelY - b.labelY);
    sideLabels.forEach((label, index) => {
      label.labelY = Math.max(34, label.labelY, index ? sideLabels[index - 1].labelY + 35 : 34);
    });
    const overflow = sideLabels.at(-1)!.labelY - (HEIGHT - 34);
    if (overflow > 0) sideLabels.forEach(label => { label.labelY -= overflow; });
  }
  return labels;
}

function sectorPath(startAngle: number, endAngle: number): string {
  const start = startAngle + 0.55;
  const end = endAngle - 0.55;
  const point = (radius: number, angle: number) => [CENTER_X + Math.cos(angle * Math.PI / 180) * radius, CENTER_Y + Math.sin(angle * Math.PI / 180) * radius];
  const [outerStartX, outerStartY] = point(OUTER_RADIUS, start);
  const [outerEndX, outerEndY] = point(OUTER_RADIUS, end);
  const [innerEndX, innerEndY] = point(INNER_RADIUS, end);
  const [innerStartX, innerStartY] = point(INNER_RADIUS, start);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}

function splitName(name: string): string[] {
  if (name.length <= 22) return [name];
  const words = name.split(" ");
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")];
}

export default function BitcoinHoldingsPage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = hoveredId ?? selectedId;
  const activeEntry = referenceTreasuries.find(entry => entry.id === activeId);
  const labels = layoutTreasuryLabels(referenceTreasuries);
  let angle = -90;

  const clearSelection = () => { setSelectedId(null); setHoveredId(null); };
  const toggleSelection = (id: string) => setSelectedId(current => current === id ? null : id);

  return <section className="btc-holdings-page" aria-labelledby="btc-holdings-title">
    <header className="btc-holdings-header">
      <h1 id="btc-holdings-title">Bitcoin Holdings by Company</h1>
      <p>Reference visualization · Percentage fixture from the supplied design spec</p>
    </header>
    <div className="btc-holdings-scroll">
      <svg className="btc-holdings-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Interactive Bitcoin holdings donut chart. Use Tab to focus a company, Enter or Space to select, and Escape to clear selection." onKeyDown={event => { if (event.key === "Escape") clearSelection(); }}>
        <rect width={WIDTH} height={HEIGHT} fill="transparent" onClick={clearSelection} aria-hidden="true"/>
        {referenceTreasuries.map(entry => {
          const start = angle;
          const end = angle + entry.percentage * 3.6;
          const midAngle = (start + end) / 2;
          angle = end;
          const active = activeId === entry.id;
          const radians = midAngle * Math.PI / 180;
          const offsetX = active ? Math.cos(radians) * 6 : 0;
          const offsetY = active ? Math.sin(radians) * 6 : 0;
          return <path key={entry.id} className={`btc-holdings-slice${active ? " is-active" : ""}${selectedId === entry.id ? " is-selected" : ""}`} d={sectorPath(start, end)} fill={entry.color} style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }} tabIndex={0} role="button" aria-label={`${entry.name}, ${entry.percentage.toFixed(2)} percent`} aria-pressed={selectedId === entry.id} onMouseEnter={() => setHoveredId(entry.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(entry.id)} onBlur={() => setHoveredId(null)} onClick={event => { event.stopPropagation(); toggleSelection(entry.id); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggleSelection(entry.id); } }}/>;
        })}
        {labels.map(entry => {
          const radians = entry.midAngle * Math.PI / 180;
          const elbowX = CENTER_X + Math.cos(radians) * (OUTER_RADIUS + 32);
          const textX = CENTER_X + (entry.side === "right" ? 1 : -1) * (OUTER_RADIUS + 90);
          const lineEndX = entry.side === "right" ? textX - 8 : textX + 8;
          const lines = splitName(entry.name);
          const nameY = entry.labelY - (lines.length > 1 ? 7 : 0);
          return <g className="btc-holdings-label" key={`label-${entry.id}`} aria-hidden="true">
            <path d={`M ${CENTER_X + Math.cos(radians) * OUTER_RADIUS} ${CENTER_Y + Math.sin(radians) * OUTER_RADIUS} L ${elbowX} ${entry.labelY} L ${lineEndX} ${entry.labelY}`} stroke={entry.color} />
            <text x={textX} y={nameY} textAnchor={entry.side === "right" ? "start" : "end"}>
              {lines.map((line, index) => <tspan key={index} x={textX} dy={index ? 15 : 0}>{line}</tspan>)}
              <tspan className="btc-holdings-percent"> {entry.percentage.toFixed(2)}%</tspan>
            </text>
          </g>;
        })}
        <g className="btc-holdings-center" aria-live="polite" pointerEvents="none">
          {activeEntry ? <>
            {splitName(activeEntry.name).map((line, index) => <text key={index} className="btc-holdings-active-name" x={CENTER_X} y={CENTER_Y - 34 + index * 18}>{line}</text>)}
            <text className="btc-holdings-active-percent" x={CENTER_X} y={CENTER_Y + (splitName(activeEntry.name).length > 1 ? 18 : 10)}>{activeEntry.percentage.toFixed(2)}%</text>
            <text className="btc-holdings-total-label" x={CENTER_X} y={CENTER_Y + 43}>Total BTC held · {TOTAL_BTC}</text>
          </> : <>
            <text className="btc-holdings-total-label" x={CENTER_X} y={CENTER_Y - 13}>Total BTC Held:</text>
            <text className="btc-holdings-total" x={CENTER_X} y={CENTER_Y + 28}>{TOTAL_BTC}</text>
          </>}
        </g>
      </svg>
    </div>
    <p className="btc-holdings-footnote">Percentages and total are illustrative reference values, not live holdings data.</p>
  </section>;
}
