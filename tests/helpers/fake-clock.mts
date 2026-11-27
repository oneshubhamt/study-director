type Timer={id:number;at:number;run:()=>void};
export function createFakeClock(start='2026-09-01T00:00:00.000Z'){
  const NativeDate=Date;
  let now=NativeDate.parse(start),nextId=0;
  if(!Number.isFinite(now))throw new TypeError('Fake clock start must be a valid date.');
  const timers=new Map<number,Timer>();
  class FakeDate extends NativeDate{
    constructor(...args:unknown[]){
      const date:unknown=Reflect.construct(NativeDate,args.length?args:[now]);
      if(!(date instanceof NativeDate))throw new Error('Native Date constructor returned an invalid instance.');
      super(date.getTime());
    }
    static override now(){return now;}
  }
  const setTimeout=<T extends unknown[]>(callback:(...args:T)=>void,delay=0,...args:T)=>{
    const id=++nextId;
    timers.set(id,{id,at:now+Math.max(0,Number(delay)||0),run:()=>callback(...args)});
    return id;
  };
  const clearTimeout=(id:number)=>{timers.delete(id);};
  async function drainMicrotasks(turns=8){for(let i=0;i<turns;i++)await Promise.resolve();}
  async function advance(milliseconds:number){
    const target=now+Math.max(0,Number(milliseconds)||0);
    while(true){
      const due=[...timers.values()].filter(timer=>timer.at<=target).sort((a,b)=>a.at-b.at||a.id-b.id)[0];
      if(!due)break;
      timers.delete(due.id);now=due.at;due.run();await drainMicrotasks();
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
  const nextAt=()=>timers.size?Math.min(...[...timers.values()].map(timer=>timer.at)):null;
  return Object.freeze({Date:FakeDate,setTimeout,clearTimeout,advance,runAll,drainMicrotasks,nextAt,now:()=>now,pending:()=>timers.size});
}
