
(()=>{
  const key=Symbol.for('studyDirector.presentationKernel.v1');
  const freeze=Object.freeze;
  const list=(...values)=>freeze(values);
  const presentations=freeze({
    'director-current':freeze({
      id:'director-current',
      label:'Director',
      typography:'director',
      shape:'angular',
      material:'solid',
      depth:'layered',
      density:'standard',
      responsive:'adaptive',
      motion:'precise',
      charts:'analytical'
    }),
    'glass':freeze({
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
    }),
    'aurora':freeze({
      id:'aurora',
      label:'Aurora',
      typography:'aurora',
      shape:'aurora',
      material:'aurora',
      depth:'aurora',
      density:'standard',
      responsive:'adaptive',
      motion:'precise',
      charts:'analytical'
    })
  });
  const themes=freeze({
    // Themes choose light or dark semantic roles only; skins are independent.
    'dark':freeze({id:'dark',label:'Dark'}),
    'light':freeze({id:'light',label:'Light'})
  });
  const breakpoints=freeze({
    core:freeze({
      widePlan:1100,
      executeCompact:1050,
      reviewCompact:1000,
      desktopMin:901,
      mobileMax:900,
      executeStack:720,
      compact:650,
      phone:620,
      narrow:560,
      libraryStack:500,
      smallPhone:480,
      tiny:420
    }),
    plugins:freeze({
      guide:freeze({lifecycleWrap:860,compact:680}),
      insights:freeze({compact:960,phone:620})
    })
  });
  const publicTokens=freeze({
    foundation:list(
      '--sd-meta-theme-color',
      '--sd-meta-apple-status-bar-style',
      '--sd-color-canvas',
      '--sd-color-surface-1',
      '--sd-color-surface-2',
      '--sd-color-border-1',
      '--sd-color-border-2',
      '--sd-color-border-3',
      '--sd-color-accent-primary',
      '--sd-color-accent-secondary',
      '--sd-color-info',
      '--sd-color-text-primary',
      '--sd-color-text-secondary',
      '--sd-color-text-tertiary',
      '--sd-color-text-muted',
      '--sd-color-text-secondary-strong',
      '--sd-color-text-accessible-muted',
      '--sd-color-danger',
      '--sd-color-warning',
      '--sd-color-success',
      '--sd-color-on-strong',
      '--sd-color-text-inverse',
      '--sd-color-watch',
      '--sd-color-low',
      '--sd-color-risk',
      '--sd-rgb-canvas',
      '--sd-rgb-surface-1',
      '--sd-rgb-surface-2',
      '--sd-rgb-surface-deep',
      '--sd-rgb-neutral-overlay',
      '--sd-rgb-on-strong',
      '--sd-rgb-shadow',
      '--sd-rgb-accent-primary',
      '--sd-rgb-accent-secondary',
      '--sd-rgb-info',
      '--sd-rgb-danger',
      '--sd-rgb-warning',
      '--sd-rgb-success',
      '--sd-rgb-watch',
      '--sd-rgb-low',
      '--sd-rgb-risk'
    ),
    typography:list(
      '--sd-font-mono',
      '--sd-font-condensed',
      '--sd-font-body',
      '--sd-font-display',
      '--sd-font-weight-regular',
      '--sd-font-weight-medium',
      '--sd-font-weight-semibold',
      '--sd-font-weight-bold',
      '--sd-font-weight-extrabold',
      '--sd-font-weight-black',
      '--sd-text-micro',
      '--sd-text-label',
      '--sd-text-small',
      '--sd-text-body',
      '--sd-text-input',
      '--sd-text-section',
      '--sd-text-title',
      '--sd-text-display',
      '--sd-type-role-overline-size',
      '--sd-type-role-label-size',
      '--sd-type-role-caption-size',
      '--sd-type-role-copy-compact-size',
      '--sd-type-role-copy-size',
      '--sd-type-role-body-size',
      '--sd-type-role-control-size',
      '--sd-type-role-input-size',
      '--sd-type-role-reading-size',
      '--sd-type-role-metric-size',
      '--sd-type-role-section-size',
      '--sd-type-role-title-size',
      '--sd-type-role-display-size',
      '--sd-type-role-hero-size',
      '--sd-type-role-countdown-size',
      '--sd-type-role-chart-label-size',
      '--sd-type-role-chart-axis-size',
      '--sd-leading-normal',
      '--sd-leading-roomy',
      '--sd-tracking-tight',
      '--sd-tracking-label',
      '--sd-tracking-code',
      '--sd-type-label-family',
      '--sd-type-label-size',
      '--sd-type-label-weight',
      '--sd-type-label-tracking',
      '--sd-type-label-transform',
      '--sd-type-body-family',
      '--sd-type-body-size',
      '--sd-type-body-weight',
      '--sd-type-body-leading',
      '--sd-type-body-tracking',
      '--sd-type-mono-family',
      '--sd-type-mono-size',
      '--sd-type-mono-leading',
      '--sd-type-mono-tracking',
      '--sd-type-control-family',
      '--sd-type-control-weight',
      '--sd-type-control-leading',
      '--sd-type-control-tracking',
      '--sd-type-control-transform',
      '--sd-type-title-family',
      '--sd-type-title-size',
      '--sd-type-title-weight',
      '--sd-type-title-tracking',
      '--sd-type-title-transform'
    ),
    surfaces:list(
      '--sd-line-neutral-soft',
      '--sd-line-neutral-mid',
      '--sd-line-neutral-default',
      '--sd-line-neutral-strong',
      '--sd-line-neutral-control',
      '--sd-surface-field',
      '--sd-surface-neutral-veil',
      '--sd-surface-neutral-wash',
      '--sd-surface-neutral-sheen',
      '--sd-surface-neutral-panel',
      '--sd-surface-accent-soft',
      '--sd-surface-accent-panel',
      '--sd-material-document',
      '--sd-material-surface',
      '--sd-material-card',
      '--sd-material-card-soft',
      '--sd-material-inset',
      '--sd-material-canvas',
      '--sd-material-panel',
      '--sd-material-control',
      '--sd-material-field',
      '--sd-material-disclosure',
      '--sd-material-floating',
      '--sd-material-chart-surface',
      '--sd-material-chart-tooltip',
      '--sd-shadow-card',
      '--sd-shadow-panel',
      '--sd-shadow-deep',
      '--sd-depth-card',
      '--sd-depth-panel',
      '--sd-depth-inset',
      '--sd-depth-canvas',
      '--sd-depth-floating',
      '--sd-depth-focus'
    ),
    states:list(
      '--sd-focus-accent',
      '--sd-state-accent-bg',
      '--sd-state-accent-bg-soft',
      '--sd-state-accent-bg-faint',
      '--sd-state-accent-line',
      '--sd-state-accent-line-soft',
      '--sd-state-accent-line-strong',
      '--sd-state-accent-glow',
      '--sd-state-info-bg',
      '--sd-state-info-bg-soft',
      '--sd-state-info-bg-faint',
      '--sd-state-info-line',
      '--sd-state-info-line-soft',
      '--sd-state-info-line-strong',
      '--sd-state-warn-bg',
      '--sd-state-warn-bg-soft',
      '--sd-state-warn-bg-faint',
      '--sd-state-warn-line',
      '--sd-state-warn-line-soft',
      '--sd-state-warn-line-strong',
      '--sd-state-danger-bg',
      '--sd-state-danger-bg-soft',
      '--sd-state-danger-line',
      '--sd-state-danger-line-strong',
      '--sd-state-success-bg',
      '--sd-state-success-line',
      '--sd-state-success-line-strong'
    ),
    motion:list(
      '--sd-motion-workspace-open-duration',
      '--sd-motion-workspace-close-duration',
      '--sd-motion-workspace-ease',
      '--sd-motion-feedback-duration',
      '--sd-motion-feedback-ease',
      '--sd-motion-anchored-transition'
    ),
    geometry:list(
      '--sd-radius-sm',
      '--sd-radius-md',
      '--sd-shape-inset-radius',
      '--sd-shape-canvas-radius',
      '--sd-cut-xs',
      '--sd-cut-sm',
      '--sd-cut-md',
      '--sd-cut-lg',
      '--sd-cut-hero',
      '--sd-density-touch-target',
      '--sd-density-control-min-height',
      '--sd-density-field-min-height',
      '--sd-density-field-padding',
      '--sd-density-button-padding',
      '--sd-density-panel-padding',
      '--sd-density-card-padding',
      '--sd-density-section-gap',
      '--sd-safe-top',
      '--sd-safe-right',
      '--sd-safe-bottom',
      '--sd-safe-left'
    ),
    charts:list(
      '--sd-chart-fill-none',
      '--sd-chart-stroke-none',
      '--sd-chart-axis-color',
      '--sd-chart-axis-width',
      '--sd-chart-grid-color',
      '--sd-chart-grid-width',
      '--sd-chart-label-color',
      '--sd-chart-label-strong-color',
      '--sd-chart-line-color',
      '--sd-chart-line-strong-color',
      '--sd-chart-line-width',
      '--sd-chart-line-strong-width',
      '--sd-chart-dot-color',
      '--sd-chart-dot-stroke',
      '--sd-chart-dot-stroke-width',
      '--sd-chart-tooltip-background',
      '--sd-chart-tooltip-border',
      '--sd-chart-tooltip-shadow',
      '--sd-chart-inspect-box-background',
      '--sd-chart-inspect-box-border',
      '--sd-chart-inspect-box-shadow',
      '--sd-chart-hit-selected-fill',
      '--sd-chart-hit-selected-stroke',
      '--sd-chart-hit-radius-touch',
      '--sd-chart-series-01',
      '--sd-chart-series-02',
      '--sd-chart-series-03',
      '--sd-chart-series-04',
      '--sd-chart-series-05',
      '--sd-chart-series-06',
      '--sd-chart-series-07',
      '--sd-chart-series-08',
      '--sd-chart-series-09',
      '--sd-chart-series-10',
      '--sd-chart-series-11',
      '--sd-chart-series-12',
      '--sd-chart-series-13',
      '--sd-chart-series-14',
      '--sd-chart-series-15',
      '--sd-chart-series-16'
    )
  });
  const manifest=freeze({
    format:'study-director.presentation-manifest',
    version:1,
    defaults:freeze({theme:'dark',preferredPresentation:'glass',fallbackPresentation:'director-current'}),
    themes,
    presentations,
    breakpoints,
    tokens:freeze({
      contractVersion:2,
      public:publicTokens,
      internal:freeze({
        namespace:'--sd-',
        rule:'all namespaced tokens not listed as public',
        stability:'release-private',
        consumers:'core and bundled plugins'
      })
    }),
    invariants:freeze({
      touchMinimumPx:44,
      touchMinimumScope:'direct controls and discrete touch targets',
      chartTouchModel:'full-surface nearest-point inspection',
      focusMinimumPx:2,
      safeAreaProtection:true,
      reducedMotionOverride:true,
      semanticStateMeaning:freeze({ok:'success',warn:'warning',err:'danger',info:'information',primary:'accent'}),
      canonicalBreakpoints:breakpoints.core,
      domOrder:'application-owned',
      focusOrder:'application-owned'
    })
  });
  const root=document.documentElement;
  const profileScope=window[Symbol.for('studyDirector.profileScope.v1')];
  const themeStorageKey=profileScope.scoped('@@SD_THEME_STORAGE_KEY@@');
  const presentationStorageKey=profileScope.scoped('@@SD_PRESENTATION_STORAGE_KEY@@');
  const presentationIdPattern=/^[a-z][a-z0-9-]{0,40}$/;
  const profileFields=freeze(['typography','shape','material','depth','density','responsive','motion','charts']);
  const registry=new Map(Object.entries(manifest.presentations));
  let preferredPresentationId=manifest.defaults.preferredPresentation;
  const owns=(record,value)=>Object.prototype.hasOwnProperty.call(record,value);
  const safePresentationId=value=>String(value||'').trim().toLowerCase().match(presentationIdPattern)?.[0]||'';
  const normalizeThemeId=value=>{
    const candidate=String(value||'').trim();
    return owns(manifest.themes,candidate)?candidate:manifest.defaults.theme;
  };
  const normalizePresentationId=value=>{
    const candidate=safePresentationId(value);
    return registry.has(candidate)?candidate:manifest.defaults.fallbackPresentation;
  };
  const normalizePresentationDefinition=value=>{
    if(!value||typeof value!=='object'||Number(value.contractVersion)!==manifest.tokens.contractVersion)return null;
    const id=safePresentationId(value.id);
    if(!id)return null;
    const profile={id,label:String(value.label||id).trim().slice(0,40)||id};
    for(const field of profileFields){
      const clean=safePresentationId(value[field]);
      if(!clean)return null;
      profile[field]=clean;
    }
    return freeze(profile);
  };
  const samePresentation=(left,right)=>!!(left&&right&&left.id===right.id&&left.label===right.label&&profileFields.every(field=>left[field]===right[field]));
  const applyPresentation=profileId=>{
    const clean=normalizePresentationId(profileId);
    const profile=registry.get(clean)||manifest.presentations[manifest.defaults.fallbackPresentation];
    Object.assign(root.dataset,{
      presentation:profile.id,
      typography:profile.typography,
      shape:profile.shape,
      material:profile.material,
      depth:profile.depth,
      density:profile.density,
      responsive:profile.responsive,
      motion:profile.motion,
      charts:profile.charts
    });
    return clean;
  };
  const defaultRead=(key,fallback)=>{
    try{
      const value=localStorage.getItem(key);
      return value===null?fallback:value;
    }catch(error){
      return fallback;
    }
  };
  const defaultWrite=(key,value)=>{
    try{
      localStorage.setItem(key,String(value));
      return true;
    }catch(error){
      return false;
    }
  };
  const readStoredTheme=(read=defaultRead)=>normalizeThemeId(read(themeStorageKey,manifest.defaults.theme));
  const readStoredPresentation=(read=defaultRead)=>{
    const stored=safePresentationId(read(presentationStorageKey,manifest.defaults.preferredPresentation));
    preferredPresentationId=stored||manifest.defaults.preferredPresentation;
    return registry.has(preferredPresentationId)?preferredPresentationId:manifest.defaults.fallbackPresentation;
  };
  const restoreStoredPresentation=(read=defaultRead)=>applyPresentation(readStoredPresentation(read));
  const listPresentations=()=>freeze([...registry.values()]);
  const registerPresentation=value=>{
    const profile=normalizePresentationDefinition(value);
    if(!profile)return false;
    const current=registry.get(profile.id);
    if(current)return samePresentation(current,profile);
    registry.set(profile.id,profile);
    if(profile.id===preferredPresentationId)applyPresentation(profile.id);
    return true;
  };
  const switchPresentation=(presentationId,{persist=false,write=defaultWrite}={})=>{
    const clean=normalizePresentationId(presentationId);
    preferredPresentationId=clean;
    applyPresentation(clean);
    if(persist)write(presentationStorageKey,clean);
    return clean;
  };
  const synchronizeMetadata=()=>{
    const styles=getComputedStyle(root);
    const themeColor=document.querySelector('meta[name="theme-color"]');
    const statusBar=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const computedColor=styles.getPropertyValue('--sd-meta-theme-color').trim();
    const computedStatus=styles.getPropertyValue('--sd-meta-apple-status-bar-style').trim();
    if(themeColor&&computedColor)themeColor.setAttribute('content',computedColor);
    if(statusBar&&computedStatus)statusBar.setAttribute('content',computedStatus);
  };
  const switchTheme=(themeId,{persist=false,write=defaultWrite,syncMetadata=true}={})=>{
    const clean=normalizeThemeId(themeId);
    root.dataset.theme=clean;
    if(persist)write(themeStorageKey,clean);
    if(syncMetadata)synchronizeMetadata();
    return clean;
  };
  const activeThemeId=()=>normalizeThemeId(root.dataset.theme);
  const activePresentationId=()=>normalizePresentationId(root.dataset.presentation);
  const kernel=freeze({
    format:'study-director.presentation-kernel',
    version:1,
    manifest,
    normalizeThemeId,
    normalizePresentationId,
    readStoredTheme,
    readStoredPresentation,
    restoreStoredPresentation,
    activeThemeId,
    activePresentationId,
    listPresentations,
    registerPresentation,
    switchPresentation,
    synchronizeMetadata,
    switchTheme
  });
  Object.defineProperty(window,key,{value:kernel,writable:false,enumerable:false,configurable:false});
  switchTheme(readStoredTheme(),{syncMetadata:false});
  restoreStoredPresentation();
})();
