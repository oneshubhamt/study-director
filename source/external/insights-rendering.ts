import type {InsightsModelRuntime,InsightsResult} from './insights-model.ts';

type Model=InsightsResult;
type Subject=Model['subjects'][number];
type DailyRow=Model['daily'][number];
type Practice=Model['practice'];
type PracticeDailyRow=Practice['daily'][number];
type PracticePositionRow=Practice['position']['profile'][number];
type PracticeRepeatedSegment=Practice['repeatedSegments'][number];
type PracticeSizeGroup=Practice['unitSizeGroups']['all'][number];
type PracticeGroupRow=Practice['areas'][number];
type Fitness=Model['fitness'];
type FitnessDimension=NonNullable<Fitness['performanceState']['dimensions']>[keyof NonNullable<Fitness['performanceState']['dimensions']>];
type Dynamics=Model['dynamics'];
type Workload=NonNullable<Dynamics['workload']>;
type ChartHit={node:SVGElement;text:string;initial?:boolean};
type ChartNode=Element;
type ChartItem={draw:()=>ChartNode;after:(()=>void)|undefined;node:ChartNode};
type RendererApi=Readonly<{
  preview?:Readonly<{
    clear?(target:string):unknown;
    useSample?(options:Readonly<{label:string;target:'insights';today:string}>):PromiseLike<Readonly<{ok?:boolean}>>|Readonly<{ok?:boolean}>;
  }>;
  ui?:Readonly<{goTab?(tab:string):unknown}>;
}>;
type Reload=()=>unknown;
type DisplayValue=string|number|null|undefined;
type StartDelayRow=Model['startDelays'][number];
type BlockOrderRow=Model['blockOrder'][number];
type BarSeriesRow=Readonly<{blocks:number;label:string;completion:number|null}>;
type TrendDailyRow=DailyRow&Readonly<{rolling7:number|null|undefined}>;
type LineChartKey='completion'|'rolling7';
type LineChartOptions=Readonly<{key?:LineChartKey;softKey?:LineChartKey;label?:string}>;
type CalendarRange=Readonly<{start?:string|null;end?:string|null}>;
type ResourceRow=Model['resourceMix'][number];
type CoachSignal=Model['interpretation']['signals']['coach'][number];
type CoachSurfaceSignal=Model['interpretation']['signals']['surfaces'][number];
type CoverageGeometry={plotTop:number;plotBottom:number;plotLeft:number;plotRight:number;plotW:number;plotH:number;compact:boolean;pointCount:number};
type CoveragePoint=Subject&{evidenceConfidence:number;index:number;code:string;cx:number;cy:number;r:number;tone:string};
type CoverageInteractivePoint=CoveragePoint&{group:SVGGElement;node:SVGGElement;text:string};
type CoverageNodeView=Readonly<{
  svg:SVGSVGElement;groups:CoverageInteractivePoint[];inspectLine:SVGLineElement;title:SVGTextElement;line1:SVGTextElement;line2:SVGTextElement;
  inspectX:number;inspectY:number;inspectW:number;riskLabel:(subject:Subject)=>string;compact:boolean;
}>;
type HeatCell=HTMLDivElement;
type PracticeComparisonRow=Practice['areas'][number]|Practice['modes'][number];
type AllocationRow=Subject;
type Bayesian=Model['dynamics']['bayesian'];
type Allocation=Model['dynamics']['allocation'];
type Cascade=Model['dynamics']['cascade'];
type UnionKeys<T>=T extends T?keyof T:never;
type UnionValue<T,K extends PropertyKey>=T extends T?K extends keyof T?T[K]:never:never;
type CompleteUnion<T>={ [K in UnionKeys<T>]?:UnionValue<T,K>|undefined };
type RenderBayesian=CompleteUnion<Bayesian>;
type RenderAllocation=CompleteUnion<Allocation>;
type RenderDynamicAllocation=CompleteUnion<NonNullable<RenderAllocation['dynamic']>>;
type RenderCascade=CompleteUnion<Cascade>;
type RenderCascadeAdjusted=CompleteUnion<NonNullable<RenderCascade['adjusted']>>;
type RenderHazard=CompleteUnion<NonNullable<RenderCascadeAdjusted['hazard']>>;
type HazardCurveRow=NonNullable<RenderHazard['curve']>[number];
type RenderWorkload=CompleteUnion<Workload>;
type RenderForecast=CompleteUnion<NonNullable<RenderWorkload['forecast']>>;
type RenderChangePoint=CompleteUnion<Model['dynamics']['changePoint']>;
type RenderCalibration=CompleteUnion<NonNullable<RenderForecast['calibration']>|NonNullable<RenderWorkload['calibration']>>;
type WorkloadCurveRow=NonNullable<RenderWorkload['curve']>[number]|NonNullable<RenderWorkload['forecastCurve']>[number];
type WorkloadPoint={
  planned:number;completionMean:number|null;completionLow:number|null;completionHigh:number|null;
  strongProbability:number|null;strongLow:number|null;strongHigh:number|null;expectedCompleted:number|null;
};
type BayesianDimension=NonNullable<RenderBayesian['dimensions']>[number];
type BayesianPatternRow=BayesianDimension['rows'][number];
type PatternRead={dimension:BayesianDimension;row:BayesianPatternRow};


const PREVIEW_SAMPLE_DAYS=28;
const MIN_WEEKDAY_SAMPLES_FOR_PATTERN=3;
const MIN_VISIBLE_PRACTICE_DIFFERENCE_POINTS=8;
const MIN_PRACTICE_EARLY_VIEW_UNITS=3;
const MIN_PRACTICE_EARLY_VIEW_TOTAL_UNITS=8;
const MAX_DYNAMICS_SUPPORTING_READS=3;
const MAX_WORKLOAD_HISTORY_POINTS_DESKTOP=220;
const MAX_WORKLOAD_HISTORY_POINTS_COMPACT=120;
const MAX_COMPLETION_CHART_DAYS_DESKTOP=90;
const MAX_COMPLETION_CHART_DAYS_COMPACT=14;
const MAX_STABILITY_CHART_DAYS_DESKTOP=90;
const MAX_STABILITY_CHART_DAYS_COMPACT=14;
const MAX_PLAN_SCATTER_DAYS_DESKTOP=60;
const MAX_PLAN_SCATTER_DAYS_COMPACT=16;
const WORK_TREND_MAX_CONNECTED_GAP_DAYS=3;
const SVG_NS='http://www.w3.org/2000/svg';

function createInsightsRendering(
  Config:InsightsModelRuntime['Config'],
  Primitives:InsightsModelRuntime['Primitives'],
  PacerEvidence:InsightsModelRuntime['PacerEvidence'],
  Coach:InsightsModelRuntime['Coach']
){

    const {
      BOCPD_DETECTION_PROBABILITY,COACH_VISIBLE_SIGNAL_LIMIT,EVIDENCE_BASIS,INSIGHT_WINDOW_OPTIONS,
      
      
      
      MIN_BLOCKS_FOR_SIGNAL,MIN_CHANGE_POINT_SEGMENT_DAYS,MIN_FORECAST_BACKTESTS,
      MIN_MEANINGFUL_DIFFERENCE_POINTS,MIN_PRACTICE_COMPARABLE_RUNS,
      MIN_PRACTICE_ESTABLISHED_RUNS,MIN_PRACTICE_POSITION_RUNS,
      MIN_PRACTICE_POSITION_UNITS,MIN_PRACTICE_SEGMENT_EFFECT_POINTS,MIN_TIMER_COVERAGE_FOR_PLAN_READ,
      PRACTICE_CONTROLLED_MAX,
      PRACTICE_CONTROLLED_MIN
    }=Config;
    const {
      apportionedPercents,clamp,clampPct,confidenceAtLeast,dateDay,dateFromDay,delayLabel,
      descriptiveEvidenceConfidence,finiteOrNull,isIsoDate,labelCompare,mean,minutesLabel,num,numberLabel,pct,
      percentLabel,round,shortDate,signedMillisecondsLabel,stdev
    }=Primitives;
    const {
      practicePacerReading
    }=PacerEvidence;
    const {
      hasBestSubjectEvidence
    }=Coach;
  function el<K extends keyof HTMLElementTagNameMap>(tag:K,className?:string|null,text?:DisplayValue):HTMLElementTagNameMap[K]{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined&&text!==null)node.textContent=String(text);
    return node;
  }
  function evidenceNote(text:DisplayValue,className=''):HTMLDivElement{
    return el('div',`insights-note${className?' '+className:''} ui-mono`,text);
  }
  function kvItem(className:string,label:DisplayValue,value:DisplayValue,note:DisplayValue='',valueFirst=false,labelClass='k ui-label',valueClass='v ui-mono'):HTMLDivElement{
    const item=el('div',className);
    const labelNode=el('div',labelClass,label),valueNode=el('div',valueClass,value);
    item.append(...(valueFirst?[valueNode,labelNode]:[labelNode,valueNode]));
    if(note)item.appendChild(el('div','n ui-mono',note));
    return item;
  }
  function lazyDisclosure(className:string,summary:string|Node,build:()=>Node|null|undefined,busy=false):HTMLDetailsElement{
    const details=el('details',className);
    details.appendChild(typeof summary==='string'?el('summary',null,summary):summary);
    let rendered=false,builder:(()=>Node|null|undefined)|null=build;
    details.addEventListener('toggle',()=>{
      if(!details.open||rendered)return;
      rendered=true;
      if(busy)details.setAttribute('aria-busy','true');
      const factory=builder;builder=null;
      if(!factory)return;
      const body=factory();
      if(body)details.appendChild(body);
      if(busy)details.removeAttribute('aria-busy');
    });
    return details;
  }
  function svgEl<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Readonly<Record<string,string|number>>={}):SVGElementTagNameMap[K]{
    const node=document.createElementNS(SVG_NS,tag);
    Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
    return node;
  }
  function isCompact(){
    return !!(window.matchMedia&&window.matchMedia('(max-width:620px)').matches);
  }
  const Layout=(()=>{
    const charts=new Set<ChartItem>();let compact=isCompact(),timer:number|null=null;
    const purge=(pane:HTMLElement)=>charts.forEach(item=>{if(!item.node.isConnected||pane.contains(item.node))charts.delete(item);});
    const chart=(draw:()=>ChartNode,after?:()=>void)=>{const item:ChartItem={draw,after,node:draw()};charts.add(item);return item.node;};
    const redraw=(pane:HTMLElement)=>charts.forEach(item=>{if(!item.node.isConnected){charts.delete(item);return;}if(pane.contains(item.node)){const next=item.draw();item.node.replaceWith(next);item.node=next;if(item.after)item.after();}});
    const mark=()=>{compact=isCompact();};
    const resize=(getPane:()=>HTMLElement|null)=>{
      const next=isCompact();if(next===compact){if(timer){clearTimeout(timer);timer=null;}return;}
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>{timer=null;const final=isCompact();if(final===compact)return;compact=final;const pane=getPane();if(pane)redraw(pane);},120);
    };
    return Object.freeze({chart,mark,purge,resize});
  })();
  let accessibleGraphicSequence=0;
  function labelGraphic(svg:SVGSVGElement,label:string,description=''):SVGSVGElement{
    if(!svg)return svg;
    const id=`insights-graphic-${++accessibleGraphicSequence}`;
    const title=svgEl('title',{id:`${id}-title`});
    title.textContent=label;
    svg.insertBefore(title,svg.firstChild);
    const labelledBy=[`${id}-title`];
    if(description){
      const desc=svgEl('desc',{id:`${id}-desc`});
      desc.textContent=description;
      svg.insertBefore(desc,title.nextSibling);
      labelledBy.push(`${id}-desc`);
    }
    svg.setAttribute('aria-labelledby',labelledBy.join(' '));
    return svg;
  }
  function chartHitRadiusClass(radius:number){
    const value=Number(radius);
    if(value===8)return ' chart-hit-xs';
    if(value===9)return ' chart-hit-sm';
    if(value===10)return ' chart-hit-md';
    if(value===14)return ' chart-hit-default';
    if(value===15)return ' chart-hit-emphasis';
    if(value===22)return ' chart-hit-touch';
    return '';
  }
  function chartHitCircle(svg:SVGSVGElement,x:number,y:number,text:string,items:ChartHit[],r=14){
    const hit=svgEl('circle',{class:`chart-hit-zone${chartHitRadiusClass(r)}`,cx:x,cy:y,r,tabindex:'0',role:'button','aria-label':text});
    svg.appendChild(hit);items.push({node:hit,text});return hit;
  }
  function chartHitRect(svg:SVGSVGElement,x:number,y:number,width:number,height:number,text:string,items:ChartHit[]){
    const hit=svgEl('rect',{class:'chart-hit-zone',x,y,width,height,tabindex:'0',role:'button','aria-label':text});
    svg.appendChild(hit);items.push({node:hit,text});return hit;
  }
  function finiteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}
  function coarsePointerActive(){
    return !!(window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches);
  }
  function nearestInteractiveItem<T extends ChartHit>(items:readonly T[],clientX:number,clientY:number):T|null{
    let nearest:T|null=null,best=Infinity;
    items.forEach(item=>{
      const rect=item&&item.node&&item.node.getBoundingClientRect&&item.node.getBoundingClientRect();
      if(!rect||!rect.width||!rect.height)return;
      const dx=clientX-(rect.left+rect.width/2),dy=clientY-(rect.top+rect.height/2);
      const distance=dx*dx+dy*dy;
      if(distance<best){best=distance;nearest=item;}
    });
    return nearest;
  }
  function inspectedChart(svg:SVGSVGElement,items:ChartHit[]=[],initialText='Tap a point or bar to inspect it.'):HTMLDivElement{
    const wrap=el('div','insights-chart-widget ui-canvas');
    const caption=el('div','insights-chart-inspector ui-mono',initialText);
    const select=(item:ChartHit)=>{
      items.forEach(row=>row.node.classList.toggle('selected',row===item));
      caption.textContent=item.text;
    };
    items.forEach(item=>{
      item.node.addEventListener('click',event=>{event.preventDefault();select(item);});
      item.node.addEventListener('focus',()=>select(item));
      item.node.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();select(item);
      });
    });
    svg.classList.add('insights-chart-touch-surface');
    svg.dataset['touchInspect']='nearest';
    svg.addEventListener('click',event=>{
      if(!coarsePointerActive())return;
      if(event.target instanceof Element&&event.target.closest('.chart-hit-zone'))return;
      const nearest=nearestInteractiveItem(items,event.clientX,event.clientY);
      if(nearest)select(nearest);
    });
    if(items.length){const initial=items.slice().reverse().find(item=>item.initial)??items[items.length-1];if(initial)select(initial);}
    wrap.append(svg,caption);
    return wrap;
  }
  function appendChartNote(widget:HTMLElement,text:string){
    if(widget&&text)widget.appendChild(el('div','insights-rhythm-note ui-mono',text));
    return widget;
  }
  function chartFrame(width:number,height:number,pad:number,rightPad=pad){
    const svg=svgEl('svg',{class:'insights-chart',viewBox:`0 0 ${width} ${height}`,role:'group'});
    const plotRight=width-rightPad;
    const plotBottom=height-pad;
    svg.appendChild(svgEl('line',{class:'axis',x1:pad,y1:plotBottom,x2:plotRight,y2:plotBottom}));
    svg.appendChild(svgEl('line',{class:'axis',x1:pad,y1:pad,x2:pad,y2:plotBottom}));
    return {svg,plotRight,plotBottom,plotWidth:plotRight-pad,plotHeight:plotBottom-pad};
  }
  function chartEmpty(svg:SVGSVGElement,text:string,x:number,y:number,textAnchor?:string):SVGSVGElement{
    const label=svgEl('text',{class:'label',x,y,...(textAnchor?{'text-anchor':textAnchor}:{})});
    label.textContent=text;
    svg.appendChild(label);
    return svg;
  }
  // 9B. BASE STYLES
  const INSIGHTS_BASE_STYLES=`
/* INSIGHTS-01 · FRAME, NAVIGATION, WINDOW, AND DEFINITIONS Owns the plugin shell, hero, window selector, section navigation, and metric guide. */
.insights-wrap{
  display:flex;flex-direction:column;gap:var(--sd-density-section-gap)}
.insights-update-status{position:fixed;right:max(16px,var(--sd-safe-right));bottom:max(16px,var(--sd-safe-bottom));z-index:320;max-width:min(360px,calc(100vw - 32px));padding:var(--sd-space-09) var(--sd-space-12);--inset-line:var(--sd-state-info-line);--inset-bg:var(--sd-material-floating);--inset-shadow:var(--sd-depth-floating);color:var(--sd-color-info)}
.insights-update-status.err{--inset-line:var(--sd-state-danger-line);color:var(--sd-color-danger)}
.insights-hero{--panel-line:var(--sd-color-border-2);--panel-cut-size:var(--sd-cut-hero);--panel-padding:var(--sd-space-14) var(--sd-space-20);display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'heading options' 'copy copy';column-gap:18px;row-gap:10px}
.insights-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--sd-color-accent-secondary),var(--sd-color-accent-primary),var(--sd-color-info))}
.insights-hero-heading{grid-area:heading;min-width:0}
.insights-kicker{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:4.2px;margin-bottom:3px}
.insights-title{font-size:var(--sd-type-role-title-size);font-weight:var(--sd-font-weight-black);letter-spacing:2px;line-height:1}
.insights-window-bar{display:contents}
.insights-window-copy{grid-area:copy;min-width:0;padding-top:10px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.07);display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.insights-window-title{font-size:var(--sd-type-role-overline-size);letter-spacing:3.2px;color:var(--sd-color-text-secondary)}
.insights-window-note{font-size:var(--sd-type-role-copy-compact-size);line-height:1.35;color:var(--sd-color-text-tertiary)}
.insights-window-options{grid-area:options;align-self:center;justify-self:end;display:flex;gap:7px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
.insights-window-btn{appearance:none;--btn-border-width:1px;--btn-bg:var(--sd-material-insights-window-control);padding:var(--sd-space-07) var(--sd-space-10);font-size:var(--sd-type-role-overline-size);letter-spacing:2px}
.insights-window-btn:hover,.insights-window-btn:focus{--btn-hover-border:rgba(var(--sd-rgb-info),.38);outline:none}
.insights-window-btn.active{--btn-border:var(--sd-focus-accent);--btn-bg:var(--sd-state-accent-bg-soft);--btn-color:var(--sd-color-text-primary)}
.insights-section-nav{z-index:8;display:flex;align-items:center;gap:6px;padding:var(--sd-space-07);--inset-bg:var(--sd-material-insights-navigation);--inset-shadow:var(--sd-depth-insights-navigation);overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(var(--sd-rgb-info),.24) transparent}
.insights-section-nav-btn{appearance:none;flex:1 0 auto;min-height:38px;--btn-border-width:1px;--btn-border:transparent;padding:var(--sd-space-07) var(--sd-space-10);font-size:var(--sd-type-role-overline-size);letter-spacing:2.15px;text-transform:uppercase;white-space:nowrap}
.insights-section-nav-btn:hover,.insights-section-nav-btn:focus-visible{outline:none;--btn-hover-border:rgba(var(--sd-rgb-info),.30);--btn-hover-bg:var(--sd-state-info-bg)}
.insights-section-nav-btn.active{--btn-border:rgba(var(--sd-rgb-accent-primary),.28);--btn-bg:var(--sd-surface-accent-soft);--btn-color:var(--sd-color-accent-primary)}
.insights-anchor-target{scroll-margin-top:66px}
.insights-definition-strip{margin-top:13px;padding:var(--sd-space-12) var(--sd-space-13);--inset-line:var(--sd-state-info-line-soft);--inset-shadow:var(--sd-depth-insights-definition);display:grid;gap:10px}
.insights-definition-title{font-size:var(--sd-type-role-label-sm-size);letter-spacing:3.2px;color:var(--sd-color-accent-primary);text-transform:uppercase}
.insights-definition-grid,.insights-reliability-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.insights-definition-item{min-width:0;padding:var(--sd-space-10) var(--sd-space-11);display:grid;gap:6px;align-content:start}
.insights-definition-item .k{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.35px;color:var(--sd-color-text-secondary);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-definition-item .v{font-size:var(--sd-type-role-copy-compact-wide-size);line-height:1.42;color:var(--sd-color-text-primary);letter-spacing:.35px;white-space:normal}
.insights-metric-guide-disclosure{--inset-line:rgba(var(--sd-rgb-info),.14)}
.insights-metric-guide-disclosure>summary{cursor:pointer;padding:10px 12px;color:var(--sd-color-accent-primary);font-size:var(--sd-type-role-overline-size);font-weight:800;letter-spacing:2.4px;text-transform:uppercase}
.insights-metric-guide-body{padding:0 10px 10px}
.insights-cluster-head{display:grid;gap:5px;padding:4px 2px 0}
.insights-cluster-title{font-size:var(--sd-type-role-caption-size);letter-spacing:4px;color:var(--sd-color-accent-primary);text-transform:uppercase}
.insights-cluster-note{font-size:var(--sd-type-role-copy-compact-expanded-size);line-height:1.45;color:var(--sd-color-text-tertiary);max-width:900px}
/* INSIGHTS-02 · SHARED LAYOUT, EXECUTION TABS, AND CARDS Owns grids, Execution switching, shared cards, titles, and supporting copy. */
.insights-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
.insights-grid.insights-diagnostics{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}
.insights-execution,.insights-visual-stack,.insights-area-coverage{display:grid;gap:12px}
.insights-execution-surface,.insights-allocation-visual{display:grid;gap:12px;min-width:0}
.insights-execution-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:5px;--inset-bg:var(--sd-material-content-subtle)}
.insights-execution-tab{min-height:40px;padding:9px 12px;--btn-border-width:1px;--btn-border:transparent;letter-spacing:1.8px}
.insights-execution-tab:hover{--btn-hover-border:var(--sd-line-neutral-mid)}
.insights-execution-tab.active{--btn-color:var(--sd-color-accent-primary);--btn-border:rgba(var(--sd-rgb-accent-primary),.28);--btn-bg:var(--sd-surface-accent-soft);box-shadow:0 0 16px var(--sd-state-accent-glow)}
.insights-execution-tab-panel{min-width:0}
.insights-execution-tab-panel[hidden]{display:none!important}
.insights-practice-embedded{--card-line:rgba(var(--sd-rgb-pacer-primary),.22);overflow:hidden;padding:0}
.insights-practice-embedded-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(var(--sd-rgb-pacer-primary),.18)}
.insights-execution .insights-rhythm-grid .insights-card{padding:13px 15px}
.insights-card{padding:var(--sd-density-card-padding)}
.insights-card.soft{--card-bg:var(--sd-material-card-soft)}
.insights-section-title{display:flex;justify-content:space-between;gap:12px;align-items:end}
.insights-label{font-size:var(--sd-type-role-label-size);letter-spacing:3.6px;margin-bottom:8px}
.insights-main{font-size:var(--sd-type-role-section-emphasis-size);font-weight:800;letter-spacing:1px;line-height:1.08;color:var(--sd-color-text-primary)}
.insights-note{margin-top:8px;font-size:var(--sd-type-role-copy-compact-size);line-height:1.45;color:var(--sd-color-text-secondary)}
/* INSIGHTS-03 · STUDY COACH Owns evidence signals, ranked decisions, synthesis, and surface jump controls. */
.insights-coach-card{display:grid;gap:11px}
.insights-coach,.insights-heatmap-widget,.insights-fitness-state-list{display:grid;gap:8px}
.insights-coach-evidence{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:5px;padding:5px;--inset-line:rgba(var(--sd-rgb-accent-primary),.16)}
.insights-coach-evidence-item{--evidence-tone:var(--sd-color-text-secondary);min-width:0;padding:5px 8px;border-left:2px solid var(--evidence-tone)}
.insights-coach-evidence-item.good{--evidence-tone:var(--sd-color-accent-primary)}
.insights-coach-evidence-item.strong{--evidence-tone:var(--sd-color-info)}
.insights-coach-evidence-item.watch{--evidence-tone:var(--sd-color-watch)}
.insights-coach-evidence-item.low{--evidence-tone:var(--sd-color-low)}
.insights-coach-evidence-item .l{font-size:var(--sd-type-role-overline-xxs-size);letter-spacing:1.8px;color:var(--sd-color-text-secondary);margin-bottom:3px}
.insights-coach-evidence-item .v{font-size:var(--sd-type-role-copy-compact-size);line-height:1.2;color:var(--evidence-tone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-coach-decision{--coach-tone:var(--sd-color-accent-primary);padding:11px 12px;border-left:3px solid var(--coach-tone);display:grid;gap:8px}
.insights-coach-decision.primary{padding:var(--sd-space-15) var(--sd-space-16) var(--sd-space-13);--canvas-shadow:var(--sd-depth-insights-coach-primary)}
.insights-coach-decision.strong{--coach-tone:var(--sd-color-info)}
.insights-coach-decision.watch{--coach-tone:var(--sd-color-watch)}
.insights-coach-decision.low{--coach-tone:var(--sd-color-low)}
.insights-coach-decision.quiet{--coach-tone:var(--sd-color-text-secondary)}
.insights-coach-decision-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
.insights-coach-decision-kicker{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:3px;color:var(--coach-tone);text-transform:uppercase}
.insights-coach-decision-tags{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.insights-coach-decision-tag,.insights-coach-decision-surface{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:1.8px;line-height:1;padding:5px 7px;white-space:nowrap;--chip-color:var(--sd-color-text-primary);--chip-line:rgba(var(--sd-rgb-neutral-overlay),.14);--chip-bg:rgba(var(--sd-rgb-neutral-overlay),.04)}
.insights-coach-decision-surface{--chip-color:var(--sd-color-text-secondary);--chip-line:rgba(var(--sd-rgb-info),.16);--chip-bg:var(--sd-state-info-bg-soft)}
.insights-coach-decision-copy{font-size:var(--sd-type-role-copy-relaxed-size);line-height:1.47;color:var(--sd-color-text-primary)}
.insights-coach-decision.primary .insights-coach-decision-copy{font-size:var(--sd-type-role-input-size);line-height:1.5;max-width:980px}
.insights-coach-decision-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;padding-top:7px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.055)}
.insights-coach-decision-evidence{font-size:var(--sd-type-role-label-xs-size);color:var(--sd-color-text-tertiary)}
.insights-coach-open{min-height:28px;padding:5px 8px;--btn-border-width:1px;--btn-border:var(--sd-state-info-line-soft);--btn-bg:var(--sd-state-info-bg-soft);--btn-color:var(--sd-color-info);font-size:var(--sd-type-role-overline-size);letter-spacing:1.3px;white-space:nowrap}
.insights-coach-open:hover{--btn-hover-border:rgba(var(--sd-rgb-info),.40);--btn-hover-bg:rgba(var(--sd-rgb-info),.06)}
.insights-coach-synthesis{min-width:0;max-width:100%;--inset-line:rgba(var(--sd-rgb-info),.14)}
.insights-coach-synthesis>summary{cursor:pointer;padding:10px 12px;color:var(--sd-color-accent-primary);font-size:var(--sd-type-role-overline-size);font-weight:800;letter-spacing:2.3px;text-transform:uppercase}
.insights-coach-synthesis-body{min-width:0;max-width:100%;padding:0 9px 9px}
.insights-coach-surface-grid{min-width:0;max-width:100%;display:grid;gap:6px}
.insights-coach-surface{--surface-tone:var(--sd-color-text-secondary);display:grid;grid-template-columns:minmax(120px,.55fr) minmax(0,2fr) minmax(155px,.8fr) auto;gap:10px;align-items:center;min-width:0;padding:9px 10px;border-left:3px solid var(--surface-tone)}
.insights-coach-surface.good{--surface-tone:var(--sd-color-accent-primary)}
.insights-coach-surface.strong{--surface-tone:var(--sd-color-info)}
.insights-coach-surface.watch{--surface-tone:var(--sd-color-watch)}
.insights-coach-surface.low{--surface-tone:var(--sd-color-low)}
.insights-coach-surface-head{display:grid;gap:4px;align-content:start}
.insights-coach-surface-label{font-size:var(--sd-type-role-overline-compact-size);letter-spacing:2.1px;color:var(--surface-tone);text-transform:uppercase}
.insights-coach-surface-tag{font-size:var(--sd-type-role-overline-xs-size);letter-spacing:1.2px;color:var(--sd-color-text-secondary)}
.insights-coach-surface-copy{font-size:var(--sd-type-role-copy-compact-tight-size);line-height:1.42;color:var(--sd-color-text-primary)}
.insights-coach-surface-evidence{min-width:0;font-size:var(--sd-type-role-overline-size);color:var(--sd-color-text-tertiary)}
/* INSIGHTS-04 · PERFORMANCE, OUTPUT, AND DAILY EXECUTION VISUALS Owns evidence strips, training/output bars, rhythm summaries, and shared charts. */
.insights-evidence-strip{padding:var(--sd-space-14) var(--sd-space-16);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
.insights-evidence-item{min-width:0;border-left:1px solid var(--sd-line-neutral-default);padding-left:12px}
.insights-evidence-item:first-child{border-left:0;padding-left:0}
.insights-evidence-item .v{font-size:var(--sd-type-role-metric-size);color:var(--sd-color-accent-primary);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-evidence-item .l{font-size:var(--sd-type-role-overline-size);letter-spacing:2.6px;margin-top:5px}
.insights-evidence-item .n{font-size:var(--sd-type-role-copy-compact-size);color:var(--sd-color-text-tertiary);letter-spacing:.55px;margin-top:7px;line-height:1.4}
.insights-calculation-disclosure{grid-column:1/-1;margin-top:2px;border-top:1px solid var(--sd-line-neutral-soft)}
.insights-calculation-disclosure>summary{cursor:pointer;list-style:none;padding:9px 0 2px;color:var(--sd-color-text-secondary-strong);font-size:var(--sd-type-role-copy-compact-size);font-weight:800;letter-spacing:.7px;text-transform:none}
.insights-calculation-disclosure>summary::-webkit-details-marker{display:none}
.insights-calculation-disclosure>summary::after{content:" +";color:var(--sd-color-info)}
.insights-calculation-disclosure[open]>summary::after{content:" −"}
.insights-calculation-body{padding:8px 0 2px;color:var(--sd-color-text-tertiary);font-size:var(--sd-type-role-copy-compact-size);line-height:1.5;letter-spacing:.15px}
.insights-quality-link-main{display:flex;align-items:baseline;justify-content:space-between;gap:9px;flex-wrap:wrap}
.insights-quality-link-stat{font-size:var(--sd-type-role-copy-size);color:var(--sd-color-text-secondary);letter-spacing:.5px;white-space:nowrap}
.insights-training-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.insights-bars,.insights-fitness-states{display:grid;gap:10px;align-content:start}
.insights-bar-row{display:grid;grid-template-columns:minmax(110px,160px) 1fr 78px;gap:12px;align-items:center;padding:2px 0}
.insights-name{letter-spacing:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sd-color-text-primary)}
.insights-track{height:10px;background:rgba(var(--sd-rgb-neutral-overlay),.045);border:1px solid var(--sd-line-neutral-control);overflow:hidden;position:relative}
.insights-fill{height:100%;background:linear-gradient(90deg,var(--sd-color-chart-coral) 0%,var(--sd-color-info) 52%,var(--sd-color-accent-primary) 100%);width:0%;box-shadow:0 0 12px rgba(var(--sd-rgb-info),.12) inset}
.insights-pct{text-align:right;color:var(--sd-color-info);white-space:nowrap}
.insights-area-completion-row{grid-template-columns:minmax(110px,160px) 1fr minmax(100px,122px)}
.insights-area-completion-stats{min-width:0;text-align:right;display:grid;gap:2px;justify-items:end}
.insights-area-completion-row .insights-name{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.22;word-break:break-word}
.insights-area-completion-meta{font-size:var(--sd-type-role-label-xs-size);line-height:1.25;color:var(--sd-color-text-secondary);white-space:normal}
.insights-area-completion-row.early .insights-fill{opacity:var(--sd-chart-opacity-area-early)}
.insights-area-completion-row.early .insights-area-completion-meta{color:var(--sd-color-text-tertiary)}
.insights-area-allocation-caveat{margin-top:9px;padding-top:8px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.065);font-size:var(--sd-type-role-caption-sm-size);color:var(--sd-color-text-secondary);line-height:1.4}
.insights-name,.insights-pct{font-size:var(--sd-type-role-copy-compact-size)}
.insights-rhythm-grid .insights-card{display:grid;align-content:start;min-height:238px}
.insights-rhythm-note{margin-top:10px;padding-top:9px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.07);color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-caption-size);line-height:1.45}
.insights-bar-row.is-empty{opacity:var(--sd-chart-opacity-reference)}
.insights-bar-row.is-empty .insights-name,.insights-bar-row.is-empty .insights-pct{color:var(--sd-color-text-secondary)}
.insights-friction-source-card{align-self:start}
.insights-friction-source-card .insights-section-title{display:grid;gap:4px;align-items:start}
.insights-friction-source-card .insights-section-title .insights-note{margin-top:0}
.insights-friction-source-list{display:grid;gap:14px;margin-top:11px}
.insights-friction-source-row,.insights-chart-widget{display:grid;gap:6px;min-width:0}.insights-chart-widget{padding:var(--sd-space-07) var(--sd-space-08)}
.insights-friction-source-head{display:grid;grid-template-columns:minmax(0,1fr) max-content;gap:10px;align-items:baseline}
.insights-friction-source-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sd-color-text-primary);font-size:var(--sd-type-role-caption-size);letter-spacing:1.1px}
.insights-friction-source-value{color:var(--sd-color-info);font-size:var(--sd-type-role-caption-size);white-space:nowrap;text-align:right}
.insights-rhythm-summary{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 8px}
.insights-rhythm-chip{padding:7px 9px;display:grid;gap:3px;min-width:0;flex:1 1 112px}
.insights-rhythm-chip .k{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.4px;color:var(--sd-color-text-secondary);text-transform:uppercase}
.insights-rhythm-chip .v{font-size:var(--sd-type-role-copy-compact-size);line-height:1.35;color:var(--sd-color-text-primary)}
.insights-visuals{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(390px,1fr);gap:12px;align-items:start}
.insights-visuals .insights-card{padding:13px 15px 11px}
.insights-visual-left{display:grid;gap:10px}
.insights-trend-card{padding-bottom:8px}
.insights-trend-card .insights-chart{height:var(--sd-responsive-chart-height-tall)}
.insights-weekly-card .insights-chart{height:var(--sd-responsive-chart-height-short)}
.insights-visual-stack .insights-chart{height:var(--sd-responsive-chart-height-medium)}
.insights-chart{width:100%;height:var(--sd-responsive-chart-height);display:block;overflow:visible;margin-top:7px;background:transparent}
.insights-chart-inspector{min-height:var(--sd-chart-inspection-target);padding:var(--sd-space-07) var(--sd-space-09);border-left:2px solid var(--sd-chart-tooltip-border);background:var(--sd-chart-tooltip-background);box-shadow:var(--sd-chart-tooltip-shadow);color:var(--sd-color-text-primary);line-height:1.4}
.insights-chart .chart-hit-zone,.insights-risk-scatter .risk-hit{fill:var(--sd-value-transparent);stroke:var(--sd-value-transparent);pointer-events:all;cursor:pointer}
.insights-chart .chart-hit-zone.selected,.insights-chart .chart-hit-zone:focus-visible{stroke:var(--sd-chart-hit-selected-stroke);stroke-width:var(--sd-chart-stroke-normal);fill:var(--sd-chart-hit-selected-fill);outline:none}
.insights-chart .axis{stroke:var(--sd-chart-axis-color);stroke-width:var(--sd-chart-axis-width)}
.insights-chart .axis-label{fill:var(--sd-chart-label-color);font-size:var(--sd-type-role-chart-axis-size);letter-spacing:.9px}
.insights-chart .axis-label.strong{fill:var(--sd-chart-label-strong-color);font-weight:var(--sd-font-weight-bold,700)}
.insights-chart .line{fill:var(--sd-chart-fill-none);stroke:var(--sd-chart-line-color);stroke-width:var(--sd-chart-line-width);stroke-linecap:round;stroke-linejoin:round}
.insights-chart .line.soft{stroke:var(--sd-chart-line-strong-color);stroke-width:var(--sd-chart-line-strong-width);opacity:var(--sd-chart-opacity-full)}
.insights-chart .dot{fill:var(--sd-chart-dot-color,rgba(var(--sd-rgb-chart-coral),.62));stroke:var(--sd-chart-dot-stroke,rgba(var(--sd-rgb-neutral-overlay),.22));stroke-width:var(--sd-chart-dot-stroke-width)}
.insights-chart .completion-reference-band{fill:rgba(var(--sd-rgb-info),.045);stroke:rgba(var(--sd-rgb-info),.12);stroke-width:var(--sd-chart-stroke-thin)}
.insights-chart .near-plan-band{fill:rgba(var(--sd-rgb-accent-primary),.025);stroke:rgba(var(--sd-rgb-accent-primary),.10);stroke-width:var(--sd-chart-stroke-thin)}
.insights-chart .dot.unusual{fill:var(--sd-color-warning);stroke:var(--sd-color-accent-primary);stroke-width:calc(var(--sd-chart-stroke-thin) + .15)}
.insights-chart .dot.near-plan{fill:var(--sd-color-accent-primary);stroke:var(--sd-state-accent-line-strong);stroke-width:calc(var(--sd-chart-stroke-thin) + .15)}
.insights-chart .dot.coverage-limited{fill:rgba(var(--sd-rgb-data-muted),.18);stroke:rgba(var(--sd-rgb-data-muted),.88);stroke-width:calc(var(--sd-chart-stroke-thin) + .25);stroke-dasharray:var(--sd-chart-dash-short)}
.insights-chart .bar.plan{fill:var(--sd-line-neutral-default);stroke:var(--sd-line-neutral-strong);stroke-width:var(--sd-chart-stroke-thin)}
.insights-chart .bar.actual{fill:rgba(var(--sd-rgb-info),.32);stroke:rgba(var(--sd-rgb-neutral-overlay),.18);stroke-width:var(--sd-chart-stroke-thin)}
.insights-chart .bar.actual.coverage-limited{fill:rgba(var(--sd-rgb-info),.07);stroke:rgba(var(--sd-rgb-data-muted),.80);stroke-dasharray:var(--sd-chart-dash-even)}
.insights-chart .label{fill:var(--sd-chart-label-color);font-size:var(--sd-type-role-chart-label-size);letter-spacing:.65px}
.insights-chart .label.bright,.insights-risk-scatter .label.strong{fill:var(--sd-chart-label-strong-color);font-weight:var(--sd-font-weight-extrabold,800)}

/* Presentation-contract geometry for generated SVG. Numeric attributes remain
   compatibility fallbacks; CSS geometry lets presentation profiles retune them. */
:is(.insights-chart,.insights-risk-scatter) .chart-point-xs{r:var(--sd-chart-point-radius-xs)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-sm{r:var(--sd-chart-point-radius-sm)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-phase{r:var(--sd-chart-point-radius-phase)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-base{r:var(--sd-chart-point-radius-base)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-md{r:var(--sd-chart-point-radius-md)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-lg{r:var(--sd-chart-point-radius-lg)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-large{r:var(--sd-chart-point-radius-large)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-xl{r:var(--sd-chart-point-radius-xl)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-empirical{r:var(--sd-chart-point-radius-empirical)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-emphasis{r:var(--sd-chart-point-radius-emphasis)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-pattern{r:var(--sd-chart-point-radius-pattern)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-current{r:var(--sd-chart-point-radius-current)}
:is(.insights-chart,.insights-risk-scatter) .chart-point-onset{r:var(--sd-chart-point-radius-onset)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-xs{r:var(--sd-chart-hit-radius-xs)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-sm{r:var(--sd-chart-hit-radius-sm)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-md{r:var(--sd-chart-hit-radius-md)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-default{r:var(--sd-chart-hit-radius-default)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-emphasis{r:var(--sd-chart-hit-radius-emphasis)}
:is(.insights-chart,.insights-risk-scatter) .chart-hit-touch{r:var(--sd-chart-hit-radius-touch)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-hidden{opacity:var(--sd-chart-opacity-hidden)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-faint{opacity:var(--sd-chart-opacity-faint)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-grid{opacity:var(--sd-chart-opacity-grid)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-muted{opacity:var(--sd-chart-opacity-muted)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-reference{opacity:var(--sd-chart-opacity-reference)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-axis{opacity:var(--sd-chart-opacity-axis)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-mid{opacity:var(--sd-chart-opacity-mid)}
:is(.insights-chart,.insights-risk-scatter) .chart-opacity-soft{opacity:var(--sd-chart-opacity-soft)}
/* INSIGHTS-05 · PRACTICE PACER Owns Practice Pacer disclosure, evidence, position/pace charts, and differences. */
.insights-practice{--pacer:var(--sd-color-pacer-accent)}
.insights-practice>summary{color:var(--pacer)}
.insights-practice-summary-copy,.insights-fitness-summary-copy,.insights-brain-summary-copy{display:grid;gap:4px;min-width:0;margin-right:auto}
.insights-practice-summary-title{font-size:var(--sd-type-role-copy-compact-size);letter-spacing:3.5px;color:var(--pacer)}
.insights-practice-summary-meta,.insights-fitness-summary-meta,.insights-brain-summary-meta{font-size:var(--sd-type-role-label-size);line-height:1.35;letter-spacing:.65px;text-transform:none;color:var(--sd-color-text-secondary)}
.insights-practice-body,.insights-fitness-body,.insights-brain-body{padding:var(--sd-space-14);display:grid;gap:12px}
.insights-practice-caution{padding:10px 12px;--inset-line:rgba(var(--sd-rgb-pacer-primary),.24);border-left:2px solid rgba(var(--sd-rgb-pacer-primary),.48);color:var(--sd-color-text-secondary);line-height:1.45}
.insights-practice-metrics{--card-line:rgba(var(--sd-rgb-pacer-primary),.16)}
.insights-practice-reading{--practice-tone:var(--sd-color-text-secondary);display:grid;grid-template-columns:max-content minmax(0,1fr);gap:10px;align-items:start;padding:11px 12px;border-left:3px solid var(--practice-tone)}
.insights-practice-reading.strong{--practice-tone:var(--sd-color-info)}
.insights-practice-reading.watch{--practice-tone:var(--sd-color-watch)}
.insights-practice-reading .tag{padding:5px 7px;--chip-color:var(--practice-tone);--chip-line:var(--sd-line-neutral-strong);--chip-bg:transparent;font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.1px;white-space:nowrap}
.insights-practice-reading.strong .tag{border-color:rgba(var(--sd-rgb-fitness),.34)}
.insights-practice-reading.watch .tag{border-color:rgba(var(--sd-rgb-watch),.36)}
.insights-practice-reading .copy{font-size:var(--sd-type-role-copy-size);line-height:1.48;color:var(--sd-color-text-primary)}
.insights-practice-reading>.insights-rhythm-note{grid-column:1/-1;min-width:0}
.insights-practice-grid,.insights-area-overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
.insights-practice-card{display:grid;align-content:start;gap:9px;min-width:0}
.insights-practice-chart .pace-band{fill:rgba(var(--sd-rgb-pacer-primary),.065)}
.insights-practice-chart .pace-spread-ribbon{fill:rgba(var(--sd-rgb-info),.14);stroke:var(--sd-state-info-line);stroke-width:var(--sd-chart-stroke-hairline);pointer-events:none}
.insights-practice-chart .pace-spread-whisker{stroke:rgba(var(--sd-rgb-info),.34);stroke-width:var(--sd-chart-stroke-thin);pointer-events:none}
.insights-practice-chart .pace-target{stroke:rgba(var(--sd-rgb-accent-primary),.50);stroke-width:calc(var(--sd-chart-stroke-thin) + .3);stroke-dasharray:var(--sd-chart-dash-reference)}
.insights-practice-chart .pace-line{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-pacer-accent),.62);stroke-width:var(--sd-chart-stroke-strong);stroke-linecap:round;stroke-linejoin:round}
.insights-practice-chart .pace-point{fill:rgba(var(--sd-rgb-pacer-primary),.72);stroke:rgba(var(--sd-rgb-neutral-overlay),.42);stroke-width:var(--sd-chart-stroke-thin);pointer-events:none}
.insights-practice-chart .pace-cap-marker{fill:var(--sd-color-watch);stroke:rgba(var(--sd-rgb-neutral-overlay),.54);stroke-width:var(--sd-chart-stroke-hairline);pointer-events:none}
.insights-practice-chart .chart-hit-zone.selected{stroke:var(--sd-chart-practice-hit-stroke);stroke-width:calc(var(--sd-chart-stroke-normal) + .1);fill:var(--sd-chart-practice-hit-fill)}
.insights-practice-position-chart .position-band{fill:rgba(var(--sd-rgb-fitness),.055);stroke:var(--sd-chart-stroke-none)}
.insights-practice-position-chart .position-line{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-pacer-accent),.75);stroke-width:calc(var(--sd-chart-stroke-strong) + .4);stroke-linecap:round;stroke-linejoin:round}
.insights-practice-position-chart .position-point{fill:rgba(var(--sd-rgb-pacer-primary),.82);stroke:rgba(var(--sd-rgb-neutral-overlay),.48);stroke-width:calc(var(--sd-chart-stroke-thin) + .1);pointer-events:none}
.insights-practice-position-chart .position-point.onset{fill:var(--sd-color-watch);stroke:var(--sd-color-accent-primary);stroke-width:var(--sd-chart-stroke-normal)}
.insights-practice-position-chart .position-guide{stroke:rgba(var(--sd-rgb-neutral-overlay),.08);stroke-width:var(--sd-chart-stroke-thin);stroke-dasharray:var(--sd-chart-dash-guide)}
.insights-practice-position-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.insights-practice-differences{display:grid;gap:5px;align-content:start}
.insights-practice-difference-row{display:grid;gap:5px;padding:9px 0;border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.065)}
.insights-practice-difference-row:last-child{border-bottom:0}
.insights-practice-difference-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}
.insights-practice-difference-name{min-width:0;color:var(--sd-color-text-primary);font-size:var(--sd-type-role-copy-compact-size);letter-spacing:.9px;overflow-wrap:anywhere}
.insights-practice-difference-value{color:var(--pacer);font-size:var(--sd-type-role-copy-compact-size);white-space:nowrap}
.insights-practice-difference-meta{color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-caption-xs-size);line-height:1.4;overflow-wrap:anywhere}
.insights-practice-difference-note{color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-caption-size);line-height:1.42;overflow-wrap:anywhere}
.insights-practice-difference-row.watch .insights-practice-difference-value{color:var(--sd-color-watch)}
.insights-practice-difference-row.strong .insights-practice-difference-value{color:var(--sd-color-info)}
/* INSIGHTS-06 · AREAS, COVERAGE, ALLOCATION, AND RHYTHM Owns area evidence, allocation/conversion, risk, heatmaps, and day structure. */
.insights-area-card{display:grid;gap:12px;align-content:start;min-width:0}
.insights-area-card .insights-section-title{margin-bottom:0}
.insights-subject-signals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:auto;padding-top:12px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.07)}
.insights-subject-signal{padding:var(--sd-space-13) var(--sd-space-14);min-width:0}
.insights-subject-signal .k{font-size:var(--sd-type-role-label-sm-size);letter-spacing:2.45px;color:var(--sd-color-text-secondary);margin-bottom:6px}
.insights-subject-signal .v{font-size:var(--sd-type-role-section-size);line-height:1.02;color:var(--sd-color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.insights-subject-signal .n{font-size:var(--sd-type-role-copy-compact-relaxed-size);line-height:1.4;color:var(--sd-color-text-secondary);margin-top:7px;min-height:0}
.insights-area-card .insights-bars{margin-top:0}
.insights-allocation-bars,.insights-life-bars{display:grid;gap:9px}
.insights-allocation-bar-row{display:grid;grid-template-columns:78px 1fr;gap:10px;align-items:center;min-width:0}
.insights-allocation-bar-row .k{font-size:var(--sd-type-role-overline-size);letter-spacing:2px;color:var(--sd-color-text-secondary);text-transform:uppercase}
.insights-allocation-track{height:22px;display:flex;overflow:hidden;border:1px solid var(--sd-line-neutral-control);background:rgba(var(--sd-rgb-neutral-overlay),.035)}
.insights-allocation-segment{height:100%;min-width:0;border-right:1px solid rgba(var(--sd-rgb-chart-divider),.42)}
.insights-allocation-segment,.insights-allocation-swatch{background:var(--insights-series-color)}
.insights-series-01{--insights-series-color:var(--sd-chart-series-01)}
.insights-series-02{--insights-series-color:var(--sd-chart-series-02)}
.insights-series-03{--insights-series-color:var(--sd-chart-series-03)}
.insights-series-04{--insights-series-color:var(--sd-chart-series-04)}
.insights-series-05{--insights-series-color:var(--sd-chart-series-05)}
.insights-series-06{--insights-series-color:var(--sd-chart-series-06)}
.insights-series-07{--insights-series-color:var(--sd-chart-series-07)}
.insights-series-08{--insights-series-color:var(--sd-chart-series-08)}
.insights-series-09{--insights-series-color:var(--sd-chart-series-09)}
.insights-series-10{--insights-series-color:var(--sd-chart-series-10)}
.insights-series-11{--insights-series-color:var(--sd-chart-series-11)}
.insights-series-12{--insights-series-color:var(--sd-chart-series-12)}
.insights-series-13{--insights-series-color:var(--sd-chart-series-13)}
.insights-series-14{--insights-series-color:var(--sd-chart-series-14)}
.insights-series-15{--insights-series-color:var(--sd-chart-series-15)}
.insights-series-16{--insights-series-color:var(--sd-chart-series-16)}
.insights-allocation-segment:last-child{border-right:0}
.insights-allocation-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 14px;padding-top:3px}
.insights-allocation-item{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:7px;align-items:center;min-width:0;padding:5px 0;border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.055)}
.insights-allocation-swatch{width:9px;height:9px;border:1px solid rgba(var(--sd-rgb-neutral-overlay),.22)}
.insights-allocation-name{font-size:var(--sd-type-role-caption-size);letter-spacing:.9px;color:var(--sd-color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-allocation-values{font-size:var(--sd-type-role-caption-xs-size);color:var(--sd-color-text-secondary);white-space:nowrap;text-align:right}
.insights-allocation-values.up{color:var(--sd-color-info)}
.insights-allocation-values.down{color:var(--sd-color-watch)}
.insights-allocation-bases{display:flex;gap:7px 14px;align-items:center;flex-wrap:wrap;padding:8px 10px;font-size:var(--sd-type-role-caption-compact-size);color:var(--sd-color-text-secondary);line-height:1.35}
.insights-allocation-bases .context{color:var(--sd-color-info);letter-spacing:.4px}
.insights-allocation-bases span{white-space:nowrap}
.insights-allocation-bases b{font-weight:800;color:var(--sd-color-text-primary);letter-spacing:.45px}
.insights-allocation-note{font-size:var(--sd-type-role-caption-compact-size);color:var(--sd-color-text-secondary);line-height:1.4}
.insights-plan-output-summary{padding:0;color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-copy-compact-relaxed-size);line-height:1.45}
.insights-area-conversion-card{display:grid;gap:12px;align-content:start}
.insights-conversion-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.insights-dossier-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:0;max-width:100%}
.insights-conversion-row{padding:10px 11px;display:grid;gap:7px}
.insights-conversion-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.insights-conversion-head .name{font-size:var(--sd-type-role-copy-compact-size);letter-spacing:1.2px;color:var(--sd-color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.insights-conversion-head .value{font-size:var(--sd-type-role-input-size);color:var(--sd-color-accent-primary);white-space:nowrap}
.insights-conversion-meta{font-size:var(--sd-type-role-caption-size);color:var(--sd-color-text-secondary);line-height:1.4}
.insights-conversion-reading{font-size:var(--sd-type-role-caption-size);color:var(--sd-color-text-primary);line-height:1.35}
.insights-conversion-warning{font-size:var(--sd-type-role-caption-sm-size);color:var(--sd-color-watch);line-height:1.35}
.insights-rhythm-grid{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr);gap:12px;align-items:stretch}
.insights-rhythm-grid .insights-section-title{border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.065);padding-bottom:9px;margin-bottom:8px}
.insights-risk-card{align-self:start;min-width:0}
.insights-risk-card .insights-section-title{margin-bottom:5px}
.insights-risk-widget{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,30%);gap:12px;align-items:start}
.insights-risk-scatter{width:100%;height:300px;display:block;margin-top:2px;overflow:visible}
.insights-risk-scatter .axis{stroke:var(--sd-chart-axis-color);stroke-width:var(--sd-chart-axis-width)}
.insights-risk-scatter .grid{stroke:var(--sd-chart-grid-color);stroke-width:var(--sd-chart-grid-width)}
.insights-risk-scatter .label{fill:var(--sd-color-text-secondary);font-size:var(--sd-type-role-copy-compact-expanded-size);letter-spacing:.65px}
.insights-risk-scatter .quadrant{fill:rgba(var(--sd-rgb-data-neutral),.25);font-size:var(--sd-type-role-label-size);letter-spacing:.9px;text-transform:uppercase}
.insights-risk-scatter .risk-line{stroke:var(--sd-state-info-line-strong);stroke-width:var(--sd-chart-stroke-thin);stroke-dasharray:var(--sd-chart-dash-threshold);opacity:var(--sd-chart-opacity-risk-line)}
.insights-risk-scatter .point{stroke:rgba(var(--sd-rgb-neutral-overlay),.34);stroke-width:var(--sd-chart-stroke-thin);transition:var(--sd-motion-chart-point-transition)}
.insights-risk-scatter .risk-node{cursor:pointer;outline:none}
.insights-risk-scatter .risk-node:hover .point,.insights-risk-scatter .risk-node:focus .point,.insights-risk-scatter .risk-node.selected .point{stroke:var(--sd-color-accent-primary);stroke-width:var(--sd-chart-stroke-strong);filter:var(--sd-chart-risk-point-active-filter)}
.insights-risk-scatter .risk-code{fill:var(--sd-color-text-primary);font-size:var(--sd-type-role-overline-sm-size);font-weight:var(--sd-font-weight-black);text-anchor:middle;dominant-baseline:central;letter-spacing:.15px;pointer-events:none}
.insights-risk-scatter .risk-low{fill:rgba(var(--sd-rgb-info),.48)}
.insights-risk-scatter .risk-mid{fill:rgba(var(--sd-rgb-watch),.58)}
.insights-risk-scatter .risk-high{fill:rgba(var(--sd-rgb-risk),.68)}
.insights-risk-scatter .risk-name{fill:var(--sd-color-text-primary);font-size:var(--sd-type-role-caption-size);letter-spacing:.45px;pointer-events:none}
.insights-risk-scatter .inspect-box{fill:var(--sd-chart-inspect-box-background);stroke:var(--sd-chart-inspect-box-border);stroke-width:var(--sd-chart-stroke-thin);filter:var(--sd-chart-inspect-box-shadow);rx:var(--sd-shape-inspector-radius)}
.insights-risk-scatter .inspect-title{fill:var(--sd-color-text-primary);font-size:var(--sd-type-role-copy-size);font-weight:800;letter-spacing:.9px}
.insights-risk-scatter .inspect-body{fill:var(--sd-color-text-secondary);font-size:var(--sd-type-role-copy-compact-size);letter-spacing:.55px}
.insights-risk-key{display:grid;grid-template-columns:1fr;gap:3px;align-content:start;max-height:300px;overflow:auto;padding:2px 3px 2px 12px;border-left:1px solid rgba(var(--sd-rgb-neutral-overlay),.08);scrollbar-width:thin;scrollbar-color:rgba(var(--sd-rgb-info),.28) transparent}
.insights-risk-key-title{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.4px;color:var(--sd-color-accent-primary);text-transform:uppercase;margin-bottom:2px}
.insights-risk-key .help{grid-column:1;color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-caption-xs-size);line-height:1.4;margin-bottom:4px}
.insights-risk-key .row{min-height:32px;display:flex;align-items:center;color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-caption-sm-size);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 4px;border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.045);cursor:pointer}
.insights-risk-key .row.selected,.insights-risk-key .row:focus-visible{color:var(--sd-color-text-primary);background:var(--sd-state-accent-bg);outline:1px solid rgba(var(--sd-rgb-accent-primary),.30);outline-offset:2px}
.insights-risk-key .code{color:var(--sd-color-info);font-weight:800;letter-spacing:.8px;margin-right:5px}
.insights-heatmap{display:grid;grid-template-columns:repeat(auto-fill,minmax(14px,18px));gap:5px;margin-top:4px}
.insights-cell{height:16px;border:1px solid var(--sd-line-neutral-mid);background:rgba(var(--sd-rgb-neutral-overlay),.04)}
.insights-cell.missing{background:rgba(var(--sd-rgb-neutral-overlay),.015);border-color:rgba(var(--sd-rgb-neutral-overlay),.055)}
.insights-cell.no-work{background:rgba(var(--sd-rgb-data-neutral),.10);border-color:rgba(var(--sd-rgb-data-neutral),.22)}
.insights-cell.l1{background:rgba(var(--sd-rgb-risk),.25)}
.insights-cell.l2{background:rgba(var(--sd-rgb-watch),.26)}
.insights-cell.l3{background:var(--sd-state-info-line)}
.insights-cell.l4{background:rgba(var(--sd-rgb-fitness),.28)}
.insights-cell.selected,.insights-cell:focus-visible{border-color:var(--sd-color-accent-primary);box-shadow:0 0 0 1px rgba(var(--sd-rgb-accent-primary),.32);outline:none}
.insights-legend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.insights-legend span{display:inline-flex;align-items:center;gap:5px}
.insights-legend i{width:12px;height:12px;display:inline-block;border:1px solid rgba(var(--sd-rgb-neutral-overlay),.14)}
.insights-mixbar-wrap{display:grid;gap:10px;margin-top:7px}
.insights-mixbar{height:18px;background:rgba(var(--sd-rgb-neutral-overlay),.045);border:1px solid var(--sd-line-neutral-control);display:flex;overflow:hidden}
.insights-mixbar-seg{height:100%;min-width:2px}
.insights-mixbar-seg.work{background:var(--sd-color-info)}
.insights-mixbar-seg.support{background:var(--sd-color-watch)}
.insights-mixbar-seg.fixed{background:var(--sd-color-data-fixed)}
.insights-mixbar-legend{display:grid;gap:6px}
.insights-mixbar-legend span{display:grid;grid-template-columns:10px 1fr auto;gap:7px;align-items:center}
.insights-mixbar-legend i{width:9px;height:9px;display:inline-block;border:1px solid var(--sd-line-neutral-strong)}
.insights-resource-card .insights-mixbar-legend{grid-template-columns:repeat(3,minmax(0,1fr))}
.insights-resource-totals{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:9px;padding-top:8px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.07)}
.insights-resource-totals span{color:var(--sd-color-text-tertiary)}
.insights-resource-totals b{font-weight:800;color:var(--sd-color-accent-primary)}
.insights-day-structure{margin-top:12px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;align-items:stretch}
.insights-life-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.insights-life-row{display:grid;gap:5px}
.insights-life-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.insights-life-head span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.insights-life-head b{color:var(--sd-color-info);font-weight:800;white-space:nowrap}
/* INSIGHTS-07 · FITNESS Owns Fitness state, context, evidence, and chart treatments. */
.insights-fitness{--fitness:var(--sd-color-fitness);--panel-padding:0}
.insights-fitness>summary{color:var(--fitness)}
.insights-fitness-summary-title{font-size:var(--sd-type-role-copy-compact-size);letter-spacing:3.5px;color:var(--fitness)}
.insights-fitness-intro{padding:10px 12px;border-left:2px solid rgba(var(--sd-rgb-fitness),.48);color:var(--sd-color-text-secondary);line-height:1.48}
.insights-fitness-reading{--fitness-tone:var(--sd-color-text-secondary);display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:12px 13px;border-left:3px solid var(--fitness-tone)}
.insights-fitness-reading.strong{--fitness-tone:var(--sd-color-info)}
.insights-fitness-reading.good{--fitness-tone:var(--sd-color-accent-primary)}
.insights-fitness-reading.watch{--fitness-tone:var(--sd-color-watch)}
.insights-fitness-reading.low{--fitness-tone:var(--sd-color-low)}
.insights-fitness-reading .tag{padding:5px 7px;--chip-color:var(--fitness-tone);--chip-line:var(--sd-line-neutral-strong);--chip-bg:transparent;font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.1px;white-space:nowrap}
.insights-fitness-reading .copy{font-size:var(--sd-type-role-body-size);line-height:1.5;color:var(--sd-color-text-primary)}
.insights-fitness-state-card{display:grid;gap:9px;align-content:start}
.insights-fitness-chart{height:240px;margin-top:0}
.insights-fitness-chart .fitness-band{fill:rgba(var(--sd-rgb-fitness),.09);stroke:var(--sd-chart-stroke-none);pointer-events:none}
.insights-fitness-chart .fitness-line{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-fitness),.78);stroke-width:calc(var(--sd-chart-stroke-strong) + .2);stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.insights-fitness-chart .fitness-dot{fill:rgba(var(--sd-rgb-info),.60);stroke:rgba(var(--sd-rgb-neutral-overlay),.42);stroke-width:var(--sd-chart-stroke-hairline);pointer-events:none}
.insights-fitness-chart .fitness-dot.weak{fill:rgba(var(--sd-rgb-data-muted),.22);stroke:rgba(var(--sd-rgb-data-muted),.78);stroke-dasharray:var(--sd-chart-dash-short)}
.insights-fitness-chart .fitness-current{fill:var(--sd-color-accent-primary);stroke:rgba(var(--sd-rgb-accent-primary),.70);stroke-width:var(--sd-chart-stroke-normal);pointer-events:none}
.insights-fitness-chart .fitness-change{stroke:rgba(var(--sd-rgb-violet),.58);stroke-width:calc(var(--sd-chart-stroke-thin) + .2);stroke-dasharray:var(--sd-chart-dash-threshold);pointer-events:none}
.insights-fitness-chart .fitness-change-label{fill:var(--sd-color-pacer-accent);font-size:var(--sd-type-role-caption-size);letter-spacing:.65px}
.insights-fitness-chart .grid{stroke:var(--sd-chart-grid-color);stroke-width:var(--sd-chart-grid-width);opacity:var(--sd-chart-opacity-fitness-grid)}
.insights-fitness-chart .chart-hit-zone.selected{stroke:var(--sd-chart-fitness-hit-stroke);stroke-width:var(--sd-chart-stroke-normal);fill:var(--sd-chart-fitness-hit-fill)}
.insights-fitness-state-row{--state-tone:var(--sd-color-text-secondary);display:grid;grid-template-columns:minmax(135px,.72fr) minmax(90px,.42fr) minmax(0,1.65fr);gap:10px 16px;align-items:center;padding:11px 12px;border-left:3px solid var(--state-tone)}
.insights-fitness-state-row.strong{--state-tone:var(--sd-color-info)}
.insights-fitness-state-row.good{--state-tone:var(--sd-color-accent-primary)}
.insights-fitness-state-row.watch{--state-tone:var(--sd-color-watch)}
.insights-fitness-state-row.low{--state-tone:var(--sd-color-low)}
.insights-fitness-state-row-head{display:grid;gap:5px;min-width:0}
.insights-fitness-state-row-title{font-size:var(--sd-type-role-overline-size);letter-spacing:2.5px;color:var(--state-tone)}
.insights-fitness-state-confidence{font-size:var(--sd-type-role-label-sm-size);color:var(--sd-color-text-secondary)}
.insights-fitness-state-value{font-size:var(--sd-type-role-section-size);line-height:1;color:var(--sd-color-text-primary)}
.insights-fitness-state-meta{font-size:var(--sd-type-role-caption-size);line-height:1.45;color:var(--sd-color-text-secondary)}
.insights-fitness-state-note{grid-column:1/-1;padding-top:6px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.05);font-size:var(--sd-type-role-label-near-size);line-height:1.45;color:var(--sd-color-text-tertiary)}
.insights-fitness-context{display:grid;gap:8px;padding:12px}
.insights-fitness-context-title{font-size:var(--sd-type-role-overline-size);letter-spacing:2.6px;color:var(--sd-color-text-secondary)}
.insights-fitness-context-row{--context-tone:var(--sd-color-text-secondary);display:grid;grid-template-columns:minmax(135px,.7fr) minmax(170px,.9fr) minmax(0,1.6fr);gap:10px 14px;align-items:start;padding:9px 10px;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.055)}
.insights-fitness-context-row.good{--context-tone:var(--sd-color-accent-primary)}
.insights-fitness-context-row.watch{--context-tone:var(--sd-color-watch)}
.insights-fitness-context-row.low{--context-tone:var(--sd-color-low)}
.insights-fitness-context-label{font-size:var(--sd-type-role-overline-compact-size);letter-spacing:2.2px;color:var(--context-tone)}
.insights-fitness-context-value{font-size:var(--sd-type-role-copy-size);line-height:1.4;color:var(--sd-color-text-primary)}
.insights-fitness-context-note{font-size:var(--sd-type-role-label-size);line-height:1.45;color:var(--sd-color-text-secondary)}
.insights-fitness-model-evidence{min-width:0;max-width:100%;--inset-line:rgba(var(--sd-rgb-fitness),.14)}
.insights-fitness-model-evidence>summary{cursor:pointer;padding:10px 12px;color:var(--fitness,var(--sd-color-fitness));font-size:var(--sd-type-role-overline-size);font-weight:800;letter-spacing:2.2px;text-transform:uppercase}
.insights-fitness-model-evidence-body{min-width:0;max-width:100%;padding:0 10px 10px;display:grid;gap:10px}
.insights-fitness-model-evidence-body>.insights-card,.insights-progressive-host{min-width:0;max-width:100%}
/* INSIGHTS-08 · STUDY DYNAMICS AND ANALYTICS LAB Owns Research Brain reads, dynamics evidence, models, charts, and lab dossiers. */
.insights-brain{--brain:var(--sd-color-brain);--panel-padding:0}
.insights-brain>summary{color:var(--brain)}
.insights-brain-summary-title{font-size:var(--sd-type-role-copy-compact-size);letter-spacing:3.5px;color:var(--brain)}
.insights-brain-intro{padding:10px 12px;border-left:2px solid rgba(var(--sd-rgb-info),.45);color:var(--sd-color-text-secondary);line-height:1.48}
.insights-brain-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
.insights-brain-card{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-content:start;min-width:0}
.insights-dynamics-card-columns{display:grid;grid-template-columns:minmax(260px,.78fr) minmax(0,1.42fr);gap:14px;align-items:start;min-width:0}
.insights-dynamics-card-copy,.insights-dynamics-card-visual{display:grid;gap:9px;align-content:start;min-width:0}
.insights-dynamics-card-visual{padding-left:13px;border-left:1px solid rgba(var(--sd-rgb-neutral-overlay),.07)}
.insights-dynamics-visual-stack{display:grid;gap:9px;min-width:0}
.insights-dynamics-visual-empty{min-height:84px;display:flex;align-items:center;padding:11px 12px;--canvas-line:rgba(var(--sd-rgb-neutral-overlay),.11);color:var(--sd-color-text-tertiary);font-size:var(--sd-type-role-caption-size);line-height:1.45}
.insights-brain-read{--evidence-tone:var(--sd-color-text-secondary);display:grid;gap:6px;padding:10px 11px;border-left:3px solid var(--evidence-tone)}
.insights-brain-read.strong{--evidence-tone:var(--sd-color-info)}
.insights-brain-read.good{--evidence-tone:var(--sd-color-accent-primary)}
.insights-brain-read.watch{--evidence-tone:var(--sd-color-watch)}
.insights-brain-read.low{--evidence-tone:var(--sd-color-low)}
.insights-brain-read-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.insights-brain-read-tag{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2px;color:var(--evidence-tone);text-transform:uppercase}
.insights-brain-read-value{font-size:var(--sd-type-role-label-size);color:var(--sd-color-text-secondary);white-space:nowrap}
.insights-brain-read-copy{font-size:var(--sd-type-role-copy-size);line-height:1.48;color:var(--sd-color-text-primary)}
.insights-dynamics-state-notes{display:grid;gap:6px;padding:9px 10px;border-left:2px solid rgba(var(--sd-rgb-brain),.35);background:var(--sd-state-info-bg-faint);font-size:var(--sd-type-role-caption-size);line-height:1.45;color:var(--sd-color-text-secondary)}
.insights-dynamics-supporting{display:grid;gap:5px;padding:8px 10px}
.insights-dynamics-support-row{display:grid;grid-template-columns:minmax(105px,.7fr) minmax(0,1.3fr);gap:8px 12px;padding:5px 0;border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.05);font-size:var(--sd-type-role-caption-xs-size);line-height:1.38}
.insights-dynamics-support-row:last-child{border-bottom:0}
.insights-dynamics-support-label{color:var(--sd-color-text-tertiary)}
.insights-dynamics-support-value{color:var(--sd-color-text-primary);text-align:right;min-width:0}
.insights-persistent-pattern-chart{height:206px}
.insights-persistent-pattern-chart .pattern-interval{stroke:rgba(var(--sd-rgb-brain),.72);stroke-width:var(--sd-chart-stroke-band);stroke-linecap:round}
.insights-persistent-pattern-chart .pattern-point{fill:var(--sd-color-accent-primary);stroke:rgba(var(--sd-rgb-neutral-overlay),.58);stroke-width:calc(var(--sd-chart-stroke-thin) + .1)}
.insights-persistent-pattern-chart .pattern-baseline{stroke:rgba(var(--sd-rgb-watch),.50);stroke-width:calc(var(--sd-chart-stroke-thin) + .2);stroke-dasharray:var(--sd-chart-dash-reference)}
.insights-persistent-pattern-chart .pattern-label{fill:var(--sd-color-text-primary);font-size:var(--sd-type-role-copy-compact-wide-size);letter-spacing:.45px}
.insights-allocation-compare-chart{height:154px}
.insights-allocation-compare-chart .pattern-label{fill:var(--sd-color-text-primary);font-size:var(--sd-type-role-copy-compact-wide-size);letter-spacing:.45px}
.insights-allocation-compare-chart .allocation-plan{stroke:rgba(var(--sd-rgb-neutral-overlay),.34);stroke-width:var(--sd-chart-stroke-allocation);stroke-linecap:round}
.insights-allocation-compare-chart .allocation-done{stroke:rgba(var(--sd-rgb-info),.72);stroke-width:var(--sd-chart-stroke-allocation);stroke-linecap:round}
.insights-dynamics-phase{height:224px}
.insights-dynamics-phase .phase-line{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-violet),.88);stroke-width:calc(var(--sd-chart-stroke-strong) + .2);stroke-linecap:round;stroke-linejoin:round}
.insights-dynamics-phase .phase-dot{fill:rgba(var(--sd-rgb-info),.52);stroke:rgba(var(--sd-rgb-neutral-overlay),.42);stroke-width:var(--sd-chart-stroke-hairline)}
.insights-dynamics-change-strip{height:78px}
.insights-dynamics-change-strip .regime-line{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-watch),.84);stroke-width:calc(var(--sd-chart-stroke-strong) - .2)}
.insights-dynamics-change-strip .regime-threshold{stroke:rgba(var(--sd-rgb-watch),.45);stroke-width:var(--sd-chart-stroke-thin);stroke-dasharray:var(--sd-chart-dash-threshold)}
.insights-hazard-chart{height:220px;margin-top:0}
.insights-hazard-chart .hazard-bar{fill:rgba(var(--sd-rgb-low),.52);stroke:rgba(var(--sd-rgb-neutral-overlay),.20);stroke-width:var(--sd-chart-stroke-thin)}
.insights-response-chart{height:250px;margin-top:0}
.insights-response-chart .response-band{fill:rgba(var(--sd-rgb-info),.075);stroke:var(--sd-chart-stroke-none);pointer-events:none}
.insights-response-chart .response-observation{fill:rgba(var(--sd-rgb-brain),.18);stroke:rgba(var(--sd-rgb-brain),.28);stroke-width:calc(var(--sd-chart-stroke-hairline) - .1);pointer-events:none}
.insights-response-chart .response-observation.selected-window{fill:rgba(var(--sd-rgb-accent-primary),.48);stroke:rgba(var(--sd-rgb-accent-primary),.72);stroke-width:var(--sd-chart-stroke-thin);pointer-events:none}
.insights-response-chart .response-empirical-band{stroke:rgba(var(--sd-rgb-neutral-overlay),.24);stroke-width:var(--sd-chart-stroke-band);stroke-linecap:round;stroke-dasharray:var(--sd-chart-dash-band);pointer-events:none}
.insights-response-chart .response-empirical-point{fill:rgba(var(--sd-rgb-neutral-overlay),.42);stroke:rgba(var(--sd-rgb-surface-deep),.75);stroke-width:var(--sd-chart-stroke-thin);pointer-events:none}
.insights-response-chart .response-completion{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-fitness),.85);stroke-width:calc(var(--sd-chart-stroke-strong) + .4);pointer-events:none}
.insights-response-chart .response-strong{fill:var(--sd-chart-fill-none);stroke:rgba(var(--sd-rgb-violet),.82);stroke-width:var(--sd-chart-stroke-strong);stroke-dasharray:var(--sd-chart-dash-emphasis);pointer-events:none}
.insights-response-chart .scenario-line{stroke:rgba(var(--sd-rgb-watch),.60);stroke-width:calc(var(--sd-chart-stroke-normal) - .1);stroke-dasharray:var(--sd-chart-dash-reference);pointer-events:none}
.insights-response-chart .frontier-point{fill:var(--sd-color-accent-primary);stroke:rgba(var(--sd-rgb-accent-primary),.65);stroke-width:calc(var(--sd-chart-stroke-normal) + .2);pointer-events:none}
.insights-dynamics-scenario{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding:11px 12px;--inset-line:rgba(var(--sd-rgb-brain),.18)}
.insights-dynamics-scenario-label{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.2px;color:var(--brain);text-transform:uppercase}
.insights-dynamics-scenario-value{font-size:var(--sd-type-role-body-size);color:var(--sd-color-text-primary)}
.insights-dynamics-scenario-slider{grid-column:1/-1;width:100%;accent-color:var(--sd-color-accent-secondary)}
.insights-dynamics-scenario-result{grid-column:1/-1;font-size:var(--sd-type-role-caption-size);line-height:1.45;color:var(--sd-color-text-secondary)}
.insights-dynamics-evidence{--inset-line:rgba(var(--sd-rgb-info),.14)}
.insights-dynamics-evidence>summary{cursor:pointer;padding:10px 12px;color:var(--brain,var(--sd-color-brain));font-size:var(--sd-type-role-overline-size);font-weight:800;letter-spacing:2.2px;text-transform:uppercase}
.insights-dynamics-evidence-body{padding:0 10px 10px;display:grid;gap:10px}
.insights-dynamics-lab{min-width:0;max-width:100%;--panel-line:var(--sd-line-neutral-mid);--panel-padding:0}
.insights-dynamics-lab-body{padding:var(--sd-space-12) var(--sd-space-14);display:grid;gap:11px;min-width:0;max-width:100%}
.insights-dossier-intro{padding:10px 11px;--inset-line:rgba(var(--sd-rgb-info),.12);color:var(--sd-color-text-secondary);line-height:1.45}
.insights-dossier-section{display:grid;gap:9px;padding:var(--sd-space-12) var(--sd-space-13);min-width:0;max-width:100%;--card-line:rgba(var(--sd-rgb-neutral-overlay),.07)}
.insights-lab-wide{grid-column:1/-1}
.insights-reliability-item{padding:10px 11px;display:grid;gap:5px;min-width:0}
.insights-reliability-item .k{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:2.3px;color:var(--sd-color-text-secondary);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-reliability-item .v{font-size:var(--sd-type-role-control-size);color:var(--sd-color-text-primary);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.insights-dossier-section .insights-card{padding:12px}
.insights-dossier-section .insights-note{font-size:var(--sd-type-role-caption-relaxed-size)}
.insights-dossier-section .insights-chart{height:246px;margin-top:8px}
.insights-lab-caution{padding:8px 10px;border-left:2px solid var(--sd-color-watch);background:rgba(var(--sd-rgb-watch),.045);color:var(--sd-color-text-primary)}
/* INSIGHTS-09 · TABLES, PROGRESSIVE DISCLOSURE, AND EMPTY STATES Owns reusable data tables, progressive controls, mobile cues, and empty views. */
.insights-table{display:grid;gap:4px;min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:rgba(var(--sd-rgb-info),.28) transparent;-webkit-overflow-scrolling:touch}
.insights-table-row{display:grid;grid-template-columns:minmax(120px,1fr) 58px 70px 70px 70px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.06)}
.insights-table-row.wide{grid-template-columns:minmax(140px,1fr) 90px 90px 90px}
.insights-table-row.head{font-size:var(--sd-type-role-overline-size);letter-spacing:1.8px;line-height:1.25}
.insights-table-row .subject{font-size:var(--sd-type-role-body-size);letter-spacing:.65px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.insights-table-row .num{text-align:right;color:var(--sd-color-info)}
.insights-progressive-table{display:grid;gap:8px;min-width:0;max-width:100%}
.insights-progressive-host{min-width:0;max-width:100%}
.insights-progressive-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--sd-color-text-secondary);padding-top:2px}
.insights-progressive-controls .mini-btn{flex:0 0 auto}
.insights-mobile-scroll-cue{display:none}
.insights-empty{padding:var(--sd-space-24);text-align:center;--card-border-style:dashed}
.insights-empty-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.insights-below-fold{content-visibility:auto;contain-intrinsic-size:auto 720px}
@media print{.insights-below-fold{content-visibility:visible}}
`;

  // 9C. RESPONSIVE STYLES
  const INSIGHTS_RESPONSIVE_STYLES=`
/* INSIGHTS-10 · RESPONSIVE AND TOUCH OVERRIDES Owns 960px/620px plugin breakpoints and coarse-pointer override order. */
@media(max-width:960px){.insights-definition-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-grid,.insights-grid.insights-diagnostics,.insights-evidence-strip,.insights-training-grid,.insights-rhythm-grid,.insights-dossier-grid,.insights-reliability-grid{grid-template-columns:1fr 1fr}.insights-day-structure{grid-template-columns:1fr}.insights-day-structure .insights-section-title{display:grid;gap:4px;align-items:start}.insights-visuals,.insights-practice-grid{grid-template-columns:1fr}.insights-bar-row{grid-template-columns:minmax(96px,120px) 1fr 66px}.insights-area-completion-row{grid-template-columns:minmax(96px,124px) 1fr minmax(92px,112px)}.insights-allocation-legend{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-risk-widget{grid-template-columns:1fr}.insights-risk-key{grid-template-columns:repeat(2,minmax(0,1fr));max-height:190px;padding:8px;border:1px solid rgba(var(--sd-rgb-neutral-overlay),.07)}.insights-risk-key-title,.insights-risk-key .help{grid-column:1/-1}}
@media(min-width:901px){.insights-section-nav{position:sticky;top:8px}}
@media(max-width:620px){
  .insights-wrap{gap:11px}
  .insights-grid,.insights-grid.insights-diagnostics,.insights-visuals,.insights-day-structure,.insights-life-grid,.insights-area-overview-grid,.insights-rhythm-grid,.insights-dossier-grid,.insights-subject-signals,.insights-conversion-list,.insights-brain-grid{grid-template-columns:1fr}
  .insights-evidence-strip,.insights-training-grid,.insights-reliability-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .insights-hero{--panel-padding:15px 14px;padding:15px 14px;grid-template-columns:1fr;grid-template-areas:'heading' 'options' 'copy';gap:8px}
  .insights-title{font-size:var(--sd-type-role-title-compact-size)}
  .insights-window-copy{min-width:0;display:grid;gap:5px}
  .insights-window-options{justify-self:stretch;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%}
  .insights-window-btn{min-width:0;min-height:var(--_sd-touch-min,44px);padding:8px 5px;text-align:center;letter-spacing:1.4px}
  .insights-section-nav{margin:0;padding:6px;gap:4px}
  .insights-section-nav-btn{flex:0 0 auto;min-height:var(--_sd-touch-min,44px);padding:8px 10px;font-size:var(--sd-type-role-label-sm-size);letter-spacing:1.55px}
  .insights-definition-grid{grid-template-columns:1fr}
  .insights-definition-strip{padding:var(--sd-space-10) var(--sd-space-11)}
  .insights-card{padding:var(--sd-space-12)}
  .insights-coach-evidence{grid-template-columns:repeat(2,minmax(0,1fr))}
  .insights-coach-decision.primary{padding:var(--sd-space-13) var(--sd-space-12)}
  .insights-coach-decision.primary .insights-coach-decision-copy{font-size:var(--sd-type-role-control-size);line-height:1.48}
  .insights-coach-decision-tag,.insights-coach-decision-surface{white-space:normal;text-align:center}
  .insights-coach-decision-foot{align-items:flex-start;flex-wrap:wrap}
  .insights-coach-surface{grid-template-columns:1fr;gap:7px;align-items:start}
  .insights-coach-surface .insights-coach-open{justify-self:start}
  .insights-practice-body{padding:var(--sd-space-10)}
  .insights-fitness-body{padding:var(--sd-space-10)}
  .insights-fitness-summary-meta{white-space:normal}
  .insights-fitness-reading{grid-template-columns:1fr}
  .insights-fitness-reading .tag{width:max-content;white-space:normal}
  .insights-fitness-state-row{grid-template-columns:1fr auto}
  .insights-fitness-state-meta{grid-column:1/-1}
  .insights-fitness-context-row{grid-template-columns:1fr}
  .insights-brain-body{padding:var(--sd-space-10)}
  .insights-brain-summary-meta{white-space:normal}
  .insights-brain-read,.insights-brain-read-head,.insights-brain-read-copy{min-width:0}
  .insights-brain-read-value{white-space:normal;overflow-wrap:anywhere;text-align:right;max-width:100%}
  .insights-dynamics-card-columns{grid-template-columns:1fr;gap:10px}
  .insights-dynamics-card-visual{padding-left:0;padding-top:10px;border-left:0;border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.07)}
  .insights-persistent-pattern-chart{height:auto}
  .insights-persistent-pattern-chart .pattern-label,.insights-allocation-compare-chart .pattern-label{font-size:var(--sd-type-role-caption-compact-size)}
  .insights-allocation-compare-chart{height:auto}
  .insights-dynamics-phase{height:auto}
  .insights-dynamics-change-strip{height:auto}
  .insights-dynamics-scenario{grid-template-columns:1fr auto}
  .insights-practice-summary-meta{white-space:normal}
  .insights-practice-reading{grid-template-columns:1fr}
  .insights-practice-reading>.insights-rhythm-note{grid-column:1}
  .insights-practice-reading .tag{width:max-content;white-space:normal}
  .insights-practice-position-summary{grid-template-columns:1fr}
  .insights-section-title{display:grid;gap:4px;align-items:start}
  .insights-cluster-head{gap:4px}
  .insights-evidence-strip{padding:var(--sd-space-12) var(--sd-space-13)}
  .insights-evidence-item{border:0;padding:0;min-width:0}
  .insights-evidence-item:nth-child(even){border-left:1px solid rgba(var(--sd-rgb-neutral-overlay),.08);padding-left:10px}
  .insights-evidence-item:nth-child(n+3){border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.08);padding-top:9px}
  .insights-evidence-item .v{font-size:var(--sd-type-role-reading-size)}
  .insights-training-grid .insights-card{min-height:0}
  .insights-bar-row{grid-template-columns:minmax(82px,104px) 1fr 58px;gap:8px}.insights-area-completion-row{grid-template-columns:minmax(82px,104px) 1fr minmax(80px,98px)}.insights-area-completion-meta{font-size:var(--sd-type-role-overline-near-size)}
  .insights-bar-row.is-empty .insights-pct{white-space:normal;overflow-wrap:anywhere;line-height:1.15}
  .insights-name,.insights-pct{font-size:var(--sd-type-role-caption-size)}
  .insights-rhythm-grid .insights-card{min-height:0}
  .insights-rhythm-summary{gap:6px}
  .insights-rhythm-chip{padding:6px 7px;flex-basis:96px}
  .insights-chart,.insights-trend-card .insights-chart,.insights-weekly-card .insights-chart,.insights-visual-stack .insights-chart,.insights-dossier-section .insights-chart{height:auto}
  .insights-brain-card .insights-chart{overflow:hidden}
  .insights-chart-inspector{min-height:44px;display:flex;align-items:center}
  .insights-heatmap{grid-template-columns:repeat(auto-fill,minmax(24px,1fr));gap:5px}
  .insights-cell{height:24px}
  .insights-resource-card .insights-mixbar-legend{grid-template-columns:1fr}
  .insights-allocation-bar-row{grid-template-columns:68px 1fr;gap:8px}
  .insights-allocation-track{height:25px}
  .insights-allocation-legend{grid-template-columns:1fr}
  .insights-allocation-item{min-height:40px}
  .insights-risk-widget{grid-template-columns:1fr;gap:8px}
  .insights-risk-key{order:-1;grid-template-columns:1fr;max-height:220px;overflow:auto;padding:8px;border:1px solid rgba(var(--sd-rgb-neutral-overlay),.07);scrollbar-width:thin;scrollbar-color:rgba(var(--sd-rgb-info),.28) transparent}
  .insights-risk-key-title,.insights-risk-key .help{grid-column:1;color:var(--sd-color-text-primary)}
  .insights-risk-key .row{min-height:var(--_sd-touch-min,44px);padding:7px 6px;display:flex;align-items:center;white-space:normal;overflow:visible;text-overflow:clip}
  .insights-risk-scatter{height:auto}
  .insights-dynamics-lab-body{padding:var(--sd-space-09);gap:9px}
  .insights-dossier-section{padding:var(--sd-space-10);gap:8px}
  .insights-reliability-item{padding:9px}
  .insights-reliability-item .k,.insights-reliability-item .v{white-space:normal;overflow:visible;text-overflow:clip}
  .insights-definition-item .k,.insights-reliability-item .k,.insights-rhythm-chip .k{font-size:var(--sd-type-role-overline-size)}
  .insights-table.compact-mobile .insights-table-row.head{display:none}
  .insights-table.compact-mobile .insights-table-row:not(.head){display:grid!important;grid-template-columns:1fr!important;width:auto;min-width:0;gap:0;padding:5px 8px;border:1px solid rgba(var(--sd-rgb-neutral-overlay),.075);background:rgba(var(--sd-rgb-neutral-overlay),.016)}
  .insights-table.compact-mobile .insights-table-row:not(.head)>div{display:grid;grid-template-columns:minmax(118px,1fr) minmax(0,1fr);gap:10px;align-items:start;padding:5px 0;text-align:right;white-space:normal;overflow:visible;text-overflow:clip;font-size:var(--sd-type-role-copy-compact-tight-size);border-bottom:1px solid rgba(var(--sd-rgb-neutral-overlay),.045)}
  .insights-table.compact-mobile .insights-table-row:not(.head)>div:last-child{border-bottom:0}
  .insights-table.compact-mobile .insights-table-row:not(.head)>div::before{content:attr(data-label);text-align:left;color:var(--sd-color-text-secondary);font-size:var(--sd-type-role-overline-sm-size);font-weight:800;letter-spacing:1.6px;text-transform:uppercase}
  .insights-table.mobile-scroll{padding-bottom:5px}
  .insights-table.mobile-scroll .insights-table-row{width:max-content;min-width:100%;font-size:var(--sd-type-role-caption-size);gap:8px}
  .insights-table.mobile-scroll .insights-table-row.head{font-size:var(--sd-type-role-overline-sm-size);letter-spacing:1.4px}
  .insights-fitness-model-evidence{overflow:hidden}
  .insights-table-row .subject{font-size:var(--sd-type-role-copy-compact-expanded-size)}
  .insights-progressive-controls{align-items:flex-start;flex-direction:column}
  .insights-mobile-scroll-cue{display:block;text-align:right;color:var(--sd-color-info);font-size:var(--sd-type-role-overline-size);letter-spacing:1.3px}
  .insights-empty{padding:var(--sd-space-18) var(--sd-space-14)}
}
@media(max-width:420px){
  .insights-kicker{letter-spacing:3.2px}
  .insights-window-note{font-size:var(--sd-type-role-caption-size)}
  .insights-evidence-strip{grid-template-columns:1fr;gap:8px}
  .insights-training-grid,.insights-reliability-grid{gap:8px}
  .insights-evidence-item:nth-child(even){border-left:0;padding-left:0}
  .insights-evidence-item:nth-child(n+2){border-top:1px solid rgba(var(--sd-rgb-neutral-overlay),.08);padding-top:9px}
  .insights-evidence-item .v{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
  .insights-main{font-size:var(--sd-type-role-section-compact-size)}
  .insights-allocation-values{font-size:var(--sd-type-role-label-compact-size)}
  .insights-risk-scatter{height:auto}
}
@media(hover:none) and (pointer:coarse){
  .insights-chart-touch-surface{min-height:var(--_sd-touch-min,44px);touch-action:pan-y}
  .insights-heatmap{grid-template-columns:repeat(auto-fill,minmax(var(--_sd-touch-min,44px),1fr))}
  .insights-heatmap>.insights-cell{height:var(--_sd-touch-min,44px)}
  .insights-coach-open,.insights-execution-tab,.insights-section-nav-btn,.insights-coach-synthesis>summary{position:relative;isolation:isolate;touch-action:manipulation}
  .insights-coach-open::after{content:"";position:absolute;inset:-8px -4px;z-index:2}
  .insights-execution-tab::after{content:"";position:absolute;inset:-2px 0;z-index:2}
  .insights-section-nav-btn::after{content:"";position:absolute;inset:-3px 0;z-index:2}
  .insights-coach-synthesis>summary::after{content:"";position:absolute;inset:-7px 0;z-index:2}
  .insights-window-btn{min-height:var(--_sd-touch-min,44px)}
  .insights-coach-open,.insights-execution-tab,.insights-coach-synthesis>summary,.insights-progressive-controls .mini-btn,.insights-empty-actions .mini-btn{min-height:var(--_sd-touch-min,44px);display:flex;align-items:center}
  .insights-risk-key .row{min-height:var(--_sd-touch-min,44px);padding:7px 6px;display:flex;align-items:center}
}
`;

  function injectStyles(){
    if(document.getElementById('study-director-insights-style'))return;
    const style=document.createElement('style');
    style.id='study-director-insights-style';
    style.textContent=INSIGHTS_BASE_STYLES+INSIGHTS_RESPONSIVE_STYLES;
    document.head.appendChild(style);
  }

  // 9D. SURFACE RENDERERS
  function renderDemoBanner(api:RendererApi,reload:Reload){
    const banner=el('div','demo-data-banner ui-card');
    const copy=el('div','demo-data-banner-copy');
    copy.append(el('div','demo-data-banner-title ui-label','Sample Data Mode'),el('div','demo-data-banner-note ui-mono',`Insights is reading a ${PREVIEW_SAMPLE_DAYS}-day sample. These patterns are for guidance only, not your real Library.`));
    const back=el('button','mini-btn ui-btn primary','Go back to real data');
    back.type='button';
    back.addEventListener('click',()=>{
      if(api&&api.preview&&typeof api.preview.clear==='function')api.preview.clear('insights');
      if(typeof reload==='function')reload();
    });
    banner.append(copy,back);
    return banner;
  }
  function renderEmptyState(api:RendererApi,reload:Reload,currentStudyDate:string){
    const box=el('div','insights-empty ui-card ui-mono');
    box.appendChild(el('div',null,'No saved daily records yet. Use Review -> Save Today, then return here.'));
    const actions=el('div','insights-empty-actions');
    const useSample=api.preview?.useSample;
    if(typeof useSample==='function'){
      const preview=el('button','mini-btn ui-btn primary',`Preview with ${PREVIEW_SAMPLE_DAYS}-day sample`);
      preview.type='button';
      preview.addEventListener('click',()=>{void (async()=>{
        preview.disabled=true;
        preview.textContent='Preparing sample…';
        const result=await useSample({label:`Sample ${PREVIEW_SAMPLE_DAYS} days`,target:'insights',today:currentStudyDate});
        if(result&&result.ok){
          if(typeof reload==='function')reload();
          return;
        }
        preview.textContent='Sample preview unavailable';
        if(!box.querySelector('.insights-preview-unavailable')){
          box.appendChild(el('div','insights-preview-unavailable insights-note ui-mono','The sample provider did not load. Real saved-data insights remain available.'));
        }
      })();});
      actions.appendChild(preview);
    }else{
      const goTab=api.ui?.goTab;
      if(typeof goTab!=='function')return box;
      const guide=el('button','mini-btn ui-btn','Open Guide');
      guide.type='button';
      guide.addEventListener('click',()=>goTab('guide'));
      actions.appendChild(guide);
    }
    if(actions.childNodes.length)box.appendChild(actions);
    return box;
  }
  function evidenceItem(label:DisplayValue,value:DisplayValue,note:DisplayValue=''){
    return kvItem('insights-evidence-item',label,value,note,true,'l ui-label');
  }
  function subjectSignal(label:DisplayValue,main:DisplayValue,note:DisplayValue=''){
    return kvItem('insights-subject-signal ui-canvas',label,main,note,false,'k ui-label','v ui-label');
  }
  function renderSubjectSignalStrip(model:Model){
    const strip=el('div','insights-subject-signals');
    const best=model.interpretation.signals.bestSubject;
    const weak=model.interpretation.signals.weakSubject;
    strip.append(
      subjectSignal('Highest sampled completion',best?best.label:'Need evidence',best?`${percentLabel(best.completion)} · ${best.blocks} blocks · ${minutesLabel(best.planned)} planned`:'Needs 3+ blocks and 90m planned or 60m actual focus.'),
      subjectSignal('Coverage watch',weak?weak.label:'No watch',weak?`${weak.windowAbsent?'Absent in window':'Score '+weak.coverageWatchScore} · ${weak.allocation} · last ${weak.daysSinceLast??0}d`:'No known top-level area is sufficiently stale or under-covered to flag.')
    );
    return strip;
  }
  function barRow(label:string,value:number|null,detail?:DisplayValue){
    const row=el('div','insights-bar-row');
    const fill=el('div','insights-fill');
    fill.style.width=clampPct(value)+'%';
    const track=el('div','insights-track');
    track.appendChild(fill);
    const name=el('div','insights-name ui-label',label);
    name.title=String(label||'');
    row.append(name,track,el('div','insights-pct ui-mono',detail!==undefined?detail:percentLabel(value)));
    return row;
  }
  function areaCompletionRow(subject:Subject){
    const early=!hasBestSubjectEvidence(subject);
    const row=el('div','insights-bar-row insights-area-completion-row'+(early?' early':''));
    const fill=el('div','insights-fill');
    fill.style.width=clampPct(subject&&subject.completion)+'%';
    const track=el('div','insights-track');
    track.appendChild(fill);
    const name=el('div','insights-name ui-label',subject&&subject.label||'Area');
    name.title=String(subject&&subject.label||'Area');
    const stats=el('div','insights-area-completion-stats');
    const planned=Math.max(0,num(subject&&subject.planned));
    stats.append(el('div','insights-pct ui-mono',percentLabel(subject&&subject.completion)),el('div','insights-area-completion-meta ui-mono',`${num(subject&&subject.blocks)} block${num(subject&&subject.blocks)===1?'':'s'} · ${planned>=600?`${Math.round(planned/60)}h`:minutesLabel(planned)} planned${early?' · early':''}`));
    row.append(name,track,stats);
    return row;
  }
  function lifeRow(label:string,value:number,total:number){
    const pctValue=total>0?Math.round(num(value)/total*100):0;
    const row=el('div','insights-life-row');
    const head=el('div','insights-life-head ui-mono');
    head.append(el('span',null,label),el('b',null,`${pctValue}% · ${minutesLabel(value)}/day`));
    const fill=el('div','insights-fill');
    fill.style.width=clampPct(pctValue)+'%';
    const track=el('div','insights-track');
    track.appendChild(fill);
    row.append(head,track);
    return row;
  }
  function card(label:DisplayValue,main:DisplayValue,note?:DisplayValue){
    const box=el('section','insights-card ui-card');
    box.append(el('div','insights-label ui-label',label),el('div','insights-main ui-label',main));
    if(note)box.appendChild(evidenceNote(note));
    return box;
  }
  function sectionTitle(label:DisplayValue,note?:DisplayValue){
    const row=el('div','insights-section-title');
    row.appendChild(el('div','insights-label ui-label',label));
    if(note)row.appendChild(evidenceNote(note));
    return row;
  }
  function summaryChip(label:DisplayValue,value:DisplayValue){
    const chip=el('div','insights-rhythm-chip ui-canvas');
    chip.append(el('div','k ui-label',label),el('div','v ui-mono',value));
    return chip;
  }
  function barRowsFromSeries<T extends BarSeriesRow>(series:readonly T[],{showEmpty=false,detailFor=null}:{showEmpty?:boolean;detailFor?:((row:T)=>DisplayValue)|null}={}){
    const wrap=el('div','insights-bars');
    const rows=showEmpty?series:series.filter(row=>row.blocks>0);
    rows.forEach(row=>{
      const detail=detailFor?detailFor(row):(row.blocks>0?`${percentLabel(row.completion)} · n=${row.blocks}`:'n=0');
      const node=barRow(row.label,row.blocks>0?row.completion:0,detail);
      if(!(row.blocks>0))node.classList.add('is-empty');
      wrap.appendChild(node);
    });
    return wrap;
  }
  function clusterHeader(label:DisplayValue,note?:DisplayValue){
    const head=el('div','insights-cluster-head');
    head.appendChild(el('div','insights-cluster-title ui-label',label));
    if(note)head.appendChild(el('div','insights-cluster-note ui-mono',note));
    return head;
  }
  function insightWindowSubtitle(model:Model){
    if(!model.recordCount)return 'No saved records in this window yet.';
    const total=model.allRecordCount&&model.allRecordCount!==model.recordCount?` of ${model.allRecordCount}`:'';
    const range=model.dateRange.start&&model.dateRange.end?` · ${shortDate(model.dateRange.start)} to ${shortDate(model.dateRange.end)}`:'';
    const direction=model.trendBasis&&model.trendBasis.capped?' · day-by-day charts and analytical models use the latest 2 years':'';
    return `${model.windowLabel||'Selected window'} · ${model.recordCount}${total} saved day${model.recordCount===1?'':'s'}${range} · totals, averages and counts use the full window${direction}.`;
  }
  function renderWindowSelector(model:Model,onChange?:(key:string)=>unknown){
    const bar=el('div','insights-window-bar');
    const copy=el('div','insights-window-copy');
    copy.appendChild(el('div','insights-window-title ui-label','Window'));
    const windowNote=model.recordCount
      ? `${insightWindowSubtitle(model)} Recent-day and top-area charts may show a labelled subset.`
      : model.allRecordCount
        ? `${model.windowLabel||'Selected window'} · no saved days in this window. Current Study State and Study Dynamics still use all ${model.allRecordCount} saved day${model.allRecordCount===1?'':'s'}.`
        : 'Choose a window after saving or importing records.';
    copy.appendChild(el('div','insights-window-note ui-mono',windowNote));
    const group=el('div','insights-window-options');
    INSIGHT_WINDOW_OPTIONS.forEach(option=>{
      const btn=el('button','insights-window-btn ui-btn ui-label'+(option.key===model.windowKey?' active':''),option.label);
      btn.type='button';
      btn.setAttribute('aria-pressed',option.key===model.windowKey?'true':'false');
      btn.addEventListener('click',()=>{ if(option.key!==model.windowKey&&typeof onChange==='function')onChange(option.key); });
      group.appendChild(btn);
    });
    bar.append(copy,group);
    return bar;
  }
  const executionActivators=new WeakMap<HTMLElement,(key:string|null)=>boolean>();
  async function openAndScrollToInsightsTarget(targetId:string){
    const target=document.getElementById(targetId);
    if(!target)return false;
    const executionPanel=target.closest<HTMLElement>('[data-execution-panel]');
    if(executionPanel&&executionPanel.hidden){
      const key=executionPanel.getAttribute('data-execution-panel');
      const surface=executionPanel.closest<HTMLElement>('.insights-execution-surface');
      const activate=surface&&executionActivators.get(surface);
      if(activate)await activate(key);
      else{
        const button=[...document.querySelectorAll<HTMLButtonElement>('[data-execution-tab]')].find(candidate=>candidate.dataset['executionTab']===key)||null;
        if(button)button.click();
      }
    }
    if(target instanceof HTMLDetailsElement)target.open=true;
    const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'});
    return true;
  }
  function renderSectionNavigation(){
    const nav=el('nav','insights-section-nav ui-inset');
    nav.setAttribute('aria-label','Insights sections');
    const sections:readonly (readonly [string,string])[]=[
      ['Coach','insights-coach'],
      ['Performance','insights-performance'],
      ['Output','insights-output'],
      ['Execution','insights-execution'],
      ['Areas','insights-areas'],
      ['Dynamics','insights-dynamics'],
      ['Lab','insights-lab']
    ];
    sections.forEach(([label,targetId],index)=>{
      const button=el('button','insights-section-nav-btn ui-btn ui-label'+(index===0?' active':''),label);
      button.type='button';
      button.setAttribute('aria-controls',targetId);
      if(index===0)button.setAttribute('aria-current','location');
      button.addEventListener('click',()=>{
        nav.querySelectorAll('.insights-section-nav-btn').forEach(item=>{
          const active=item===button;
          item.classList.toggle('active',active);
          if(active)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');
        });
        void openAndScrollToInsightsTarget(targetId);
      });
      nav.appendChild(button);
    });
    return nav;
  }
  function valueToY(value:number,min:number,max:number,height:number,pad:number){
    if(max===min)return height/2;
    return height-pad-((value-min)/(max-min))*(height-pad*2);
  }
  function lineChart(rows:readonly TrendDailyRow[],options:LineChartOptions={}){
    const compact=isCompact();
    const allRows=rows;
    const limit=compact?MAX_COMPLETION_CHART_DAYS_COMPACT:MAX_COMPLETION_CHART_DAYS_DESKTOP;
    rows=allRows.slice(-limit);
    const width=compact?360:640,height=compact?210:190,pad=compact?36:34;
    const {svg}=chartFrame(width,height,pad);
    labelGraphic(svg,options.label||'Work completion trend',`Daily work completion with a rolling mean over the latest seven completion-eligible saved days. Records without work completion are omitted from the mean. Trend lines break when sampled dates are more than ${WORK_TREND_MAX_CONNECTED_GAP_DAYS} calendar days apart. Focus a point to hear its date and value.`);
    const inspect:ChartHit[]=[];
    const key:LineChartKey=options.key||'completion';
    const values=rows.map(r=>r[key]).filter(finiteNumber);
    if(values.length<2){
      return chartEmpty(svg,'Need at least two work-completion days in the displayed span',pad,height/2);
    }
    const min=Math.min(0,Math.min(...values));
    const max=Math.max(100,Math.max(...values));
    const xFor=(i:number)=>pad+(i/(Math.max(1,rows.length-1)))*(width-pad*2);
    const yFor=(v:number)=>valueToY(v,min,max,height,pad);
    [0,50,100].forEach(mark=>{
      const y=yFor(mark);
      svg.appendChild(svgEl('line',{class:`axis${mark===0?'':' chart-opacity-axis'}`,x1:pad,y1:y,x2:width-pad,y2:y}));
      const label=svgEl('text',{class:'label',x:pad-6,y:y+3,'text-anchor':'end'});
      label.textContent=`${mark}%`;
      svg.appendChild(label);
    });
    const drawSegments=(valueKey:LineChartKey,className:string)=>{
      const segments:string[][]=[];let segment:string[]=[];let previousDay:number|null=null;let calendarBroken=false;
      rows.forEach((row,index)=>{
        const value=row&&row[valueKey],day=dateDay(row&&row.date);
        if(!finiteNumber(value)){
          if(segment.length)segments.push(segment);
          segment=[];previousDay=null;return;
        }
        if(segment.length&&finiteNumber(day)&&finiteNumber(previousDay)&&day-previousDay>WORK_TREND_MAX_CONNECTED_GAP_DAYS){
          segments.push(segment);segment=[];calendarBroken=true;
        }
        segment.push(`${xFor(index)},${yFor(value)}`);previousDay=day;
      });
      if(segment.length)segments.push(segment);
      segments.filter(points=>points.length>1).forEach(points=>svg.appendChild(svgEl('polyline',{class:className,points:points.join(' ')})));
      return calendarBroken;
    };
    const primaryBroken=drawSegments(key,'line');
    const softBroken=options.softKey?drawSegments(options.softKey,'line soft'):false;
    rows.forEach((r,i)=>{
      const v=r[key];
      if(!finiteNumber(v))return;
      const x=xFor(i),y=yFor(v);
      const dot=svgEl('circle',{class:`dot ${compact?'chart-point-xl':'chart-point-xs'}`,cx:x,cy:y,r:compact?3.4:2});
      const title=svgEl('title');
      const detail=`${shortDate(r.date)}: ${Math.round(v)}% work completion`;
      title.textContent=detail;
      dot.appendChild(title);
      svg.appendChild(dot);
      chartHitCircle(svg,x,y,detail,inspect,compact?22:14);
    });
    const left=svgEl('text',{class:'axis-label strong',x:pad,y:16});
    left.textContent=options.label||'Work completion %';
    const xLabel=svgEl('text',{class:'axis-label',x:width/2-34,y:height-6});
    xLabel.textContent='Saved days';
    const right=svgEl('text',{class:'label',x:width-pad-116,y:height-6});
    const firstRow=rows[0],lastRow=rows[rows.length-1];
    right.textContent=firstRow&&lastRow?`${shortDate(firstRow.date)} -> ${shortDate(lastRow.date)}`:'';
    svg.append(left,xLabel,right);
    const widget=inspectedChart(svg,inspect);
    if(primaryBroken||softBroken)appendChartNote(widget,`Line breaks mark sampled dates more than ${WORK_TREND_MAX_CONNECTED_GAP_DAYS} calendar days apart; points remain visible.`);
    if(allRows.length>rows.length)appendChartNote(widget,`Chart shows the latest ${rows.length} of ${allRows.length} saved days; the rolling line and descriptive summaries use the full selected window.`);
    return widget;
  }
  function plannedActualChart(rows:readonly DailyRow[]){
    const compact=isCompact();
    const width=compact?360:700,height=compact?220:220,pad=compact?38:40;
    const {svg}=chartFrame(width,height,pad);
    labelGraphic(svg,'Plan time match',`Planned work minutes compared with Timer-tracked focus across recent saved days. Blue bars with under ${MIN_TIMER_COVERAGE_FOR_PLAN_READ}% Timer coverage are faded because untracked time is unknown. Focus a day to hear both values and coverage.`);
    const clean=rows.filter(r=>Number.isFinite(r.planned)||Number.isFinite(r.actual)).slice(compact?-14:-24);
    const inspect:ChartHit[]=[];
    if(!clean.length){
      return chartEmpty(svg,'Need saved planned and actual minutes',pad,height/2);
    }
    const max=Math.max(60,...clean.flatMap(r=>[r.planned||0,r.actual||0]));
    const maxLabel=svgEl('text',{class:'label',x:pad-6,y:pad+3,'text-anchor':'end'});
    maxLabel.textContent=minutesLabel(max);
    const zeroLabel=svgEl('text',{class:'label',x:pad-6,y:height-pad+3,'text-anchor':'end'});
    zeroLabel.textContent='0';
    svg.append(maxLabel,zeroLabel);
    const gap=(width-pad*2)/Math.max(1,clean.length);
    const barW=Math.max(5,Math.min(16,gap*.32));
    let limitedDays=0;
    clean.forEach((r,i)=>{
      const x=pad+i*gap+gap*.16;
      const planH=((r.planned||0)/max)*(height-pad*2);
      const actualH=((r.actual||0)/max)*(height-pad*2);
      const coverageLimited=num(r&&r.planned)>0&&(!Number.isFinite(r&&r.timerCoverage)||num(r.timerCoverage)<MIN_TIMER_COVERAGE_FOR_PLAN_READ);
      if(coverageLimited)limitedDays+=1;
      const plan=svgEl('rect',{class:'bar plan',x,y:height-pad-planH,width:barW,height:planH});
      const actual=svgEl('rect',{class:`bar actual${coverageLimited?' coverage-limited':''}`,x:x+barW+2,y:height-pad-actualH,width:barW,height:actualH});
      const detail=`${shortDate(r.date)}: planned ${minutesLabel(r.planned)}, Timer-tracked focus ${minutesLabel(r.actual)} · coverage ${percentLabel(r.timerCoverage)}${coverageLimited?' · coverage limited; untracked time is unknown':''}`;
      const title=svgEl('title');title.textContent=detail;actual.appendChild(title);
      svg.append(plan,actual);
      chartHitRect(svg,pad+i*gap,pad,Math.max(12,gap),height-pad*2,detail,inspect);
    });
    const title=svgEl('text',{class:'axis-label strong',x:pad,y:15});
    title.textContent='Minutes per day';
    const xLabel=svgEl('text',{class:'axis-label',x:width/2-48,y:height-6});
    xLabel.textContent='Recent saved days';
    const legend=svgEl('text',{class:'label',x:width-pad-150,y:12});
    legend.textContent='grey plan / blue tracked';
    svg.append(title,xLabel,legend);
    const widget=inspectedChart(svg,inspect);
    if(limitedDays)appendChartNote(widget,`${limitedDays} displayed day${limitedDays===1?' has':'s have'} under ${MIN_TIMER_COVERAGE_FOR_PLAN_READ}% Timer coverage; faded tracked-focus bars should not be read as complete execution evidence.`);
    return widget;
  }
  function completionStabilityChart(rows:readonly DailyRow[]){
    const compact=isCompact();
    const width=compact?360:700,height=compact?238:238,pad=compact?38:42;
    const {svg}=chartFrame(width,height,pad);
    labelGraphic(svg,'Work-completion stability','Daily work completion against the selected-window average and descriptive reference band. Focus a point to hear its date and value.');
    const cleanAll=rows.filter((r):r is DailyRow&Readonly<{completion:number}>=>finiteNumber(r.completion));
    const limit=compact?MAX_STABILITY_CHART_DAYS_COMPACT:MAX_STABILITY_CHART_DAYS_DESKTOP;
    const clean=cleanAll.slice(-limit);
    const inspect:ChartHit[]=[];
    if(clean.length<5){
      return chartEmpty(svg,'Need at least five work-completion days for stability evidence',pad,height/2);
    }
    const values=cleanAll.map(r=>r.completion);
    const avg=mean(values)??0;
    const sd=stdev(values)||0;
    const upper=Math.min(100,avg+2*sd);
    const lower=Math.max(0,avg-2*sd);
    const xFor=(i:number)=>pad+(i/(Math.max(1,clean.length-1)))*(width-pad*2);
    const yFor=(v:number)=>height-pad-(v/100)*(height-pad*2);
    const band=svgEl('rect',{class:'completion-reference-band',x:pad,y:yFor(upper),width:width-pad*2,height:Math.max(1,yFor(lower)-yFor(upper))});
    svg.appendChild(band);
    [0,50,100].forEach(mark=>{
      const y=yFor(mark);
      svg.appendChild(svgEl('line',{class:`axis ${mark===0?'chart-opacity-hidden':'chart-opacity-faint'}`,x1:pad,y1:y,x2:width-pad,y2:y}));
      if(mark>0){
        const label=svgEl('text',{class:'label bright',x:10,y:y+4});
        label.textContent=`${mark}%`;
        svg.appendChild(label);
      }
    });
    [{value:upper,opacity:.28},{value:avg,opacity:.76},{value:lower,opacity:.28}].forEach(row=>{
      const y=yFor(row.value);
      svg.appendChild(svgEl('line',{class:'axis',x1:pad,y1:y,x2:width-pad,y2:y,opacity:row.opacity}));
    });
    const points=clean.map((r,i)=>`${xFor(i)},${yFor(r.completion)}`).join(' ');
    svg.appendChild(svgEl('polyline',{class:'line soft',points}));
    clean.forEach((r,i)=>{
      const unusual=r.completion>upper||r.completion<lower;
      const x=xFor(i),y=yFor(r.completion);
      const dot=svgEl('circle',{class:'dot '+(unusual?'unusual chart-point-emphasis':'chart-point-base'),cx:x,cy:y,r:unusual?4:2.6});
      const title=svgEl('title');
      const detail=`${shortDate(r.date)}: ${percentLabel(r.completion)}${unusual?' · outside the reference band':''}`;
      title.textContent=detail;
      dot.appendChild(title);
      svg.appendChild(dot);
      chartHitCircle(svg,x,y,detail,inspect,compact?22:14);
    });
    const heading=svgEl('text',{class:'axis-label strong',x:pad,y:18});
    heading.textContent='Work-completion stability';
    const reference=svgEl('text',{class:'label bright',x:width-pad,y:compact?36:18,'text-anchor':'end'});
    reference.textContent=`mean ${round(avg,1)}% · reference ${Math.round(lower)}–${Math.round(upper)}%`;
    const xLabel=svgEl('text',{class:'axis-label',x:width/2-35,y:height-8});
    xLabel.textContent='Saved days';
    svg.append(heading,reference,xLabel);
    const widget=inspectedChart(svg,inspect);
    if(cleanAll.length>clean.length)appendChartNote(widget,`Chart shows the latest ${clean.length} of ${cleanAll.length} completion days; the mean and reference band use the full selected window.`);
    return widget;
  }
  function planRealismScatter(rows:readonly DailyRow[]){
    const compact=isCompact();
    const width=compact?360:700,height=compact?260:260,pad=compact?54:58,rightPad=compact?28:34;
    const {svg,plotWidth:plotW,plotHeight:plotH}=chartFrame(width,height,pad,rightPad);
    labelGraphic(svg,'Planned versus tracked focus','Scatter plot comparing planned work with Timer-tracked focus for each saved day. Coverage-limited days are hollow and are not classified as below, near, or above plan. Coincident days are separated slightly.');
    const cleanAll=rows.filter(r=>Number.isFinite(r.planned)&&Number.isFinite(r.actual)&&(r.planned>0||r.actual>0));
    const limit=compact?MAX_PLAN_SCATTER_DAYS_COMPACT:MAX_PLAN_SCATTER_DAYS_DESKTOP;
    const clean=cleanAll.slice(-limit);
    const inspect:ChartHit[]=[];
    if(clean.length<2){
      return chartEmpty(svg,'Need planned and actual focus across saved days',pad,height/2);
    }
    const max=Math.max(60,...clean.flatMap(r=>[r.planned||0,r.actual||0]));
    const xFor=(v:number)=>pad+(Math.max(0,v)/max)*plotW;
    const yFor=(v:number)=>height-pad-(Math.max(0,v)/max)*plotH;
    [0,.5,1].forEach(mark=>{
      const value=max*mark;
      const x=xFor(value),y=yFor(value);
      svg.appendChild(svgEl('line',{class:'axis chart-opacity-axis',x1:x,y1:height-pad,x2:x,y2:height-pad+4}));
      svg.appendChild(svgEl('line',{class:'axis chart-opacity-faint',x1:pad,y1:y,x2:width-rightPad,y2:y}));
      const lx=svgEl('text',{class:'label',x:x,y:height-9,'text-anchor':'middle'});
      lx.textContent=mark===0?'0':minutesLabel(value);
      const ly=svgEl('text',{class:'label',x:pad-7,y:y+4,'text-anchor':'end'});
      ly.textContent=mark===0?'0':minutesLabel(value);
      svg.append(lx,ly);
    });
    svg.appendChild(svgEl('line',{class:'line soft chart-opacity-soft',x1:xFor(0),y1:yFor(0),x2:xFor(max),y2:yFor(max)}));
    const nearBand=svgEl('path',{class:'near-plan-band',d:`M ${xFor(0)} ${yFor(0)} L ${xFor(max)} ${yFor(max*.9)} L ${xFor(max)} ${yFor(max)} L ${xFor(max/1.1)} ${yFor(max)} Z`});
    svg.insertBefore(nearBand,svg.querySelector('line'));
    type ScatterPoint={row:DailyRow;x:number;y:number;coincident?:number};
    const plotted:ScatterPoint[]=clean.map(row=>({row,x:xFor(row.planned||0),y:yFor(row.actual||0)}));
    const coincident=new Map<string,ScatterPoint[]>();
    plotted.forEach(point=>{
      const key=`${Math.round(point.x/4)}|${Math.round(point.y/4)}`;
      if(!coincident.has(key))coincident.set(key,[]);
      coincident.get(key)?.push(point);
    });
    coincident.forEach(group=>group.forEach((point,index)=>{
      if(group.length<2)return;
      const radius=Math.min(9,3+group.length*.8);
      const angle=(Math.PI*2*index/group.length)-Math.PI/2;
      point.x=Math.max(pad+3,Math.min(width-rightPad-3,point.x+Math.cos(angle)*radius));
      point.y=Math.max(pad+3,Math.min(height-pad-3,point.y+Math.sin(angle)*radius));
      point.coincident=group.length;
    }));
    plotted.forEach(point=>{
      const {row}=point;
      const ratio=row.planned>0?row.actual/row.planned:null;
      const timerCoverage=finiteOrNull(row.timerCoverage);
      const coverageLimited=timerCoverage===null||timerCoverage<MIN_TIMER_COVERAGE_FOR_PLAN_READ;
      const cls=coverageLimited?'dot coverage-limited':ratio!==null&&ratio>=.9&&ratio<=1.1?'dot near-plan':'dot';
      const dot=svgEl('circle',{class:`${cls} ${coverageLimited?'chart-point-emphasis':'chart-point-large'}`,cx:point.x,cy:point.y,r:coverageLimited?4:3.2});
      const title=svgEl('title');
      const reading=coverageLimited?'coverage-limited':ratio===null?'no plan ratio':ratio<.9?'below plan':ratio>1.1?'above plan':'near plan';
      const detail=`${shortDate(row.date)}: planned ${minutesLabel(row.planned)}, actual ${minutesLabel(row.actual)} · Timer coverage ${percentLabel(timerCoverage)} · ${reading}${point.coincident?` · ${point.coincident} days share these values`:''}`;
      title.textContent=detail;
      dot.appendChild(title);
      svg.appendChild(dot);
      chartHitCircle(svg,point.x,point.y,detail,inspect,compact?22:14);
    });
    const heading=svgEl('text',{class:'axis-label strong',x:pad,y:18});
    heading.textContent='Planned vs tracked focus';
    const axes=svgEl('text',{class:'label',x:pad,y:compact?36:34});
    axes.textContent=compact?'x plan · y focus · diagonal = match':'x = planned work · y = tracked focus';
    const legend=svgEl('text',{class:'label',x:width-rightPad,y:34,'text-anchor':'end'});
    legend.textContent=compact?'':'diagonal = tracked time matches plan';
    svg.append(heading,axes,legend);
    const widget=inspectedChart(svg,inspect);
    if(cleanAll.length>clean.length)appendChartNote(widget,`Chart shows the latest ${clean.length} of ${cleanAll.length} eligible saved days and scales those visible points; plan-realism calculations use the full selected window.`);
    return widget;
  }
  function weeklyRhythmChart(rows:readonly DailyRow[]){
    const compact=isCompact();
    const width=compact?360:640,height=compact?180:150,pad=compact?28:24;
    const {svg}=chartFrame(width,height,pad);
    labelGraphic(svg,'Weekly work rhythm',`Planned-minute weighted work completion grouped by weekday. A weekday with fewer than ${MIN_WEEKDAY_SAMPLES_FOR_PATTERN} completion-eligible saved days is shown as early evidence rather than a pattern.`);
    const inspect:ChartHit[]=[];
    const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const groups=days.map(label=>{
      const dayRows=rows.filter(r=>String(r.dayName||'').slice(0,3)===label&&Number.isFinite(r.completion));
      const planned=dayRows.reduce((sum,row)=>sum+num(row.planned),0);
      const completed=dayRows.reduce((sum,row)=>sum+num(row.completed),0);
      return {label,days:dayRows.length,planned,completed,average:pct(completed,planned)};
    });
    [50,100].forEach(mark=>{
      const y=height-pad-(mark/100)*(height-pad*2);
      svg.appendChild(svgEl('line',{class:'grid axis chart-opacity-grid',x1:pad,y1:y,x2:width-pad,y2:y}));
      const label=svgEl('text',{class:'label bright',x:6,y:y+4});
      label.textContent=`${mark}%`;
      svg.appendChild(label);
    });
    const gap=(width-pad*2)/groups.length;
    const barW=Math.min(48,gap*.55);
    groups.forEach((group,index)=>{
      const x=pad+index*gap+(gap-barW)/2;
      const value=finiteNumber(group.average)?group.average:0;
      const repeated=group.days>=MIN_WEEKDAY_SAMPLES_FOR_PATTERN;
      const h=(value/100)*(height-pad*2);
      const rect=svgEl('rect',{class:`bar actual${repeated?'':' chart-opacity-muted'}`,x,y:height-pad-h,width:barW,height:h});
      const title=svgEl('title');
      const detail=`${group.label}: ${group.days?`${Math.round(value)}% planned-minute weighted completion across ${group.days} completion-eligible saved day${group.days===1?'':'s'}, ${minutesLabel(group.planned)} planned${repeated?'':' · early sample'}`:'no completion-eligible saved days'}`;
      title.textContent=detail;
      rect.appendChild(title);
      svg.appendChild(rect);
      chartHitRect(svg,pad+index*gap,pad,Math.max(20,gap),height-pad*2,detail,inspect);
      if(group.days){const latest=inspect[inspect.length-1];if(latest)latest.initial=true;}
      const day=svgEl('text',{class:'axis-label',x:x+barW/2-10,y:height-7});
      day.textContent=group.label;
      svg.appendChild(day);
      if(group.days&&group.planned>0){
        const pctText=svgEl('text',{class:'label',x:x+barW/2-12,y:height-pad-h-7});
        pctText.textContent=repeated?`${Math.round(value)}%`:`n=${group.days}`;
        svg.appendChild(pctText);
      }
    });
    return inspectedChart(svg,inspect);
  }
  function heatLevel(value:number|null){
    if(!finiteNumber(value))return '';
    const displayed=Math.round(value);
    if(displayed>=80)return 'l4';
    if(displayed>=60)return 'l3';
    if(displayed>=40)return 'l2';
    return 'l1';
  }
  function heatmap(rows:readonly DailyRow[],range:CalendarRange={}){
    const wrap=el('div','insights-heatmap-widget');
    const grid=el('div','insights-heatmap');
    grid.setAttribute('role','group');
    grid.setAttribute('aria-label','Calendar work-completion heatmap');
    const byDate=new Map(rows.filter(row=>isIsoDate(row.date)).map(row=>[row.date,row]));
    const lastRecord=rows[rows.length-1];
    const lastSavedDay=lastRecord?dateDay(lastRecord.date):null;
    const rangeStart=isIsoDate(range.start)?dateDay(range.start):null;
    const rangeEnd=isIsoDate(range.end)?dateDay(range.end):null;
    const endDay=rangeEnd!==null?rangeEnd:lastSavedDay;
    const startDay=rangeStart!==null?rangeStart:(endDay!==null?Math.max(endDay-89,dateDay(rows[0]?.date)||endDay):null);
    if(startDay===null||endDay===null){
      grid.appendChild(evidenceNote('No calendar days to render yet.'));
      wrap.appendChild(grid);
      return wrap;
    }
    const first=Math.max(startDay,endDay-89);
    const cells:HeatCell[]=[];
    const inspector=el('div','insights-chart-inspector ui-mono','Focus or tap a calendar day to inspect it.');
    const select=(cell:HeatCell,detail:string|null)=>{
      cells.forEach(item=>{
        const active=item===cell;
        item.classList.toggle('selected',active);
        item.setAttribute('aria-pressed',active?'true':'false');
        item.tabIndex=active?0:-1;
      });
      inspector.textContent=detail;
    };
    for(let day=first;day<=endDay;day+=1){
      const iso=dateFromDay(day);
      const row=byDate.get(iso);
      const hasCompletion=!!row&&Number.isFinite(row.completion);
      const cell=el('div','insights-cell '+(!row?'missing':hasCompletion?heatLevel(row.completion):'no-work'));
      const detail=row
        ? hasCompletion
          ? `${shortDate(row.date)} ${row.dayName||''}: ${percentLabel(row.completion)} work completion`
          : `${shortDate(row.date)} ${row.dayName||''}: saved day with no planned work`
        : `${shortDate(iso)}: no saved record`;
      cell.title=detail;
      cell.tabIndex=-1;
      cell.setAttribute('role','button');
      cell.setAttribute('aria-label',detail);
      cell.setAttribute('aria-pressed','false');
      cell.addEventListener('click',()=>select(cell,detail));
      cell.addEventListener('focus',()=>select(cell,detail));
      cell.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();select(cell,detail);return;}
        const current=cells.indexOf(cell);
        const moves:Readonly<Record<string,number>>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
        const move=moves[event.key];
        let next=move===undefined?null:current+move;
        if(event.key==='Home')next=0;
        if(event.key==='End')next=cells.length-1;
        if(next===null)return;
        event.preventDefault();
        const target=cells[Math.max(0,Math.min(cells.length-1,next))];
        if(target){select(target,target.getAttribute('aria-label'));target.focus();}
      });
      cells.push(cell);
      grid.appendChild(cell);
    }
    const legend=el('div','insights-legend ui-mono');
    [['missing','No record'],['no-work','Saved · no work'],['l1','Low <40'],['l2','Partial 40–59'],['l3','Good 60–79'],['l4','Strong 80+']].forEach(([cls,label])=>{
      const item=el('span',null);
      item.append(el('i','insights-cell '+String(cls||'')),document.createTextNode(String(label||'')));
      legend.appendChild(item);
    });
    const lastSaved=[...cells].reverse().find(cell=>!cell.classList.contains('missing'))||cells[cells.length-1];
    if(lastSaved)select(lastSaved,lastSaved.getAttribute('aria-label'));
    wrap.append(grid,legend,inspector);
    return wrap;
  }
  function coverageRiskCode(label:string,index:number,usedCodes:Set<string>){
    const clean=String(label||'Subject').replace(/[^a-zA-Z0-9\s]/g,' ').trim();
    const words=clean.split(/\s+/).filter(Boolean);
    let code=words.length>=2?words.map(word=>word[0]).join('').slice(0,4).toUpperCase():String(words[0]||'S').toUpperCase().slice(0,4);
    if(!code)code=`S${index+1}`;
    if(usedCodes.has(code))code=`${code.slice(0,3)}${index+1}`;
    usedCodes.add(code);
    return code;
  }
  function coverageRecencyLabel(subject:Subject,compact=false){
    if(subject&&subject.neverStudied)return compact?'no activity evidence':'no saved study-activity evidence';
    const days=Math.max(0,num(subject&&subject.daysSinceLast));
    return compact?`last ${days}d`:`last studied ${days} day${days===1?'':'s'} ago`;
  }
  function buildCoverageRiskPoints(subjects:readonly Subject[],geometry:CoverageGeometry):CoveragePoint[]{
    const {plotBottom,plotLeft,plotW,plotH}=geometry;
    const rows=subjects
      .filter(subject=>subject.coverageWatchEligible)
      .slice()
      .sort((a,b)=>num(b.coverageWatchScore)-num(a.coverageWatchScore)||num(b.blocks)-num(a.blocks))
      .slice(0,12);
    if(!rows.length)return [];
    const completions=rows.map(subject=>Number.isFinite(num(subject.coverageCompletion,null))?num(subject.coverageCompletion):0);
    const minComp=Math.max(0,Math.min(...completions)-8);
    const maxComp=Math.min(100,Math.max(...completions)+8);
    const compSpan=Math.max(12,maxComp-minComp);
    const maxDays=Math.max(7,...rows.filter(subject=>!subject.neverStudied).map(subject=>num(subject.daysSinceLast)));
    const radiusScale=geometry.pointCount>=10?(geometry.compact?.62:.72):geometry.pointCount>=7?.84:1;
    const usedCodes=new Set<string>();
    const xFor=(subject:Subject)=>{
      if(subject.neverStudied)return plotLeft+.98*plotW;
      const days=Math.max(0,num(subject.daysSinceLast));
      const scaled=maxDays>0?Math.log1p(days)/Math.log1p(maxDays):0;
      return plotLeft+Math.max(.02,Math.min(.98,scaled))*plotW;
    };
    const yFor=(subject:Subject)=>{
      const completion=Number.isFinite(num(subject.coverageCompletion,null))?num(subject.coverageCompletion):0;
      const scaled=(completion-minComp)/compSpan;
      return plotBottom-Math.max(.02,Math.min(.98,scaled))*plotH;
    };
    return rows.map((subject,index)=>{
      const evidenceConfidence=Math.max(0,Math.min(1,num(subject.evidenceStrength)));
      return {
        ...subject,
        evidenceConfidence:Math.round(evidenceConfidence*100),
        index,
        code:coverageRiskCode(subject.label,index,usedCodes),
        cx:xFor(subject),
        cy:yFor(subject),
        r:(7+Math.sqrt(evidenceConfidence)*10)*radiusScale,
        tone:num(subject.coverageWatchScore)>=70?'risk-high':num(subject.coverageWatchScore)>=35?'risk-mid':'risk-low'
      };
    });
  }
  function layoutCoverageRiskPoints(points:CoveragePoint[],geometry:CoverageGeometry):CoveragePoint[]{
    const {plotTop,plotBottom,plotLeft,plotRight}=geometry;
    const gap=geometry.pointCount>=7?4:5;
    for(let pass=0;pass<180;pass+=1){
      for(let i=0;i<points.length;i+=1){
        for(let j=i+1;j<points.length;j+=1){
          const a=points[i],b=points[j];
          if(!a||!b)continue;
          let dx=b.cx-a.cx,dy=b.cy-a.cy;
          let dist=Math.sqrt(dx*dx+dy*dy);
          const minDist=a.r+b.r+gap;
          if(dist>0&&dist<minDist){
            const push=(minDist-dist)/2;
            dx/=dist;dy/=dist;
            a.cx-=dx*push;b.cx+=dx*push;
            a.cy-=dy*push;b.cy+=dy*push;
          }else if(dist===0){
            const angle=((i+1)*37+(j+1)*61+pass*17)*Math.PI/180;
            const push=Math.max(2,minDist*.12);
            const ox=Math.cos(angle)*push,oy=Math.sin(angle)*push;
            a.cx-=ox;b.cx+=ox;a.cy-=oy;b.cy+=oy;
          }
        }
      }
      points.forEach(point=>{
        point.cx=Math.max(plotLeft+point.r,Math.min(plotRight-point.r,point.cx));
        point.cy=Math.max(plotTop+point.r,Math.min(plotBottom-point.r,point.cy));
      });
    }
    return points;
  }
  function renderCoverageRiskFrame(svg:SVGSVGElement,geometry:CoverageGeometry){
    const {plotTop,plotBottom,plotLeft,plotRight,plotW,plotH}=geometry;
    svg.appendChild(svgEl('line',{class:'axis',x1:plotLeft,y1:plotBottom,x2:plotRight,y2:plotBottom}));
    svg.appendChild(svgEl('line',{class:'axis',x1:plotLeft,y1:plotTop,x2:plotLeft,y2:plotBottom}));
    [0,.5,1].forEach(mark=>{
      const x=plotLeft+mark*plotW;
      const y=plotBottom-mark*plotH;
      if(mark>0)svg.appendChild(svgEl('line',{class:`${mark===.5?'axis chart-opacity-mid':'grid chart-opacity-soft'}`,x1:x,y1:plotTop,x2:x,y2:plotBottom}));
      if(mark>0)svg.appendChild(svgEl('line',{class:`${mark===.5?'axis chart-opacity-mid':'grid chart-opacity-soft'}`,x1:plotLeft,y1:y,x2:plotRight,y2:y}));
      const xTick=svgEl('text',{class:'label',x,y:plotBottom+17,'text-anchor':'middle'});
      xTick.textContent=mark===0?'recent':mark===.5?'mixed':'stale';
      const yTick=svgEl('text',{class:'label',x:plotLeft-8,y:y+4,'text-anchor':'end'});
      yTick.textContent=mark===0?'lower':mark===.5?'mid':'higher';
      svg.append(xTick,yTick);
    });
    const quadrantLabels:readonly (readonly [string,number,number])[]=[['Maintain',plotLeft+14,plotTop+18],['Practice now',plotLeft+14,plotBottom-12],['Revisit soon',plotRight-122,plotTop+18],['Review first',plotRight-112,plotBottom-12]];
    quadrantLabels.forEach(([text,x,y])=>{
      const label=svgEl('text',{class:'quadrant',x,y});label.textContent=text;svg.appendChild(label);
    });
    const yLabel=svgEl('text',{class:'label strong',x:plotLeft,y:24});yLabel.textContent='Work completion ↑';
    const xLabel=svgEl('text',{class:'label strong',x:plotRight-116,y:plotBottom+34});xLabel.textContent='Last studied →';
    svg.append(yLabel,xLabel);
  }
  function renderCoverageRiskNodes(svg:SVGSVGElement,points:CoveragePoint[],geometry:CoverageGeometry):CoverageNodeView{
    const {plotLeft,plotRight,plotW,plotBottom,compact}=geometry;
    const riskLabel=(subject:Subject)=>num(subject.coverageWatchScore)>=70?'Review first':num(subject.coverageWatchScore)>=35?'Watch':'Low';
    const inspectX=plotLeft,inspectY=plotBottom+(compact?46:34),inspectW=compact?plotRight-plotLeft:Math.min(500,plotW*.58),inspectH=compact?70:62;
    const inspectLine=svgEl('line',{class:'risk-line',x1:plotLeft,y1:plotBottom,x2:inspectX+inspectW-18,y2:inspectY+14});
    const inspect=svgEl('g',{class:'risk-inspect'});
    const inspectBox=svgEl('rect',{class:'inspect-box',x:inspectX,y:inspectY,width:inspectW,height:inspectH,rx:3});
    const title=svgEl('text',{class:'inspect-title',x:inspectX+13,y:inspectY+(compact?20:18)});
    const line1=svgEl('text',{class:'inspect-body',x:inspectX+13,y:inspectY+(compact?39:35)});
    const line2=svgEl('text',{class:'inspect-body',x:inspectX+13,y:inspectY+(compact?56:51)});
    inspect.append(inspectBox,title,line1,line2);svg.appendChild(inspectLine);
    const legendX=compact?inspectX:plotRight-216,legendY=compact?inspectY+inspectH+28:plotBottom+60;
    const riskLegend:readonly (readonly [string,string])[]=[['risk-low','low'],['risk-mid','watch'],['risk-high','high']];
    riskLegend.forEach(([cls,label],index)=>{
      const x=legendX+index*70;svg.appendChild(svgEl('circle',{class:'point chart-point-current '+cls,cx:x,cy:legendY-5,r:5}));
      const text=svgEl('text',{class:'label',x:x+9,y:legendY});text.textContent=label;svg.appendChild(text);
    });
    const legendNote=svgEl('text',{class:'label',x:legendX,y:legendY-22});legendNote.textContent='Watch color';svg.appendChild(legendNote);
    const nodeLayer=svgEl('g',{class:'risk-node-layer'});
    const groups:CoverageInteractivePoint[]=[];
    points.slice().sort((a,b)=>num(a.coverageWatchScore)-num(b.coverageWatchScore)).forEach(point=>{
      // The name starts with the node's visible text (its code and, for the top
      // three, its short name), as WCAG 2.5.3 asks.
      const fullName=String(point.label||'Area'),shownName=!compact&&point.index<3?fullName.slice(0,18):'';
      const nodeName=shownName===fullName?`${point.code} ${fullName}`:`${point.code}${shownName?` ${shownName}`:''}, ${fullName}`;
      const group=svgEl('g',{class:'risk-node',tabindex:'0',role:'button','aria-label':`${nodeName}: ${riskLabel(point)}, watch score ${point.coverageWatchScore}, ${coverageRecencyLabel(point)}`});
      // Hover and focus fill the chart's detail panel, so the node needs no SVG
      // tooltip (its text would also count as visible label text).
      group.append(svgEl('circle',{class:'risk-hit',cx:point.cx,cy:point.cy,r:Math.max(compact?22:15,point.r+(compact?10:8))}),svgEl('circle',{class:'point '+point.tone,cx:point.cx,cy:point.cy,r:point.r}));
      const code=svgEl('text',{class:'risk-code',x:point.cx,y:point.cy+0.5});code.textContent=point.code;group.appendChild(code);
      if(shownName){
        const alignRight=point.cx>plotLeft+plotW*.58;
        const label=svgEl('text',{class:'risk-name',x:alignRight?point.cx-point.r-7:point.cx+point.r+7,y:point.cy+(point.index%2?12:-8),'text-anchor':alignRight?'end':'start'});
        label.textContent=shownName;group.append(' ',label);
      }
      groups.push({...point,group,node:group,text:`${point.label} · ${riskLabel(point)}`});nodeLayer.appendChild(group);
    });
    svg.appendChild(nodeLayer);svg.appendChild(inspect);
    return {svg,groups,inspectLine,title,line1,line2,inspectX,inspectY,inspectW,riskLabel,compact};
  }
  function bindCoverageRiskInteraction(points:CoveragePoint[],nodeView:CoverageNodeView,keyRows:(HTMLDivElement|undefined)[]){
    const {svg,groups,inspectLine,title,line1,line2,inspectX,inspectY,inspectW,riskLabel,compact}=nodeView;
    function nearbyFor(point:CoveragePoint){
      return points.filter(other=>other!==point).map(other=>({other,dist:Math.hypot(other.cx-point.cx,other.cy-point.cy)}))
        .filter(row=>row.dist<point.r+row.other.r+18).sort((a,b)=>num(b.other.coverageWatchScore)-num(a.other.coverageWatchScore)).slice(0,3).map(row=>row.other.code);
    }
    function select(point:CoveragePoint){
      groups.forEach(row=>{
        const active=row.index===point.index;
        row.group.classList.toggle('selected',active);
        row.group.setAttribute('aria-pressed',active?'true':'false');
      });
      keyRows.forEach(row=>{
        if(!row)return;
        const active=String(point.index)===row.dataset['riskIndex'];
        row.classList.toggle('selected',active);
        row.setAttribute('aria-pressed',active?'true':'false');
      });
      inspectLine.setAttribute('x1',String(point.cx));inspectLine.setAttribute('y1',String(point.cy));inspectLine.setAttribute('x2',String(inspectX+inspectW-18));inspectLine.setAttribute('y2',String(inspectY+14));
      const nearby=nearbyFor(point);
      title.textContent=`${point.label} · ${riskLabel(point)}`;
      line1.textContent=compact?`watch ${point.coverageWatchScore} · ${coverageRecencyLabel(point,true)} · ${point.windowAbsent?'Absent in this window':`work ${percentLabel(point.coverageCompletion)}`}`:`watch score ${point.coverageWatchScore} · ${coverageRecencyLabel(point)} · ${point.windowAbsent?'Absent in this window':`work completion ${percentLabel(point.coverageCompletion)}`}`;
      line2.textContent=compact?`${point.allocation||'saved allocation'} · evidence confidence ${point.evidenceConfidence}%`:`${point.allocation||'saved allocation'} · evidence confidence ${point.evidenceConfidence}%${nearby.length?' · nearby '+nearby.join(', '):''}`;
    }
    groups.forEach(point=>{
      const group=point.group;
      group.addEventListener('mouseenter',()=>select(point));
      group.addEventListener('focus',()=>select(point));
      group.addEventListener('click',event=>{event.preventDefault();select(point);});
      group.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();select(point);
      });
    });
    svg.classList.add('insights-chart-touch-surface');
    svg.dataset['touchInspect']='nearest';
    svg.addEventListener('click',event=>{
      if(!coarsePointerActive())return;
      if(event.target instanceof Element&&event.target.closest('.risk-node'))return;
      const nearest=nearestInteractiveItem(groups,event.clientX,event.clientY);
      if(nearest)select(nearest);
    });
    points.forEach(point=>{
      const row=keyRows[point.index];
      if(!row)return;
      row.addEventListener('click',event=>{event.preventDefault();select(point);});
      row.addEventListener('focus',()=>select(point));
      row.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();select(point);
      });
    });
    const initial=points.slice().sort((a,b)=>num(b.coverageWatchScore)-num(a.coverageWatchScore))[0];
    if(initial)select(initial);
  }
  function coverageRiskMap(subjects:readonly Subject[]){
    const wrap=el('div','insights-risk-widget');
    const compact=isCompact();
    const pointCount=subjects.filter(subject=>subject.coverageWatchEligible).slice(0,12).length;
    const width=compact?360:860;
    const height=compact?(pointCount>=10?650:pointCount>=7?550:470):(pointCount>=10?390:pointCount>=7?350:300);
    const pad=compact?42:48,rightPad=compact?20:24,bottomPad=compact?190:104;
    const svg=svgEl('svg',{class:'insights-risk-scatter',viewBox:`0 0 ${width} ${height}`,role:'group'});
    svg.style.height=compact?'auto':`${height}px`;
    labelGraphic(svg,'Coverage Watch map','Top-level areas with saved allocation within the rolling previous 365 days, positioned by work completion and days since last study activity. Merely planning an area does not refresh recency. Bubble size indicates normalized evidence confidence and color represents Coverage Watch level.');
    const geometry:CoverageGeometry={plotTop:pad,plotBottom:height-bottomPad,plotLeft:pad,plotRight:width-rightPad,plotW:width-rightPad-pad,plotH:height-bottomPad-pad,compact,pointCount};
    const points=layoutCoverageRiskPoints(buildCoverageRiskPoints(subjects,geometry),geometry);
    if(!points.length){
      const text=svgEl('text',{class:'label',x:pad,y:height/2});text.textContent='Need top-level area records from the previous 365 days';svg.appendChild(text);wrap.appendChild(svg);return wrap;
    }
    renderCoverageRiskFrame(svg,geometry);
    const nodeView=renderCoverageRiskNodes(svg,points,geometry);
    const key=el('div','insights-risk-key ui-mono');
    key.append(
      el('div','insights-risk-key-title ui-label','Area key'),
      el('div','help','Relative axes · bubble size = evidence confidence · absent = lower edge · work = selected window (All capped at 365d). Recency needs study activity; merely planned work does not refresh it. Watch is descriptive; allocation and evidence use 365d.')
    );
    const keyRows:(HTMLDivElement|undefined)[]=[];
    points.forEach(point=>{
      const row=el('div','row');row.dataset['riskIndex']=String(point.index);
      const visible=`${String(point.label||'Area').slice(0,18)} · watch ${point.coverageWatchScore} · ${coverageRecencyLabel(point,true)} · ${point.windowAbsent?'Absent in this window':`work ${percentLabel(point.coverageCompletion)}`}`;
      const detail=`${point.label||'Area'} · watch ${point.coverageWatchScore} · ${point.allocation||'saved allocation'} · ${coverageRecencyLabel(point)} · ${point.windowAbsent?'Absent in this window':`work ${percentLabel(point.coverageCompletion)}`} · evidence confidence ${point.evidenceConfidence}%`;
      row.append(el('span','code',point.code),' ',document.createTextNode(visible));
      row.title=detail;
      row.tabIndex=0;
      row.setAttribute('role','button');
      // The name starts with the row's visible text, then adds the detail the
      // tooltip shows.
      const shortName=String(point.label||'Area').slice(0,18);
      row.setAttribute('aria-label',`${point.code} ${visible}${shortName===String(point.label||'Area')?'':` · ${point.label}`} · ${point.allocation||'saved allocation'} · ${coverageRecencyLabel(point)} · evidence confidence ${point.evidenceConfidence}%`);
      keyRows[point.index]=row;key.appendChild(row);
    });
    bindCoverageRiskInteraction(points,nodeView,keyRows);
    wrap.append(svg,key);
    return wrap;
  }
  function resourceMixBar(resources:readonly ResourceRow[],days=1){
    const wrap=el('div','insights-mixbar-wrap');
    const rows=resources.filter(row=>num(row.planned)>0);
    const total=rows.reduce((sum,row)=>sum+num(row.planned),0);
    if(!total){
      wrap.appendChild(evidenceNote('No support or fixed blocks detected yet.'));
      return wrap;
    }
    const bar=el('div','insights-mixbar');
    const displayShares=apportionedPercents(rows.map(row=>row.planned));
    rows.forEach((row,index)=>{
      const share=Math.max(0,num(row.planned)/total*100);
      const segment=el('div','insights-mixbar-seg '+row.key);
      segment.style.width=`${share}%`;
      segment.title=`${row.label}: ${displayShares[index]}% of the average planned day`;
      bar.appendChild(segment);
    });
    const legend=el('div','insights-mixbar-legend ui-mono');
    rows.forEach((row,index)=>{
      const share=displayShares[index];
      const item=el('span',null);
      const swatch=el('i',null);
      swatch.className='insights-mixbar-seg '+row.key;
      item.append(swatch,el('b','ui-label',row.label),document.createTextNode(`${share}% · ${minutesLabel(row.planned/Math.max(1,days))}/day`));
      legend.appendChild(item);
    });
    wrap.append(bar,legend);
    return wrap;
  }
  function resourceMixSummary(resources:readonly ResourceRow[],days=1){
    const planned=resources.reduce((sum,row)=>sum+num(row.planned),0);
    const wrap=el('div','insights-resource-totals ui-mono');
    const plannedItem=el('span',null,'Average planned day ');
    plannedItem.appendChild(el('b',null,minutesLabel(planned/Math.max(1,days))));
    const noteItem=el('span',null,'Fixed anchors are structure, not completion.');
    wrap.append(plannedItem,noteItem);
    return wrap;
  }
  function qualityCorrelationEvidence(model:Model){
    const qCorr=model.advanced?model.advanced.qualityCompletionCorrelation:null;
    const qN=num(model.advanced&&model.advanced.qualityPairCount);
    const value=qCorr===null?'No data':String(qCorr);
    const direction=qCorr===null?'none':qCorr>0?'positive':qCorr<0?'inverse':'none';
    const magnitude=qCorr===null?'none':Math.abs(qCorr)<.25?'weak':Math.abs(qCorr)<.5?'moderate':'strong';
    const label=qCorr===null?'No stable relationship':magnitude==='weak'?'Weak relationship':`${magnitude==='strong'?'Strong':'Moderate'} ${direction==='positive'?'positive':direction==='inverse'?'inverse':''} relationship`.replace(/\s+/g,' ').trim();
    const note=qCorr===null
      ? qN<3
        ? 'Rate at least three completion-eligible days in Review.'
        : `Correlation is unavailable because rated day quality or work completion did not vary enough across ${qN} paired days.`
      : qN<6
        ? `Early contextual signal only; n=${qN} rated day${qN===1?'':'s'} is too small for a firm read.`
        : magnitude==='weak'
          ? `Rated day quality and work completion are weakly linked in this window (n=${qN}).`
          : direction==='positive'
            ? `Higher-rated days tend to complete more planned work in this window (n=${qN}).`
            : `Higher completion is not tracking higher rated day quality in this window (n=${qN}).`;
    return {value,n:qN,note,label,stat:qCorr===null?'r unavailable':`r = ${qCorr}`,magnitude,direction};
  }
  function renderQualityRelationshipCard(model:Model){
    const relationship=qualityCorrelationEvidence(model);
    const box=el('section','insights-card ui-card insights-quality-link-card');
    box.appendChild(el('div','insights-label ui-label','Rated quality relationship · contextual'));
    const main=el('div','insights-quality-link-main');
    main.append(el('div','insights-main ui-label',relationship.label),el('div','insights-quality-link-stat ui-mono',relationship.stat));
    box.append(main,evidenceNote(relationship.note));
    return box;
  }
  function coachEvidenceRecency(model:Model){
    const latest=model.dynamics&&model.dynamics.history&&model.dynamics.history.end||model.dateRange&&model.dateRange.end;
    const current=model.currentStudyDate;
    const latestDay=dateDay(latest),currentDay=dateDay(current);
    if(!finiteNumber(latestDay)||!finiteNumber(currentDay))return {days:null,label:'No saved evidence',tone:'low',stale:true};
    const days=Math.max(0,currentDay-latestDay);
    return {days,label:days===0?'Today':days===1?'1 day ago':`${days} days ago`,tone:days<=2?'good':days<=7?'watch':'low',stale:days>7};
  }
  function coachEvidenceLine(model:Model,signal:CoachSignal|CoachSurfaceSignal){
    const recency=coachEvidenceRecency(model);
    const basis=['fitness','dynamics'].includes(signal&&signal.surfaceKey)?EVIDENCE_BASIS.history:model.windowLabel||EVIDENCE_BASIS.window;
    return [signal&&signal.confidenceLabel||'Descriptive read',basis,recency.stale?`latest ${recency.label}`:null].filter(Boolean).join(' · ');
  }
  function renderCoachSynthesis(model:Model){
    const surfaces=model.interpretation.signals.surfaces||[];
    return lazyDisclosure('insights-coach-synthesis ui-inset',`Additional synthesis · ${surfaces.length} surface${surfaces.length===1?'':'s'}`,()=>{
      const body=el('div','insights-coach-synthesis-body'),list=el('div','insights-coach-surface-grid');
      surfaces.forEach(signal=>{
        const item=el('section',`insights-coach-surface ui-canvas ${signal.tone||'quiet'}`),head=el('div','insights-coach-surface-head');
        head.append(el('div','insights-coach-surface-label ui-label',signal.surfaceLabel||'Surface'),el('div','insights-coach-surface-tag ui-label',signal.tag||'Observation'));
        const open=el('button','insights-coach-open ui-btn','Open →');
        open.type='button';
        open.setAttribute('aria-label',`Open ${signal.surfaceLabel||'surface'}`);
        open.addEventListener('click',()=>{void openAndScrollToInsightsTarget(signal.targetId);});
        item.append(head,el('div','insights-coach-surface-copy ui-mono',signal.text||''),el('div','insights-coach-surface-evidence ui-mono',coachEvidenceLine(model,signal)),open);
        list.appendChild(item);
      });
      body.appendChild(list);
      return body;
    });
  }
  function renderCoachEvidence(model:Model){
    const strip=el('div','insights-coach-evidence ui-inset');
    const sample=model.guardrails&&model.guardrails.sample||{label:'Low sample',tone:'low'};
    const timerCoverage=finiteOrNull(model.sampleAudit&&model.sampleAudit.timerPlannedCoverage);
    const explicitRate=finiteOrNull(model.progressEvidence&&model.progressEvidence.explicitRate);
    const recency=coachEvidenceRecency(model);
    const items=[
      ['Window evidence',sample.label||'Low sample',sample.tone||'low'],
      ['Saved days',`${num(model.recordCount)} window · ${num(model.allRecordCount)} all-history`,model.recordCount>=10?'good':model.recordCount>=5?'watch':'low'],
      ['Timer coverage',percentLabel(timerCoverage),timerCoverage!==null&&timerCoverage>=65?'good':timerCoverage===null?'low':'watch'],
      ['Explicit progress',percentLabel(explicitRate),explicitRate!==null&&explicitRate>=60?'good':explicitRate===null?'low':'watch'],
      ['Latest evidence',recency.label,recency.tone]
    ];
    items.forEach(([label,value,tone])=>{
      const item=el('div',`insights-coach-evidence-item ui-canvas ${tone||'quiet'}`);
      item.append(el('div','l ui-label',label),el('div','v ui-mono',value));
      strip.appendChild(item);
    });
    return strip;
  }
  function renderCoachDecision(model:Model,data:CoachSignal,index:number){
    const labels=['Primary focus','Secondary focus'];
    const primary=index===0;
    const item=el('section',`insights-coach-decision ui-canvas${primary?' primary':''} ${data.tone||'quiet'}`);
    const head=el('div','insights-coach-decision-head');
    const title=el('div','insights-coach-decision-kicker ui-label',labels[index]||'Focus');
    const tags=el('div','insights-coach-decision-tags');
    tags.append(el('span','insights-coach-decision-tag ui-chip ui-label',data.tag||'Insight'),el('span','insights-coach-decision-surface ui-chip ui-label',data.surfaceLabel||'Coach'));
    head.append(title,tags);
    const copy=el('div','insights-coach-decision-copy',data.text||'');
    const foot=el('div','insights-coach-decision-foot');
    foot.appendChild(el('div','insights-coach-decision-evidence ui-mono',coachEvidenceLine(model,data)));
    const open=el('button','insights-coach-open ui-btn','Open →');
    open.type='button';
    open.setAttribute('aria-label',`Open ${data.surfaceLabel||'source surface'}`);
    open.addEventListener('click',()=>{void openAndScrollToInsightsTarget(data.targetId);});
    foot.appendChild(open);
    item.append(head,copy,foot);
    return item;
  }
  function renderCoach(model:Model){
    const coach=el('section','insights-card insights-coach-card ui-card');
    coach.appendChild(sectionTitle('Study coach','Evidence first, then Primary and Secondary Focus. Practice Pacing retains high priority when its evidence is mature and actionable.'));
    coach.appendChild(renderCoachEvidence(model));
    const coachLines=el('div','insights-coach');
    const signals:CoachSignal[]=(model.interpretation.signals.coach||[]).slice(0,COACH_VISIBLE_SIGNAL_LIMIT);
    if(!signals.length)signals.push({text:'Save a few days in Review and this page will start reading the daily-record pattern clearly.',tag:'Low sample',tone:'low',kind:'context',domain:'performance',topic:'evidence',theme:'evidence-quality',surfaceLabel:'Performance',targetId:'insights-performance',confidenceLabel:'Low sample',confidenceTone:'low',surfaceKey:'performance'});
    signals.forEach((signal,index)=>coachLines.appendChild(renderCoachDecision(model,signal,index)));
    coach.appendChild(coachLines);
    coach.appendChild(renderCoachSynthesis(model));
    return coach;
  }
  function progressEvidenceSummary(progress:Model['progressEvidence']){
    if(!progress||!num(progress.total))return 'No progress evidence in this window.';
    const counts=[
      num(progress.explicitBlocks),
      num(progress.timeDerivedBlocks),
      num(progress.unverifiedBlocks)+num(progress.missingBlocks),
      num(progress.skippedBlocks)
    ];
    const shares=apportionedPercents(counts,0);
    const parts=[
      `${shares[0]}% explicit`,
      `${shares[1]}% time-derived`,
      `${shares[2]}% uncertain`
    ];
    if(num(counts[3])>0)parts.push(`${num(shares[3])}% skipped`);
    return `Evidence · ${parts.join(' · ')}`;
  }
  function renderMetrics(model:Model){
    const stability=model.advanced.outputStability&&model.advanced.outputStability.label||'No stability read';
    const variability=model.advanced.completionSd===null?'Need more saved days.':`${model.advanced.completionSd} point completion variability; not a performance score.`;
    const trend=model.advanced.completionSlopePerWeek===null?'No data':`${model.advanced.completionSlopePerWeek>0?'+':''}${model.advanced.completionSlopePerWeek} pts/wk`;
    const ratedDays=(model.daily||[]).filter(row=>Number.isFinite(row&&row.quality)).length;
    const metrics=el('section','insights-evidence-strip ui-card');
    metrics.append(
      evidenceItem('Work completion',model.overview.planned>0?percentLabel(model.overview.completion):'No data',progressEvidenceSummary(model.progressEvidence)),
      evidenceItem('Work trend',trend,`${model.trendBasis&&model.trendBasis.label||model.windowLabel||'Selected window'} · direction across ${model.advanced.trendCompletionDayCount} completion day${model.advanced.trendCompletionDayCount===1?'':'s'}.`),
      evidenceItem('Rated day quality',model.overview.averageQuality!==null?`${model.overview.averageQuality}/5`:'No data',ratedDays?`Average self-rating across ${ratedDays}/${model.recordCount} saved day${model.recordCount===1?'':'s'} · contextual, not an objective performance score.`:'No saved day ratings in this window.'),
      evidenceItem('Output stability',stability,variability)
    );
    metrics.appendChild(lazyDisclosure('insights-calculation-disclosure','How this was calculated',()=>{
      const body=el('div','insights-calculation-body ui-mono');
      body.textContent=`Work trend is the linear slope of daily work completion against calendar date across ${model.advanced.trendCompletionDayCount} eligible day${model.advanced.trendCompletionDayCount===1?'':'s'}, normalized to percentage points per week. It is descriptive, not a forecast.`;
      return body;
    }));
    return metrics;
  }
  function renderExecutionRhythm(model:Model){
    const rhythmGrid=el('div','insights-rhythm-grid');

    const delaySeries=model.startDelays||[];
    const delayRows=delaySeries.filter(row=>row.blocks>0);
    const comparableDelayRows=delayRows.filter(row=>row.blocks>=MIN_BLOCKS_FOR_SIGNAL);
    const totalDelayBlocks=delayRows.reduce((sum,row)=>sum+row.blocks,0);
    const weightedDelay=totalDelayBlocks?Math.round(delayRows.reduce((sum,row)=>sum+num(row.averageDelay)*row.blocks,0)/totalDelayBlocks):null;
    const bestDelay=comparableDelayRows.length?[...comparableDelayRows].sort((a,b)=>num(b.completion,-1)-num(a.completion,-1)||b.blocks-a.blocks)[0]:null;
    const weakestDelay=comparableDelayRows.length?[...comparableDelayRows].sort((a,b)=>num(a.completion,101)-num(b.completion,101)||b.blocks-a.blocks)[0]:null;
    const delaySpread=bestDelay&&weakestDelay?Math.round(Math.max(0,num(bestDelay.completion)-num(weakestDelay.completion))):0;

    const rhythmCard=el('section','insights-card soft ui-card');
    rhythmCard.appendChild(sectionTitle('Start-time rhythm','Does lateness hurt execution? Work completion by delay from planned start.'));
    const rhythmSummary=el('div','insights-rhythm-summary');
    if(delayRows.length){
      rhythmSummary.append(
        summaryChip('Sample',`${totalDelayBlocks} work block${totalDelayBlocks===1?'':'s'}`),
        summaryChip('Avg delay',delayLabel(weightedDelay)),
        bestDelay&&weakestDelay&&comparableDelayRows.length>=2&&delaySpread>=MIN_MEANINGFUL_DIFFERENCE_POINTS
          ? summaryChip('Clearest bucket',`${bestDelay.label} · ${percentLabel(bestDelay.completion)}`)
          : summaryChip('Pattern',comparableDelayRows.length>=2?`Similar · ${Math.round(delaySpread)} pt range`:`Need 2 buckets with n≥${MIN_BLOCKS_FOR_SIGNAL}`)
      );
    }else{
      rhythmSummary.appendChild(summaryChip('Start-delay read','Need actual starts from Timer'));
    }
    const delayBars=barRowsFromSeries(delaySeries,{showEmpty:true,detailFor:row=>row.blocks>0?`${percentLabel(row.completion)} · n=${row.blocks}`:'No sampled starts'});
    const delayNote=el('div','insights-rhythm-note ui-mono',`On time / early includes starts up to 5 minutes after the planned start. Comparisons require at least ${MIN_BLOCKS_FOR_SIGNAL} blocks in each bucket; smaller samples remain visible but are not ranked.`);
    rhythmCard.append(rhythmSummary,delayBars,delayNote);

    const orderSeries=model.blockOrder||[];
    const orderRows=orderSeries.filter(row=>row.blocks>0);
    const comparableOrderRows=orderRows.filter(row=>row.blocks>=MIN_BLOCKS_FOR_SIGNAL);
    const strongestOrder=comparableOrderRows.length?[...comparableOrderRows].sort((a,b)=>num(b.completion,-1)-num(a.completion,-1)||b.blocks-a.blocks)[0]:null;
    const weakestOrder=comparableOrderRows.length?[...comparableOrderRows].sort((a,b)=>num(a.completion,101)-num(b.completion,101)||b.blocks-a.blocks)[0]:null;
    const orderSpread=strongestOrder&&weakestOrder?Math.round(Math.max(0,num(strongestOrder.completion)-num(weakestOrder.completion))):0;

    const positionCard=el('section','insights-card soft ui-card');
    positionCard.appendChild(sectionTitle('Planned block position','Work completion by the block’s planned ordinal.'));
    const orderSummary=el('div','insights-rhythm-summary');
    if(orderRows.length){
      if(strongestOrder&&weakestOrder&&comparableOrderRows.length>=2&&orderSpread>=MIN_MEANINGFUL_DIFFERENCE_POINTS){
        orderSummary.append(
          summaryChip('Strongest',`${strongestOrder.label} · ${percentLabel(strongestOrder.completion)}`),
          summaryChip('Weakest',`${weakestOrder.label} · ${percentLabel(weakestOrder.completion)}`)
        );
      }else{
        orderSummary.append(summaryChip('Pattern',comparableOrderRows.length>=2?`Similar · ${Math.round(orderSpread)} pt range`:`Need 2 positions with n≥${MIN_BLOCKS_FOR_SIGNAL}`));
      }
      orderSummary.appendChild(summaryChip('Depth',`${orderRows.length} position bucket${orderRows.length===1?'':'s'}`));
    }else{
      orderSummary.appendChild(summaryChip('Position read','Need saved work blocks'));
    }
    const orderBars=barRowsFromSeries(orderSeries,{showEmpty:false,detailFor:row=>{
      const missed=num(row.outcomeCounts&&row.outcomeCounts.skipped)+num(row.outcomeCounts&&row.outcomeCounts.untouched);
      return `${percentLabel(row.completion)} · ${missed?`${missed} missed · `:''}n=${row.blocks}`;
    }});
    const orderNote=el('div','insights-rhythm-note ui-mono',`1st, 2nd, 3rd and so on refer to planned numbered work blocks, not actual execution order. Comparisons require n≥${MIN_BLOCKS_FOR_SIGNAL} per position; differences under ${MIN_MEANINGFUL_DIFFERENCE_POINTS} points are shown as similar.`);
    positionCard.append(orderSummary,orderBars,orderNote);

    rhythmGrid.append(rhythmCard,positionCard);
    return rhythmGrid;
  }
  function renderExecutionQuality(model:Model){
    const section=el('section','insights-execution');
    const grid=el('div','insights-grid insights-diagnostics');
    const friction=model.interruption;
    const clean=friction.cleanBlockRate===null?'No data':`${percentLabel(friction.cleanBlockRate)} without recorded friction`;
    const frictionMain=!friction.hasWorkBlocks?'No data':!friction.hasTimerEvidence?'Need Timer evidence':friction.pauseCount>0
      ? `${friction.averagePausesPerInterruptedBlock||1} unplanned pause${friction.averagePausesPerInterruptedBlock===1?'':'s'} / affected block`
      : 'No unplanned friction recorded';
    const frictionNote=!friction.hasWorkBlocks?'Save work blocks to begin this read.':!friction.hasTimerEvidence?'Existing work blocks have no Timer evidence, so interruption status is unknown.':friction.pauseCount>0
      ? `${clean} · avg friction event ${friction.averagePauseMinutes===null?'unclear':friction.averagePauseMinutes+'m'}. Worst: ${friction.worstAffected||'not clear yet'}. Accepted Pomodoro recovery excluded. ${friction.blockCount}/${friction.workBlockCount} work blocks are Timer-backed.`
      : `No unplanned friction was recorded across ${friction.blockCount}/${friction.workBlockCount} Timer-backed work blocks. Accepted Pomodoro recovery excluded.`;
    const movementNote=model.schedule.shiftedDays
      ? `Average largest movement on shifted days: ${minutesLabel(model.schedule.averageDailyPeakShiftOnShiftedDays)}. Worst saved day: ${minutesLabel(model.schedule.maxDailyShiftMinutes)}. Movement may reflect drift or deliberate replanning.`
      : 'No meaningful saved schedule movement yet. Movement may reflect drift or deliberate replanning.';
    grid.append(
      card('Schedule movement',model.schedule.shiftedDays?`${model.schedule.shiftedDays}/${model.recordCount} shifted days`:'No saved movement',movementNote),
      renderQualityRelationshipCard(model),
      card('Focus friction',frictionMain,frictionNote)
    );
    section.append(grid,renderExecutionRhythm(model));
    return section;
  }
  function renderVisuals(model:Model){
    const grid=el('section','insights-visuals');
    const left=el('div','insights-visual-left');
    const trendCard=el('section','insights-card soft ui-card insights-trend-card');
    const trendBasis=model.trendBasis&&model.trendBasis.label||model.windowLabel||'Selected window';
    trendCard.appendChild(sectionTitle('Window work trend',`Daily work completion plus a rolling mean over the latest seven completion-eligible saved days. No-work records are omitted from that mean. The chart shows the latest 90 saved days on desktop or 14 on compact screens; its analytical basis is ${trendBasis.toLowerCase()}.`));
    const trendRows=model.daily.map((d,i)=>({...d,rolling7:model.advanced.rolling7[i]?.value}));
    trendCard.appendChild(Layout.chart(()=>lineChart(trendRows,{key:'completion',softKey:'rolling7',label:'Work completion %'})));
    const weeklyCard=el('section','insights-card soft ui-card insights-weekly-card');
    weeklyCard.appendChild(sectionTitle('Weekly work rhythm',`Planned-minute weighted completion by weekday; a weekday with fewer than ${MIN_WEEKDAY_SAMPLES_FOR_PATTERN} completion-eligible saved days remains muted as early evidence.`));
    weeklyCard.appendChild(Layout.chart(()=>weeklyRhythmChart(model.daily)));
    left.append(trendCard,weeklyCard);
    const stack=el('div','insights-visual-stack');
    const planCard=el('section','insights-card soft ui-card');
    planCard.appendChild(sectionTitle('Plan time match',`Grey planned; blue Timer-tracked focus. Chart shows the latest 24 saved days on desktop or 14 on compact screens; its day-by-day analytical basis is ${trendBasis.toLowerCase()}.`));
    planCard.appendChild(Layout.chart(()=>plannedActualChart(model.daily)));
    const heatCard=el('section','insights-card soft ui-card');
    heatCard.appendChild(sectionTitle('Calendar heatmap · up to 90 days','Color = daily work completion; blank cells are missing saved days.'));
    heatCard.appendChild(heatmap(model.daily,model.calendarRange));
    stack.append(planCard,heatCard);
    grid.append(left,stack);
    return grid;
  }
  function practiceTrendChart(practice:Practice){
    const compact=isCompact();
    const allRows=practice.daily;
    const limit=compact?20:60;
    const rows=allRows.slice(-limit);
    const width=compact?360:700,height=compact?225:215,pad=40,rightPad=compact?18:22;
    const {svg,plotRight,plotBottom,plotWidth,plotHeight}=chartFrame(width,height,pad,rightPad);
    svg.classList.add('insights-practice-chart');
    labelGraphic(svg,'Practice pace over time',`Daily median run time as a percentage of the combined targets recorded in each run. One hundred percent equals the total target; the controlled band is ${PRACTICE_CONTROLLED_MIN}–${PRACTICE_CONTROLLED_MAX}%; the translucent ribbon is the middle 50% across runs when a day contains ${MIN_PRACTICE_ESTABLISHED_RUNS}+ runs; point size represents runs.`);
    if(!rows.length)return chartEmpty(svg,'No completed practice runs in this window',pad,height/2);
    const upperValues=rows.map(row=>Math.max(num(row.medianPace),row.spreadReady?num(row.paceQ3):0)).filter(finiteNumber).sort((a,b)=>a-b);
    const maxObserved=Math.max(110,...upperValues);
    const runnerUp=upperValues.length>1?(upperValues[upperValues.length-2]??maxObserved):maxObserved;
    const isolatedExtreme=upperValues.length>=4&&maxObserved>Math.max(200,runnerUp*1.75);
    const scalePeak=isolatedExtreme?runnerUp*1.15:maxObserved;
    const yMin=0,yMax=Math.max(150,Math.ceil(scalePeak/25)*25);
    const hasCappedValues=rows.some(row=>num(row.medianPace)>yMax||(row.spreadReady&&num(row.paceQ3)>yMax));
    const yFor=(value:number|null|undefined)=>pad+(1-(Math.max(yMin,Math.min(yMax,num(value)))-yMin)/(yMax-yMin))*plotHeight;
    const firstPracticeRow=rows[0],lastPracticeRow=rows[rows.length-1];
    const firstDay=firstPracticeRow?dateDay(firstPracticeRow.date):null,lastDay=lastPracticeRow?dateDay(lastPracticeRow.date):null,daySpan=Math.max(1,num(lastDay)-num(firstDay));
    const xFor=(row:PracticeDailyRow,index:number)=>rows.length===1?pad+plotWidth/2:pad+((num(dateDay(row.date),index)-num(firstDay))/(daySpan||1))*plotWidth;
    const bandTop=yFor(PRACTICE_CONTROLLED_MAX),bandBottom=yFor(PRACTICE_CONTROLLED_MIN);
    const band=svgEl('rect',{class:'pace-band',x:pad,y:bandTop,width:plotWidth,height:Math.max(1,bandBottom-bandTop)});
    svg.insertBefore(band,svg.querySelector('line'));
    const spreadSegments:Array<Array<{row:PracticeDailyRow;index:number}>>=[];
    let spreadSegment:Array<{row:PracticeDailyRow;index:number}>=[];
    rows.forEach((row,index)=>{
      if(row.spreadReady&&Number.isFinite(row.paceQ1)&&Number.isFinite(row.paceQ3))spreadSegment.push({row,index});
      else if(spreadSegment.length){spreadSegments.push(spreadSegment);spreadSegment=[];}
    });
    if(spreadSegment.length)spreadSegments.push(spreadSegment);
    spreadSegments.forEach(segment=>{
      if(segment.length>1){
        const upper=segment.map(({row,index})=>`${xFor(row,index)},${yFor(row.paceQ3)}`);
        const lower=segment.slice().reverse().map(({row,index})=>`${xFor(row,index)},${yFor(row.paceQ1)}`);
        svg.appendChild(svgEl('polygon',{class:'pace-spread-ribbon',points:[...upper,...lower].join(' ')}));
      }
      segment.forEach(({row,index})=>svg.appendChild(svgEl('line',{class:'pace-spread-whisker',x1:xFor(row,index),y1:yFor(row.paceQ3),x2:xFor(row,index),y2:yFor(row.paceQ1)})));
    });
    const marks=[0,50,80,100,150,...(yMax>150?[yMax]:[])].filter((value,index,array)=>value>=yMin&&value<=yMax&&array.indexOf(value)===index);
    marks.forEach(mark=>{
      const y=yFor(mark);
      const line=svgEl('line',{class:`${mark===100?'pace-target':'axis chart-opacity-reference'}`,x1:pad,y1:y,x2:plotRight,y2:y});
      svg.appendChild(line);
      const label=svgEl('text',{class:'label'+(mark===100?' bright':''),x:pad-7,y:y+4,'text-anchor':'end'});label.textContent=`${mark}%`;svg.appendChild(label);
    });
    const points=rows.map((row,index)=>`${xFor(row,index)},${yFor(row.medianPace)}`).join(' ');
    if(rows.length>1)svg.appendChild(svgEl('polyline',{class:'pace-line',points}));
    const maxRuns=Math.max(1,...rows.map(row=>num(row.runs)));
    const inspect:ChartHit[]=[];
    rows.forEach((row,index)=>{
      const x=xFor(row,index),medianCapped=num(row.medianPace)>yMax,spreadCapped=row.spreadReady&&num(row.paceQ3)>yMax,capped=medianCapped||spreadCapped,y=medianCapped?pad+10:yFor(row.medianPace),radius=4+Math.sqrt(num(row.runs)/maxRuns)*4;
      svg.appendChild(svgEl('circle',{class:'pace-point'+(capped?' capped':''),cx:x,cy:y,r:radius}));
      if(capped)svg.appendChild(svgEl('path',{class:'pace-cap-marker',d:`M ${x} ${pad+1} L ${x-5} ${pad+8} L ${x+5} ${pad+8} Z`}));
      const spread=row.spreadReady?` · middle 50% ${percentLabel(row.paceQ1,1)}–${percentLabel(row.paceQ3,1)} · ${row.paceSpread} pt spread`:` · spread needs ${MIN_PRACTICE_ESTABLISHED_RUNS}+ runs`;
      chartHitCircle(svg,x,y,`${shortDate(row.date)} · median run time ${percentLabel(row.medianPace,1)} of target${spread} · ${row.runs} run${row.runs===1?'':'s'} · ${row.units} unit${row.units===1?'':'s'} · ${percentLabel(row.controlledRate,1)} of runs in the 80–100% band`,inspect,Math.max(14,radius+7));
    });
    const firstLabel=svgEl('text',{class:'label',x:pad,y:plotBottom+22});firstLabel.textContent=firstPracticeRow?shortDate(firstPracticeRow.date):'';
    const lastLabel=svgEl('text',{class:'label',x:plotRight,y:plotBottom+22,'text-anchor':'end'});lastLabel.textContent=lastPracticeRow?shortDate(lastPracticeRow.date):'';
    svg.append(firstLabel,lastLabel);
    const trend=practice&&practice.trend||{};
    const basis=practice&&practice.trendBasis&&practice.trendBasis.label||'Selected window';
    const stability=practice&&practice.trendReady&&finiteNumber(trend.slopePerWeek)?(trend.stable?` Direction ${trend.slopePerWeek>0?'+':''}${trend.slopePerWeek} pts/week; consistent across ${trend.blockCount} history checks · ${basis}.`:` No consistent directional claim across the saved history · ${basis}.`):` Trend interpretation needs more practice-day evidence · ${basis}.`;
    const widget=inspectedChart(svg,inspect,`Daily medians give each completed run equal weight; the ribbon shows variation across runs${allRows.length>rows.length?`; chart shows the latest ${rows.length} of ${allRows.length} practice days`:''}.${stability}`);
    if(hasCappedValues)appendChartNote(widget,`Isolated pace above the ${yMax}% visual ceiling is pinned to the top marker for readability; its actual value remains in the point inspector.`);
    return widget;
  }
  function practicePositionChart(practice:Practice){
    const rows=(practice&&practice.position&&practice.position.profile||[]).filter(row=>Number.isFinite(row&&row.medianPace));
    const width=620,height=240,pad=42,rightPad=18;
    const {svg,plotRight,plotBottom,plotWidth,plotHeight}=chartFrame(width,height,pad,rightPad);
    svg.classList.add('insights-practice-position-chart');
    labelGraphic(svg,'Pace by relative run position','Median normalized pace across five relative positions. The shaded band marks 80–100% of target.');
    if(!rows.length)return chartEmpty(svg,`Need ${MIN_PRACTICE_POSITION_RUNS} repeated runs with ${MIN_PRACTICE_POSITION_UNITS}+ completed units`,pad,height/2);
    const values=rows.map(row=>num(row.medianPace)).filter(finiteNumber),minObserved=Math.min(...values),maxObserved=Math.max(...values);
    const yMin=Math.max(0,Math.min(60,Math.floor((minObserved-15)/10)*10));
    const rawMax=Math.max(140,Math.ceil(maxObserved/25)*25),yMax=Math.min(250,rawMax);
    const capped=maxObserved>yMax;
    const yFor=(value:number|null|undefined)=>pad+(1-(Math.max(yMin,Math.min(yMax,num(value)))-yMin)/(yMax-yMin))*plotHeight;
    const xFor=(index:number)=>rows.length===1?pad+plotWidth/2:pad+(index/(rows.length-1))*plotWidth;
    const bandTop=yFor(PRACTICE_CONTROLLED_MAX),bandBottom=yFor(PRACTICE_CONTROLLED_MIN);
    const firstChild=svg.firstChild;
    svg.insertBefore(svgEl('rect',{class:'position-band',x:pad,y:bandTop,width:plotWidth,height:Math.max(1,bandBottom-bandTop)}),firstChild?.nextSibling??null);
    const marks=[yMin,80,100,yMax].filter((value,index,array)=>value>=yMin&&value<=yMax&&array.indexOf(value)===index);
    marks.forEach(mark=>{
      const y=yFor(mark);svg.appendChild(svgEl('line',{class:`${mark===100?'pace-target':'axis chart-opacity-reference'}`,x1:pad,y1:y,x2:plotRight,y2:y}));
      const label=svgEl('text',{class:'label'+(mark===100?' bright':''),x:pad-7,y:y+4,'text-anchor':'end'});label.textContent=`${mark}%`;svg.appendChild(label);
    });
    rows.forEach((row,index)=>{if(index>0&&index<rows.length-1){const x=xFor(index);svg.appendChild(svgEl('line',{class:'position-guide',x1:x,y1:pad,x2:x,y2:plotBottom}));}});
    const points=rows.map((row,index)=>`${xFor(index)},${yFor(row.medianPace)}`).join(' ');
    if(rows.length>1)svg.appendChild(svgEl('polyline',{class:'position-line',points}));
    const onsetKey=practice&&practice.position&&practice.position.onset&&practice.position.onset.key;
    const inspect:ChartHit[]=[];
    const shortLabels=['Opening','Early-middle','Middle','Late-middle','Final'];
    rows.forEach((row,index)=>{
      const x=xFor(index),valueCapped=num(row.medianPace)>yMax,y=valueCapped?pad+8:yFor(row.medianPace),isOnset=row.key===onsetKey;
      svg.appendChild(svgEl('circle',{class:`position-point chart-point-${isOnset?'onset':'current'}${isOnset?' onset':''}`,cx:x,cy:y,r:isOnset?6:5}));
      if(valueCapped)svg.appendChild(svgEl('path',{class:'pace-cap-marker',d:`M ${x} ${pad+1} L ${x-5} ${pad+8} L ${x+5} ${pad+8} Z`}));
      const delta=finiteNumber(row.medianDeltaFromOpening)?` · ${row.medianDeltaFromOpening>0?'+':''}${row.medianDeltaFromOpening} pts from opening`:'';
      chartHitCircle(svg,x,y,`${row.label} · median pace ${percentLabel(row.medianPace,1)}${delta} · ${row.runs} runs · ${row.days} days${isOnset?' · detected slippage onset':''}`,inspect,15);
      const label=svgEl('text',{class:'label'+(isOnset?' bright':''),x,y:plotBottom+22,'text-anchor':'middle'});label.textContent=shortLabels[index]||row.label;svg.appendChild(label);
    });
    const widget=inspectedChart(svg,inspect,practice&&practice.position&&practice.position.onset
      ?`Pace begins slipping around the ${practice.position.onset.label.toLowerCase()}. Select a point for its run and day evidence.`
      :'No stable slippage point is established. Select a point to inspect its evidence.');
    if(capped)appendChartNote(widget,`Pace above the ${yMax}% visual ceiling is pinned to the top marker; the actual value remains in the inspector.`);
    return widget;
  }
  function practicePaceConcernDistance(value:number|null){
    if(!finiteNumber(value))return 0;
    if(value>PRACTICE_CONTROLLED_MAX)return value-PRACTICE_CONTROLLED_MAX;
    if(value<PRACTICE_CONTROLLED_MIN)return PRACTICE_CONTROLLED_MIN-value;
    return 0;
  }
  function practiceComparisonDifference(rows:readonly PracticeComparisonRow[],family:string){
    const eligible=rows.filter(row=>row.maturity.rank>=1&&finiteNumber(row.medianRunPace));
    if(eligible.length<2)return null;
    const sorted=eligible.slice().sort((a,b)=>num(a.medianRunPace)-num(b.medianRunPace));
    const low=sorted[0],high=sorted[sorted.length-1];
    if(!low||!high)return null;
    const gap=num(high.medianRunPace)-num(low.medianRunPace);
    if(gap<MIN_VISIBLE_PRACTICE_DIFFERENCE_POINTS)return null;
    const lowConcern=practicePaceConcernDistance(num(low.medianRunPace)),highConcern=practicePaceConcernDistance(num(high.medianRunPace));
    const focus=highConcern>=lowConcern?high:low,other=focus===high?low:high;
    const direction=num(focus.medianRunPace)>=num(other.medianRunPace)?'above':'below';
    return {
      family,label:focus.label,value:percentLabel(focus.medianRunPace,1),tone:practicePaceConcernDistance(num(focus.medianRunPace))>0?'watch':'quiet',
      meta:`${focus.units} units · ${focus.runs} runs · ${focus.days} days · ${focus.maturity.label}`,
      note:`${numberLabel(gap,1)} pace points ${direction} ${other.label}.`,
      score:gap+practicePaceConcernDistance(num(focus.medianRunPace))*1.5+num(focus.maturity.rank)*4
    };
  }
  function practiceEarlyComparisonRow(rows:readonly PracticeComparisonRow[],family:string){
    const eligible=rows.filter(row=>finiteNumber(row.medianRunPace)&&num(row.units)>=MIN_PRACTICE_EARLY_VIEW_UNITS&&num(row.runs)>=1&&num(row.days)>=1);
    if(eligible.length<2)return null;
    const sorted=eligible.slice().sort((a,b)=>num(a.medianRunPace)-num(b.medianRunPace));
    const low=sorted[0],high=sorted[sorted.length-1];
    if(!low||!high)return null;
    const gap=num(high.medianRunPace)-num(low.medianRunPace);
    if(num(low.units)+num(high.units)<MIN_PRACTICE_EARLY_VIEW_TOTAL_UNITS)return null;
    const evidenceLabel=(row:PracticeComparisonRow)=>`${row.units} unit${num(row.units)===1?'':'s'} · ${row.runs} run${num(row.runs)===1?'':'s'} · ${row.days} day${num(row.days)===1?'':'s'}`;
    return {
      family,label:`${high.label} vs ${low.label}`,value:`${percentLabel(high.medianRunPace,1)} / ${percentLabel(low.medianRunPace,1)}`,tone:'quiet',early:true,
      meta:`${high.label}: ${evidenceLabel(high)} · ${high.maturity&&high.maturity.label||'Early'}`,
      note:`${low.label}: ${percentLabel(low.medianRunPace,1)} · ${evidenceLabel(low)}. ${numberLabel(gap,1)}-point gap; difference not established yet.`,
      score:gap+Math.min(num(high.units)+num(low.units),24)/6
    };
  }
  function practiceDifferenceDisplay(practice:Practice){
    const established=practiceDifferenceRows(practice);
    if(established.length)return {rows:established,early:false};
    const early=[practiceEarlyComparisonRow(practice.areas,'Area'),practiceEarlyComparisonRow(practice.modes,'Setup')]
      .filter((row):row is NonNullable<typeof row>=>!!row)
      .sort((a,b)=>num(b.score)-num(a.score)||String(a.family).localeCompare(String(b.family)))
      .slice(0,2);
    return {rows:early,early:true};
  }
  function practiceDifferenceRows(practice:Practice){
    const candidates:Array<{family:string;label:string;value:string;tone:string;meta:string;note:string;score:number;early?:boolean}>=[];
    const area=practiceComparisonDifference(practice&&practice.areas,'Area');if(area)candidates.push(area);
    const setup=practiceComparisonDifference(practice&&practice.modes,'Setup');if(setup)candidates.push(setup);
    const segments=(practice&&practice.repeatedSegments||[]).filter(row=>row&&row.maturity&&row.maturity.rank>=1);
    if(segments.length){
      const row=segments.slice().sort((a,b)=>{
        const score=(value:PracticeRepeatedSegment)=>Math.max(0,100-num(value.medianCompletion),100-num(value.completedSegmentRate),Math.abs(num(value.medianRelativeDelta)),practicePaceConcernDistance(num(value.medianPace)));
        return score(b)-score(a)||num(b.maturity.rank)-num(a.maturity.rank)||num(b.runs)-num(a.runs);
      })[0];
      if(!row)return candidates;
      const incomplete=num(row.completedSegmentRate)<100||num(row.medianCompletion)<100;
      const paceEffect=Math.abs(num(row.medianRelativeDelta));
      if(incomplete||paceEffect>=MIN_PRACTICE_SEGMENT_EFFECT_POINTS||practicePaceConcernDistance(num(row.medianPace))>=MIN_PRACTICE_SEGMENT_EFFECT_POINTS){
        const note=incomplete
          ?`${row.completedSegments}/${row.runs} repeated segments were fully completed; median completion ${percentLabel(row.medianCompletion,1)}.`
          :`${num(row.medianRelativeDelta)>0?'+':''}${numberLabel(row.medianRelativeDelta,1)} pace points versus the rest of the same runs.`;
        candidates.push({family:'Segment',label:row.label,value:Number.isFinite(row.medianPace)?percentLabel(row.medianPace,1):percentLabel(row.medianCompletion,1),tone:incomplete||practicePaceConcernDistance(num(row.medianPace))>=MIN_PRACTICE_SEGMENT_EFFECT_POINTS?'watch':'quiet',meta:`${row.evidenceUnits} units · ${row.runs} runs · ${row.days} days · ${row.maturity.label}`,note,score:Math.max(100-num(row.completedSegmentRate),100-num(row.medianCompletion),paceEffect,practicePaceConcernDistance(num(row.medianPace)))+num(row.maturity.rank)*4});
      }
    }
    const size=practice&&practice.unitSizeDifference;
    if(size&&size.low&&size.high){
      const lowConcern=practicePaceConcernDistance(num(size.low.medianPace)),highConcern=practicePaceConcernDistance(num(size.high.medianPace));
      const focus=highConcern>=lowConcern?size.high:size.low,other=focus===size.high?size.low:size.high;
      candidates.push({family:focus.family==='marks'?'Marks':'Target time',label:focus.label,value:percentLabel(focus.medianPace,1),tone:practicePaceConcernDistance(num(focus.medianPace))>0?'watch':'quiet',meta:`${focus.units} units · ${focus.runs} runs · ${focus.days} days · ${focus.maturity.label}`,note:`${numberLabel(size.gap,1)} pace points ${num(focus.medianPace)>=num(other.medianPace)?'above':'below'} ${other.label}.`,score:num(size.gap)+practicePaceConcernDistance(num(focus.medianPace))*1.5+num(focus.maturity.rank)*4});
    }
    return candidates.sort((a,b)=>num(b.score)-num(a.score)||String(a.family).localeCompare(String(b.family))).slice(0,3);
  }
  function renderPracticePositionCard(practice:Practice){
    const card=el('section','insights-card soft ui-card insights-practice-card');
    card.appendChild(sectionTitle('Where does pace slip?','Run-balanced pace across five relative positions; the shaded band marks 80–100% of target.'));
    card.appendChild(practicePositionChart(practice));
    const summary=el('div','insights-practice-position-summary');
    const position=practice.position||{};
    summary.append(summaryChip('Slippage onset',position.onset?`${position.onset.label} · +${round(position.onset.medianDeltaFromOpening,1)} pts`:position.eligibleRuns>=MIN_PRACTICE_POSITION_RUNS?'No stable onset':`Need ${MIN_PRACTICE_POSITION_RUNS} runs with ${MIN_PRACTICE_POSITION_UNITS}+ units`),summaryChip('Within-run spread',num(practice.spreadComparableRuns)<MIN_PRACTICE_COMPARABLE_RUNS?`Need ${MIN_PRACTICE_COMPARABLE_RUNS} runs`:`${round(practice.medianWithinRunSpread,1)} pts · n=${practice.spreadComparableRuns}`));
    card.appendChild(summary);
    return card;
  }
  function renderPracticeDifferences(practice:Practice){
    const card=el('section','insights-card soft ui-card insights-practice-differences');
    card.appendChild(sectionTitle('What differs?','Established differences appear first; when none qualify, up to two early area or setup views remain visible.'));
    const display=practiceDifferenceDisplay(practice),rows=display.rows;
    if(!rows.length){card.appendChild(evidenceNote('No stable difference or usable early area/setup comparison yet.'));return card;}
    rows.forEach(row=>{
      const item=el('div',`insights-practice-difference-row ${row.tone||'quiet'}${row.early?' early-view':''}`),head=el('div','insights-practice-difference-head');
      head.append(el('div','insights-practice-difference-name ui-label',`${row.early?'Early view · ':''}${row.family} · ${row.label}`),el('div','insights-practice-difference-value ui-mono',row.value));
      item.append(head,el('div','insights-practice-difference-meta ui-mono',row.meta),el('div','insights-practice-difference-note ui-mono',row.note));card.appendChild(item);
    });
    return card;
  }
  function renderPracticePacer(model:Model,{embedded=false}:{embedded?:boolean}={}){
    const practice=model.practice;
    const details=embedded?el('section','insights-practice insights-practice-embedded ui-card'):el('details','insights-practice ui-disclosure');
    const summary=embedded?el('div','insights-practice-embedded-head'):el('summary',null),summaryCopy=el('span','insights-practice-summary-copy');
    summaryCopy.append(el('span','insights-practice-summary-title ui-label','Practice Pacing'),el('span','insights-practice-summary-meta ui-mono',practice.units?`${practice.units} unit${practice.units===1?'':'s'} · ${practice.runs} run${practice.runs===1?'':'s'} · ${practice.practiceDays} practice day${practice.practiceDays===1?'':'s'}`:'No completed runs in this window'));
    summary.appendChild(summaryCopy);
    const body=el('div','insights-practice-body');
    body.appendChild(el('div','insights-practice-caution ui-inset ui-mono',`Timing only · ${PRACTICE_CONTROLLED_MIN}–${PRACTICE_CONTROLLED_MAX}% controlled · correctness and quality are not measured.`));
    if(!practice.units){
      body.appendChild(el('div','insights-empty ui-card ui-mono','Finish and save a Practice Pacer run to begin this read. Active or discarded runs are not evidence.'));
      details.append(summary,body);return details;
    }
    const metrics=el('section','insights-evidence-strip insights-practice-metrics ui-card');
    if(practice.plannedRuns){
      metrics.append(
        evidenceItem('Plans finished',`${practice.completedPlannedRuns}/${practice.plannedRuns}`,`${percentLabel(practice.completedPlannedRunRate,1)} of planned runs fully completed · typical planned run ${percentLabel(practice.plannedRunCompletionMedian,1)} complete.`),
        evidenceItem('Finished within time',practice.completedPlannedRuns?percentLabel(practice.completedWithinTimeRate,1):'No completed plans',practice.completedPlannedRuns?`${practice.completedWithinTimeRuns}/${practice.completedPlannedRuns} fully completed planned runs.`:'A run must be fully completed before its finishing time can be judged.'),
        evidenceItem('Finishing margin',practice.completedPlannedRuns?signedMillisecondsLabel(practice.medianFinishingMarginMs):'No completed plans',practice.completedPlannedRuns?`Median full-budget use ${percentLabel(practice.medianCompletedRunTimeUsed,1)}.`:'Incomplete planned runs remain part of follow-through, not finishing-margin evidence.'),
        evidenceItem('Typical unit pace',percentLabel(practice.typicalUnitPace,1),'Median of each run’s own median unit pace; every run has equal influence.')
      );
    }else{
      metrics.append(
        evidenceItem('Run time used',percentLabel(practice.medianRunPace,1),'Median total actual run time ÷ combined applicable targets; every run has equal influence.'),
        evidenceItem('Controlled runs',percentLabel(practice.controlledRunRate,1),`${practice.controlledRuns}/${practice.runs} completed runs used 80–100% of their combined targets.`),
        evidenceItem('Typical unit pace',percentLabel(practice.typicalUnitPace,1),'Median of each run’s own median unit pace; every run has equal influence.'),
        evidenceItem('Practice volume',`${practice.runs} run${practice.runs===1?'':'s'}`,`${practice.units} completed unit${practice.units===1?'':'s'} across ${practice.practiceDays} practice day${practice.practiceDays===1?'':'s'}.`)
      );
    }
    const reading=el('div',`insights-practice-reading ui-canvas ${practice.reading&&practice.reading.tone||'quiet'}`);
    reading.append(el('div','tag ui-chip ui-label',practice.reading&&practice.reading.tag||'Pace reading'),el('div','copy ui-mono',practice.reading&&practice.reading.text||''));
    if(practice.supportingReading)reading.appendChild(el('div','insights-rhythm-note ui-mono',`Also: ${practice.supportingReading.text}`));
    const audit=practice.audit||{};
    if(num(audit.excludedRuns)>0||num(audit.excludedUnits)>0)reading.appendChild(el('div','insights-rhythm-note ui-mono',`Evidence check: ${audit.excludedRuns||0} of ${audit.savedRuns||0} saved run${num(audit.savedRuns)===1?' was':'s were'} excluded${num(audit.excludedUnits)>0?` · ${audit.excludedUnits} unit entr${num(audit.excludedUnits)===1?'y':'ies'} excluded`:''}. See Analytics Lab for reasons.`));
    const grid=el('div','insights-practice-grid'),trendCard=el('section','insights-card soft ui-card insights-practice-card');
    trendCard.appendChild(sectionTitle('Is pacing changing?','Run-balanced daily pace; a direction appears only when it remains consistent across the saved history.'));
    trendCard.classList.add('insights-practice-trend-card');
    const syncTrendLimit=()=>{
      const previous=trendCard.querySelector('.insights-practice-trend-limit');if(previous)previous.remove();
      const visiblePracticeDays=isCompact()?20:60;
      const basis=practice.trendBasis||{},trend=practice.trend||{};
      const chart=`Chart shows the latest ${Math.min(visiblePracticeDays,practice.daily.length)} of ${practice.daily.length} practice day${practice.daily.length===1?'':'s'}.`;
      trendCard.appendChild(el('div','insights-rhythm-note insights-practice-trend-limit ui-mono',`${chart} The interpretation uses all eligible Pacer evidence in ${String(basis.label||'the selected window').toLowerCase()}.`));
    };
    trendCard.appendChild(Layout.chart(()=>practiceTrendChart(practice),syncTrendLimit));syncTrendLimit();
    trendCard.appendChild(lazyDisclosure('insights-calculation-disclosure','How this was calculated',()=>{
      const basis=practice.trendBasis||{},trend=practice.trend||{};
      const method=trend.exact?`an exact all-pairs slope across ${trend.eligibleDays} trend day${trend.eligibleDays===1?'':'s'}`:`a bounded time-stratified slope using ${trend.sampledDays} of ${trend.eligibleDays} trend days`;
      const body=el('div','insights-calculation-body ui-mono');
      body.textContent=`Direction uses ${String(basis.label||'the selected window').toLowerCase()} with ${method}. It must retain its direction across ${trend.blockCount||0} contiguous block-jackknife checks plus first- and last-block stability checks.`;
      return body;
    }));
    grid.append(trendCard,renderPracticePositionCard(practice));
    body.append(metrics,reading,grid,renderPracticeDifferences(practice));details.append(summary,body);return details;
  }
  function renderExecutionSurface(model:Model){
    const surface=el('section','insights-execution-surface');
    const tabs=el('div','insights-execution-tabs ui-inset');
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Execution views');
    const dailyButton=el('button','insights-execution-tab ui-btn active ui-label','Daily Execution');
    const practiceButton=el('button','insights-execution-tab ui-btn ui-label','Practice Pacing');
    dailyButton.type=practiceButton.type='button';
    dailyButton.dataset['executionTab']='daily';practiceButton.dataset['executionTab']='practice';
    dailyButton.setAttribute('role','tab');practiceButton.setAttribute('role','tab');
    dailyButton.setAttribute('aria-selected','true');practiceButton.setAttribute('aria-selected','false');
    dailyButton.setAttribute('aria-controls','insights-execution-daily');practiceButton.setAttribute('aria-controls','insights-practice');
    const dailyPanel=el('div','insights-execution-tab-panel');
    dailyPanel.id='insights-execution-daily';dailyPanel.dataset['executionPanel']='daily';dailyPanel.setAttribute('role','tabpanel');
    const practicePanel=el('div','insights-execution-tab-panel');
    practicePanel.id='insights-practice';practicePanel.dataset['executionPanel']='practice';practicePanel.setAttribute('role','tabpanel');practicePanel.hidden=true;
    dailyPanel.appendChild(renderExecutionQuality(model));
    practicePanel.appendChild(renderPracticePacer(model,{embedded:true}));
    const activate=(key:string|null)=>{
      const daily=key==='daily';
      if((daily&&!dailyPanel.hidden)||(!daily&&!practicePanel.hidden))return true;
      dailyButton.classList.toggle('active',daily);practiceButton.classList.toggle('active',!daily);
      dailyButton.setAttribute('aria-selected',daily?'true':'false');practiceButton.setAttribute('aria-selected',daily?'false':'true');
      dailyPanel.hidden=!daily;practicePanel.hidden=daily;
      return true;
    };
    executionActivators.set(surface,activate);
    dailyButton.addEventListener('click',()=>{void activate('daily');});
    practiceButton.addEventListener('click',()=>{void activate('practice');});
    [dailyButton,practiceButton].forEach((button,index)=>button.addEventListener('keydown',event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      const next=index===0?practiceButton:dailyButton;
      next.focus();next.click();
    }));
    tabs.append(dailyButton,practiceButton);surface.append(tabs,dailyPanel,practicePanel);return surface;
  }
  function renderSubjectCoverage(model:Model){
    const section=el('section','insights-area-coverage');
    const presentSubjects=(model.subjects||[]).filter(row=>num(row.blocks)>0||num(row.planned)>0||num(row.completed)>0);
    const overview=el('div','insights-area-overview-grid');
    const subjectCard=el('section','insights-card soft ui-card insights-area-card insights-area-completion-card');
    subjectCard.appendChild(sectionTitle('Area work completion','Completed work divided by planned work for every current top-level area; compact volume shows how much evidence sits behind each percentage.'));
    const subjectBars=el('div','insights-bars');
    subjectCard.appendChild(subjectBars);
    presentSubjects.forEach(subject=>subjectBars.appendChild(areaCompletionRow(subject)));
    if(!presentSubjects.length)subjectBars.appendChild(evidenceNote('No top-level area work blocks saved in this window.'));
    subjectCard.appendChild(renderSubjectSignalStrip(model));
    const allocationCard=el('section','insights-card soft ui-card insights-area-card insights-area-allocation-card');
    allocationCard.appendChild(sectionTitle('Planned vs completed work mix','The full independently normalised mix across every current top-level area.'));
    allocationCard.appendChild(renderAreaAllocationVisual(model,presentSubjects));
    allocationCard.appendChild(el('div','insights-area-allocation-caveat ui-mono','Saved allocation reflects your plans, not exam priority.'));
    overview.append(subjectCard,allocationCard);
    const riskCard=el('section','insights-card soft ui-card insights-risk-card');
    riskCard.appendChild(sectionTitle('Coverage Watch map','Up to 12 top-level areas with saved allocation within the rolling previous 365 days; recency requires study activity.'));
    riskCard.appendChild(Layout.chart(()=>coverageRiskMap(model.subjects)));
    section.append(overview,riskCard);
    return section;
  }
  function plannedOutputRows(subjects:readonly Subject[]){
    const rows=subjects
      .filter(row=>num(row.planned)>0||num(row.completed)>0)
      .slice()
      .sort((a,b)=>Math.max(num(b.plannedShare),num(b.share))-Math.max(num(a.plannedShare),num(a.share))||num(b.planned)-num(a.planned)||labelCompare(a,b));
    return rows;
  }
  function mixSummaryText(rows:readonly AllocationRow[]){
    if(!rows.length)return 'Need more top-level area evidence before comparing planned and completed work.';
    const shifts=rows.map(row=>({...row,rawShift:num(row.share)-num(row.plannedShare)}));
    const toward=shifts.filter(row=>row.rawShift>=5).sort((a,b)=>b.rawShift-a.rawShift)[0];
    const away=shifts.filter(row=>row.rawShift<=-5).sort((a,b)=>a.rawShift-b.rawShift)[0];
    if(toward&&away)return `Completed-work mix shifted toward ${toward.label} (+${Math.round(toward.rawShift)} share pts) and away from ${away.label} (${Math.round(away.rawShift)} share pts).`;
    if(toward)return `Completed-work mix leaned more toward ${toward.label} than planned (+${Math.round(toward.rawShift)} share pts).`;
    if(away)return `${away.label} formed a smaller share of completed work than planned (${Math.round(away.rawShift)} share pts).`;
    return 'Completed work is broadly aligned with the planned top-level area mix.';
  }
  function absoluteAreaWorkGap(row:AllocationRow,divisor=1,suffix=''){
    const safeDivisor=Math.max(1,num(divisor,1));
    const totalDifference=num(row.completed)-num(row.planned);
    const difference=totalDifference/safeDivisor;
    const magnitude=Math.abs(difference);
    const unit=String(suffix||'');
    if(Math.abs(totalDifference)<.5)return {minutes:0,totalMinutes:0,tone:'within',label:'complete',longLabel:'no work gap'};
    const magnitudeLabel=magnitude<1?'<1m':minutesLabel(magnitude);
    if(difference>0)return {minutes:difference,totalMinutes:totalDifference,tone:'up',label:`${magnitudeLabel}${unit} surplus`,longLabel:`${magnitudeLabel}${unit} completed beyond plan`};
    return {minutes:difference,totalMinutes:totalDifference,tone:'down',label:`${magnitudeLabel}${unit} short`,longLabel:`${magnitudeLabel}${unit} short of plan`};
  }
  function allocationBaseSummary(planned:number,completed:number,savedDays=1){
    const days=Math.max(1,num(savedDays,1));
    const wrap=el('div','insights-allocation-bases ui-inset ui-mono');
    const add=(label:string,value:string)=>{
      const item=el('span',null);
      item.append(el('b',null,label+' '),document.createTextNode(value));
      wrap.appendChild(item);
    };
    wrap.appendChild(el('span','context',`Average saved day · n=${days}`));
    add('Planned',minutesLabel(num(planned)/days));
    add('Completed',`${minutesLabel(num(completed)/days)} equivalent`);
    add('Completion',percentLabel(pct(completed,planned)));
    wrap.title=`Window totals across ${days} saved day${days===1?'':'s'}: ${minutesLabel(planned)} planned; ${minutesLabel(completed)} completed-equivalent.`;
    return wrap;
  }
  function allocationSeriesClass(index:number){
    return `insights-series-${String(index%16+1).padStart(2,'0')}`;
  }
  function allocationCompositionBar(label:string,rows:readonly AllocationRow[],shareKey:'share'|'plannedShare',displayShares:readonly number[]){
    const line=el('div','insights-allocation-bar-row');
    const track=el('div','insights-allocation-track');
    const detail=rows.map((row,index)=>`${row.label} ${displayShares[index]}%`).join(', ');
    track.setAttribute('role','img');
    track.setAttribute('aria-label',`${label}: ${detail}`);
    rows.forEach((row,index)=>{
      const share=Math.max(0,num(row[shareKey]));
      if(share<=0)return;
      const segment=el('div','insights-allocation-segment');
      segment.classList.add(allocationSeriesClass(index));
      segment.style.width=`${share}%`;
      segment.title=`${row.label}: ${displayShares[index]}% of ${label.toLowerCase()} work`;
      track.appendChild(segment);
    });
    line.append(el('div','k ui-label',label),track);
    return line;
  }
  function renderAreaAllocationVisual(model:Model,subjects:readonly Subject[]){
    const visual=el('div','insights-allocation-visual');
    const mixRows=plannedOutputRows(subjects);
    if(model.overview.planned<240||model.overview.completed<60||mixRows.length<2){
      visual.appendChild(evidenceNote('Needs at least two areas, about 4h planned work, and 1h completed work in this window.'));
      return visual;
    }
    visual.appendChild(el('div','insights-plan-output-summary ui-mono',mixSummaryText(mixRows)));
    const savedDays=Math.max(1,model.recordCount||0);
    visual.appendChild(allocationBaseSummary(model.overview.planned,model.overview.completed,savedDays));
    const plannedDisplayShares=apportionedPercents(mixRows.map(row=>row.plannedShare));
    const completedDisplayShares=apportionedPercents(mixRows.map(row=>row.share));
    const bars=el('div','insights-allocation-bars');
    bars.append(
      allocationCompositionBar('Planned',mixRows,'plannedShare',plannedDisplayShares),
      allocationCompositionBar('Completed',mixRows,'share',completedDisplayShares)
    );
    const legend=el('div','insights-allocation-legend ui-mono');
    mixRows.forEach((row,index)=>{
      const plan=plannedDisplayShares[index];
      const completed=completedDisplayShares[index];
      const gap=absoluteAreaWorkGap(row,savedDays,'/day');
      const item=el('div','insights-allocation-item');
      const swatch=el('i','insights-allocation-swatch');swatch.classList.add(allocationSeriesClass(index));
      const values=el('div','insights-allocation-values',`${plan}% → ${completed}% · ${gap.label}`);
      values.classList.add(gap.tone);
      item.title=`${row.label}: ${plan}% of planned mix, ${completed}% of completed mix; window totals ${minutesLabel(row.planned)} planned and ${minutesLabel(row.completed)} completed-equivalent; ${gap.longLabel} on average (${minutesLabel(Math.abs(gap.totalMinutes))} total ${gap.totalMinutes>0?'surplus':gap.totalMinutes<0?'short':'gap'}).`;
      item.append(swatch,el('div','insights-allocation-name ui-label',row.label),values);
      legend.appendChild(item);
    });
    visual.append(bars,legend,el('div','insights-allocation-note ui-mono','Each bar is independently normalised to its own 100% total so it compares area mix. Area gap is average absolute planned work versus completed-equivalent work per saved day; window totals remain in Analytics Lab.'));
    return visual;
  }
  function conversionReading(row:Subject,conversion:number){
    const mix=row&&row.pairedSourceMix||{};
    const explicit=num(mix['units'])+num(mix['manual']);
    const timeDerived=num(mix['time'])+num(mix['finished-time']);
    if(timeDerived>0&&explicit===0)return 'Time-derived completion: focus supplied progress, so this is not an independent conversion measure.';
    const completion=num(pct(row.pairedCompleted,row.pairedPlanned));
    const planned=num(row.pairedPlanned);
    const actual=num(row.pairedActual);
    if(completion<65&&actual>=planned*.9)return 'Enough focus, weaker output: check scope, difficulty, or progress evidence.';
    if(completion<65&&actual<planned*.7)return 'Execution shortfall: focus time is too low to judge block size.';
    if(conversion>=115)return 'Fast conversion: future similar blocks may be oversized.';
    if(conversion>=85)return 'Clean conversion: focus broadly matched completed output.';
    if(conversion<70)return 'Low conversion: review scope, progress definition, or difficulty.';
    return 'Mixed signal: useful to watch across more blocks.';
  }
  function conversionConfidenceNote(row:Subject){
    const mix=row&&row.pairedSourceMix||{};
    const explicit=num(mix['units'])+num(mix['manual']);
    const timeDerived=num(mix['time'])+num(mix['finished-time']);
    const unverified=num(mix['finished-unverified']);
    const missing=num(mix['none']);
    const notes=[];
    if(num(row&&row.pairedBlocks)<MIN_BLOCKS_FOR_SIGNAL||num(row&&row.pairedActual)<120)notes.push(`Early sample: n=${num(row&&row.pairedBlocks)}, ${minutesLabel(row&&row.pairedActual)} paired focus.`);
    if(timeDerived+unverified+missing>0)notes.push(`Evidence: ${explicit} explicit · ${timeDerived} time-derived · ${unverified+missing} unverified or missing.`);
    return notes.join(' ');
  }
  function renderConversionRow(row:Subject){
    const conversion=pct(row.pairedCompleted,row.pairedActual);
    const item=el('div','insights-conversion-row ui-canvas');
    const head=el('div','insights-conversion-head');
    head.append(el('div','name ui-label',row.label),el('div','value ui-mono',percentLabel(conversion)));
    item.append(
      head,
      el('div','insights-conversion-meta ui-mono',`Paired work ${minutesLabel(row.pairedCompleted)} · focus ${minutesLabel(row.pairedActual)} · plan ${minutesLabel(row.pairedPlanned)} · n=${row.pairedBlocks} · coverage ${percentLabel(row.pairedTimerCoverage)}`),
      el('div','insights-conversion-reading ui-mono',conversionReading(row,num(conversion)))
    );
    const warning=conversionConfidenceNote(row);
    if(warning)item.appendChild(el('div','insights-conversion-warning ui-mono',warning));
    return item;
  }
  function conversionDisplayRows(subjects:readonly Subject[]){
    return subjects
      .filter(row=>num(row.pairedBlocks)>=2&&num(row.pairedPlanned)>=60&&num(row.pairedActual)>=60&&num(row.pairedTimerCoverage)>=MIN_TIMER_COVERAGE_FOR_PLAN_READ)
      .map(row=>({...row,conversion:pct(row.pairedCompleted,row.pairedActual)}))
      .filter(row=>Number.isFinite(num(row.conversion,null)))
      .sort((a,b)=>num(a.conversion)-num(b.conversion)||num(b.pairedActual)-num(a.pairedActual)||labelCompare(a,b));
  }
  function renderAreaConversionEvidence(model:Model){
    const conversionCard=el('section','insights-card soft ui-card insights-area-conversion-card');
    conversionCard.appendChild(sectionTitle('Focus-to-output by area','Every eligible top-level area, sorted from lowest conversion; paired Timer-backed evidence only.'));
    const subjects=(model.subjects||[]).filter(row=>num(row.planned)>0||num(row.completed)>0);
    const conversionRows=conversionDisplayRows(subjects);
    if(!conversionRows.length){
      conversionCard.appendChild(evidenceNote(`Need 2+ paired Timer-backed blocks, 60m paired plan and focus, and at least ${MIN_TIMER_COVERAGE_FOR_PLAN_READ}% paired area coverage before this read is useful.`));
    }else{
      const list=el('div','insights-conversion-list');
      conversionRows.forEach(row=>list.appendChild(renderConversionRow(row)));
      conversionCard.appendChild(list);
      conversionCard.appendChild(evidenceNote('This is area-level, not an overall score. Only matched Timer-backed blocks contribute to both sides; time-derived rows remain labelled because their completion and focus share the same evidence.'));
    }
    return conversionCard;
  }
  function renderTrainingLog(model:Model){
    const days=Math.max(1,model.recordCount||0);
    const box=el('section','insights-card ui-card');
    box.appendChild(sectionTitle('Training log','Milestones and support structure.'));
    const grid=el('div','insights-training-grid');
    model.milestones.forEach(item=>grid.appendChild(card(item.label,String(item.value),item.note)));
    box.appendChild(grid);
    const structure=el('div','insights-day-structure');
    const mixCard=el('section','insights-card soft ui-card insights-resource-card');
    mixCard.appendChild(sectionTitle('Day mix','Average planned allocation per saved day: work, support, fixed.'));
    mixCard.appendChild(resourceMixBar(model.resourceMix,days));
    mixCard.appendChild(resourceMixSummary(model.resourceMix,days));
    const life=el('div','insights-life-grid');
    const supportCard=el('section','insights-card soft ui-card');
    supportCard.append(sectionTitle('Support blocks','Average planned minutes per saved day for top maintenance categories.'),el('div','insights-life-bars'));
    const supportBars=supportCard.querySelector<HTMLDivElement>('.insights-life-bars');
    model.support.resources.slice(0,4).forEach(row=>supportBars?.appendChild(lifeRow(row.label,row.planned/days,model.support.planned/days)));
    if(!model.support.resources.length)supportBars?.appendChild(evidenceNote('No support blocks saved yet.'));
    const fixedCard=el('section','insights-card soft ui-card');
    fixedCard.append(sectionTitle('Fixed anchors','Average planned minutes per saved day; structure only.'),el('div','insights-life-bars'));
    const fixedBars=fixedCard.querySelector<HTMLDivElement>('.insights-life-bars');
    model.fixed.resources.slice(0,4).forEach(row=>fixedBars?.appendChild(lifeRow(row.label,row.planned/days,model.fixed.planned/days)));
    if(!model.fixed.resources.length)fixedBars?.appendChild(evidenceNote('No fixed blocks saved yet.'));
    life.append(supportCard,fixedCard);
    structure.append(mixCard,life);
    box.appendChild(structure);
    return box;
  }
  function fitnessSummaryMeta(model:Model){
    const fitness=model.fitness||{};
    const state=fitness.performanceState&&fitness.performanceState.current;
    if(!state)return `Current state unavailable · display ${(model&&model.windowLabel||'selected window').toLowerCase()}`;
    const trajectory=fitness.performanceState.trajectory&&fitness.performanceState.trajectory.label||'Uncertain';
    return `All-history state · output ${trajectory.toLowerCase()} · ${percentLabel(state.estimate,1)} (${percentLabel(state.low,0)}–${percentLabel(state.high,0)}) · ${(fitness.readiness&&fitness.readiness.label||'weak signal').toLowerCase()} · display ${(model&&model.windowLabel||'selected window').toLowerCase()}`;
  }
  function fitnessStateChart(model:Model){
    const state=model&&model.fitness&&model.fitness.performanceState||{};
    const allRows=(state.history??[]).filter(row=>finiteNumber(row.estimate));
    const showAll=model&&model.windowKey==='all';
    const displayStart=!showAll&&isIsoDate(model&&model.calendarRange&&model.calendarRange.start)?dateDay(model.calendarRange.start):null;
    const displayEnd=!showAll&&isIsoDate(model&&model.calendarRange&&model.calendarRange.end)?dateDay(model.calendarRange.end):null;
    const windowRows=allRows.filter(row=>(!finiteNumber(displayStart)||row.day>=displayStart)&&(!finiteNumber(displayEnd)||row.day<=displayEnd));
    const compact=isCompact();
    const visibleCalendarDays=compact?30:90;
    const latestWindowRow=windowRows[windowRows.length-1];
    const latestDay=latestWindowRow?latestWindowRow.day:null;
    const rows=finiteNumber(latestDay)?windowRows.filter(row=>row.day>=latestDay-visibleCalendarDays+1):[];
    const chartWidth=compact?360:920,chartHeight=compact?230:252,chartPad=compact?34:42,chartRightPad=compact?10:20;
    const {svg,plotRight,plotBottom,plotWidth,plotHeight}=chartFrame(chartWidth,chartHeight,chartPad,chartRightPad);
    svg.classList.add('insights-fitness-chart');
    labelGraphic(svg,'Output-state history','Daily canonical work completion is shown as dots. The line is a chronological filtered state whose historical parameters use only evidence available by each date; the band is its approximate 95% model interval. Missing days widen uncertainty instead of becoming zero output.');
    if(!rows.length){
      chartEmpty(svg,'No usable progress evidence for a state estimate.',56,118);
      return inspectedChart(svg,[],'Save explicit, time-derived, unverified-finish, or skipped progress evidence to begin this read.');
    }
    const firstStateRow=rows[0],lastStateRow=rows[rows.length-1];
    if(!firstStateRow||!lastStateRow)return inspectedChart(svg,[],'No usable progress evidence for a state estimate.');
    const startDay=firstStateRow.day,endDay=lastStateRow.day,span=Math.max(1,endDay-startDay);
    const xFor=(day:number)=>chartPad+(day-startDay)/span*plotWidth;
    const yFor=(value:number|null|undefined)=>plotBottom-Math.max(0,Math.min(100,num(value)))/100*plotHeight;
    [0,25,50,75,100].forEach(value=>{
      const y=yFor(value);
      if(value>0)svg.appendChild(svgEl('line',{class:'grid',x1:chartPad,y1:y,x2:plotRight,y2:y}));
      const label=svgEl('text',{class:'axis-label',x:chartPad-7,y:y+4,'text-anchor':'end'});label.textContent=`${value}%`;svg.appendChild(label);
    });
    const bandPoints=rows.map(row=>`${xFor(row.day)},${yFor(row.high)}`).concat(rows.slice().reverse().map(row=>`${xFor(row.day)},${yFor(row.low)}`));
    svg.appendChild(svgEl('polygon',{class:'fitness-band',points:bandPoints.join(' ')}));
    const change=model&&model.dynamics&&model.dynamics.changePoint;
    const changeDay=change&&change.detected&&isIsoDate(change.date)?dateDay(change.date):null;
    if(finiteNumber(changeDay)&&changeDay>=startDay&&changeDay<=endDay){
      const x=xFor(changeDay);
      svg.appendChild(svgEl('line',{class:'fitness-change',x1:x,y1:chartPad,x2:x,y2:plotBottom}));
      const label=svgEl('text',{class:'fitness-change-label',x:x+5,y:chartPad+13});label.textContent='record shift';svg.appendChild(label);
    }
    svg.appendChild(svgEl('polyline',{class:'fitness-line',points:rows.map(row=>`${xFor(row.day)},${yFor(row.estimate)}`).join(' ')}));
    rows.filter(row=>finiteNumber(row.observed)).forEach(row=>{
      svg.appendChild(svgEl('circle',{class:`fitness-dot ${row.observationUsed?'chart-point-large':'chart-point-md'}${row.observationUsed?'':' weak'}`,cx:xFor(row.day),cy:yFor(row.observed),r:row.observationUsed?3.2:3}));
    });
    const current=rows[rows.length-1];
    if(!current)return inspectedChart(svg,[],'No usable progress evidence for a state estimate.');
    svg.appendChild(svgEl('circle',{class:'fitness-current chart-point-current',cx:xFor(current.day),cy:yFor(current.estimate),r:5}));
    const items:ChartHit[]=[];
    rows.filter(row=>finiteNumber(row.observed)).forEach(row=>{
      const copy=`${shortDate(row.date)} · observed ${percentLabel(row.observed,1)} · Output state ${percentLabel(row.estimate,1)} (${percentLabel(row.low,0)}–${percentLabel(row.high,0)}) · ${row.observationUsed?`evidence weight ${numberLabel(row.evidenceWeight,2)}`:'no usable progress-source weight; state not updated'}`;
      chartHitCircle(svg,xFor(row.day),yFor(row.observed),copy,items,10);
    });
    const currentCopy=`${shortDate(current.date)} · current Output state ${percentLabel(current.estimate,1)} · model range ${percentLabel(current.low,0)}–${percentLabel(current.high,0)} · last usable evidence ${state.daysSinceLastEvidence===0?'today':state.daysSinceLastEvidence===1?'1 day ago':`${state.daysSinceLastEvidence} days ago`}`;
    chartHitCircle(svg,xFor(current.day),yFor(current.estimate),currentCopy,items,14);
    if(items.length){const latest=items[items.length-1];if(latest)latest.initial=true;}
    [rows[0],rows[Math.floor((rows.length-1)/2)],rows[rows.length-1]].filter((row):row is NonNullable<typeof row>=>!!row).filter((row,index,list)=>list.findIndex(item=>item.date===row.date)===index).forEach((row,index,list)=>{
      const label=svgEl('text',{class:'axis-label',x:xFor(row.day),y:plotBottom+22,'text-anchor':index===0?'start':index===list.length-1?'end':'middle'});label.textContent=shortDate(row.date);svg.appendChild(label);
    });
    const widget=inspectedChart(svg,items,currentCopy);
    const basis=state.basis;
    appendChartNote(widget,`Chart shows up to ${Math.min(visibleCalendarDays,Math.max(1,endDay-startDay+1))} calendar days from the selected display window; the displayed endpoint comes from the canonical all-history run spanning ${basis?.start?shortDate(basis.start):'the first eligible day'} to ${basis?.end?shortDate(basis.end):shortDate(current.date)}. Raw dots use canonical work completion; muted dots have no usable progress-source weight and do not update the state.`);
    return widget;
  }
  function fitnessStateRow(dimension:FitnessDimension,{trajectory=null,note=''}:{trajectory?:Fitness['performanceState']['trajectory']|null;note?:string}={}){
    const row=el('section',`insights-fitness-state-row ui-canvas ${(dimension&&dimension.confidence&&dimension.confidence.tone)||'low'}`);
    const head=el('div','insights-fitness-state-row-head');
    head.append(el('div','insights-fitness-state-row-title ui-label',dimension&&dimension.label||'State'));
    const confidence=el('div','insights-fitness-state-confidence ui-mono',dimension&&dimension.confidence&&dimension.confidence.label||'Weak signal');
    head.appendChild(confidence);
    const current=dimension&&dimension.current;
    const valueDigits=dimension&&dimension.key==='capacity'?1:0;
    const value=el('div','insights-fitness-state-value ui-mono',current?percentLabel(current.estimate,valueDigits):'Unknown');
    const meta=el('div','insights-fitness-state-meta ui-mono');
    const pieces=[];
    if(current)pieces.push(`${percentLabel(current.low,0)}–${percentLabel(current.high,0)} model range`);
    if(trajectory&&trajectory.label)pieces.push(trajectory.label);
    pieces.push(`${dimension&&dimension.observedDays||0} observed day${dimension&&dimension.observedDays===1?'':'s'}`);
    const age=dimension&&dimension.daysSinceLastEvidence;
    pieces.push(dimension&&dimension.lastEvidenceDate?`${shortDate(dimension.lastEvidenceDate)}${age===0?' · current':age===1?' · 1d ago':Number.isFinite(age)?` · ${age}d ago`:''}`:'No usable evidence');
    meta.textContent=pieces.join(' · ');
    row.append(head,value,meta);
    if(note)row.appendChild(el('div','insights-fitness-state-note ui-mono',note));
    return row;
  }
  function fitnessContextRow(label:string,value:DisplayValue,note:string,tone='quiet'){
    const row=el('div',`insights-fitness-context-row ${tone}`);
    row.append(el('div','insights-fitness-context-label ui-label',label),el('div','insights-fitness-context-value ui-mono',value),el('div','insights-fitness-context-note ui-mono',note));
    return row;
  }
  function renderFitnessStateRows(model:Model){
    const fitness=model.fitness||{};
    const state=fitness.performanceState||{};
    const dimensions=state.dimensions;
    const rows=el('div','insights-fitness-state-list');
    if(!dimensions)return rows;
    rows.append(
      fitnessStateRow(dimensions.capacity,{trajectory:state.trajectory,note:'Filtered canonical work completion; it is a present plan-execution estimate, not a personal ability ceiling.'}),
      fitnessStateRow(dimensions.execution,{note:'Uses captured start delay and saved schedule movement. Movement may reflect disruption or deliberate adaptation.'}),
      fitnessStateRow(dimensions.recovery,{note:'Uses Timer-backed friction and accepted Pomodoro returns only. Daily quality ratings are not part of this state.'})
    );
    return rows;
  }
  function renderFitnessContext(model:Model){
    const fitness=model.fitness||{};
    const load=fitness.loadMatch||{};
    const quality=fitness.quality||{};
    const context=el('section','insights-fitness-context ui-inset');
    context.appendChild(el('div','insights-fitness-context-title ui-label','Current context'));
    const loadValue=Number.isFinite(load.recentPlanned)
      ? `${minutesLabel(load.recentPlanned)}/eligible day · ${load.label||'response unknown'}`
      : load.label||'Response not established';
    const loadRange=load.ready&&load.range?`${minutesLabel(load.range.min)}–${minutesLabel(load.range.max)}`:'not established';
    const loadNote=load.ready
      ? `Estimated realistic region ${loadRange}; recent completion ${Number.isFinite(load.recentCompletion)?percentLabel(load.recentCompletion,1):'unknown'} across ${load.recentDays||0} eligible day${load.recentDays===1?'':'s'}. Study Dynamics owns workload interpretation and coaching.`
      : `${load.reason||'More varied planned-work days are needed.'} Study Dynamics owns workload interpretation and coaching.`;
    const qualityValue=quality.ready?`${numberLabel(quality.average,1)}/5`:'Not established';
    const qualityNote=`${quality.ratedDays||0}/${quality.totalSavedDays||0} saved days rated. This is broad self-reported day quality and remains separate from Focus control.`;
    context.append(
      fitnessContextRow('Recent planned load',loadValue,loadNote,load.tone||'quiet'),
      fitnessContextRow('Rated day quality',qualityValue,qualityNote,quality.ready?'good':'low')
    );
    return context;
  }
  function renderStudyFitnessReport(model:Model){
    const summary=el('summary'),copy=el('span','insights-fitness-summary-copy');
    copy.append(el('span','insights-fitness-summary-title ui-label','Current Study State'),el('span','insights-fitness-summary-meta ui-mono',fitnessSummaryMeta(model)));
    summary.appendChild(copy);
    return lazyDisclosure('insights-fitness ui-disclosure',summary,()=>{
      const fitness=model&&model.fitness||{},body=el('div','insights-fitness-body');
      body.appendChild(el('div','insights-fitness-intro ui-mono','A present operational estimate of how the study system is executing its plans. Output, schedule and focus remain separate, uncertainty stays visible, and no overall score is created. It does not measure health, intelligence, knowledge mastery, exam readiness, motivation or dedication.'));
      const reading=el('div',`insights-fitness-reading ui-canvas ${(fitness.readiness&&fitness.readiness.tone)||'low'}`);
      reading.append(el('div','tag ui-chip ui-label',(fitness.readiness&&fitness.readiness.label)||'Weak signal'),el('div','copy',fitness.summary&&fitness.summary.text||'No current-state read is available.'));
      body.appendChild(reading);
      const states=el('section','insights-card soft ui-card insights-fitness-states');
      states.append(sectionTitle('Current state','Three all-history estimates. The selected Insights window changes only what portion of the timeline is displayed.'),renderFitnessStateRows(model));
      const timeline=el('section','insights-card soft ui-card insights-fitness-state-card');
      timeline.append(sectionTitle('Output-state timeline','Raw daily completion, a chronologically filtered Output state, and its uncertainty band.'),Layout.chart(()=>fitnessStateChart(model)));
      body.append(states,timeline,renderFitnessContext(model));
      return body;
    },true);
  }
  function dynamicsRead(confidence:{key:string;label:string;tone:string},copy:string,value:DisplayValue=''){
    const strength=confidence||{label:'Weak signal',tone:'low'};
    const item=el('div',`insights-brain-read ui-canvas ${strength.tone||'low'}`);
    const head=el('div','insights-brain-read-head');
    head.append(el('div','insights-brain-read-tag ui-label',strength.label||'Weak signal'));
    if(value)head.appendChild(el('div','insights-brain-read-value ui-mono',value));
    item.append(head,el('div','insights-brain-read-copy ui-mono',copy));
    return item;
  }
  function dynamicsSupportingList(rows:readonly {priority:number;label:string;value:string}[]){
    const clean=rows.filter(row=>row.value)
      .sort((a,b)=>num(b.priority)-num(a.priority)||String(a.label||'').localeCompare(String(b.label||'')))
      .slice(0,MAX_DYNAMICS_SUPPORTING_READS);
    if(!clean.length)return null;
    const list=el('div','insights-dynamics-supporting ui-inset ui-mono');
    clean.forEach(row=>{const item=el('div','insights-dynamics-support-row');item.append(el('div','insights-dynamics-support-label',row.label||'Evidence'),el('div','insights-dynamics-support-value',row.value));list.appendChild(item);});
    return list;
  }
  function dynamicsCardColumns(leftNodes:Node|readonly Node[],rightNodes:Node|readonly Node[]|null){
    const layout=el('div','insights-dynamics-card-columns'),copy=el('div','insights-dynamics-card-copy'),visual=el('div','insights-dynamics-card-visual');
    const left=Array.isArray(leftNodes)?leftNodes:[leftNodes];
    const right=Array.isArray(rightNodes)?rightNodes:[rightNodes];
    left.filter((node):node is Node=>node instanceof Node).forEach(node=>copy.appendChild(node));
    right.filter((node):node is Node=>node instanceof Node).forEach(node=>visual.appendChild(node));
    if(!visual.childElementCount)visual.appendChild(el('div','insights-dynamics-visual-empty ui-canvas ui-mono','This visual will appear when enough consistent evidence is available.'));
    layout.append(copy,visual);
    return layout;
  }
  function strongestPatternReads(bayesian:RenderBayesian):PatternRead[]{
    return (bayesian.dimensions??[])
      .map(dimension=>({dimension,row:(dimension.rows||[]).filter(row=>row.meaningful&&row.estimate&&confidenceAtLeast(row.estimate.confidence,'emerging')).sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)||b.estimate.nEff-a.estimate.nEff)[0]}))
      .filter((item):item is PatternRead=>!!item.row)
      .sort((a,b)=>Math.abs(b.row.effect)-Math.abs(a.row.effect))
      .slice(0,3);
  }
  function evidenceIntervalLabel(estimate:{mean:number|null;low:number|null;high:number|null}){
    return estimate?`${percentLabel(estimate.low,0)}–${percentLabel(estimate.high,0)}`:'No interval';
  }
  function persistentPatternChart(patterns:readonly PatternRead[],bayesian:RenderBayesian){
    const rows=patterns.filter(item=>item.row.estimate);
    if(!rows.length)return evidenceNote('Repeated completion-pattern chart needs a stable pattern.');
    const compact=isCompact(),width=compact?360:680,height=52+rows.length*42,left=compact?120:158,right=18,top=28,bottom=24,plotWidth=width-left-right;
    const svg=svgEl('svg',{class:'insights-chart insights-persistent-pattern-chart',viewBox:`0 0 ${width} ${height}`,role:'group'});
    labelGraphic(svg,'Repeated completion patterns','Estimated completion and likely ranges for the clearest stable Area, start-time, and plan-position patterns. The dashed line is your overall work average.');
    const xFor=(value:number)=>left+clamp(num(value),0,100)/100*plotWidth,items:ChartHit[]=[];
    [0,50,100].forEach(value=>{
      const x=xFor(value);svg.appendChild(svgEl('line',{class:'grid',x1:x,y1:top,x2:x,y2:height-bottom}));
      const label=svgEl('text',{class:'axis-label',x,y:height-5,'text-anchor':value===0?'start':value===100?'end':'middle'});label.textContent=percentLabel(value,0);svg.appendChild(label);
    });
    if(finiteNumber(bayesian.baseline)){
      const baselineX=xFor(bayesian.baseline);
      svg.appendChild(svgEl('line',{class:'pattern-baseline',x1:baselineX,y1:top-5,x2:baselineX,y2:height-bottom}));
    }
    rows.forEach((item,index)=>{
      const {dimension,row}=item,estimate=row.estimate,y=top+index*42+13;
      const dimensionLabel=dimension.label==='Top-level area'?'Area':dimension.label==='Actual-start band'?'Start band':String(dimension.label||'Pattern');
      const visible=`${dimensionLabel} · ${String(row.label||'Group')}`;
      const label=svgEl('text',{class:'pattern-label',x:left-10,y:y+4,'text-anchor':'end'});label.textContent=visible.slice(0,compact?17:26);svg.appendChild(label);
      svg.append(
        svgEl('line',{class:'pattern-interval',x1:xFor(estimate.low),y1:y,x2:xFor(estimate.high),y2:y}),
        svgEl('circle',{class:'pattern-point chart-point-pattern',cx:xFor(estimate.mean),cy:y,r:4.2})
      );
      const copy=`${dimension.label} · ${row.label} · estimated completion ${percentLabel(estimate.mean,1)} · likely range ${evidenceIntervalLabel(estimate)} · ${row.effect>0?'+':''}${row.effect} points versus your overall work average`;
      chartHitRect(svg,left,y-14,plotWidth,28,copy,items);
    });
    return inspectedChart(svg,items,'Ranges show the clearest repeated completion patterns; the dashed marker is your overall work average.');
  }
  function allocationComparisonChart(allocation:RenderAllocation){
    const rows=allocation.displayRows??[];
    if(!allocation.ready||!rows.length)return evidenceNote('Allocation comparison needs stable area evidence.');
    const compact=isCompact(),width=compact?360:680,height=48+rows.length*38,left=compact?94:152,right=18,top=33,plotWidth=width-left-right;
    const svg=svgEl('svg',{class:'insights-chart insights-allocation-compare-chart',viewBox:`0 0 ${width} ${height}`,role:'group'});
    labelGraphic(svg,'Planned and completed area shares','Paired share lines for the largest lifetime differences between planned work and completed-equivalent work. Equal allocation is not assumed to be desirable.');
    const xFor=(value:number)=>left+clamp(num(value),0,100)/100*plotWidth,items:ChartHit[]=[];
    const legend=svgEl('text',{class:'axis-label strong',x:left,y:16});legend.textContent='Planned grey · completed cyan';svg.appendChild(legend);
    rows.forEach((row,index)=>{
      const y=top+index*38+8,label=svgEl('text',{class:'pattern-label',x:left-10,y:y+4,'text-anchor':'end'});
      label.textContent=String(row.label||'Area').slice(0,compact?13:24);svg.appendChild(label);
      svg.append(
        svgEl('line',{class:'allocation-plan',x1:left,y1:y-5,x2:xFor(row.plannedShare),y2:y-5}),
        svgEl('line',{class:'allocation-done',x1:left,y1:y+5,x2:xFor(row.completedShare),y2:y+5})
      );
      chartHitRect(svg,left,y-14,plotWidth,28,`${row.label} · planned ${percentLabel(row.plannedShare,1)} · completed-equivalent ${percentLabel(row.completedShare,1)} · ${row.gap>0?'+':''}${row.gap} share points`,items);
    });
    return inspectedChart(svg,items,'Largest planned-versus-completed share differences; this is descriptive, not a balance target.');
  }
  function renderPersistentPatternsCard(model:Model){
    const cardNode=el('section','insights-card soft ui-card insights-brain-card insights-dynamics-state-card');
    cardNode.appendChild(sectionTitle('1. What patterns keep repeating?','Shows recurring completion patterns and where completed work repeatedly differs from the plan.'));
    const bayesian:RenderBayesian=model.dynamics.bayesian;
    const allocation:RenderAllocation=model.dynamics.allocation;
    const patterns=strongestPatternReads(bayesian);
    const supporting=patterns.map(({dimension,row},index)=>({priority:90-index,label:dimension.label,value:`${row.label}: ${row.effect>0?'+':''}${row.effect} pts · ${percentLabel(row.estimate.mean,1)} (${evidenceIntervalLabel(row.estimate)})`}));
    const dynamic:RenderDynamicAllocation=allocation.dynamic??{};
    const dynamicTrend=dynamic.trend;
    let confidence={key:'weak',label:'Needs more history',tone:'low'},copy='No repeated completion or allocation pattern is stable enough to report yet.',meta=`${bayesian.actualStartBlocks||0} blocks with recorded starts`;
    if(dynamic.ready&&dynamic.persistentUnder){
      confidence=descriptiveEvidenceConfidence(dynamic.persistentUnder.periods,dynamic.persistentUnder.periods*120);
      copy=`${dynamic.persistentUnder.label} was under-allocated against plan in ${dynamic.persistentUnder.under}/${dynamic.persistentUnder.periods} completed eligible weeks.`;
      meta=`Mean gap ${dynamic.persistentUnder.meanGap} share pts`;
    }else if(patterns.length){
      const pattern=patterns[0];
      if(!pattern)return cardNode;
      const {dimension,row}=pattern;
      confidence=row.estimate.confidence;
      copy=`${row.label} is the clearest repeated ${dimension.label.toLowerCase()} completion pattern: ${Math.abs(row.effect)} points ${row.effect>=0?'above':'below'} your overall work average.`;
      meta=`${percentLabel(row.estimate.mean,1)} · ${evidenceIntervalLabel(row.estimate)} interval`;
    }else if(dynamic.ready&&dynamicTrend){
      const recentPeriods=num(dynamic.recentPeriods);
      confidence=descriptiveEvidenceConfidence(recentPeriods,recentPeriods*180);
      copy=`Weekly plan alignment is ${dynamicTrend.label.toLowerCase()}; no area shows a repeated material under-allocation pattern.`;
      meta=`${recentPeriods} recent eligible weeks · ${dynamic.trendBasis&&dynamic.trendBasis.label||'directional basis'}`;
    }else if(allocation.ready){
      confidence=allocation.confidence??{key:'weak',label:'Needs more history',tone:'low'};
      copy=`Lifetime completed-work allocation is ${String(allocation.label||'available').toLowerCase()}, but repeated weekly direction is not established.`;
      meta=`${allocation.areas} areas · overall plan-completion difference ${numberLabel(num(allocation.divergencePercent),1)}%`;
    }
    const left=[dynamicsRead(confidence,copy,meta)];
    if(dynamic.ready&&dynamic.persistentUnder)supporting.push({priority:110,label:'Repeated under-allocation',value:`${dynamic.persistentUnder.label} · ${dynamic.persistentUnder.under}/${dynamic.persistentUnder.periods} completed eligible weeks · mean ${dynamic.persistentUnder.meanGap} share pts`});
    else if(dynamic.ready&&dynamicTrend)supporting.push({priority:100,label:'Allocation direction',value:`${dynamicTrend.label}${finiteNumber(dynamicTrend.slope)?` · ${dynamicTrend.slope>0?'+':''}${dynamicTrend.slope} alignment-change pts/week`:''} · ${dynamic.trendBasis&&dynamic.trendBasis.label||'directional basis'}`});
    if(dynamic.provisionalPeriod)supporting.push({priority:72,label:'Current week · provisional',value:`${minutesLabel(dynamic.provisionalPeriod.planned)} planned · ${minutesLabel(dynamic.provisionalPeriod.completed)} completed-equivalent · excluded from persistence and trend`});
    if(allocation.ready){
      supporting.push({priority:70,label:'Plan breadth',value:`${numberLabel(num(allocation.effectivePlannedAreas),1)} planned → ${numberLabel(num(allocation.effectiveCompletedAreas),1)} completed-equivalent areas`});
      const shifts=[allocation.topOver?`${allocation.topOver.label} +${allocation.topOver.gap}`:'',allocation.topUnder?`${allocation.topUnder.label} ${allocation.topUnder.gap}`:''].filter(Boolean);
      if(shifts.length)supporting.push({priority:95,label:'Largest lifetime shifts',value:`${shifts.join(' · ')} share pts`});
    }
    const list=dynamicsSupportingList(supporting);
    if(list)left.push(list);
    else left.push(el('div','insights-dynamics-state-notes ui-mono','Repeated completion patterns and plan-alignment breadth are not yet established.'));
    const visual=el('div','insights-dynamics-visual-stack');
    if(patterns.length)visual.appendChild(Layout.chart(()=>persistentPatternChart(patterns,bayesian)));
    if(allocation.ready)visual.appendChild(Layout.chart(()=>allocationComparisonChart(allocation)));
    cardNode.appendChild(dynamicsCardColumns(left,visual.childElementCount?visual:null));
    return cardNode;
  }
  function dynamicsChangeRows(model:Model,{excludeInitialization=false}:{excludeInitialization?:boolean}={}){
    const regime:RenderChangePoint=model.dynamics.changePoint;
    const displayedCompletion=new Map(model.daily.filter(row=>isIsoDate(row.date)&&finiteNumber(row.completion)).map(row=>[row.date,row.completion]));
    const all=(regime.history||[]).filter(row=>finiteNumber(row.day)&&finiteNumber(row.recentChangeProbability))
      .map(row=>({...row,completion:finiteNumber(row.completion)?row.completion:displayedCompletion.get(row.date)}));
    const eligible=excludeInitialization?all.slice(Math.min(MIN_CHANGE_POINT_SEGMENT_DAYS,all.length)):all;
    const fromDay=isIsoDate(model.calendarRange&&model.calendarRange.start)?dateDay(model.calendarRange.start):null;
    const calendarToDay=isIsoDate(model.calendarRange&&model.calendarRange.end)?dateDay(model.calendarRange.end):null;
    const currentDay=isIsoDate(model.currentStudyDate)?dateDay(model.currentStudyDate):null;
    const toDay=[calendarToDay,currentDay].filter(finiteNumber).sort((a,b)=>b-a)[0];
    const selected=eligible.filter(row=>(!finiteNumber(fromDay)||row.day>=fromDay)&&(!finiteNumber(toDay)||row.day<=toDay));
    return (selected.length?selected:eligible).slice(-(isCompact()?45:120));
  }
  function dynamicsPhaseChart(model:Model){
    const regime:RenderChangePoint=model.dynamics.changePoint,rows=dynamicsChangeRows(model);
    const compact=isCompact(),width=compact?360:700,height=compact?206:224,pad=compact?50:42,right=compact?10:20;
    const {svg,plotRight,plotBottom,plotWidth,plotHeight}=chartFrame(width,height,pad,right);
    svg.classList.add('insights-dynamics-phase');
    labelGraphic(svg,'Daily completion and performance phases','Daily completion is shown as dots and the estimated longer-running performance phase as a line.');
    if(!rows.length)return chartEmpty(svg,'No completion-phase history',width/2,height/2,'middle');
    const first=rows[0],last=rows[rows.length-1];if(!first||!last)return chartEmpty(svg,'No completion-phase history',width/2,height/2,'middle');
    const start=first.day,end=last.day,span=Math.max(1,end-start),xFor=(day:number)=>pad+(day-start)/span*plotWidth;
    const yFor=(value:number|null|undefined)=>plotBottom-clamp(num(value),0,100)/100*plotHeight;
    [0,50,100].forEach(value=>{const y=yFor(value);svg.appendChild(svgEl('line',{class:'grid',x1:pad,y1:y,x2:plotRight,y2:y}));const label=svgEl('text',{class:'axis-label',x:pad-6,y:y+4,'text-anchor':'end'});label.textContent=percentLabel(value,0);svg.appendChild(label);});
    svg.appendChild(svgEl('polyline',{class:'phase-line',points:rows.filter(row=>Number.isFinite(row.regimeMean)).map(row=>`${xFor(row.day)},${yFor(row.regimeMean)}`).join(' ')}));
    const items:ChartHit[]=[];
    rows.forEach(row=>{
      if(finiteNumber(row.completion))svg.appendChild(svgEl('circle',{class:'phase-dot chart-point-phase',cx:xFor(row.day),cy:yFor(row.completion),r:2.5}));
      const copy=`${shortDate(row.date)} · completion ${percentLabel(row.completion,1)} · estimated phase ${percentLabel(row.regimeMean,1)} · recent change likelihood ${percentLabel(row.recentChangeProbability*100,1)}`;
      chartHitCircle(svg,xFor(row.day),yFor(finiteNumber(row.completion)?row.completion:row.regimeMean),copy,items,9);
    });
    if(regime.detected&&isIsoDate(regime.date)){const changeDay=dateDay(regime.date);if(finiteNumber(changeDay)&&changeDay>=start&&changeDay<=end){const x=xFor(changeDay);svg.appendChild(svgEl('line',{class:'fitness-change',x1:x,y1:pad,x2:x,y2:plotBottom}));}}
    const legend=svgEl('text',{class:'axis-label strong',x:pad,y:17});legend.textContent=compact?'Completion • · phase —':'Daily completion • · estimated phase —';svg.appendChild(legend);
    [first,last].forEach((row,index)=>{const label=svgEl('text',{class:'axis-label',x:xFor(row.day),y:plotBottom+20,'text-anchor':index?'end':'start'});label.textContent=shortDate(row.date);svg.appendChild(label);});
    return inspectedChart(svg,items,regime.detected?`A credible phase change is marked near ${shortDate(regime.date)}.`:'No performance-phase change currently clears both likelihood and size gates.');
  }
  function dynamicsChangeProbabilityStrip(model:Model){
    const rows=dynamicsChangeRows(model,{excludeInitialization:true});
    const compact=isCompact(),width=compact?360:700,height=78,left=compact?34:42,right=compact?10:20,top=17,bottom=18,plotRight=width-right,plotBottom=height-bottom,plotWidth=plotRight-left,plotHeight=plotBottom-top;
    const svg=svgEl('svg',{class:'insights-chart insights-dynamics-change-strip',viewBox:`0 0 ${width} ${height}`,role:'group'});
    labelGraphic(svg,'Likelihood of a recent performance change','Shows whether the recent pattern differs enough from the preceding phase to count as a meaningful change. Early setup observations are excluded.');
    if(!rows.length)return chartEmpty(svg,'Change evidence needs more eligible days',width/2,height/2,'middle');
    const first=rows[0],last=rows[rows.length-1];if(!first||!last)return chartEmpty(svg,'Change evidence needs more eligible days',width/2,height/2,'middle');
    const start=first.day,end=last.day,span=Math.max(1,end-start),xFor=(day:number)=>left+(day-start)/span*plotWidth;
    const scaleMax=Math.min(1,Math.max(BOCPD_DETECTION_PROBABILITY,...rows.map(row=>num(row.recentChangeProbability))));
    const yFor=(value:number)=>plotBottom-clamp(num(value),0,scaleMax)/scaleMax*plotHeight;
    svg.appendChild(svgEl('line',{class:'axis',x1:left,y1:plotBottom,x2:plotRight,y2:plotBottom}));
    const thresholdY=yFor(BOCPD_DETECTION_PROBABILITY);svg.appendChild(svgEl('line',{class:'regime-threshold',x1:left,y1:thresholdY,x2:plotRight,y2:thresholdY}));
    svg.appendChild(svgEl('polyline',{class:'regime-line',points:rows.map(row=>`${xFor(row.day)},${yFor(row.recentChangeProbability)}`).join(' ')}));
    const items:ChartHit[]=[];
    rows.forEach(row=>chartHitCircle(svg,xFor(row.day),yFor(row.recentChangeProbability),`${shortDate(row.date)} · change likelihood ${percentLabel(row.recentChangeProbability*100,1)} · evidence threshold ${percentLabel(BOCPD_DETECTION_PROBABILITY*100,0)}`,items,8));
    const label=svgEl('text',{class:'axis-label strong',x:left,y:11});label.textContent=`Change likelihood · threshold ${percentLabel(BOCPD_DETECTION_PROBABILITY*100,0)}`;svg.appendChild(label);
    return inspectedChart(svg,items,'Early setup observations are excluded so they do not overstate later change.');
  }
  function renderWhatChangedCard(model:Model){
    const change:RenderChangePoint=model.dynamics.changePoint,cardNode=el('section','insights-card soft ui-card insights-brain-card insights-dynamics-change-card');
    cardNode.appendChild(sectionTitle('2. What changed recently?','Compares recent completion with the preceding performance phase and withholds a conclusion when the shift is unclear.'));
    const detected=!!(change.detected&&finiteNumber(change.delta)&&isIsoDate(change.date));
    const copy=detected
      ? `A likely ${num(change.delta)>=0?'upward':'downward'} completion phase began near ${shortDate(change.date)}: ${percentLabel(change.beforeMean,1)} before versus ${percentLabel(change.afterMean,1)} after. The estimated likelihood of a real shift reached ${percentLabel(change.probability,1)}.`
      : change.reason||'No clear performance-phase change is present.';
    const left=[dynamicsRead(change.confidence??{key:'weak',label:'Needs more history',tone:'low'},copy,detected?`${num(change.delta)>0?'+':''}${num(change.delta)} pts`:`Latest ${percentLabel(change.latestProbability,1)}`)];
    const supporting=[];
    if(finiteNumber(change.currentRunLength))supporting.push({priority:80,label:'Current phase length',value:`About ${num(change.currentRunLength)+1} completion-eligible day${change.currentRunLength===0?'':'s'}`});
    if(finiteNumber(change.currentRegimeMean))supporting.push({priority:70,label:'Current phase average',value:percentLabel(change.currentRegimeMean,1)});
    if(finiteNumber(change.latestProbability))supporting.push({priority:100,label:'Latest change likelihood',value:`${percentLabel(change.latestProbability,1)} · gate ${percentLabel(change.threshold&&change.threshold.probability,0)}`});
    if(detected&&finiteNumber(change.beforeMean)&&finiteNumber(change.afterMean))supporting.push({priority:110,label:'Before → after',value:`${percentLabel(change.beforeMean,1)} → ${percentLabel(change.afterMean,1)} · ${num(change.delta)>0?'+':''}${num(change.delta)} pts`});
    const list=dynamicsSupportingList(supporting);
    if(list)left.push(list);
    const visual=el('div','insights-dynamics-visual-stack');
    visual.append(Layout.chart(()=>dynamicsPhaseChart(model)),Layout.chart(()=>dynamicsChangeProbabilityStrip(model)));
    cardNode.appendChild(dynamicsCardColumns(left,visual));
    return cardNode;
  }
  function sequenceHazardChart(cascade:RenderCascade){
    const adjusted:RenderCascadeAdjusted=cascade.adjusted??{},hazard:RenderHazard=adjusted.hazard??{},curve:readonly HazardCurveRow[]=hazard.curve??[];
    const compact=isCompact(),width=compact?360:620,height=220,pad=42,right=20;
    const {svg,plotRight,plotBottom}=chartFrame(width,height,pad,right);svg.classList.add('insights-hazard-chart');
    labelGraphic(svg,'Breakdown risk by planned block position','Estimated risk that each planned position begins a missed end-of-day tail, after accounting for the other recorded factors.');
    if(!curve.length||!curve.some(row=>Number.isFinite(row.estimate.mean)))return chartEmpty(svg,'Breakdown risk needs more comparable days',width/2,height/2,'middle');
    const yFor=(value:number|null|undefined)=>valueToY(num(value),0,Math.max(25,...curve.map(row=>num(row.estimate.high))),height,pad),step=(plotRight-pad)/Math.max(1,curve.length);
    const items:ChartHit[]=[];
    curve.forEach((row,index)=>{
      const x=pad+step*(index+.5),barWidth=Math.max(12,step*.48),y=yFor(row.estimate.mean),bottom=plotBottom;
      svg.appendChild(svgEl('rect',{class:'hazard-bar',x:x-barWidth/2,y,width:barWidth,height:Math.max(1,bottom-y)}));
      const copy=`${row.label} planned position · estimated breakdown risk ${percentLabel(row.estimate.mean,1)} · likely range ${percentLabel(row.estimate.low,0)}–${percentLabel(row.estimate.high,0)}`;
      chartHitRect(svg,x-step/2,pad,step,plotBottom-pad,copy,items);
      const label=svgEl('text',{class:'axis-label',x,y:plotBottom+19,'text-anchor':'middle'});label.textContent=row.label;svg.appendChild(label);
    });
    return inspectedChart(svg,items,'Select a position to inspect its estimated breakdown risk.');
  }
  function renderWhatBreaksCard(model:Model){
    const cascade:RenderCascade=model.dynamics.cascade,adjusted:RenderCascadeAdjusted=cascade.adjusted??{},cardNode=el('section','insights-card soft ui-card insights-brain-card insights-dynamics-break-card');
    cardNode.appendChild(sectionTitle('3. Where does the day tend to break down?','Looks for recorded conditions that tend to precede a weak next block or a missed end of day. These are associations, not proof of cause.'));
    const confidence=adjusted.primary?.confidence??cascade.confidence??{key:'weak',label:'Needs more history',tone:'low'};
    const copy=cascade.primary&&cascade.primary.text||adjusted.reason||'No recorded sequence factor is consistent enough to report yet.';
    const left=[dynamicsRead(confidence,copy,`${cascade.transitions||0} block transitions · ${(adjusted.hazard&&adjusted.hazard.events)||0} end-of-day breakdowns`)];
    const transitionLabels:Readonly<Record<string,string>>={strong:'After strong',attempted:'After partial',missed:'After missed'};
    const supporting=(cascade.transitionRows||[]).filter(row=>row.total>0).map(row=>({priority:row.key==='missed'?95:row.key==='attempted'?85:65,label:transitionLabels[row.key]||row.label,value:`${percentLabel(row.estimate&&row.estimate.mean,1)} next block strong · n=${row.total}`}));
    const interactions=model.dynamics&&model.dynamics.interactions||{};
    (interactions.shown||[]).forEach((interaction,index)=>supporting.push({priority:110-index,label:'Combined pattern',value:interaction.text}));
    if(cascade.peakHazard)supporting.push({priority:90,label:'Most vulnerable position',value:`${cascade.peakHazard.label} block · ${cascade.peakHazard.collapses}/${cascade.peakHazard.daysAtRisk} missed end-of-day tails · ${percentLabel(cascade.peakHazard.estimate&&cascade.peakHazard.estimate.mean,1)}`});
    const list=dynamicsSupportingList(supporting);
    if(list)left.push(list);
    const visual=adjusted.hazard&&adjusted.hazard.ready
      ? Layout.chart(()=>sequenceHazardChart(cascade))
      : evidenceNote(adjusted.hazard&&adjusted.hazard.reason||'Breakdown risk waits until enough breakdown and non-breakdown days can be compared fairly.');
    cardNode.appendChild(dynamicsCardColumns(left,visual));
    return cardNode;
  }
  function workloadPointAt(workload:RenderWorkload,planned:number):WorkloadPoint|null{
    const forecast:RenderForecast=workload.forecast??Object.freeze({});
    const source:readonly WorkloadCurveRow[]=forecast.completionReady&&workload.forecastCurve?.length?workload.forecastCurve:workload.curve??[];
    const curve=source.slice().sort((a,b)=>a.planned-b.planned);
    const first=curve[0],last=curve[curve.length-1];
    if(!first||!last)return null;
    const from=(row:WorkloadCurveRow,value:number):WorkloadPoint=>({
      planned:value,
      completionMean:finiteNumber(row.completionMean)?row.completionMean:null,
      completionLow:finiteNumber(row.completionLow)?row.completionLow:null,
      completionHigh:finiteNumber(row.completionHigh)?row.completionHigh:null,
      strongProbability:finiteNumber(row.strongProbability)?row.strongProbability:null,
      strongLow:finiteNumber(row.strongLow)?row.strongLow:null,
      strongHigh:finiteNumber(row.strongHigh)?row.strongHigh:null,
      expectedCompleted:finiteNumber(row.expectedCompleted)?row.expectedCompleted:null
    });
    if(planned<=first.planned)return from(first,planned);
    if(planned>=last.planned)return from(last,planned);
    const upperIndex=curve.findIndex(point=>point.planned>=planned),lower=curve[upperIndex-1],upper=curve[upperIndex];
    if(!lower||!upper)return null;
    const ratio=(planned-lower.planned)/Math.max(1,upper.planned-lower.planned);
    const interpolate=(key:'completionMean'|'completionLow'|'completionHigh'|'strongProbability'|'strongLow'|'strongHigh'|'expectedCompleted')=>{
      const low=lower[key],high=upper[key];
      return finiteNumber(low)&&finiteNumber(high)?low+ratio*(high-low):null;
    };
    return {
      planned,
      completionMean:interpolate('completionMean'),completionLow:interpolate('completionLow'),completionHigh:interpolate('completionHigh'),
      strongProbability:interpolate('strongProbability'),strongLow:interpolate('strongLow'),strongHigh:interpolate('strongHigh'),
      expectedCompleted:interpolate('expectedCompleted')
    };
  }
  function workloadObservationInDisplayWindow(observation:NonNullable<RenderWorkload['observations']>[number],model:Model){
    const day=dateDay(observation&&observation.date);
    if(!finiteNumber(day))return false;
    const from=isIsoDate(model.calendarRange&&model.calendarRange.start)?dateDay(model.calendarRange.start):null;
    const calendarTo=isIsoDate(model.calendarRange&&model.calendarRange.end)?dateDay(model.calendarRange.end):null;
    const current=isIsoDate(model.currentStudyDate)?dateDay(model.currentStudyDate):null;
    const to=[calendarTo,current].filter(finiteNumber).sort((a,b)=>b-a)[0];
    return (!finiteNumber(from)||day>=from)&&(!finiteNumber(to)||day<=to);
  }
  function evenlySampleRows<T>(rows:readonly T[],limit:number):T[]{
    const source=rows;
    if(source.length<=limit)return source.slice();
    if(limit<=1){const last=source[source.length-1];return last===undefined?[]:[last];}
    return [...new Set(Array.from({length:limit},(_,index)=>Math.round(index*(source.length-1)/(limit-1))))].flatMap(index=>{const row=source[index];return row===undefined?[]:[row];});
  }
  function prioritizedChartPoints<T extends {day?:number|null;date?:string}>(rows:readonly T[],limit:number,isSelected:(row:T)=>boolean){
    const source=rows,points=source.map(row=>{const selected=!!isSelected(row),day=finiteNumber(row.day)?row.day:dateDay(row.date);return Object.freeze({row,selected,day:num(day)});});
    const selected=points.filter(point=>point.selected),older=points.filter(point=>!point.selected);
    const shownSelected=selected.length<=limit?selected.slice():evenlySampleRows(selected,limit);
    const remaining=Math.max(0,limit-shownSelected.length),shownOlder=remaining?evenlySampleRows(older,remaining):[];
    const shown=[...shownOlder,...shownSelected].sort((a,b)=>a.day-b.day);
    return {points:shown,shown:shown.length,total:points.length};
  }
  function workloadChartObservations(workload:RenderWorkload,model:Model,compact:boolean){
    const all:readonly NonNullable<RenderWorkload['observations']>[number][]=workload.observations??[];
    const limit=compact?MAX_WORKLOAD_HISTORY_POINTS_COMPACT:MAX_WORKLOAD_HISTORY_POINTS_DESKTOP;
    return prioritizedChartPoints(all,limit,row=>workloadObservationInDisplayWindow(row,model));
  }
  function workloadResponseChart(workload:RenderWorkload,model:Model){
    const curve=workload&&workload.curve||[],compact=isCompact(),width=compact?360:720,height=250,pad=compact?50:42,right=18;
    const {svg,plotRight,plotBottom}=chartFrame(width,height,pad,right);svg.classList.add('insights-response-chart');
    const strongReady=!!(workload&&workload.capabilities&&workload.capabilities.strong&&workload.capabilities.strong.ready),observationView=workloadChartObservations(workload,model,compact);
    labelGraphic(svg,'Workload and likely completion',strongReady?'Planned work is on the horizontal axis. Actual days anchor the estimated completion and 80%+ day curves; shading shows the likely range.':'Planned work is on the horizontal axis. Actual days anchor the estimated completion curve; shading shows the likely range. The 80%+ day chance waits for enough varied outcomes.');
    if(!curve.length)return chartEmpty(svg,'Need more varied planned-work days',width/2,height/2,'middle');
    const first=curve[0],last=curve[curve.length-1];if(!first||!last)return chartEmpty(svg,'Need more varied planned-work days',width/2,height/2,'middle');
    const min=first.planned,max=last.planned,xFor=(value:number)=>pad+(value-min)/Math.max(1,max-min)*(plotRight-pad),yFor=(value:number|null|undefined)=>valueToY(num(value),0,100,height,pad);
    [0,50,80,100].forEach(value=>{const y=yFor(value);svg.appendChild(svgEl('line',{class:'grid',x1:pad,y1:y,x2:plotRight,y2:y}));const label=svgEl('text',{class:'axis-label',x:pad-6,y:y+4,'text-anchor':'end'});label.textContent=`${value}%`;svg.appendChild(label);});
    const items:ChartHit[]=[];
    observationView.points.forEach(point=>{
      const observation=point.row,selected=point.selected,x=xFor(observation.planned),y=yFor(observation.completion);
      svg.appendChild(svgEl('circle',{class:`response-observation ${selected?'chart-point-lg selected-window':'chart-point-sm'}`,cx:x,cy:y,r:selected?3.1:2.3}));
      const copy=`${shortDate(observation.date)} · planned ${minutesLabel(observation.planned)} · completion ${percentLabel(observation.completion,1)} · completed-equivalent ${minutesLabel(observation.completed)}${selected?' · inside selected display window':' · older model-history day'}`;
      chartHitCircle(svg,x,y,copy,items,selected?10:8);
      if(selected){const latest=items[items.length-1];if(latest)latest.initial=true;}
    });
    (workload.empiricalBands||[]).forEach(band=>{
      const y=yFor(band.meanCompletion),x1=xFor(band.minPlanned),x2=xFor(band.maxPlanned),x=xFor(band.meanPlanned);
      svg.append(svgEl('line',{class:'response-empirical-band',x1,y1:y,x2,y2:y}),svgEl('circle',{class:'response-empirical-point chart-point-empirical',cx:x,cy:y,r:3.6}));
      const copy=`${band.label} observed workload band · ${band.days} days · planned ${minutesLabel(band.minPlanned)}–${minutesLabel(band.maxPlanned)} · mean completion ${percentLabel(band.meanCompletion,1)} · expected completed work ${minutesLabel(band.expectedCompleted)}`;
      chartHitRect(svg,Math.min(x1,x2),y-7,Math.max(12,Math.abs(x2-x1)),14,copy,items);
    });
    const band=curve.map(point=>`${xFor(point.planned)},${yFor(point.completionHigh)}`).concat(curve.slice().reverse().map(point=>`${xFor(point.planned)},${yFor(point.completionLow)}`));
    svg.append(svgEl('polygon',{class:'response-band',points:band.join(' ')}),svgEl('polyline',{class:'response-completion',points:curve.map(point=>`${xFor(point.planned)},${yFor(point.completionMean)}`).join(' ')}));
    if(strongReady)svg.appendChild(svgEl('polyline',{class:'response-strong',points:curve.map(point=>`${xFor(point.planned)},${yFor(point.strongProbability)}`).join(' ')}));
    const selected=workload.recommendation,forecast:RenderForecast=workload.forecast??{},scenario=finiteNumber(forecast.scenarioPlanned)?forecast:null;
    if(selected)svg.appendChild(svgEl('circle',{class:'frontier-point selected chart-point-onset',cx:xFor(num(selected.typicalPlanned)),cy:yFor(num(selected.completionMean)),r:6}));
    if(scenario&&finiteNumber(scenario.scenarioPlanned))svg.appendChild(svgEl('line',{class:'scenario-line',x1:xFor(scenario.scenarioPlanned),y1:pad,x2:xFor(scenario.scenarioPlanned),y2:plotBottom}));
    [first,last].forEach((point,index)=>{const label=svgEl('text',{class:'axis-label',x:xFor(point.planned),y:plotBottom+20,'text-anchor':index?'end':'start'});label.textContent=minutesLabel(point.planned);svg.appendChild(label);});
    const legend=svgEl('text',{class:'axis-label strong',x:pad,y:17});
    legend.textContent=compact
      ? strongReady?'Completion — · strong ··· · actual •':'Completion — · actual • · bands –'
      : strongReady?'Estimated completion — · 80%+ day ··· · actual days • · observed bands –':'Estimated completion — · actual days • · observed bands –';
    svg.appendChild(legend);
    const inspection=scenario
      ? `${minutesLabel(scenario.scenarioPlanned)} scenario · completion ${percentLabel(scenario.completionMean,1)}${scenario.strongReady?` · strong-day chance ${percentLabel(scenario.strongProbability,1)}`:' · strong-day probability unavailable'}. ${observationView.shown}/${observationView.total} actual days are plotted; select a day or band to inspect the raw evidence.`
      : `Historical workload curve; ${String(workload&&workload.calibration&&workload.calibration.label||'reliability checks pending').toLowerCase()}. ${observationView.shown}/${observationView.total} actual days are plotted; select a day or band to inspect the underlying evidence.`;
    return inspectedChart(svg,items,inspection);
  }
  function renderPlanningCard(model:Model){
    const workload:RenderWorkload=model.dynamics.workload,cardNode=el('section','insights-card soft ui-card insights-brain-card insights-dynamics-planning-card');
    cardNode.appendChild(sectionTitle('4. What workload is realistic?','Uses your past planned and completed work to identify a personally supportable range, while withholding forecasts that are not reliable enough.'));
    if(!workload.ready){
      cardNode.appendChild(dynamicsCardColumns(
        dynamicsRead({key:'weak',label:'Needs more history',tone:'low'},workload.reason||'Need more varied workload evidence.',`${workload.days||0} days · ${minutesLabel(workload.span||0)} span`),
        null
      ));
      return cardNode;
    }
    const forecast:RenderForecast=workload.forecast??{},recommendation=workload.recommendation;
    if(!recommendation){
      cardNode.appendChild(dynamicsCardColumns(
        dynamicsRead({key:'weak',label:'Range not ready',tone:'low'},workload.recommendationReason||'A workload pattern is visible, but no well-supported planning range is available yet.',`${workload.days||0} days · ${minutesLabel(workload.span||0)} span`),
        Layout.chart(()=>workloadResponseChart(workload,model))
      ));
      return cardNode;
    }
    const range=`${minutesLabel(recommendation.minPlanned)}–${minutesLabel(recommendation.maxPlanned)}`;
    const calibration:RenderCalibration=forecast.calibration??workload.calibration??Object.freeze({});
    const completionAbstention=forecast.completionReason||calibration.completionReason||`Only ${calibration.backtests||0}/${MIN_FORECAST_BACKTESTS} qualifying rolling completion forecasts are available.`;
    const strongUnavailable=workload.capabilities&&workload.capabilities.strong&&!workload.capabilities.strong.ready
      ? workload.capabilities.strong.reason
      : forecast.strongReason||calibration.strongReason;
    let readText,readMeta,readConfidence;
    if(forecast.completionReady){
      const rangeName=forecast.rangeReady?'a backtest-checked 80% range':'an estimated model range';
      readText=`For the editable next-plan scenario, expected completion is ${percentLabel(forecast.completionMean,1)} with ${rangeName} of ${percentLabel(forecast.completionLow,0)}–${percentLabel(forecast.completionHigh,0)}.`;
      if(!forecast.rangeReady&&forecast.rangeReason)readText+=` The range is not yet labelled 80% because its historical coverage check has not passed.`;
      readText+=forecast.strongReady?` The estimated chance of an 80%+ day is ${percentLabel(forecast.strongProbability,1)}.`:` The 80%+ day chance is withheld: ${strongUnavailable||'both outcomes are not yet sufficiently represented.'}`;
      readMeta=`${forecast.modelLabel||calibration.selectedModelLabel||'Forecast'} · ${calibration.backtests} past-day tests · ${forecast.scenarioSupport} nearby workload days${forecast.rangeReady?` · range covered ${percentLabel(forecast.rangeCoverage,1)} in ${forecast.rangeBacktests} checks`:''}`;
      readConfidence=recommendation.confidence;
    }else{
      readText=`The workload curve is available, but next-plan completion guidance is not reliable enough yet. ${completionAbstention}`;
      if(strongUnavailable)readText+=` Strong-day probability is separately withheld: ${strongUnavailable}`;
      readMeta=range;
      readConfidence={key:'emerging',label:calibration.label||'Calibration pending',tone:'watch'};
    }
    const left=[dynamicsRead(readConfidence,readText,readMeta)];
    const supporting=[
      {priority:80,label:'Evidence base',value:`${workload.days} eligible days · ${minutesLabel(workload.span)} workload span · ${(workload.empiricalBands||[]).length} observed workload bands`},
      {priority:95,label:'Realistic-range anchor',value:`${minutesLabel(recommendation.typicalPlanned)} plan · ${percentLabel(recommendation.completionMean,1)} completion · ${minutesLabel(recommendation.expectedCompleted)} completed-equivalent · ${recommendation.localSupport} nearby days`}
    ];
    if(forecast.completionReady)supporting.push({priority:110,label:'Estimate method',value:`${forecast.modelLabel} · ${forecast.selectionReason||calibration.selectionReason||'selected using rolling past-day tests'}`});
    if(Number.isFinite(recommendation.strongProbability))supporting.push({priority:70,label:'Strong-day estimate',value:`${percentLabel(recommendation.strongProbability,1)} at the realistic-range anchor`});
    if(workload.anchorBand)supporting.push({priority:90,label:'Nearby raw band',value:`${minutesLabel(workload.anchorBand.minPlanned)}–${minutesLabel(workload.anchorBand.maxPlanned)} · ${percentLabel(workload.anchorBand.meanCompletion,1)} mean completion · n=${workload.anchorBand.days}`});
    const supportingList=dynamicsSupportingList(supporting);
    if(supportingList)left.push(supportingList);
    if(workload.tradeoff){
      const reliability=Number.isFinite(workload.tradeoff.reliabilityDrop)?` and strong-day probability ${workload.tradeoff.reliabilityDrop} points`:'';
      left.push(evidenceNote(`Estimated trade-off: at ${minutesLabel(workload.tradeoff.high.planned)}, expected completion is ${workload.tradeoff.completionDrop} points${reliability} below the lower-load comparison. This remains association, not causal proof.`,'insights-lab-caution'));
    }
    const curve=workload.curve||[],firstCurve=curve[0],lastCurve=curve[curve.length-1];
    if(!firstCurve||!lastCurve)return cardNode;
    const minimum=firstCurve.planned,maximum=lastCurve.planned;
    const scenario=el('div','insights-dynamics-scenario ui-inset');
    const label=el('div','insights-dynamics-scenario-label ui-label','Next-plan scenario');
    const value=el('div','insights-dynamics-scenario-value ui-mono');
    const slider=el('input','insights-dynamics-scenario-slider');slider.type='range';slider.min=String(minimum);slider.max=String(maximum);slider.step='15';slider.value=String(clamp(forecast.scenarioPlanned,minimum,maximum));slider.setAttribute('aria-label','Next plan workload scenario in minutes');
    const result=el('div','insights-dynamics-scenario-result ui-mono');
    const update=()=>{
      const point=workloadPointAt(workload,num(slider.value));if(!point)return;value.textContent=minutesLabel(point.planned);
      const strongPart=Number.isFinite(point.strongProbability)?` · 80%+ day chance ${percentLabel(point.strongProbability,1)}`:` · 80%+ day chance unavailable`;
      const rangeText=forecast.rangeReady?'backtest-checked 80% range':'estimated model range';
      result.textContent=`Expected completion ${percentLabel(point.completionMean,1)} (${percentLabel(point.completionLow,0)}–${percentLabel(point.completionHigh,0)} ${rangeText})${strongPart} · expected completed work ${minutesLabel(point.expectedCompleted)}${forecast.completionReady?'':` · checks pending`}`;
    };
    slider.addEventListener('input',update);scenario.append(label,value,slider,result);update();left.push(scenario);
    left.push(evidenceNote(`Realistic workload range: ${range}. The scenario stays within workloads represented in your saved history; completion and 80%+ day estimates are withheld independently when evidence is weak.`));
    cardNode.appendChild(dynamicsCardColumns(left,Layout.chart(()=>workloadResponseChart(workload,model))));
    return cardNode;
  }
  function dynamicsSummaryMeta(model:Model){
    const dynamics=model.dynamics||{};
    const parts=[];
    if(dynamics.changePoint&&dynamics.changePoint.detected)parts.push(`change likelihood ${percentLabel(dynamics.changePoint.probability,0)}`);
    if(dynamics.workload&&dynamics.workload.forecast&&dynamics.workload.forecast.completionReady)parts.push('next-plan estimate ready');
    if(!parts.length&&dynamics.bayesian&&dynamics.bayesian.readyDimensions)parts.push(`${dynamics.bayesian.readyDimensions} completion-pattern groups ready`);
    const history=dynamics.history||{};
    const basis=history.records?`All ${history.records} saved day${history.records===1?'':'s'}`:'All saved history';
    return `${basis} · display ${String(model.windowLabel||'selected window').toLowerCase()} · ${parts.join(' · ')||'building careful evidence'}`;
  }
  function renderStudyDynamics(model:Model){
    const summary=el('summary'),copy=el('span','insights-brain-summary-copy');
    copy.append(el('span','insights-brain-summary-title ui-label','Study Dynamics'),el('span','insights-brain-summary-meta ui-mono',dynamicsSummaryMeta(model)));
    summary.appendChild(copy);
    return lazyDisclosure('insights-brain ui-disclosure',summary,()=>{
      const body=el('div','insights-brain-body'),grid=el('div','insights-brain-grid');
      body.appendChild(el('div','insights-brain-intro ui-mono','Study Dynamics looks across your saved days for four useful signals: patterns that keep repeating, recent changes, common breakdown points, and a workload you can realistically complete. It withholds findings when the evidence is too weak; open Analytics Lab if you want to inspect the supporting data.'));
      grid.append(renderPersistentPatternsCard(model),renderWhatChangedCard(model),renderWhatBreaksCard(model),renderPlanningCard(model));
      body.appendChild(grid);
      return body;
    },true);
  }
    return Object.freeze({
      Layout,clusterHeader,completionStabilityChart,el,evidenceIntervalLabel,evidenceNote,injectStyles,kvItem,
      lazyDisclosure,planRealismScatter,qualityCorrelationEvidence,renderAreaConversionEvidence,renderCoach,
      renderDemoBanner,renderEmptyState,renderExecutionSurface,renderMetrics,renderSectionNavigation,
      renderStudyDynamics,renderStudyFitnessReport,renderSubjectCoverage,renderTrainingLog,renderVisuals,
      renderWindowSelector,sectionTitle
    });

}
export type InsightsRenderingRuntime=ReturnType<typeof createInsightsRendering>;
export type InsightsRenderingModel=InsightsResult;
