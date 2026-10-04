import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('source/app.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const presentationSource=scripts.find(source=>source.includes('studyDirector.presentationKernel.v1'));
assert.ok(presentationSource,'Presentation Kernel bootstrap must remain inline and discoverable.');

function loadKernel({storedTheme=null,storedPresentation=null}={}){
  const root={dataset:{theme:'dark',presentation:'glass',typography:'glass',shape:'glass',material:'glass',depth:'glass',density:'standard',responsive:'adaptive',motion:'precise',charts:'analytical'},style:{}};
  const meta={
    themeColor:{content:'#04050a',setAttribute(name,value){if(name==='content')this.content=String(value);}},
    statusBar:{content:'black-translucent',setAttribute(name,value){if(name==='content')this.content=String(value);}}
  };
  const document={
    documentElement:root,visibilityState:'visible',
    querySelector:selector=>selector==='meta[name="theme-color"]'?meta.themeColor:selector==='meta[name="apple-mobile-web-app-status-bar-style"]'?meta.statusBar:null
  };
  const storage=new Map();
  if(storedTheme!==null)storage.set('studyDirector.theme.v1',String(storedTheme));
  if(storedPresentation!==null)storage.set('studyDirector.presentation.v1',String(storedPresentation));
  const localStorage={getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value))};
  const window={};
  const context=vm.createContext({
    console,Symbol,Object,Set,Map,Promise,TypeError,Error,window,document,localStorage,
    getComputedStyle:()=>({getPropertyValue:name=>{
      if(name==='--sd-meta-theme-color')return root.dataset.theme==='light'?'#f2f0ea':'#04050a';
      if(name==='--sd-meta-apple-status-bar-style')return root.dataset.theme==='light'?'default':'black-translucent';
      return '';
    }})
  });
  const compiledPresentationSource=presentationSource
    .replaceAll('@@SD_THEME_STORAGE_KEY@@','studyDirector.theme.v1')
    .replaceAll('@@SD_PRESENTATION_STORAGE_KEY@@','studyDirector.presentation.v1');
  vm.runInContext(compiledPresentationSource,context,{filename:'presentation-kernel.js'});
  const kernel=window[Symbol.for('studyDirector.presentationKernel.v1')];
  assert.ok(kernel);
  return {kernel,storage,root,meta};
}

const GLASS_PROFILE=Object.freeze({
  contractVersion:2,
  id:'glass',
  label:'Glass',
  typography:'glass',
  shape:'glass',
  material:'glass',
  depth:'glass',
  density:'standard',
  responsive:'adaptive',
  motion:'precise',
  charts:'analytical'
});

{
  const {kernel,storage,root,meta}=loadKernel();
  assert.equal(kernel.manifest.defaults.theme,'dark','Dark is the new-user default theme.');
  assert.equal(kernel.manifest.defaults.preferredPresentation,'glass','Glass is the preferred presentation for users without a saved choice.');
  assert.equal(kernel.activeThemeId(),'dark');
  assert.equal(kernel.activePresentationId(),'glass','Glass is the pre-hydration presentation for users without a saved choice.');
  assert.equal(storage.has('studyDirector.presentation.v1'),false,'Choosing the new-user default must not manufacture a persisted preference.');
  assert.equal(kernel.registerPresentation(GLASS_PROFILE),true);
  assert.equal(kernel.activePresentationId(),'glass','Glass remains active when its presentation pack registers.');
  assert.equal(storage.has('studyDirector.presentation.v1'),false,'Default Glass remains an implicit default, not a migration/write.');
  kernel.synchronizeMetadata();
  assert.equal(root.dataset.theme,'dark');
  assert.equal(meta.themeColor.content,'#04050a');
  assert.equal(meta.statusBar.content,'black-translucent');
}

for(const [storedPresentation,storedTheme,expectedColor,expectedStatus] of [
  ['director-current','dark','#04050a','black-translucent'],
  ['director-current','light','#f2f0ea','default'],
  ['glass','dark','#04050a','black-translucent'],
  ['glass','light','#f2f0ea','default']
]){
  const {kernel,storage,root,meta}=loadKernel({storedTheme,storedPresentation});
  assert.equal(kernel.activeThemeId(),storedTheme,`Saved ${storedTheme} theme must be restored during pre-hydration.`);
  assert.equal(kernel.activePresentationId(),storedPresentation,`Saved ${storedPresentation} presentation must be restored during pre-hydration.`);
  assert.equal(kernel.registerPresentation(GLASS_PROFILE),true);
  assert.equal(kernel.activePresentationId(),storedPresentation,'Registering Glass must not override a saved presentation.');
  assert.equal(storage.get('studyDirector.theme.v1'),storedTheme);
  assert.equal(storage.get('studyDirector.presentation.v1'),storedPresentation);
  kernel.synchronizeMetadata();
  assert.equal(root.dataset.theme,storedTheme);
  assert.equal(meta.themeColor.content,expectedColor,'Browser theme-color must match the restored saved theme.');
  assert.equal(meta.statusBar.content,expectedStatus,'Standalone status-bar mode must match the restored saved theme.');
}

// Aurora preserves the pre-reimagining Glass as its own skin; a saved choice
// must restore at first paint, before its pack script registers.
for(const theme of ['dark','light']){
  const {kernel,storage,root}=loadKernel({storedTheme:theme,storedPresentation:'aurora'});
  assert.equal(kernel.activePresentationId(),'aurora','Saved Aurora must restore during pre-hydration.');
  assert.deepEqual([root.dataset.typography,root.dataset.shape,root.dataset.material,root.dataset.depth],['aurora','aurora','aurora','aurora'],'Aurora owns its own presentation axes.');
  assert.equal(kernel.registerPresentation(GLASS_PROFILE),true);
  assert.equal(kernel.activePresentationId(),'aurora','Registering Glass must not override a saved Aurora choice.');
  assert.equal(storage.get('studyDirector.presentation.v1'),'aurora');
}

// Releases before the dark/light rename stored Director-prefixed theme IDs.
// They must keep restoring the same appearance without a migration write.
for(const [legacy,expected,expectedColor] of [['director-dark','dark','#04050a'],['director-light','light','#f2f0ea']]){
  const {kernel,storage,root,meta}=loadKernel({storedTheme:legacy,storedPresentation:'glass'});
  assert.equal(kernel.activeThemeId(),expected,`Legacy ${legacy} must restore as ${expected}.`);
  assert.equal(root.dataset.theme,expected,'The document must carry the canonical theme ID, never the legacy alias.');
  assert.equal(kernel.normalizeThemeId(legacy),expected,'Legacy theme IDs from backups and canonical preferences must resolve.');
  assert.equal(storage.get('studyDirector.theme.v1'),legacy,'Restoring a legacy theme must not rewrite stored preferences.');
  kernel.synchronizeMetadata();
  assert.equal(meta.themeColor.content,expectedColor);
  assert.equal(kernel.switchTheme(legacy,{persist:true}),expected);
  assert.equal(storage.get('studyDirector.theme.v1'),expected,'A deliberate theme change persists the canonical ID.');
}
assert.equal(loadKernel().kernel.normalizeThemeId('director-sepia'),'dark','Unknown theme IDs still fall back to the default.');

assert.equal('motion' in loadKernel().kernel,false,'Presentation Kernel must not expose snapshot-transition machinery to plugins; appearance transitions are host-owned.');

console.log(JSON.stringify({status:'PASS',contract:'presentation-defaults',paths:['implicit-glass-dark','saved-director-dark','saved-director-light','saved-glass-dark','saved-glass-light','legacy-director-theme-aliases','saved-aurora','prepaint-browser-chrome','no-plugin-snapshot-api']},null,2));
