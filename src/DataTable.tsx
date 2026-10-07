import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownZA, ArrowUpDown, Filter, RotateCcw, X } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, ColumnFiltersState, FilterFn, SortingState } from "@tanstack/react-table";
import { Card, EmptyState } from "./ui";
import { matchesColumnFilter } from "./tableUtils";

export type DataTableLabels={
  filterColumn:string;
  sortAscending:string;
  sortDescending:string;
  filterValues:string;
  filterPlaceholder:string;
  filterHint:string;
  clearColumn:string;
  resetFilters:string;
  rowsShown:string;
  close:string;
  noMatches:string;
};

type DataTableProps<TData>={
  data:TData[];
  columns:ColumnDef<TData,unknown>[];
  labels:DataTableLabels;
  maxRows?:number;
  onReset?:()=>void;
};

const excelFilter:FilterFn<unknown>=(row,columnId,value)=>matchesColumnFilter(row.getValue(columnId),String(value??""));

export default function DataTable<TData>({data,columns,labels,maxRows,onReset}:DataTableProps<TData>){
  const [sorting,setSorting]=useState<SortingState>([]);
  const [columnFilters,setColumnFilters]=useState<ColumnFiltersState>([]);
  const [activeColumnId,setActiveColumnId]=useState<string|null>(null);
  const table=useReactTable({
    data,
    columns,
    state:{sorting,columnFilters},
    onSortingChange:setSorting,
    onColumnFiltersChange:setColumnFilters,
    defaultColumn:{filterFn:excelFilter as FilterFn<TData>},
    getCoreRowModel:getCoreRowModel(),
    getFilteredRowModel:getFilteredRowModel(),
    getSortedRowModel:getSortedRowModel(),
    getFacetedRowModel:getFacetedRowModel(),
    getFacetedUniqueValues:getFacetedUniqueValues(),
  });
  const activeColumn=activeColumnId?table.getColumn(activeColumnId):undefined;
  const activeLabel=activeColumn?String(activeColumn.columnDef.header??activeColumn.id):"";
  const suggestions=useMemo(()=>activeColumn?Array.from(activeColumn.getFacetedUniqueValues().keys()).map(String).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).slice(0,200):[],[activeColumn,columnFilters,data]);
  const filteredRows=table.getRowModel().rows;
  const visibleRows=maxRows?filteredRows.slice(0,maxRows):filteredRows;
  const hasChanges=sorting.length>0||columnFilters.length>0;
  const reset=()=>{table.resetColumnFilters(true);table.resetSorting();setActiveColumnId(null);onReset?.();};
  return <Card className="table-card data-table-card">
    <div className="data-table-toolbar">
      <span aria-live="polite">{labels.rowsShown.replace("{shown}",String(visibleRows.length)).replace("{total}",String(filteredRows.length))}</span>
      <button type="button" className="table-reset" onClick={reset} disabled={!hasChanges&&!onReset}><RotateCcw size={14}/>{labels.resetFilters}</button>
    </div>
    {activeColumn&&<div className="column-filter-panel">
      <strong>{activeLabel}</strong>
      <div className="column-filter-actions">
        <button type="button" className={activeColumn.getIsSorted()==="asc"?"active":""} onClick={()=>activeColumn.toggleSorting(false)}><ArrowDownAZ size={14}/>{labels.sortAscending}</button>
        <button type="button" className={activeColumn.getIsSorted()==="desc"?"active":""} onClick={()=>activeColumn.toggleSorting(true)}><ArrowDownZA size={14}/>{labels.sortDescending}</button>
      </div>
      <label><span>{labels.filterValues}</span><input type="search" list={`filter-options-${activeColumn.id}`} value={String(activeColumn.getFilterValue()??"")} onChange={event=>activeColumn.setFilterValue(event.target.value||undefined)} placeholder={labels.filterPlaceholder}/><small>{labels.filterHint}</small></label>
      <datalist id={`filter-options-${activeColumn.id}`}>{suggestions.map(value=><option value={value} key={value}/>)}</datalist>
      <button type="button" className="column-clear" onClick={()=>activeColumn.setFilterValue(undefined)} disabled={!activeColumn.getIsFiltered()}>{labels.clearColumn}</button>
      <button type="button" className="column-panel-close" onClick={()=>setActiveColumnId(null)} aria-label={labels.close}><X size={15}/></button>
    </div>}
    <div className="table-scroll"><table><thead>{table.getHeaderGroups().map(group=><tr key={group.id}>{group.headers.map(header=>{
      const sorted=header.column.getIsSorted(); const filtered=header.column.getIsFiltered();
      return <th key={header.id}><div className="table-heading"><button type="button" className="column-sort" onClick={header.column.getToggleSortingHandler()} aria-label={`${String(header.column.columnDef.header)}: ${sorted==="asc"?labels.sortDescending:labels.sortAscending}`}><span>{header.isPlaceholder?null:flexRender(header.column.columnDef.header,header.getContext())}</span>{sorted==="asc"?<ArrowDownAZ size={13}/>:sorted==="desc"?<ArrowDownZA size={13}/>:<ArrowUpDown size={13}/>}</button><button type="button" className={`column-filter ${filtered?"active":""}`} onClick={()=>setActiveColumnId(current=>current===header.column.id?null:header.column.id)} aria-label={`${labels.filterColumn}: ${String(header.column.columnDef.header)}`} aria-expanded={activeColumnId===header.column.id}><Filter size={12}/></button></div></th>;
    })}</tr>)}</thead><tbody>{visibleRows.length?visibleRows.map(row=><tr key={row.id}>{row.getVisibleCells().map(cell=><td key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>):<tr><td colSpan={columns.length}><EmptyState text={labels.noMatches}/></td></tr>}</tbody></table></div>
  </Card>;
}
