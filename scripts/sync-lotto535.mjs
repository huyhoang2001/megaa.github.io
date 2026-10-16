import { writeFile } from "node:fs/promises";

const repository="https://github.com/NhanAZ-Data/vietlott-research";
const source="https://raw.githubusercontent.com/NhanAZ-Data/vietlott-research/main/datasets/draws/lotto535/all.csv";
const prizeSource="https://raw.githubusercontent.com/NhanAZ-Data/vietlott-research/main/datasets/prizes/lotto535/all.csv";
const metadataSource="https://raw.githubusercontent.com/NhanAZ-Data/vietlott-research/main/datasets/metadata/dataset-summary.json";

function parseCsv(text){
  const rows=[];
  let row=[];
  let field="";
  let quoted=false;
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(quoted){
      if(character==='"'&&text[index+1]==='"'){field+='"';index++;}
      else if(character==='"')quoted=false;
      else field+=character;
    }else if(character==='"')quoted=true;
    else if(character===","){row.push(field);field="";}
    else if(character==="\n"){
      row.push(field.replace(/\r$/, ""));
      if(row.some(value=>value!==""))rows.push(row);
      row=[];
      field="";
    }else field+=character;
  }
  if(field||row.length){row.push(field.replace(/\r$/, ""));rows.push(row);}
  const [headers,...values]=rows;
  return values.map(columns=>Object.fromEntries(headers.map((header,index)=>[header,columns[index]??""])));
}

const [drawResponse,prizeResponse,metadataResponse]=await Promise.all([fetch(source),fetch(prizeSource),fetch(metadataSource)]);
if(!drawResponse.ok)throw new Error(`Lotto 5/35 draw download failed: ${drawResponse.status}`);
if(!prizeResponse.ok)throw new Error(`Lotto 5/35 prize download failed: ${prizeResponse.status}`);
if(!metadataResponse.ok)throw new Error(`Lotto 5/35 metadata download failed: ${metadataResponse.status}`);

const [drawRows,prizeRows,metadata]=await Promise.all([drawResponse.text().then(parseCsv),prizeResponse.text().then(parseCsv),metadataResponse.json()]);
const jackpotsById=new Map();
for(const row of prizeRows){
  if(row.product!=="lotto535"||row.prize_tier!=="Giải Độc Đắc")continue;
  const details=JSON.parse(row.details_json||"{}");
  const rawAmount=row.prize_value_vnd||details.columns?.column_4||"0";
  const amount=Number(String(rawAmount).replace(/\D/g,""));
  if(!Number.isFinite(amount)||amount<0)throw new Error(`Invalid jackpot value for draw ${row.draw_id}`);
  jackpotsById.set(row.draw_id,amount);
}

let skipped=0;
const draws=drawRows.flatMap((row,index)=>{
  if(row.product!=="lotto535"||row.draw_status!=="confirmed"){
    skipped++;
    return [];
  }
  const result=JSON.parse(row.result_json);
  const numbers=result.numbers?.map(Number).sort((a,b)=>a-b);
  const bonus=Number(result.special_numbers?.[0]);
  if(!Array.isArray(numbers)||numbers.length!==5||new Set(numbers).size!==5||numbers.some(number=>!Number.isInteger(number)||number<1||number>35)||!Number.isInteger(bonus)||bonus<1||bonus>12){
    throw new Error(`Invalid Lotto 5/35 values at dataset row ${index+2}`);
  }
  return [{id:String(row.draw_id).padStart(5,"0"),date:row.draw_date,numbers,bonus,jackpot:jackpotsById.get(row.draw_id)??0}];
}).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));

const expected=metadata.products?.lotto535;
if(expected&&draws.length<expected.confirmed_rows)throw new Error(`Expected at least ${expected.confirmed_rows} confirmed Lotto 5/35 draws, received ${draws.length}`);
const output={game:"lotto535",repository,source,prizeSource,metadataSource,sourceThrough:draws.at(-1)?.date??null,datasetUpdatedAt:metadata.dataset_updated_at??null,draws};
await writeFile(new URL("../src/data/lotto535-history.json",import.meta.url),`${JSON.stringify(output,null,2)}\n`);
console.log(`Wrote ${draws.length} Lotto 5/35 draws through ${output.sourceThrough}; skipped ${skipped} non-confirmed row(s).`);
