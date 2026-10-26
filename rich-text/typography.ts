/* Study Director typography extension boundary.
 * Native Wordgard primitives are preferred. Only missing block typography
 * (font size, line height, justify) is implemented here. */
import {
  Alignment,ChangeSet,Plot,Command,GardState,Heading,Mark,Node,Paragraph,Transaction,
  parse,selectedTextblocks,setAlignment,setTextblockType,
} from './wordgard-adapter';

export type TypographyPreset='N'|'H1'|'H2';
export type TypographyAlignment='left'|'center'|'right'|'justify';
export type TypographyStep=-1|1;

export const FONT_SIZE_MIN=10;
export const FONT_SIZE_MAX=48;
export const LINE_HEIGHT_STEPS=Object.freeze([1,1.15,1.3,1.55,1.75,2] as const);

function validFontSize(value:number){return Number.isInteger(value)&&value>=FONT_SIZE_MIN&&value<=FONT_SIZE_MAX}
function validLineHeight(value:number){return LINE_HEIGHT_STEPS.some(step=>Math.abs(step-value)<0.0001)}
function parsedNumber(value:string){const number=Number(value);return Number.isFinite(number)?number:null}
function fontSizeFromCss(value:string){const match=/^([0-9]+(?:\.[0-9]+)?)px$/i.exec(value.trim());if(!match)return null;const number=Math.round(Number(match[1]));return validFontSize(number)?number:null}
function lineHeightFromCss(value:string){const number=parsedNumber(value.trim());if(number===null||number<LINE_HEIGHT_STEPS[0]||number>LINE_HEIGHT_STEPS[5])return null;return LINE_HEIGHT_STEPS.reduce((best,step)=>Math.abs(step-number)<Math.abs(best-number)?step:best,LINE_HEIGHT_STEPS[0])}

export const SDFontSize=Mark.Type.define<number>('SDFontSize',{
  target:Node.Group.Textblock,keepOnSplit:true,keepOnTypeChange:true,
  validate:value=>{if(!validFontSize(value))throw new RangeError('Invalid font size.')},
  shape:{attribute:'style/font-size',value:value=>`${value}px`},
  parseRules:[{attribute:'style/font-size',readAttribute:value=>fontSizeFromCss(value)??parse.Reject}],
});

export const SDLineHeight=Mark.Type.define<number>('SDLineHeight',{
  target:Node.Group.Textblock,keepOnSplit:true,keepOnTypeChange:true,
  validate:value=>{if(!validLineHeight(value))throw new RangeError('Invalid line spacing.')},
  shape:{attribute:'style/line-height',value:value=>String(value)},
  parseRules:[{attribute:'style/line-height',readAttribute:value=>lineHeightFromCss(value)??parse.Reject}],
});

export const SDJustify=Mark.define('SDJustify',{
  target:Node.Group.Textblock,keepOnSplit:true,keepOnTypeChange:true,
  shape:{attribute:'style/text-align',value:'justify'},
  parseRules:[{attribute:'style/text-align',value:'justify'}],
});

export const TYPOGRAPHY_SCHEMA_ELEMENTS=Object.freeze([Alignment,SDFontSize,SDLineHeight,SDJustify]);

function presetTag(preset:TypographyPreset){return preset==='H1'?Heading.of(1):preset==='H2'?Heading.of(2):Paragraph}
function presetForTag(tag:Plot.Tag | undefined):TypographyPreset{return tag&&tag.type===Heading&&Number(tag.param)===1?'H1':tag&&tag.type===Heading&&Number(tag.param)===2?'H2':'N'}
function baseFontSize(tag:Plot.Tag | undefined){const preset=presetForTag(tag);return preset==='H1'?21:preset==='H2'?18:15}
function baseLineHeight(tag:Plot.Tag | undefined){const preset=presetForTag(tag);return preset==='H1'?1.3:preset==='H2'?1.35:1.55}
function merge(state:GardState,a:false|Transaction.Spec,b:false|Transaction.Spec){return !a?b:!b?a:Transaction.merge(state,a,b)}

function numericMarkSpec(state:GardState,type:Mark.Type<number>,value:number|null,userEvent:string,defaultFor:(tag:Plot.Tag | undefined)=>number):false|Transaction.Spec{
  if(state.readOnly)return false;
  const changes:ChangeSet.Spec[]=[];
  for(const block of selectedTextblocks(state)){
    if(!state.schema.markAllowed(type,block.node.type))continue;
    const current=block.node.tag.mark(type),next=value!==null&&Math.abs(value-defaultFor(block.node.tag))>0.0001?value:null;
    if(next===null){if(current!==undefined)changes.push({from:block.before,remove:type.of(current)});}
    else if(current!==next)changes.push({from:block.before,add:type.of(next)});
  }
  return changes.length?{changes,userEvent}:false;
}

function justifySpec(state:GardState,on:boolean):false|Transaction.Spec{
  if(state.readOnly)return false;
  const changes:ChangeSet.Spec[]=[];
  for(const block of selectedTextblocks(state)){
    if(!state.schema.markAllowed(SDJustify.type,block.node.type))continue;
    const current=!!SDJustify.isInSet(block.node.marks);
    if(current===on)continue;
    changes.push(on?{from:block.before,add:SDJustify}:{from:block.before,remove:SDJustify});
  }
  return changes.length?{changes,userEvent:'typography.justify'}:false;
}

function resetSizeSpacing(state:GardState):false|Transaction.Spec{
  const changes:ChangeSet.Spec[]=[];
  for(const block of selectedTextblocks(state)){
    const size=block.node.tag.mark(SDFontSize),spacing=block.node.tag.mark(SDLineHeight);
    if(size!==undefined)changes.push({from:block.before,remove:SDFontSize.of(size)});
    if(spacing!==undefined)changes.push({from:block.before,remove:SDLineHeight.of(spacing)});
  }
  return changes.length?{changes,userEvent:'typography.preset.reset',sequential:true}:false;
}

export const setTypographyPreset:Command.Pure<TypographyPreset>=(target,preset)=>{
  const native=setTextblockType(target,presetTag(preset)),reset=resetSizeSpacing(target.state);
  return merge(target.state,native,reset);
};

export const setFontSize:Command.Pure<number>=(target,value)=>validFontSize(value)?numericMarkSpec(target.state,SDFontSize,value,'typography.font-size',baseFontSize):false;
export const setLineHeight:Command.Pure<number>=(target,value)=>validLineHeight(value)?numericMarkSpec(target.state,SDLineHeight,value,'typography.line-height',baseLineHeight):false;

function nextLineHeight(current:number,direction:TypographyStep){
  if(direction>0)return LINE_HEIGHT_STEPS.find(step=>step>current+0.0001)??current;
  for(let i=LINE_HEIGHT_STEPS.length-1;i>=0;i--)if(LINE_HEIGHT_STEPS[i]!<current-0.0001)return LINE_HEIGHT_STEPS[i]!;
  return current;
}

export const adjustFontSize:Command.Pure<TypographyStep>=(target,direction)=>{
  const current=typographyState(target.state).fontSize,next=Math.max(FONT_SIZE_MIN,Math.min(FONT_SIZE_MAX,current+direction));
  return next===current?false:setFontSize(target,next);
};
export const adjustLineHeight:Command.Pure<TypographyStep>=(target,direction)=>{
  const current=typographyState(target.state).lineHeight,next=nextLineHeight(current,direction);
  return Math.abs(next-current)<0.0001?false:setLineHeight(target,next);
};
export const resetLineHeight:Command.Pure=target=>numericMarkSpec(target.state,SDLineHeight,null,'typography.line-height.reset',baseLineHeight);

export const setTypographyAlignment:Command.Pure<TypographyAlignment>=(target,alignment)=>{
  const native=setAlignment(target,alignment==='justify'?null:alignment),custom=justifySpec(target.state,alignment==='justify');
  return merge(target.state,native,custom);
};

export function typographyState(state:GardState){
  const block=state.sel.head.textblockParent,tag=block?.node.tag,preset=presetForTag(tag),customSize=block?.node.tag.mark(SDFontSize),customLine=block?.node.tag.mark(SDLineHeight),nativeAlign=block?.node.tag.mark(Alignment),justify=!!(block&&SDJustify.isInSet(block.node.marks));
  return Object.freeze({
    preset,
    fontSize:customSize??baseFontSize(tag),
    lineHeight:customLine??baseLineHeight(tag),
    alignment:justify?'justify':nativeAlign==='center'?'center':nativeAlign==='end'?'right':'left' as TypographyAlignment,
  });
}

export function normalizeTypographyPasteStyle(part:string){
  const text=part.trim(),font=/^font-size\s*:\s*(.+)$/i.exec(text);if(font){const value=fontSizeFromCss(font[1]!);return value===null?'':`font-size: ${value}px`;}
  const line=/^line-height\s*:\s*(.+)$/i.exec(text);if(line){const value=lineHeightFromCss(line[1]!);return value===null?'':`line-height: ${value}`;}
  const align=/^text-align\s*:\s*(left|right|start|end|center|justify)$/i.exec(text);if(align){const value=align[1]!.toLowerCase();if(value==='left'||value==='start')return '';return `text-align: ${value==='right'?'end':value}`;}
  return '';
}
