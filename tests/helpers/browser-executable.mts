import fs from 'node:fs';

export function resolveChromiumExecutable(preferred=''){
  const candidates=[
    preferred,
    process.env['CHROMIUM_PATH'],
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/tmp/chromium'
  ].filter((value):value is string=>!!value);
  const match=candidates.find(candidate=>{try{return fs.existsSync(candidate)&&fs.statSync(candidate).isFile();}catch{return false;}});
  if(!match)throw new Error(`Chromium is unavailable. Checked: ${candidates.join(', ')}`);
  return match;
}

