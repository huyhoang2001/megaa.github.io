import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MiniPieInfo } from "./Dashboard";

let container:HTMLDivElement|undefined;
afterEach(()=>container?.remove());

describe("MiniPieInfo",()=>{
  it("closes outside and can be opened again",()=>{
    container=document.createElement("div");
    document.body.append(container);
    const root=createRoot(container);
    act(()=>root.render(createElement(MiniPieInfo,{title:"Inside/Outside",info:"Inside numbers: 02, 03"})));
    const button=container.querySelector("button")!;
    act(()=>button.click());
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    act(()=>document.body.dispatchEvent(new Event("pointerdown",{bubbles:true})));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    act(()=>button.click());
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain("02, 03");
    act(()=>root.unmount());
  });
});
