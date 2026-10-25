export function createFakeClock(start='2026-09-01T00:00:00.000Z'){
  let now=Date.parse(start),nextId=0;
  if(!Number.isFinite(now))throw new TypeError('Fake clock start must be a valid date.');
  const timers=new Map();
  class FakeDate extends Date{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  const setTimeout=(callback,delay=0,...args)=>{
    const id=++nextId;
    timers.set(id,{id,at:now+Math.max(0,Number(delay)||0),callback,args});
    return id;
  };
  const clearTimeout=id=>{timers.delete(id);};
  async function drainMicrotasks(turns=8){for(let i=0;i<turns;i++)await Promise.resolve();}
  async function advance(milliseconds){
    const target=now+Math.max(0,Number(milliseconds)||0);
    while(true){
      const due=[...timers.values()].filter(timer=>timer.at<=target).sort((a,b)=>a.at-b.at||a.id-b.id)[0];
      if(!due)break;
      timers.delete(due.id);now=due.at;due.callback(...due.args);await drainMicrotasks();
    }
    now=target;await drainMicrotasks();
  }
  async function runAll(limit=1000){
    let runs=0;
    while(timers.size){
      if(++runs>limit)throw new Error('Fake clock timer limit exceeded.');
      const next=Math.min(...[...timers.values()].map(timer=>timer.at));
      await advance(Math.max(0,next-now));
    }
  }
  // The time the next timer is due, or null: lets a test step from timer to timer.
  const nextAt=()=>timers.size?Math.min(...[...timers.values()].map(timer=>timer.at)):null;
  return Object.freeze({Date:FakeDate,setTimeout,clearTimeout,advance,runAll,drainMicrotasks,nextAt,now:()=>now,pending:()=>timers.size});
}
