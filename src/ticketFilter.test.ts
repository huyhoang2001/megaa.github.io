import { describe,expect,it } from "vitest";
import { ALLOWED_TAILS,filterTicketResultsByNumber,filterTickets,getDigitParity,getTicketTail,parseTicketInput,splitTicket,ticketDigitalRoot,ticketResultsToCsv } from "./ticketFilter";

const example="110294,890504,291160,223907,607658,021855,653805,971108,020304,426012,abc123";

describe("ticket filter",()=>{
  it("parses commas and newlines while preserving leading zeroes",()=>expect(parseTicketInput("021855,\n 059255")).toEqual(["021855","059255"]));
  it("validates six digits without removing internal characters",()=>{const result=filterTickets("11029,1102947,11-0294,abc123");expect(result.rejected.every(item=>item.rejectReasons[0]==="INVALID_FORMAT")).toBe(true);});
  it("extracts numeric tails and splits AB/CD/EF",()=>{expect(getTicketTail("890504")).toBe(4);expect(getTicketTail("653805")).toBe(5);expect(splitTicket("110294")).toEqual([11,2,94]);});
  it("applies the allowed pool only to the final pair",()=>{expect(ALLOWED_TAILS.has(94)).toBe(true);expect(filterTickets("110294").accepted).toHaveLength(1);});
  it("short-circuits after a rejected tail",()=>{const item=filterTickets("426012").rejected[0];expect(item.rejectReasons).toEqual(["TAIL_NOT_ALLOWED"]);expect(item.parts).toBeUndefined();expect(item.pairSum).toBeUndefined();});
  it("calculates sum and allowed digital roots",()=>{expect(ticketDigitalRoot(107)).toBe(8);expect(ticketDigitalRoot(100)).toBe(1);expect(ticketDigitalRoot(68)).toBe(5);expect(filterTickets("020304").rejected[0].rejectReasons).toEqual(["SUM_TOO_LOW"]);expect(filterTickets("653805").rejected[0].rejectReasons).toEqual(["ROOT_NOT_ALLOWED"]);});
  it("counts zero as even and enforces digit parity",()=>{expect(getDigitParity("110294")).toEqual({even:3,odd:3,key:"3/3"});expect(getDigitParity("890504")).toEqual({even:4,odd:2,key:"4/2"});expect(filterTickets("971108").rejected[0].rejectReasons).toEqual(["PARITY_NOT_ALLOWED"]);});
  it("keeps the first duplicate and logs later copies",()=>{const result=filterTickets("110294,110294");expect(result.accepted).toHaveLength(1);expect(result.summary.duplicates).toBe(1);expect(result.logs.some(log=>log.message.includes("Duplicate ignored"))).toBe(true);});
  it("continues after invalid entries and ranks root then parity then sum",()=>{const result=filterTickets(example);expect(result.accepted.map(item=>item.code)).toEqual(["110294","890504","223907","607658","021855","291160"]);expect(result.rejected.map(item=>item.rejectReasons[0])).toEqual(["ROOT_NOT_ALLOWED","PARITY_NOT_ALLOWED","SUM_TOO_LOW","TAIL_NOT_ALLOWED","INVALID_FORMAT"]);expect(result.logs.at(-1)?.message).toBe("Rejected: 5");});
  it("exports accepted results without losing leading zeroes",()=>{const csv=ticketResultsToCsv(filterTickets(example).accepted);expect(csv).toContain("021855");expect(csv.split("\n")[0]).toBe("rank,ticket,tail,a,b,c,sum,root,parity,status");});
  it("narrows ticket results by a partial winning number",()=>{const results=filterTickets(example);expect(filterTicketResultsByNumber([...results.accepted,...results.rejected],"94").map(item=>item.code)).toEqual(["110294"]);});
  it("requires an exact match for a six-digit winning number",()=>{const results=filterTickets(example);expect(filterTicketResultsByNumber([...results.accepted,...results.rejected],"021855").map(item=>item.code)).toEqual(["021855"]);expect(filterTicketResultsByNumber(results.accepted,"999999")).toEqual([]);});
});
