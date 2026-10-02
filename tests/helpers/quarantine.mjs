import fs from 'node:fs';

// Quarantine is deliberately browser-only. Fast correctness tests may never be skipped.
// Keep this list empty unless a browser feature/extended test is temporarily unstable.
const BROWSER_QUARANTINES=Object.freeze([
]);

const DAY=24*60*60*1000;
const isoDate=/^\d{4}-\d{2}-\d{2}$/;

function parseDate(value,label){
  if(!isoDate.test(value||''))throw new Error(`${label} must be YYYY-MM-DD: ${value}`);
  const time=Date.parse(`${value}T00:00:00Z`);
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new Error(`${label} is invalid: ${value}`);
  return time;
}

export function validateBrowserQuarantineEntries(quarantines,{now=new Date(),browserEntries=[]}={}){
  const byScript=new Map(browserEntries.map(entry=>[entry.script,entry]));
  const seen=new Set();
  const current=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  for(const item of quarantines){
    if(!item||typeof item!=='object')throw new Error('Browser quarantine entry must be an object.');
    const {script,reason,tracking,introducedOn,expiresOn}=item;
    if(seen.has(script))throw new Error(`Duplicate browser quarantine: ${script}`);
    seen.add(script);
    const entry=byScript.get(script);
    if(!entry)throw new Error(`Quarantine references a non-existent browser test: ${script}`);
    if(entry.tier==='smoke')throw new Error(`Smoke browser tests cannot be quarantined: ${script}`);
    if(entry.tier!=='feature'&&entry.tier!=='extended')throw new Error(`Only feature/extended browser tests may be quarantined: ${script}`);
    if(typeof reason!=='string'||reason.trim().length<12)throw new Error(`Quarantine needs a specific reason: ${script}`);
    if(typeof tracking!=='string'||tracking.trim().length<3)throw new Error(`Quarantine needs a tracking reference: ${script}`);
    const introduced=parseDate(introducedOn,'introducedOn');
    const expires=parseDate(expiresOn,'expiresOn');
    if(expires<=introduced)throw new Error(`Quarantine expiry must be after introduction: ${script}`);
    if(expires-introduced>14*DAY)throw new Error(`Quarantine may last at most 14 days: ${script}`);
    if(current>expires)throw new Error(`EXPIRED browser quarantine (${expiresOn}): ${script}`);
    if(!fs.existsSync(script))throw new Error(`Quarantined browser test is missing: ${script}`);
  }
  return Object.freeze([...quarantines]);
}

export function validateBrowserQuarantines(options={}){
  return validateBrowserQuarantineEntries(BROWSER_QUARANTINES,options);
}

export function quarantinedBrowserScripts(options={}){
  return new Set(validateBrowserQuarantines(options).map(item=>item.script));
}
