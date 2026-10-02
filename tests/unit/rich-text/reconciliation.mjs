import assert from 'node:assert/strict';
import {importRichTextReconciliationSource} from '../../helpers/typescript-source.mjs';

const R=await importRichTextReconciliationSource();

const text=(param,marks)=>marks?{type:'Text',param,marks}:{type:'Text',param};
const p=(...content)=>({type:'Paragraph',content:content.flat().map(node=>typeof node==='string'?text(node):node)});
const h=(value,level=2)=>({type:'Heading',param:level,content:[text(value)]});
const li=(...blocks)=>({type:'ListItem',content:blocks.flat().map(block=>typeof block==='string'?p(block):block)});
const ul=(...items)=>({type:'BulletList',content:items.flat().map(item=>typeof item==='string'?li(item):item)});
const ol=(...items)=>({type:'OrderedList',param:1,content:items.flat().map(item=>typeof item==='string'?li(item):item)});
const image=id=>({type:'SDImage',param:{assetId:id,alt:'diagram',widthPct:68}});
const audio=id=>({type:'SDAudio',param:{attachmentId:id,name:'Lecture.mp3'}});
const wrap=content=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
const parse=value=>JSON.parse(String(value).slice(4)).doc;
const walkText=node=>{
  if(!node||typeof node!=='object')return '';
  if(node.type==='Text')return String(node.param||'');
  if(node.type==='LineBreak')return '\n';
  return (node.content||[]).map(walkText).join(node.type==='Doc'?'\n':'');
};
const unitText=(comparison,side,id)=>comparison[side].units.find(unit=>unit.id===id)?.text;
let checks=0;const check=(condition,message)=>{checks++;assert.ok(condition,message)};const equal=(a,b,message)=>{checks++;assert.equal(a,b,message)};const deep=(a,b,message)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message)};

// Segmentation and normalization.
equal(R.normalizeMergeText('  MÉDITATION\tReduces   Stress. '),'méditation reduces stress.','Normalization must collapse whitespace/case without dropping content.');
const segmented=R.segmentSentenceRanges('Dr. Rao measured 3.5 cm. It improved! Final line?');
equal(segmented.length,3,'Sentence segmentation must avoid splitting common abbreviations and decimals.');
equal('Dr. Rao measured 3.5 cm. It improved! Final line?'.slice(segmented[0].from,segmented[0].to).trim(),'Dr. Rao measured 3.5 cm.');

// Merge-unit extraction.
const extracted=R.extractMergeUnits(wrap([h('Heading'),p('First sentence. Second sentence.'),ul('Bullet one. Bullet two.'),image('img-12345678901234567890')]));
deep(extracted.map(unit=>unit.kind),['heading','sentence','sentence','list-sentence','list-sentence','atomic'],'Extraction must preserve structural unit kinds.');
equal(extracted.at(-1).nodeType,'SDImage');
check(extracted.every(unit=>unit.from<=unit.to&&unit.topIndex>=0),'Every unit must expose stable document ranges and top-level context.');

// Exact and normalized matching.
let comparison=R.compareRichText('Alpha sentence.\nBeta sentence.','Alpha sentence.\nBeta sentence.');
equal(comparison.correspondences.length,2);check(comparison.correspondences.every(match=>match.kind==='exact'),'Identical text must exact-match.');equal(comparison.incomingOnly.length,0);
comparison=R.compareRichText('Alpha sentence.','  ALPHA   SENTENCE.  ');
equal(comparison.correspondences.length,1);equal(comparison.correspondences[0].kind,'normalized','Case/whitespace-only variation must normalize-match.');equal(comparison.incomingOnly.length,0);

// Fuzzy correspondence is conservative correspondence, not an addition.
comparison=R.compareRichText('Running improves aerobic endurance.','Running considerably improves aerobic endurance.');
equal(comparison.correspondences.length,1);equal(comparison.correspondences[0].kind,'fuzzy');check(comparison.correspondences[0].score>=0.72,'Expected close sentence to clear fuzzy threshold.');equal(comparison.incomingOnly.length,0,'Fuzzy counterparts must not be auto-added as new information.');
comparison=R.compareRichText('The Constitution creates a federal structure.','Photosynthesis converts light energy into chemical energy.');
equal(comparison.correspondences.length,0);equal(comparison.incomingOnly.length,1,'Unrelated prose must stay incoming-only.');

// Incoming-only sentence calculation and contextual merge inside one paragraph.
const localSentence='Alpha establishes the baseline. Beta explains the process. Delta closes the section.';
const incomingSentence='Alpha establishes the baseline. Beta explains the process. Gamma adds a distinct safeguard. Delta closes the section.';
comparison=R.compareRichText(localSentence,incomingSentence);
equal(comparison.incomingOnly.length,1);equal(unitText(comparison,'incoming',comparison.incomingOnly[0]),'Gamma adds a distinct safeguard.');
let merged=R.mergeIncomingAdditions(localSentence,incomingSentence);
equal(merged.value,incomingSentence,'Contextual merge must insert a genuine incoming sentence between matched neighbours.');check(merged.changed,'Contextual merge should report a mutation.');equal(merged.addedUnitIds.length,1);
const mergedAgain=R.mergeIncomingAdditions(merged.value,incomingSentence);equal(mergedAgain.value,merged.value,'Contextual merge must be idempotent.');check(!mergedAgain.changed,'Idempotent rerun must not report a change.');

// Contextual whole-block insertion.
const localBlocks=wrap([p('Alpha anchor.'),p('Delta anchor.')]);
const incomingBlocks=wrap([p('Alpha anchor.'),p('Beta inserted block.'),p('Delta anchor.')]);
merged=R.mergeIncomingAdditions(localBlocks,incomingBlocks);
const blockDoc=parse(merged.value);deep(blockDoc.content.map(block=>walkText(block)),['Alpha anchor.','Beta inserted block.','Delta anchor.'],'Whole incoming blocks must be placed between surrounding matched blocks.');

// Append-additions keeps local body and puts only additions beneath it.
let appended=R.appendIncomingAdditions(localSentence,incomingSentence);
equal(appended.value,localSentence+'\nGamma adds a distinct safeguard.','Append must add only incoming-only prose beneath the local note.');
const appendedAgain=R.appendIncomingAdditions(appended.value,incomingSentence);equal(appendedAgain.value,appended.value,'Append must also be idempotent.');

// List segmentation and contextual new-item insertion.
const localList=wrap([ul('Alpha item.','Delta item.')]);
const incomingList=wrap([ul('Alpha item.','Beta new item.','Delta item.')]);
merged=R.mergeIncomingAdditions(localList,incomingList);
const mergedList=parse(merged.value).content[0];deep(mergedList.content.map(item=>walkText(item)),['Alpha item.','Beta new item.','Delta item.'],'A new list item must be inserted at the contextual list position.');

// Sentence addition inside an existing list item.
const localListSentence=wrap([ul(li(p('Alpha statement. Delta statement.')))]);
const incomingListSentence=wrap([ul(li(p('Alpha statement. Beta inserted statement. Delta statement.')))]);
merged=R.mergeIncomingAdditions(localListSentence,incomingListSentence);
equal(walkText(parse(merged.value).content[0].content[0]),'Alpha statement. Beta inserted statement. Delta statement.','A new sentence inside a matched list item must stay inside that item.');

// Ordered-list semantics stay intact when appending unique material.
const localOrdered=wrap([ol('First existing.')]);
const incomingOrdered=wrap([ol('First existing.','Second incoming.')]);
appended=R.appendIncomingAdditions(localOrdered,incomingOrdered);
const orderedDoc=parse(appended.value);equal(orderedDoc.content.at(-1).type,'OrderedList','Append must preserve list container type.');equal(walkText(orderedDoc.content.at(-1)),'Second incoming.');

// Marks and attachment links are copied from the incoming fragment unchanged.
const attachment='att-12345678901234567890';
const richLocal=wrap([p('Alpha anchor. ',text('Delta anchor.'))]);
const richIncoming=wrap([p('Alpha anchor. ',text('Bold incoming sentence. ',{Strong:null}),text('MRI evidence. ',{Link:'#attachment='+attachment}),text('Delta anchor.'))]);
merged=R.mergeIncomingAdditions(richLocal,richIncoming);
const richContent=parse(merged.value).content[0].content;
const boldNode=richContent.find(node=>node.type==='Text'&&String(node.param).includes('Bold incoming sentence.'));
const linkNode=richContent.find(node=>node.type==='Text'&&String(node.param).includes('MRI evidence.'));
equal(boldNode?.marks?.Strong,null,'Incoming Strong mark must survive sentence insertion.');equal(linkNode?.marks?.Link,'#attachment='+attachment,'Attachment link mark/ID must survive sentence insertion.');

// Atomic attachment-bearing nodes preserve exact identity/parameters.
const imageId='img-12345678901234567890',audioId='att-abcdefghijabcdefghij12';
const atomicLocal=wrap([p('Anchor.')]);
const atomicIncoming=wrap([p('Anchor.'),image(imageId),audio(audioId)]);
merged=R.mergeIncomingAdditions(atomicLocal,atomicIncoming);
const atomicDoc=parse(merged.value);equal(atomicDoc.content[1].param.assetId,imageId);equal(atomicDoc.content[2].param.attachmentId,audioId);deep(atomicDoc.content[1].param,{assetId:imageId,alt:'diagram',widthPct:68},'Image parameters must be copied losslessly.');

// Atomic tables are copied whole rather than sentence-edited.
const table={type:'Table',marks:{SDTableWidth:100},content:[{type:'TableRow',content:[{type:'Cell',marks:{SDCellWidth:100,SDCellHeight:34},content:[p('Cell content')]}]}]};
merged=R.mergeIncomingAdditions(wrap([p('Anchor.')]),wrap([p('Anchor.'),table]));deep(parse(merged.value).content[1],table,'Tables must remain atomic and structurally identical.');

// Format-only divergence is correspondence, not duplicate content.
const plainFormat=wrap([p(text('Same sentence.'))]);
const strongFormat=wrap([p(text('Same sentence.',{Strong:null}))]);
comparison=R.compareRichText(plainFormat,strongFormat);equal(comparison.incomingOnly.length,0);equal(comparison.correspondences[0].kind,'exact');check(!comparison.correspondences[0].formatEqual,'Format-only divergence must be visible to CR3.');check(comparison.localRanges.some(range=>range.kind==='format')&&comparison.incomingRanges.some(range=>range.kind==='format'),'Format-only divergence must emit transient ranges.');
merged=R.mergeIncomingAdditions(plainFormat,strongFormat);equal(merged.value,plainFormat,'Format-only divergence must never silently replace local formatting.');

// Fuzzy changed words get transient ranges on both sides, within their unit bounds.
comparison=R.compareRichText(wrap([p('Running improves aerobic endurance.')]),wrap([p('Running considerably improves aerobic endurance.') ]));
check(comparison.localRanges.some(range=>range.kind==='changed')||comparison.incomingRanges.some(range=>range.kind==='changed'),'Fuzzy correspondence must expose changed-part ranges.');
for(const side of ['local','incoming'])for(const range of comparison[side+'Ranges']){const unit=comparison[side].units.find(item=>item.id===range.unitId);check(!!unit&&range.from>=unit.from&&range.to<=unit.to&&range.to>range.from,`${side} transient range must lie inside its merge unit.`)}

// Local-only and incoming-only ranges are independently surfaced.
comparison=R.compareRichText('Local only sentence.','Incoming unrelated sentence.');
check(comparison.localRanges.some(range=>range.kind==='local-only'),'Local-only material needs a transient range.');check(comparison.incomingRanges.some(range=>range.kind==='incoming-only'),'Incoming-only material needs a transient range.');

// Plain/rich encoding behavior.
merged=R.mergeIncomingAdditions('Alpha.','Alpha. Beta incoming.');check(!merged.value.startsWith('WG1:'),'Plain + plain merge should stay plain when no rich structure is needed.');
merged=R.mergeIncomingAdditions('Alpha.',wrap([p('Alpha.'),image(imageId)]));check(merged.value.startsWith('WG1:'),'Merging rich structure into plain local text must produce WG1.');

// Invalid WG1 fails closed.
checks++;assert.throws(()=>R.compareRichText('Alpha.','WG1:'+JSON.stringify({version:2,doc:{type:'Doc',content:[]}})),/invalid WG1/u);

// Duplicate sentences pair one-to-one rather than collapsing both onto one source unit.
comparison=R.compareRichText('Repeat me. Repeat me. Tail.','Repeat me. Repeat me. Tail.');equal(comparison.correspondences.length,3);equal(new Set(comparison.correspondences.map(match=>match.localId)).size,3);equal(new Set(comparison.correspondences.map(match=>match.incomingId)).size,3);

// Fuzzy correspondence must not cause an edited sentence to be auto-appended.
const editedLocal='Article 21 protects life and personal liberty.';
const editedIncoming='Article 21 strongly protects life and personal liberty.';
merged=R.appendIncomingAdditions(editedLocal,editedIncoming);equal(merged.value,editedLocal,'A fuzzy edited counterpart must remain a human conflict, not an auto-addition.');

// Determinism across repeat comparisons.
const deterministicA=R.compareRichText(richLocal,richIncoming),deterministicB=R.compareRichText(richLocal,richIncoming);deep(JSON.parse(JSON.stringify(deterministicA)),JSON.parse(JSON.stringify(deterministicB)),'Comparison output must be deterministic.');

// Property-style insertion sweep: one unique sentence among stable neighbours, 24 placements.
for(let index=0;index<24;index++){
  const before=`Stable alpha ${index} establishes context.`;
  const added=`Unique gamma ${index} contributes evidence.`;
  const after=`Stable omega ${index} closes context.`;
  const local=`${before} ${after}`,incoming=`${before} ${added} ${after}`;
  const result=R.mergeIncomingAdditions(local,incoming);equal(result.value,incoming,`Contextual insertion property case ${index} failed.`);
  const repeat=R.mergeIncomingAdditions(result.value,incoming);equal(repeat.value,result.value,`Idempotence property case ${index} failed.`);
}


// Partial blockquote append keeps only the incoming addition inside a quote wrapper.
const quoteLocal=wrap([{type:'Blockquote',content:[p('Alpha quoted context. Delta quoted context.')]}]);
const quoteIncoming=wrap([{type:'Blockquote',content:[p('Alpha quoted context. Beta quoted addition. Delta quoted context.')]}]);
appended=R.appendIncomingAdditions(quoteLocal,quoteIncoming);
const quoteDoc=parse(appended.value);equal(quoteDoc.content.at(-1).type,'Blockquote','Partial blockquote additions must retain quote structure.');equal(walkText(quoteDoc.content.at(-1)),'Beta quoted addition.');

// Checklist/list marks survive whole-item insertion unchanged.
const checklistLocal=wrap([{type:'BulletList',marks:{SDChecklist:null},content:[{type:'ListItem',marks:{SDChecklistRole:null,SDChecklistChecked:false},content:[p('Existing task.')]}]}]);
const checklistIncoming=wrap([{type:'BulletList',marks:{SDChecklist:null},content:[{type:'ListItem',marks:{SDChecklistRole:null,SDChecklistChecked:false},content:[p('Existing task.')]},{type:'ListItem',marks:{SDChecklistRole:null,SDChecklistChecked:true},content:[p('Incoming completed task.')]}]}]);
merged=R.mergeIncomingAdditions(checklistLocal,checklistIncoming);
const checklistDoc=parse(merged.value);deep(checklistDoc.content[0].marks,{SDChecklist:null});deep(checklistDoc.content[0].content[1].marks,{SDChecklistRole:null,SDChecklistChecked:true},'Checklist item marks must be preserved exactly.');

// Moving identical prose within the same structural context must not invent a format conflict.
const movedLocal=wrap([ul('First item.','Second item.')]);
const movedIncoming=wrap([ul('Second item.','First item.')]);
comparison=R.compareRichText(movedLocal,movedIncoming);equal(comparison.incomingOnly.length,0);check(comparison.correspondences.every(match=>match.formatEqual),'Path movement alone must not be reported as formatting divergence.');

// A negated edit may correspond fuzzily, but must never be treated as safe additive content.
const negatedLocal='Exercise improves cardiovascular endurance in trained adults.';
const negatedIncoming='Exercise does not improve cardiovascular endurance in trained adults.';
comparison=R.compareRichText(negatedLocal,negatedIncoming);equal(comparison.incomingOnly.length,0,'High-overlap semantic conflict should remain correspondence for human review rather than auto-addition.');

// Scaling sanity: hundreds of exact units plus sparse additions should remain deterministic and complete.
const manyLocal=Array.from({length:400},(_,index)=>`Stable sentence ${index} records baseline evidence.`).join(' ');
const manyIncoming=Array.from({length:400},(_,index)=>`Stable sentence ${index} records baseline evidence.${index%80===79?` New evidence block ${index} is incoming only.`:''}`).join(' ');
const started=Date.now(),many=R.compareRichText(manyLocal,manyIncoming),elapsed=Date.now()-started;
equal(many.incomingOnly.length,5,'Sparse additions across a long note must all be isolated.');check(elapsed<5000,`Long-note comparison took unexpectedly long (${elapsed} ms).`);

// Similarity sanity checks keep clear near/far ordering.
check(R.fuzzyMergeSimilarity('Exercise improves cardiovascular health.','Exercise substantially improves cardiovascular health.')>R.fuzzyMergeSimilarity('Exercise improves cardiovascular health.','The Mughal Empire expanded under Akbar.'),'Fuzzy scoring must rank semantically/textually close edits above unrelated material.');


// Three-way merge: independent additions on local and incoming descendants are
// combined against the proven common ancestor without order-dependent pairwise loss.
let three=R.mergeThreeWay(
  'Alpha baseline. Beta baseline. Delta baseline.',
  'Alpha baseline. Beta baseline. Gamma local addition. Delta baseline.',
  'Alpha baseline. Beta baseline. Delta baseline. Epsilon incoming addition.'
);
check(three.safe,'Independent descendant additions must be safe to merge.');
equal(three.conflictCount,0);
equal(three.value,'Alpha baseline. Beta baseline. Gamma local addition. Delta baseline. Epsilon incoming addition.','Three-way merge must preserve independent additions from both descendants.');

// One-sided incoming edit plus an unrelated local addition is safe: the ancestor
// proves which side changed the original sentence.
three=R.mergeThreeWay(
  'Running improves aerobic endurance. Recovery matters.',
  'Running improves aerobic endurance. Recovery matters. Local training note.',
  'Running considerably improves aerobic endurance. Recovery matters.'
);
check(!three.safe,'A fuzzy-corresponded one-sided incoming edit must require human review even when local left the ancestor unit unchanged.');
check(three.conflictCount>0,'Fuzzy one-sided replacement must report a conflict rather than silently rewriting canonical text.');
check(three.value.includes('Running improves aerobic endurance.'),'The proposed result must keep the local ancestor wording when fuzzy authority is insufficient.');
check(three.value.includes('Local training note.'),'Independent local material must survive while the edit is deferred to human review.');

// Symmetric case: local edited an ancestor unit while incoming added unrelated material.
// The local edit must survive; incoming must not reintroduce the ancestor wording.
three=R.mergeThreeWay(
  'Sleep improves recovery. Hydration matters.',
  'Consistent sleep improves recovery. Hydration matters.',
  'Sleep improves recovery. Hydration matters. Incoming nutrition note.'
);
check(three.safe,'A one-sided local edit plus incoming addition must be safe.');
check(three.value.includes('Consistent sleep improves recovery.'),'Local one-sided edit must survive.');
check(!three.value.includes('Sleep improves recovery. Hydration matters.'),'Unchanged ancestor wording must not be reintroduced over the local edit.');
check(three.value.includes('Incoming nutrition note.'),'Independent incoming addition must be included.');

// Both descendants editing the same ancestor statement differently is a genuine
// conflict and may be proposed, but must never be marked auto-safe.
three=R.mergeThreeWay(
  'Exercise improves cardiovascular endurance.',
  'Regular exercise improves cardiovascular endurance.',
  'Aerobic exercise substantially improves cardiovascular endurance.'
);
check(!three.safe,'Overlapping descendant edits must remain a human conflict.');
check(three.conflictCount>0,'Overlapping descendant edits must report a conflict.');

// Fast-path ancestry cases are deterministic and need no fuzzy inference.
three=R.mergeThreeWay('Base statement.','Base statement.','Incoming replacement.');
check(three.safe);equal(three.value,'Incoming replacement.','If local equals ancestor, incoming wins safely.');
three=R.mergeThreeWay('Base statement.','Local replacement.','Base statement.');
check(three.safe);equal(three.value,'Local replacement.','If incoming equals ancestor, local wins safely.');

// One-sided rich edit/addition must preserve incoming marks, links and attachment IDs.
const threeAttachment='att-threeway123456789012';
const threeBase=wrap([p(text('Anchor statement.')),p(text('Closing statement.'))]);
const threeLocal=wrap([p(text('Anchor statement.')),p(text('Closing statement.')),p(text('Local appendix.'))]);
const threeIncoming=wrap([
  p(text('Anchor statement revised. ',{Strong:null}),text('Evidence link.',{Link:'#attachment='+threeAttachment})),
  p(text('Closing statement.'))
]);
three=R.mergeThreeWay(threeBase,threeLocal,threeIncoming);
check(!three.safe,'A fuzzy-corresponded rich-text replacement must require human review.');
check(three.conflictCount>0,'Fuzzy rich replacement must be surfaced as a conflict.');
const threeDoc=parse(three.value);
check(walkText(threeDoc).includes('Anchor statement.'),'The local/base anchor must remain until the user resolves the fuzzy edit.');
check(walkText(threeDoc).includes('Local appendix.'),'Three-way rich merge must retain unrelated local additions while deferring the fuzzy replacement.');

// Repeatability: a three-way merge over the same inputs must be deterministic.
const threeAgain=R.mergeThreeWay(threeBase,threeLocal,threeIncoming);
deep(JSON.parse(JSON.stringify(three)),JSON.parse(JSON.stringify(threeAgain)),'Three-way merge output must be deterministic.');

console.log(JSON.stringify({status:'PASS',suite:'rich-text-reconciliation-pure',checks,coverage:['merge-unit extraction','sentence/list segmentation','exact','normalized','fuzzy','incoming-only','contextual merge','append additions','marks/links/attachment IDs','atomic blocks','transient ranges','determinism','idempotence','three-way ancestor merge','overlap conflict detection']},null,2));
