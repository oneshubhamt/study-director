// Seeded generated inputs for rule-based tests. Each case gets its own seed,
// so a failure names the case and seed, and SD_CASE_SEED=<seed> reruns just
// that case. The same seeds run every time: a pass is repeatable.

export function seededRandom(seed){
  let state=seed>>>0;
  // mulberry32: small, fast and well spread for test inputs.
  return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

function tools(random){
  const int=(min,max)=>min+Math.floor(random()*(max-min+1));
  const pick=values=>values[int(0,values.length-1)];
  // weighted({keep:2,edit:1}) picks a key in proportion to its weight.
  const weighted=weights=>{const entries=Object.entries(weights),total=entries.reduce((sum,[,weight])=>sum+weight,0);let roll=random()*total;for(const [value,weight] of entries){if(roll<weight)return value;roll-=weight;}return entries.at(-1)[0];};
  return Object.freeze({random,int,pick,weighted,chance:p=>random()<p});
}

export async function checkCases(name,{seed,count},check){
  const only=process.env.SD_CASE_SEED;
  const seeds=only?[Number(only)>>>0]:Array.from({length:count},(_,index)=>(seed+index)>>>0);
  for(const [index,caseSeed] of seeds.entries()){
    try{await check(tools(seededRandom(caseSeed)),index);}
    catch(error){
      const where=`${name}: case ${index+1} of ${seeds.length} failed (seed ${caseSeed}; rerun with SD_CASE_SEED=${caseSeed})`;
      if(error&&typeof error==='object'){try{error.message=`${where}\n${error.message}`;}catch{}}
      console.error(where);throw error;
    }
  }
  return seeds.length;
}
