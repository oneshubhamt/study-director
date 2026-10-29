import {readCoreScript} from '../../helpers/core-script.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime(seed={},kind={type:'iphone',browser:'safari'}){
  const backing=new Map(Object.entries(seed));
  const localStorage={
    getItem:key=>backing.has(String(key))?backing.get(String(key)):null,
    setItem:(key,value)=>backing.set(String(key),String(value)),
    removeItem:key=>backing.delete(String(key))
  };
  const context=vm.createContext({
    console,Date,Math,JSON,RegExp,Error,TypeError,Object,Array,String,Number,Map,Set,Promise,Uint8Array,
    crypto:globalThis.crypto,localStorage,globalThis:null
  });
  context.globalThis=context;
  for(const file of ['internal','persistence'])vm.runInContext(readCoreScript(file),context,{filename:`${file}.js`});
  const persistence=context[Symbol.for('studyDirector.internalModules.v1')].require('persistence',1);
  const local=persistence.createLocalStorage();
  const identity=persistence.createInstallationIdentity(Object.freeze({local,keys:Object.freeze({installationId:'installation'}),describe:()=>kind}));
  return {backing,identity,persistence};
}

// The device ID says what the device is: inst_<type>_<browser>_<first use>_<random>.
const current=runtime({installation:'inst_iphone_safari_mve00000_abcdef01',legacyDevice:'dev_old'});
assert.equal(current.identity.contractVersion,4);
assert.equal(current.identity.getId(),'inst_iphone_safari_mve00000_abcdef01','current installation identity must remain stable');
assert.equal(current.backing.get('legacyDevice'),'dev_old','ordinary installation identity must not read, rewrite, or retire historical device identity state');
for(const name of ['compatibilityDeviceId','retireLegacy','verifyRetired'])assert.equal(Object.hasOwn(current.identity,name),false);

const fresh=runtime({legacyDevice:'dev_legacy_installation'},{type:'android',browser:'chrome'});
const generated=fresh.identity.getId();
assert.match(generated,/^inst_android_chrome_[a-z0-9]{6,12}_[a-f0-9]{8}$/u,'a new ID names the device and browser');
assert.equal(fresh.backing.get('installation'),generated,'fresh current identity must be durable');
assert.equal(fresh.identity.getId(),generated,'the ID is made once');
assert.equal(fresh.backing.get('legacyDevice'),'dev_legacy_installation','historical identity must remain exclusively for the compatibility facade to migrate/retire');

// A browser-data clear removes the stored ID; the open tab writes it back,
// and leaves alone an ID another tab has written since.
fresh.backing.delete('installation');
assert.equal(fresh.identity.keep(),true);assert.equal(fresh.backing.get('installation'),generated,'the open tab writes its ID back after a clear');
fresh.backing.set('installation','inst_android_chrome_mve00001_12345678');
assert.equal(fresh.identity.keep(),true);assert.equal(fresh.backing.get('installation'),'inst_android_chrome_mve00001_12345678','an ID written since is kept');

const unnamed=runtime({installation:'inst_current_installation'},{type:'toaster',browser:'lynx'}).identity.getId();
assert.match(unnamed,/^inst_device_browser_[a-z0-9]{6,12}_[a-f0-9]{8}$/u,'an ID that does not say what the device is is made again; an unknown device reads as Device · Browser');

// Names: any device can name any other from its ID alone.
const {deviceName,describeDevice}=current.persistence;
const day=Date.UTC(2026,8,1),later=Date.UTC(2026,9,5);
const iphone=`inst_iphone_safari_${day.toString(36)}_abcdef01`,secondIphone=`inst_iphone_safari_${later.toString(36)}_12345678`,windows=`inst_windows_edge_${day.toString(36)}_00000000`;
assert.equal(deviceName(iphone,[windows]),'iPhone · Safari');
assert.equal(deviceName(windows,[iphone]),'Windows · Edge');
assert.match(deviceName(iphone,[secondIphone]),/^iPhone · Safari \(since .+\)$/u,'two alike devices are told apart by their first-use date');
assert.equal(deviceName('inst_current_installation'),'','an ID that does not say gives no name');
assert.equal(deviceName('dev_old'),'');
const ua=(userAgent,extra={})=>describeDevice({userAgent,...extra});
assert.deepEqual({...ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')},{type:'iphone',browser:'safari'});
assert.deepEqual({...ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',{maxTouchPoints:5})},{type:'ipad',browser:'safari'},'an iPad that reports itself as a Mac is told apart by touch');
assert.deepEqual({...ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')},{type:'mac',browser:'safari'});
assert.deepEqual({...ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')},{type:'windows',browser:'edge'});
assert.deepEqual({...ua('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36')},{type:'android',browser:'samsung'});
assert.deepEqual({...ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15')},{type:'iphone',browser:'firefox'});
assert.deepEqual({...ua('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')},{type:'chromeos',browser:'chrome'});
assert.deepEqual({...ua('')},{type:'device',browser:'browser'});

console.log(JSON.stringify({status:'PASS',suite:'installation-identity',currentOnly:true,legacyMigrationIsolated:true,namesFromIds:true},null,2));
