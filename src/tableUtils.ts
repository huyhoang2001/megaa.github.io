export function matchesColumnFilter(value: unknown, rawFilter: string) {
  const filter=rawFilter.trim();
  if(!filter) return true;
  if(value==null&&/^(?:<=|>=|!=|=|<|>)?\s*-?\d+(?:\.\d+)?(?:\s*\.\.\s*-?\d+(?:\.\d+)?)?$/.test(filter))return false;
  if(typeof value==="number"&&Number.isFinite(value)){
    const comparison=filter.match(/^(<=|>=|!=|=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
    if(comparison){
      const target=Number(comparison[2]);
      switch(comparison[1]){
        case "<": return value<target;
        case "<=": return value<=target;
        case ">": return value>target;
        case ">=": return value>=target;
        case "!=": return value!==target;
        default: return value===target;
      }
    }
    const range=filter.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/);
    if(range){
      const low=Math.min(Number(range[1]),Number(range[2]));
      const high=Math.max(Number(range[1]),Number(range[2]));
      return value>=low&&value<=high;
    }
    const exact=Number(filter);
    if(Number.isFinite(exact)) return value===exact;
  }
  return String(value??"").toLocaleLowerCase().includes(filter.toLocaleLowerCase());
}
