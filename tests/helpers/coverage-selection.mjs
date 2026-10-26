// Explicit scope prevents a targeted pass being reported as full certification.
export function coverageSelection(args){
  const tests=[],files=[];let json=null;
  for(let index=0;index<args.length;index++){
    const flag=args[index];
    if(!['--test','--file','--json'].includes(flag))throw new Error(`Unknown coverage option: ${flag}`);
    const value=args[++index];
    if(!value||value.startsWith('--'))throw new Error(`${flag} requires a value.`);
    if(flag==='--test')tests.push(value);
    else if(flag==='--file')files.push(value);
    else{if(json!==null)throw new Error('--json may only be supplied once.');json=value;}
  }
  if(Boolean(tests.length)!==Boolean(files.length))throw new Error('Targeted coverage requires both --test and --file; repeat either for multiple surfaces.');
  return Object.freeze({targeted:tests.length>0,tests:Object.freeze([...new Set(tests)]),files:Object.freeze([...new Set(files)]),json});
}
