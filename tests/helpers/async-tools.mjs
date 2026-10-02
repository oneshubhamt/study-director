export async function drainMicrotasks(turns=8){for(let i=0;i<turns;i++)await Promise.resolve();}
export function nextTurn(){return new Promise(resolve=>setImmediate(resolve));}
