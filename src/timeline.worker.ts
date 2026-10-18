import { calculateOccurrenceTimeline } from "./analytics";
import type { Draw } from "./domain";

self.onmessage=({data}:MessageEvent<Draw[]>)=>{
  self.postMessage(calculateOccurrenceTimeline(data));
};
