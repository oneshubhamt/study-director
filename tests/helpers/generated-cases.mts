// Stable generated-case identity and bounded, reproducible input evidence.
export function seededRandom(seed: number): ()=>number {
  let state=seed>>>0;
  return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function tools(random: ()=>number, trace: (input: unknown)=>void){
  const int=(min: number,max: number)=>min+Math.floor(random()*(max-min+1));
  const pick=<T,>(values: readonly T[]): T=>{const index=int(0,values.length-1);if(!values.length)throw new Error('Cannot pick from an empty collection.');return values[index]!;};
  const weighted=<K extends string>(weights: Record<K,number>): K=>{
    const keys=Object.keys(weights) as K[];
    const total=keys.reduce((sum,key)=>sum+weights[key],0);
    if(!keys.length||!Number.isFinite(total)||total<=0||keys.some(key=>weights[key]<0))throw new Error('Invalid generated weights.');
    let roll=random()*total;
    for(const key of keys){if(roll<weights[key])return key;roll-=weights[key];}
    return keys[keys.length-1]!;
  };
  return Object.freeze({random,int,pick,weighted,chance:(p: number)=>random()<p,trace});
}
type CaseTools=ReturnType<typeof tools>;
type CaseOptions={seed:number;count:number};
const requestedAtStartup=process.env['SD_CASE_SEED'];
const familyAtStartup=process.env['SD_CASE_FAMILY'];
let selectedAtStartup=0;
if(requestedAtStartup!==undefined)process.once('beforeExit',()=>{
  if(!selectedAtStartup){console.error(`No generated case matched ${familyAtStartup??'(any family)'} seed ${requestedAtStartup}.`);process.exitCode=1;}
});
export async function checkCases(name: string,{seed,count}: CaseOptions,check: (tools: CaseTools,index: number)=>void|Promise<void>): Promise<number>{
  const only=process.env['SD_CASE_SEED'],family=process.env['SD_CASE_FAMILY'];
  if(family&&family!==name)return 0;
  if(only!==undefined&&(!/^\d+$/u.test(only)||Number(only)>0xffffffff))throw new Error('SD_CASE_SEED must be an unsigned 32-bit integer.');
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(count)||count<1)throw new Error('Invalid generated-case range.');
  const cases=Array.from({length:count},(_,index)=>({index,caseSeed:(seed+index)>>>0})).filter(row=>only===undefined||row.caseSeed===Number(only));
  if(family&&only!==undefined&&!cases.length)throw new Error(`Seed ${only} is outside ${name}.`);
  for(const {index,caseSeed} of cases){
    if(only===requestedAtStartup&&family===familyAtStartup)selectedAtStartup++;
    const draws:number[]=[],inputs:unknown[]=[];
    const random=seededRandom(caseSeed);
    try{
      await check(tools(()=>{const draw=random();draws.push(draw);return draw;},input=>inputs.push(structuredClone(input))),index);
      if(process.env['SD_CASE_TRACE_SEED']===String(caseSeed)&&(!process.env['SD_CASE_TRACE_FAMILY']||process.env['SD_CASE_TRACE_FAMILY']===name))console.log('CASE-TRACE '+JSON.stringify({family:name,seed:caseSeed,index,draws,inputs}));
    }catch(error){
      const where=`${name}: case ${index+1} of ${count} failed (seed ${caseSeed}; rerun with SD_CASE_FAMILY=${JSON.stringify(name)} SD_CASE_SEED=${caseSeed})`;
      console.error(where);
      console.error(JSON.stringify({family:name,seed:caseSeed,index,draws,inputs}));
      throw error;
    }
  }
  return cases.length;
}
