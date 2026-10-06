/*
  Study Director Guide
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.

  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.
*/
(function(){
  'use strict';

  const PLUGIN_VERSION='@@SD_RELEASE@@';
  const TAB_ID='guide';
  const INSTALL_STATE_EVENT='studydirector:installationchange';
  const PREVIEW_SAMPLE_DAYS=28;
  const REQUIRED_CAPABILITIES=Object.freeze({
    pluginApi:1,
    tabRegistry:1,
    planDraft:1,
    previewRecords:1,
    installation:1,
    workspaceHistory:1
  });

  const TEMPLATES=Object.freeze([
    {id:'generic',label:'Generic Student',note:'Balanced study day with practice, review, meals, and sleep.',schedule:`05:30 | 90 | Morning Routine: Wake-up + Exercise + Freshen-up | support | Routine | block | 1
07:00 | 120 | Deep Study Block 1 | work | Core Subject | block | 1
09:00 | 30 | Breakfast + Short Break | fixed | Meal | |
09:30 | 120 | Class / Lecture / Primary Study | work | Main Course | block | 1
11:30 | 60 | Practice Questions / Application Work | work | Practice | questions | 25
12:30 | 60 | Lunch + Rest | fixed | Meal | |
13:30 | 120 | Deep Study Block 2 | work | Secondary Subject | block | 1
15:30 | 60 | Review + Error Notebook | work | Revision | block | 1
16:30 | 45 | Break / Walk / Snack | fixed | Break | |
17:15 | 90 | Test Practice / Writing Practice | work | Assessment | block | 1
18:45 | 45 | Light Revision / Flashcards | work | Revision | block | 1
19:30 | 60 | Dinner + Recovery | fixed | Meal | |
20:30 | 60 | Daily Review + Tomorrow Planning | support | Planning | block | 1
21:30 | 480 | Sleep | fixed | Rest | |`},
    {id:'upsc',label:'UPSC',note:'Static, optional, answer writing, current affairs, and revision.',schedule:`05:30 | 90 | Morning Routine + Exercise + Meditation | support | Routine | block | 1
07:00 | 120 | GS Static Study | work | General Studies | block | 1
09:00 | 45 | Breakfast + Break | fixed | Meal | |
09:45 | 120 | Optional Subject Study | work | Optional | block | 1
11:45 | 60 | PYQs / Answer Writing | work | Mains Practice | answers | 2
12:45 | 60 | Lunch + Rest | fixed | Meal | |
13:45 | 120 | Current Affairs + Notes | work | Current Affairs | block | 1
15:45 | 60 | Revision / Error Notebook | work | Revision | block | 1
16:45 | 60 | Break / Walk / Snack | fixed | Break | |
17:45 | 90 | Test Practice / Essay / CSAT | work | Practice | block | 1
19:15 | 60 | Dinner | fixed | Meal | |
20:15 | 60 | Daily Review + Tomorrow Planning | support | Planning | block | 1
21:15 | 480 | Sleep | fixed | Rest | |`},
    {id:'neet-jee',label:'NEET/JEE',note:'Problem solving, MCQs, coaching revision, and formula review.',schedule:`05:30 | 60 | Morning Routine + Light Exercise | support | Routine | block | 1
06:30 | 120 | Physics Problem Solving | work | Physics | questions | 30
08:30 | 45 | Breakfast + Break | fixed | Meal | |
09:15 | 120 | Chemistry Theory + MCQs | work | Chemistry | questions | 40
11:15 | 90 | Maths / Biology Practice | work | Core Subject | questions | 35
12:45 | 60 | Lunch + Rest | fixed | Meal | |
13:45 | 120 | Coaching / Lecture Revision | work | Classes | block | 1
15:45 | 60 | Error Notebook + Formula Revision | work | Revision | block | 1
16:45 | 60 | Break / Snack / Walk | fixed | Break | |
17:45 | 120 | Mock Test / Timed Practice | work | Test Practice | block | 1
19:45 | 60 | Dinner | fixed | Meal | |
20:45 | 60 | Light Revision + Tomorrow Planning | support | Planning | block | 1
21:45 | 480 | Sleep | fixed | Rest | |`},
    {id:'medical',label:'Medical Grad',note:'Clinical learning, case work, MCQs, and short-subject revision.',schedule:`05:30 | 60 | Morning Routine + Exercise | support | Routine | block | 1
06:30 | 90 | Core Reading: Anatomy / Physiology / Medicine | work | Medicine | block | 1
08:00 | 60 | Breakfast + Commute / Prep | fixed | Meal | |
09:00 | 180 | Clinical Posting / Ward Learning | work | Clinical | cases | 3
12:00 | 60 | Case Notes + Viva Revision | work | Clinical | cases | 2
13:00 | 60 | Lunch + Rest | fixed | Meal | |
14:00 | 120 | Lecture / Topic Study | work | Medicine | block | 1
16:00 | 60 | MCQs + Error Review | work | Practice | questions | 30
17:00 | 60 | Break / Walk / Snack | fixed | Break | |
18:00 | 90 | Short Subject Revision | work | Revision | block | 1
19:30 | 60 | Dinner | fixed | Meal | |
20:30 | 60 | Case Discussion + Notes Consolidation | support | Planning | block | 1
21:30 | 480 | Sleep | fixed | Rest | |`},
    {id:'work',label:'Work Day',note:'Planning, deep work, meetings, admin, health, and shutdown.',schedule:`06:00 | 60 | Morning Routine + Exercise | support | Routine | block | 1
07:00 | 45 | Breakfast + Day Setup | fixed | Meal | |
07:45 | 45 | Plan Priorities + Inbox Triage | work | Work Planning | block | 1
08:30 | 120 | Deep Work Block 1 | work | Core Work | block | 1
10:30 | 30 | Short Break | fixed | Break | |
11:00 | 90 | Meetings / Collaboration | work | Meetings | block | 1
12:30 | 60 | Lunch + Rest | fixed | Meal | |
13:30 | 120 | Deep Work Block 2 | work | Core Work | block | 1
15:30 | 60 | Admin / Follow-ups | work | Admin | block | 1
16:30 | 45 | Walk / Tea / Reset | fixed | Break | |
17:15 | 75 | Learning / Skill Development | work | Learning | block | 1
18:30 | 45 | Daily Shutdown + Tomorrow Plan | support | Planning | block | 1
19:15 | 60 | Dinner | fixed | Meal | |
20:15 | 75 | Personal Time / Reading | support | Personal | block | 1
21:30 | 480 | Sleep | fixed | Rest | |`}
  ]);

  function freezeGuideItems(items,kind){
    return Object.freeze((items||[]).map(item=>(kind==='pairs'||kind==='fields')?Object.freeze([String(item[0]),String(item[1])]):String(item)));
  }
  function guideTab(definition){
    return Object.freeze({...definition,items:freezeGuideItems(definition.items,definition.kind)});
  }
  function guideSection(definition){
    return Object.freeze({
      ...definition,
      purpose:Object.freeze([...(definition.purpose||[])]),
      actions:Object.freeze([...(definition.actions||[])]),
      records:Object.freeze([...(definition.records||[])]),
      referenceTabs:Object.freeze((definition.referenceTabs||[]).map(guideTab)),
      saved:Object.freeze([...(definition.saved||[])]),
      flow:Object.freeze([...(definition.flow||[])])
    });
  }

  const GUIDE_ORDER=Object.freeze(['plan','execute','review','library','insights']);
  const GUIDE_SECTIONS=Object.freeze({
    plan:guideSection({
      label:"Plan",
      title:"Plan is where the day becomes real.",
      purpose:[
        "Plan turns your intentions into a realistic sequence of work, support, meals and rest. Start with the visual Plan Board; open the text Composer only when pasting or editing several rows is easier.",
        "Edits remain a safe draft until you press Apply. The applied plan becomes today's live schedule for Timer and Review. A Study Director day runs from 04:00 to 03:59, so after-midnight blocks can still belong to the same study day.",
        "Applying during a current trackable window starts its remaining time automatically; later trackable blocks begin when their scheduled wall-clock window arrives. Reordering or changing duration recalculates later starts and closes following gaps."
      ],
      actions:[
        "Start from a template, paste rows, or add blocks directly.",
        "Mark focused work, helpful support, and fixed anchors correctly.",
        "Add an Area and an optional measurable target where useful.",
        "Reorder or resize blocks, then press Apply when the day is ready."
      ],
      records:[
        "Your current draft is kept for recovery.",
        "The applied plan becomes today's working schedule.",
        "Your default changes only when you explicitly update it."
      ],
      referenceTabs:[
        {id:"fields",label:"Fields",heading:"Composer fields",kind:"fields",items:[
          ["Start","When the block begins, like 07:00."],
          ["Mins","How long the block runs."],
          ["Task","The visible activity name."],
          ["Kind","Work covers study, writing and tests; Support covers exercise, admin and routines; Fixed covers meals, rest and sleep."],
          ["Area","The subject or domain used for grouping. Tasks with the same exact Area share one ongoing note."],
          ["Measure","Optional unit: pages, questions, cases."],
          ["Target","Optional goal number for that unit."],
        ]},
        {id:"actions",label:"Moves",heading:"Planning moves",kind:"list",items:[
          "Start with a template or paste your own rows",
          "Add, remove, reorder, or resize blocks",
          "Keep breaks and meals realistic",
          "Use Area to group subjects or workstreams",
          "Apply only when the draft is ready",
        ]},
      ],
      saved:["Draft schedule is saved locally.","Default schedule is saved only if you update it.","Applied schedule becomes today's working plan."],
      flow:["Template / Paste","Draft","Preview","Apply","Execute"],
      remember:"Draft changes are not the same as today's active plan until you press Apply."
    }),
    execute:guideSection({
      label:"Execute",
      title:"Execute is the live cockpit for the day.",
      purpose:[
        "Timer follows the applied plan and records what actually happens. Run the current work block, pause when you stop, then finish or skip it. Pauses stay separate from focus; crossing zero simply enters Extra Time.",
        "Practice Pacer is an optional within-block stopwatch for answers, questions or paper sections. It starts or resumes only while a work block is running. Choose Simple for one repeated target or Paper Plan for fixed-time or marks-weighted groups. It guides pace without adding focus time or changing completion.",
        "Pomodoro Rhythm can cue planned recovery, while Adjust Plan helps when the real day has drifted. Timer keeps recoverable live evidence; Review is where the day becomes a saved record."
      ],
      actions:[
        "Run, pause, finish or skip the current block.",
        "Enter Done/Total or a percentage when progress is measurable.",
        "Use Practice Pacer only inside a running work block when pace matters.",
        "Use Pomodoro or Adjust Plan when recovery or replanning is needed."
      ],
      records:[
        "Active focus, pauses, starts, finishes and schedule changes.",
        "Work and support completion, skips, progress units, Area notes, and the shared Support Activities note.",
        "Completed Practice Pacer runs, kept separate from focus and completion.",
        "A recoverable live draft until Review saves the day."
      ],
      referenceTabs:[
        {id:"surfaces",label:"Surfaces",heading:"How to read this pane",kind:"pairs",items:[
          ["Now Studying","Shows the current block and its Area. Work blocks use Area-specific ongoing notes; every support block uses the shared Support Activities note."],
          ["Session Status","Shows No Session, Plan Ready, Live Session, Session Paused, Suspended or Complete from the real Timer state."],
          ["Countdown","Shows remaining time for the running block. Extra Time appears after the planned duration is crossed."],
          ["Finish Block","Ends the current block, records focus evidence, and advances the schedule. If no explicit progress was entered, focus time becomes the editable fallback completion."],
          ["Skip Block","Leaves the block zero-complete, records the skip, and moves to the next block."],
          ["Block Progress","Done/Total converts pages, questions, cases, or other units into a percentage for the block. Manual % can override; focus time is only the fallback when stronger progress evidence is missing."],
          ["Practice Pacer","Starts or resumes only during a running work block. Use Simple for one target or Paper Plan for fixed-time or marks-weighted groups. Live guidance is derived; completed unit times are saved."],
          ["Ongoing Notes","Persistent notes for the current Work Area, useful for doubts, mistakes, reminders, and subject-level carry-over. With no Work Area selected, the editor clears and links to Library notes."],
          ["Alignment","Compares the wall-clock schedule with the timer block so you can see drift clearly."],
          ["Adjust Plan","Manual recovery tools: jump to now, start full block, use remaining time, push work that still fits before 04:00, or make an unfinished note. Overflow becomes unfinished work."],
          ["Pomodoro Rhythm","Work-only break cues. The cue does not pause focus; the accepted Pomodoro break is timed separately and saved as planned recovery."],
          ["Session Controls","Suspend keeps today recoverable. Reset clears today's live progress but keeps saved Library records and ongoing notes."],
        ]},
        {id:"actions",label:"Controls",heading:"What you can do",kind:"list",items:[
          "Tap the big timer to pause or resume",
          "Finish a block when you are moving on",
          "Skip a block when it should remain zero-complete",
          "Use Done/Total for measurable progress",
          "Use Practice Pacer during a running work block; Next Unit commits an attempt, Undo Last reverses it, and Restart / Edit discards the unsaved run",
          "Use Adjust Plan only when the live day has drifted",
          "Use Pomodoro nudges on work blocks only; accepted breaks pause focus and are saved as planned recovery",
        ]},
        {id:"tracked",label:"Tracked",heading:"What is tracked",kind:"pairs",items:[
          ["Actual Focus","Running time counted while the timer is active, excluding pauses."],
          ["Pause Time","Manual pauses, inactive-gap breaks, and accepted Pomodoro breaks, kept separate from focus."],
          ["Work Completion","Explicit Done/Total or manual % counts first. If missing, actual focus can fill completion as a time-derived fallback. Skipped blocks stay 0%."],
          ["Schedule Drift","Original versus adjusted timing, shifted blocks, and recovery choices."],
          ["Session Shape","Starts, ends, overtime, sessions per block, and interruptions."],
          ["Subject Evidence","Area-linked ongoing notes and progress by subject/workstream."],
          ["Practice Evidence","Completed pacer runs are shown in Review, Library, and the Practice Pacing view inside Execution. They do not change focus, work completion, Pomodoro, or any non-pacing metric."],
        ]},
      ],
      saved:["Live timer state is saved for same-day recovery. If the browser is reopened after the study day changes, the previous unsaved session can be loaded into Review without restarting its timer.","Actual focus, pause time, work completion, skips, and adjustments are captured.","Practice Pacer stores only completed unit durations, the linked task, one governing target, optional compact plan groups, and compact segment boundaries/labels when used. Session totals, remaining pace and displayed statistics are derived.","Ongoing subject notes are saved by Area and reused across days.","Review uses Timer evidence to create the saved daily record that Library and Insights can read."],
      flow:["Applied Plan","Active Block","Pause / Focus / Overtime","Complete / Skip / Adjust","Review"],
      remember:"Execute is not only a clock. It supplies the evidence later used by Review, Library and Insights."
    }),
    review:guideSection({
      label:"Review",
      title:"Review is the checkpoint before history.",
      purpose:[
        "With an active Study Day, Review brings the plan and Timer evidence together before the day enters history. Check the summary and each block, correct progress when needed, then add an optional quality rating, reflection or unfinished note.",
        "Without an active Study Day, Review becomes reflection-only: study metrics, blocks, quality and report copying stay out of the way while Daily Reflection and Unfinished Note remain available. Saving non-empty reflection text creates or updates that date in Diary.",
        "Save Today stores the Study Day in Library. Save Reflection stores only the reflection when there is no Study Day."
      ],
      actions:[
        "When a Study Day exists, check its summary and block evidence before saving.",
        "Correct Done/Total or completion where the fallback is misleading.",
        "Optionally reflect and rate a Study Day, then press Save Today.",
        "When no Study Day exists, write the Daily Reflection and use Save Reflection; empty reflections are not kept in Diary."
      ],
      records:[
        "One canonical record for the date.",
        "Plan, focus, completion, pauses, outcomes and Pacer runs.",
        "Quality, reflection and unfinished work when provided."
      ],
      referenceTabs:[
        {id:"surfaces",label:"Surfaces",heading:"How to read this pane",kind:"pairs",items:[
          ["Today Summary","Shows the broad shape of the day: planned work, completed work, actual focus, quality, and unfinished signals."],
          ["Today's Blocks","Shows each applied plan block as review evidence: what was planned, what happened, and how complete it is."],
          ["Progress Fields","Done/Total and work completion can be corrected before saving. The app shows whether completion came from units, manual %, focus-time fallback, finished status, or skip."],
          ["Practice Pacer","Shows one compact row per completed run and an in-table total only when several runs exist. Open a run to inspect its units or delete that run from today’s review."],
          ["Ongoing Notes","Work Areas keep reusable subject or workstream notes. All support activities share one Support Activities note. Review uses them as context, not as a forced diary."],
          ["Diary Reflection","Optional. Use it for causes, decisions, lessons, mood, or anything that explains the day."],
          ["Save Today","Stores one canonical Study Day for the date. Saving again replaces that same Study Day; it never creates a second copy."],
          ["Save Reflection","When no Study Day is active, stores a non-empty Daily Reflection in Diary for that date."],
        ]},
        {id:"checks",label:"Checks",heading:"Review checks",kind:"pairs",items:[
          ["Summary","Check whether the top-level numbers match your actual day."],
          ["Blocks","Review each block for work completion, explicit skip, untouched or finished-without-evidence state, focus evidence, and progress."],
          ["Progress","Edit done/total or work completion before saving if the focus-time fallback overstates or understates real progress."],
          ["Notes","Use Area notes for reusable work context and Support Activities for shared support context; use the diary only when reflection is useful."],
          ["Save Today","Creates the durable Study Day record used by Library and Insights."],
        ]},
      ],
      saved:["Save Today creates or replaces the date’s single daily record while retaining that record’s original creation time.","Task evidence, work-completion values, focus time, explicit skip/finish state, progress, and event-level pause evidence are saved.","Practice Pacer saves only compact run evidence; its statistics are derived.","Reflection and quality rating are saved when provided.","Carry-forward/unfinished note is saved separately from the diary."],
      flow:["Timer Evidence / Reflection","Review","Save Today / Save Reflection","Library"],
      remember:"Save Today records a Study Day; Save Reflection records only the dated reflection when no Study Day exists."
    }),
    library:guideSection({
      label:"Library",
      title:"Library keeps your saved records organized.",
      purpose:[
        "Library holds saved Study Days plus the Diary collection of dated reflections. Filter or sort Study Days, open a date, or work directly with reflections and Ongoing Notes.",
        "Library also holds backup and restore tools. Back up regularly if the records matter; restore only trusted Study Director backups. Deleting a saved date removes that record."
      ],
      actions:[
        "Find and open a saved date.",
        "Inspect the day and its individual blocks.",
        "Use managed backup history for recovery, or create/import a standalone backup file.",
        "Delete a day only when you are certain."
      ],
      records:[
        "The daily records created by Save Today.",
        "Task evidence, reflections, quality and unfinished notes.",
        "External backup copies only when you back up manually or configure automatic backup."
      ],
      referenceTabs:[
        {id:"surfaces",label:"Surfaces",heading:"How to read this pane",kind:"pairs",items:[
          ["Saved Day List","The retrieval surface for past records. Open a date to bring back that day for inspection."],
          ["Filters and Sort","Narrow the Library by month or year, then order records so older or newer days are easier to find."],
          ["Day Detail","Shows the saved record for one day: study/work metrics, Pomodoro recovery, Practice Pacer summary when present, quality, reflection, unfinished note, and block evidence."],
          ["Task Details","Lets you inspect each saved block: planned duration, actual focus, work completion, progress units, explicit skip or other outcome state, area, and saved pause evidence."],
          ["Reflection / Unfinished","Keeps the diary reflection and carry-forward note visible beside the measurable record."],
          ["Record Retrieval","Library lets you inspect saved Study Days while Diary and Ongoing Notes remain editable in their own Library sections."],
        ]},
        {id:"data-tools",label:"Data Tools",heading:"Backup and recovery",kind:"pairs",items:[
          ["Data model","Local-first, versioned handoff: your device stays authoritative until you explicitly back up or recover a checkpoint. Google Drive is the intended computer ↔ phone/tablet handoff path; it is not continuous sync."],
          ["Managed checkpoints","Device Folder keeps verified versions in a folder on this device. Google Drive keeps the same managed checkpoint model off-device and lets another Study Director device recover that history after authorization."],
          ["Recover","Choose a verified backup from that location, then Keep current, Add only what’s missing, Combine with current data, or Replace current data."],
          ["Add only what’s missing","Brings back Saved Days and attachments this device doesn’t have and changes nothing you have now. If something differs and needs a choice, nothing is changed and Combine is the way to review it."],
          ["Replace current data","Makes the selected backup authoritative for portable Study Director data. Device-local settings stay on this device."],
          ["Combine with current data","Keeps current data and reviews genuine differences before applying them. An optional checkbox can also download an extra standalone safety copy; automatic rollback protection remains on."],
          ["Export backup","Creates one complete standalone .sdbackup file for manual transfer or safekeeping. It is separate from Device Folder and Google Drive version history."],
          ["Import backup","Verifies a standalone backup, then lets you Add only what’s missing, Combine with current data, or Replace current data."],
          ["Delete Day","Removes a saved day deliberately; back up first if the record may matter later."],
        ]},
      ],
      saved:["Library contains saved Study Days and dated Diary reflections.","Managed backup history and standalone backup files are separate recovery options.","Use only trusted Study Director backups when replacing or combining data.","Delete removes a saved day."],
      flow:["Study Days / Diary","Open Record","Inspect / Edit Reflection","Insights"],
      remember:"Library is your durable record collection. Keep backups if the data matters."
    }),
    insights:guideSection({
      label:"Insights",
      title:"Insights helps you learn from repeated days.",
      purpose:[
        "Insights is a read-only learning layer built from days saved in Review. The window selector controls ordinary summaries and charts; Current Study State and Study Dynamics can use the longer eligible history while showing the selected window as context.",
        "Its seven surfaces move from action to evidence: Coach highlights the most useful decisions; Performance and Output describe results; Execution separates daily mechanics from Practice Pacing; Areas shows subject allocation; Study Dynamics looks for recurring patterns, recent changes, breakdown points and a realistic workload; Analytics Lab lets you verify the supporting evidence.",
        `Treat findings as evidence, not verdicts. Small or weak samples are labelled or withheld, missing Timer data remains unknown, and Pacer timing does not measure correctness. Use the ${PREVIEW_SAMPLE_DAYS}-day sample if you want to explore before your own Library is large enough.`
      ],
      actions:[
        "Choose a window for recent summaries.",
        "Read the two open Coach priorities first.",
        "Use the other surfaces to understand the supporting pattern.",
        "Open Analytics Lab when you want to understand or verify how a finding was supported."
      ],
      records:[
        "Nothing—Insights is read-only.",
        "It reads saved daily records and their task evidence.",
        "Changing a window or opening Lab does not alter your history."
      ],
      referenceTabs:[
        {id:"surfaces",label:"Surfaces",heading:"Inside this pane",kind:"list",items:[
          "Window selector for recent summaries",
          "Coach & Current Study State",
          "Performance",
          "Study Output",
          "Execution: Daily Execution and Practice Pacing",
          "Areas",
          "Study Dynamics",
          "Analytics Lab: Evidence & Audit",
        ]},
        {id:"reads",label:"Reads",heading:"How to interpret it",kind:"pairs",items:[
          ["Evidence base","Uses days saved from Review. Ordinary summaries follow the chosen window; State and Dynamics can use longer eligible history."],
          ["Coach","Keeps two evidence-qualified priorities open and places other non-duplicative readings in Additional Synthesis. Early evidence is moderated."],
          ["Completion and output","Separates explicit progress, time-derived estimates, skips and missing evidence. Missing Timer evidence is not treated as failed work."],
          ["Execution and pacing","Examines starts, schedule movement, pauses and Pomodoro recovery. Practice Pacing measures timing—not correctness or quality."],
          ["Areas and allocation","Compares planned and completed work by top-level Area and flags coverage gaps only when saved evidence supports them."],
          ["Current Study State","Keeps Output, Schedule and Focus control separate. A component does not improve merely because time passed or a different component was observed."],
          ["Study Dynamics","Asks what keeps repeating, what changed recently, where the day tends to break down and what workload is realistic. It withholds findings when evidence is insufficient."],
          ["Analytics Lab","Shows usable-data coverage, Timer and progress completeness, exclusions, definitions and the evidence behind each finding. It is read-only."],
        ]},
      ],
      saved:["Insights saves nothing.","It is read-only.","It reads from saved daily records."],
      flow:["Many Saved Days","Coach & Current State","Performance / Diagnostics","Better Next Plan"],
      remember:"Insights improves as your Library grows."
    })
  });

  function el(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined&&text!==null)node.textContent=String(text);
    return node;
  }
  function button(className,text,onClick){
    const b=el('button',className,text);
    b.type='button';
    b.addEventListener('click',onClick);
    return b;
  }
  const LegalCenter=(()=>{
    const documents=Object.freeze([
      Object.freeze({id:'privacy',label:'Privacy',path:'privacy.html',type:'html'}),
      Object.freeze({id:'terms',label:'Terms',path:'terms.html',type:'html'}),
      Object.freeze({id:'security',label:'Security',path:'security.html',type:'html'}),
      Object.freeze({id:'license',label:'License',path:'LICENSE.txt',type:'text'}),
      Object.freeze({id:'notices',label:'Notices',path:'NOTICE.txt',type:'text'})
    ]);
    const byId=new Map(documents.map(documentDefinition=>[documentDefinition.id,documentDefinition]));
    const pathToId=new Map(documents.flatMap(documentDefinition=>{
      const aliases=[documentDefinition.path.toLowerCase()];
      if(documentDefinition.id==='license')aliases.push('license.html');
      if(documentDefinition.id==='notices')aliases.push('notices.html');
      return aliases.map(path=>[path,documentDefinition.id]);
    }));
    const cache=new Map();
    const CLOSE_FALLBACK_MS=220;
    let overlay=null,dialog=null,title=null,navigation=null,content=null,closeButton=null,routeHistory=null;
    let activeId='',activeTrigger=null,loadRevision=0,restoreOverflow='',closeTimer=0,closeEndHandler=null,closing=false,closePromise=Promise.resolve(true),resolveClose=()=>{};
    function visible(){return !!(overlay&&!overlay.hidden);}
    function active(){return !!(visible()&&activeId);}
    function descriptor(id){const key=byId.has(id)?id:'privacy';return Object.freeze({kind:'legal',token:`legal:${key}`,key});}
    function current(){return activeId?descriptor(activeId):null;}
    function reducedMotion(){try{return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch{return false}}
    function cancelCloseVisual(){
      if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
      if(closeEndHandler){overlay?.removeEventListener('transitionend',closeEndHandler);dialog?.removeEventListener('transitionend',closeEndHandler);closeEndHandler=null;}
    }
    function finishHide(){
      if(!overlay||overlay.hidden)return false;
      cancelCloseVisual();
      closing=false;overlay.classList.remove('is-open','is-closing');overlay.hidden=true;document.body.style.overflow=restoreOverflow;
      const target=activeTrigger;activeTrigger=null;if(target&&target.isConnected)requestAnimationFrame(()=>target.focus({preventScroll:true}));
      resolveClose(true);return true;
    }
    function beginHide(meta={}){
      if(!active()&&!(overlay&&!overlay.hidden))return Promise.resolve(true);
      if(closing)return closePromise;
      const closingDescriptor=current();
      loadRevision+=1;activeId='';closing=true;
      closePromise=new Promise(resolve=>{resolveClose=resolve;});
      if(closingDescriptor)routeHistory?.closed(closingDescriptor,{fromHistory:meta.fromHistory===true,historyPending:meta.historyPending===true});
      overlay.classList.remove('is-open');overlay.classList.add('is-closing');
      if(reducedMotion())finishHide();
      else{
        closeEndHandler=event=>{if(event.target===overlay||event.target===dialog)finishHide();};
        overlay.addEventListener('transitionend',closeEndHandler);dialog?.addEventListener('transitionend',closeEndHandler);
        closeTimer=setTimeout(finishHide,CLOSE_FALLBACK_MS);
      }
      return closePromise;
    }
    function ensure(){
      if(overlay)return overlay;
      overlay=el('div','legal-center-overlay');overlay.hidden=true;
      dialog=el('section','legal-center-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','legal-center-title');dialog.tabIndex=-1;
      const head=el('header','legal-center-head');
      const headCopy=el('div');headCopy.append(el('div','legal-center-kicker ui-label','Study Director'),title=el('h2','legal-center-title','Legal Center'));title.id='legal-center-title';
      closeButton=button('legal-center-close ui-btn','Close',requestClose);closeButton.setAttribute('aria-label','Close Legal Center');
      head.append(headCopy,closeButton);
      navigation=el('nav','legal-center-nav');navigation.setAttribute('aria-label','Legal documents');navigation.setAttribute('role','tablist');
      documents.forEach(documentDefinition=>{
        const control=button('legal-center-nav-button ui-btn',documentDefinition.label,()=>open(documentDefinition.id));
        control.id=`legal-center-tab-${documentDefinition.id}`;control.dataset.legalDocument=documentDefinition.id;control.setAttribute('role','tab');control.setAttribute('aria-selected','false');control.setAttribute('aria-controls','legal-center-content');navigation.appendChild(control);
      });
      content=el('article','legal-center-content');content.id='legal-center-content';content.setAttribute('role','tabpanel');content.setAttribute('tabindex','0');
      const layout=el('div','legal-center-layout');layout.append(navigation,content);
      dialog.append(head,layout);overlay.appendChild(dialog);document.body.appendChild(overlay);
      overlay.addEventListener('mousedown',event=>{if(event.target===overlay)requestClose();});
      dialog.addEventListener('keydown',trapKeys);
      navigation.addEventListener('keydown',event=>{
        if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
        const tabs=[...navigation.querySelectorAll('[role="tab"]')],currentIndex=Math.max(0,tabs.indexOf(document.activeElement));
        let next=currentIndex;if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else next=(currentIndex+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+tabs.length)%tabs.length;
        event.preventDefault();const target=tabs[next];target.focus();open(target.dataset.legalDocument);
      });
      content.addEventListener('click',event=>{
        const link=event.target.closest&&event.target.closest('a[href]');if(!link)return;
        const href=String(link.getAttribute('href')||'').split(/[?#]/)[0].replace(/^\.\//,'').toLowerCase();
        const id=pathToId.get(href);if(!id)return;
        event.preventDefault();open(id);
      });
      return overlay;
    }
    function focusable(){return [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hidden);}
    function trapKeys(event){
      if(event.key==='Escape'){event.preventDefault();requestClose();return;}
      if(event.key!=='Tab')return;
      const items=focusable();if(!items.length){event.preventDefault();dialog.focus();return;}
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    function historyUrl(id){const url=new URL(location.href);url.hash=`legal/${id}`;return url.href;}
    async function read(documentDefinition){
      if(cache.has(documentDefinition.id))return cache.get(documentDefinition.id);
      const response=await fetch(documentDefinition.path,{credentials:'same-origin'});
      if(!response.ok)throw new Error(`Could not load ${documentDefinition.label} (${response.status}).`);
      const source=await response.text();cache.set(documentDefinition.id,source);return source;
    }
    let legalPolicy;
    function renderHtml(source){
      const types=globalThis.trustedTypes;
      if(types&&!legalPolicy)legalPolicy=types.createPolicy('sd-legal-html',{createHTML:value=>value});
      const parsed=new DOMParser().parseFromString(legalPolicy?legalPolicy.createHTML(source):source,'text/html');
      parsed.querySelectorAll('script,style,link,base,iframe,object,embed').forEach(node=>node.remove());
      parsed.querySelectorAll('*').forEach(node=>{for(const attr of [...node.attributes]){if(/^on/i.test(attr.name)||['srcdoc','src','srcset','action','formaction'].includes(attr.name))node.removeAttribute(attr.name);if(attr.name==='href'){try{const url=new URL(attr.value,location.href);if(!['https:','http:','mailto:'].includes(url.protocol))node.removeAttribute('href');}catch{node.removeAttribute('href');}}}});
      const main=parsed.querySelector('main')||parsed.body;main.querySelectorAll('nav').forEach(node=>node.remove());
      const article=el('div','legal-center-document');
      [...main.childNodes].forEach(node=>article.appendChild(document.importNode(node,true)));
      return article;
    }
    function renderText(source){const pre=el('pre','legal-center-plain-text',source);return pre;}
    async function render(id){
      const documentDefinition=byId.get(id)||documents[0],revision=++loadRevision;
      activeId=documentDefinition.id;title.textContent=documentDefinition.label;
      [...navigation.children].forEach(control=>{const selected=control.dataset.legalDocument===activeId;control.classList.toggle('on',selected);control.setAttribute('aria-selected',selected?'true':'false');control.tabIndex=selected?0:-1;});
      content.setAttribute('aria-labelledby',`legal-center-tab-${activeId}`);
      content.setAttribute('aria-label',`${documentDefinition.label} document`);content.setAttribute('aria-busy','true');
      content.replaceChildren(el('div','legal-center-loading ui-status',`Loading ${documentDefinition.label}…`));
      try{
        const source=await read(documentDefinition);if(revision!==loadRevision)return;
        content.replaceChildren(documentDefinition.type==='html'?renderHtml(source):renderText(source));content.scrollTop=0;
      }catch(error){
        if(revision!==loadRevision)return;
        const errorBox=el('div','legal-center-error ui-status',error&&error.message?error.message:'The legal document could not be loaded.');
        const direct=el('a','mini-btn ui-btn','Open direct document');direct.href=documentDefinition.path;
        content.replaceChildren(errorBox,direct);
      }finally{if(revision===loadRevision)content.setAttribute('aria-busy','false');}
    }
    function open(id='privacy',trigger=null,options={}){
      const key=byId.has(id)?id:'privacy';ensure();
      const firstOpen=!visible();
      if(closing){cancelCloseVisual();closing=false;resolveClose(true);overlay.classList.remove('is-closing');}
      if(firstOpen){activeTrigger=trigger&&trigger.nodeType===1?trigger:document.activeElement;restoreOverflow=document.body.style.overflow;document.body.style.overflow='hidden';overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('is-open'));}
      else overlay.classList.add('is-open');
      activeId=key;
      if(options.fromHistory!==true&&routeHistory){const next=descriptor(key),historyOptions={url:historyUrl(key)};if(firstOpen)routeHistory.open(next,historyOptions);else routeHistory.replace(next,historyOptions);}
      void render(key);
      requestAnimationFrame(()=>{const selected=navigation.querySelector('[aria-selected="true"]');(firstOpen?closeButton:selected||closeButton).focus({preventScroll:true});});
      return true;
    }
    function requestClose(){
      const activeDescriptor=current();if(!activeDescriptor)return false;
      const historyPending=!!routeHistory?.close(activeDescriptor);void beginHide({historyPending});return true;
    }
    async function reconcile(desired){
      if(!desired||desired.kind!=='legal'){await beginHide({fromHistory:true});return null;}
      const key=String(desired.key||'');if(!byId.has(key)||desired.token!==`legal:${key}`)return current();
      open(key,null,{fromHistory:true});return current();
    }
    function connect(history){
      if(!history||typeof history.register!=='function'||typeof history.open!=='function'||typeof history.replace!=='function'||typeof history.close!=='function'||typeof history.closed!=='function')return false;
      routeHistory=history;
      return history.register('legal',Object.freeze({current,reconcile}));
    }
    return Object.freeze({open,close:requestClose,documents,connect});
  })();
  const SampleDataEngine=(()=>{
    const SAMPLE_TEMPLATE_ID='upsc';
    function localIsoDate(date=new Date()){
      const y=date.getFullYear();
      const m=String(date.getMonth()+1).padStart(2,'0');
      const d=String(date.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    }
    function dayOffset(iso,offset){
      const date=new Date(`${iso}T00:00:00`);
      date.setDate(date.getDate()+offset);
      return localIsoDate(date);
    }
    function parseRows(schedule){
      return String(schedule||'').split(/\n+/).map((line,idx)=>{
        const p=line.split('|').map(value=>value.trim());
        if(p.length<5)return null;
        return {idx,start:p[0],dur:Number(p[1])||0,name:p[2],kind:p[3]||'work',area:p[4]||'General',measure:p[5]||'',target:p[6]||''};
      }).filter(Boolean);
    }
    function minutesToSeconds(minutes){return Math.max(0,Math.round((Number(minutes)||0)*60));}
    function clockMinute(hhmm){
      const parts=String(hhmm||'00:00').split(':').map(Number);
      return ((parts[0]||0)*60+(parts[1]||0)+1440)%1440;
    }
    function endTime(hhmm,minutes){
      const parts=String(hhmm||'00:00').split(':').map(Number);
      const total=((parts[0]||0)*60+(parts[1]||0)+(Number(minutes)||0)+1440)%1440;
      return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    }
    function completionPattern(day,idx,area){
      const base=[72,78,84,68,88,92,62,80,75,86,58,90,82,70,94,76,88,65,91,83][day%20];
      const ordinalDrag=[8,0,-3,-7,-12,-18,-22][idx%7]||0;
      const areaKey=String(area||'').toLowerCase();
      const areaBias=areaKey.includes('current')?7:areaKey.includes('revision')?5:areaKey.includes('optional')?-4:areaKey.includes('csat')?-18:areaKey.includes('essay')?-8:areaKey.includes('mock')?-6:0;
      const shock=(day===5&&idx>=4)?-22:(day===10&&idx>=2)?-26:(day===15&&idx<=2)?8:0;
      return Math.max(0,Math.min(100,Math.round(base+ordinalDrag+areaBias+shock)));
    }
    function demoArea(row,dayIndex){
      if(row.area==='Practice'){
        if(dayIndex%6===1)return 'Essay';
        if(dayIndex%6===3)return 'CSAT';
        if(dayIndex%6===5)return 'Mock Review';
      }
      if(row.area==='Revision'&&dayIndex%5===2)return 'Ancient History Revision';
      if(row.area==='General Studies'&&dayIndex%7===4)return 'Polity';
      if(row.area==='Optional'&&dayIndex%4===0)return 'Optional Paper 1';
      return row.area;
    }
    function demoTaskName(row,area){
      if(area==='CSAT')return 'CSAT timed practice';
      if(area==='Essay')return 'Essay outline + intro practice';
      if(area==='Mock Review')return 'Mock test review + error log';
      if(area==='Polity')return 'Polity static study';
      return row.name;
    }
    function demoPauseEvents(date,start,isWork,dayIndex,workOrdinal,completion){
      if(!isWork||dayIndex<3)return undefined;
      const events=[];
      if((dayIndex+workOrdinal)%4===0){
        const seconds=180+((dayIndex+workOrdinal)%3)*120;
        events.push({startedAt:date+'T'+start+':00.000',endedAt:date+'T'+endTime(start,Math.round(seconds/60))+':00.000',seconds,type:'manual'});
      }
      if((dayIndex===6&&workOrdinal>=3)||(dayIndex===10&&workOrdinal>=2)||((dayIndex+workOrdinal)%11===0)){
        const seconds=600+((dayIndex+workOrdinal)%2)*420;
        events.push({startedAt:date+'T'+start+':00.000',endedAt:date+'T'+endTime(start,Math.round(seconds/60))+':00.000',seconds,type:'inactive-gap'});
      }
      if(completion>=70&&workOrdinal%2===0&&dayIndex%3!==0){
        const plannedSeconds=300;
        const seconds=plannedSeconds+(((dayIndex+workOrdinal)%4)*90);
        events.push({startedAt:date+'T'+start+':00.000',endedAt:date+'T'+endTime(start,Math.round(seconds/60))+':00.000',seconds,plannedSeconds,type:'pomodoro'});
      }
      return events;
    }
    function sampleTemplate(){
      const template=TEMPLATES.find(item=>item.id===SAMPLE_TEMPLATE_ID);
      if(!template)throw new Error(`Guide sample template ${SAMPLE_TEMPLATE_ID} is unavailable.`);
      return template;
    }
    function samplePracticeRuns(schedule,dayIndex){
      if(![3,6,9,12,15,18,19,22,23,25].includes(dayIndex))return [];
      const work=schedule.filter(entry=>entry.kind==='work');
      if(!work.length)return [];
      const matching=(pattern,fallbackIndex)=>work.find(entry=>pattern.test(`${entry.name} ${entry.area}`))||work[Math.min(fallbackIndex,work.length-1)];
      const answerTask=matching(/answer|mains/i,2);
      const paperTask=matching(/test|practice|essay|csat/i,work.length-1);
      const secondaryTask=matching(/optional|revision/i,1);
      const run=(task,targetMs,unitMs,extra={})=>({taskId:task.id,targetMs,unitMs,...extra});
      const variation=(dayIndex%5-2)*7000;
      const uniform=run(answerTask,600000,[565000+variation,618000-variation,592000+variation],{totalUnits:3});
      const timedUnits=[548000+variation,586000-variation,612000+variation,805000-variation,936000+variation,1053000-variation];
      const timedPaper=run(paperTask,600000,dayIndex===15?timedUnits.slice(0,4):timedUnits,{
        ...(dayIndex===15?{partial:true}:{}),
        unitPlan:{mode:'time',groups:[[3,600000],[3,900000]],segments:[[3,'Section A'],[6,'Section B']]}
      });
      const marksPaper=run(secondaryTask,720000,[570000+variation,630000-variation,660000+variation,870000-variation,1020000+variation,1140000-variation],{
        sessionTargetMs:4500000,
        unitPlan:{mode:'marks',groups:[[3,10],[3,15]],segments:[[3,'Q1'],[6,'Q2']]}
      });
      if([3,19,22].includes(dayIndex))return [uniform];
      if([6,15,25].includes(dayIndex))return [timedPaper];
      if([9,23].includes(dayIndex))return [marksPaper];
      if(dayIndex===12)return [uniform,timedPaper];
      if(dayIndex===18)return [uniform,marksPaper];
      return [];
    }
    function buildRecord(date,dayIndex){
      const rows=parseRows(sampleTemplate().schedule);
      const weekend=new Date(`${date}T00:00:00`).getDay()===0;
      let workOrdinal=0;
      const results={};
      const schedule=rows.map((row,index)=>{
        const isWork=row.kind==='work';
        const isTrackable=row.kind!=='fixed';
        if(isWork)workOrdinal+=1;
        const area=isWork?demoArea(row,dayIndex):row.area;
        const name=isWork?demoTaskName(row,area):row.name;
        const duration=weekend&&isWork?Math.max(45,Math.round(row.dur*.78)):row.dur;
        const id=`sample-${date}-${index}`;
        const scheduleEntry={id,start:row.start,duration,name,kind:row.kind,area,measure:row.measure,target:row.target?Number(row.target)||null:null};
        if(!isTrackable)return scheduleEntry;
        let completion=isWork?completionPattern(dayIndex,workOrdinal,area):100;
        if(isWork&&dayIndex%9===4&&workOrdinal>=5)completion=0;
        const focusRatio=isWork?Math.max(.45,Math.min(1.08,.64+(completion/100)*.34+(dayIndex%5===2?.04:0)-(dayIndex===10?.12:0))):.78;
        const actualMin=isWork&&completion<=0?0:Math.round(duration*focusRatio);
        let completionSource=isWork?(['units','manual','finished-time','time','finished-unverified','time','units','manual'][(dayIndex+workOrdinal)%8]):'finished-unverified';
        if(isWork&&completion<=0)completionSource='skipped';
        if(isWork&&(completionSource==='time'||completionSource==='finished-time'))completion=Math.min(100,Math.round(actualMin/duration*100));
        if(isWork&&completionSource==='finished-unverified')completion=0;
        const total=isWork&&completionSource==='units'?(Number(row.target)||100):null;
        const done=total!==null?Math.round(total*completion/100):null;
        const shiftAmount=(dayIndex%5===1&&isWork&&workOrdinal>2)?15:(dayIndex%7===3&&isWork&&workOrdinal>3)?25:0;
        const adjustedStart=shiftAmount?endTime(row.start,shiftAmount):row.start;
        const startDelay=isWork?([0,4,8,14,22,35,48][(dayIndex+workOrdinal)%7]-(dayIndex%6===0?6:0)):0;
        const actualStart=endTime(adjustedStart,startDelay);
        const pauseEvents=demoPauseEvents(date,actualStart,isWork,dayIndex,workOrdinal,completion);
        const result={
          completion,completionSource,actualSeconds:minutesToSeconds(actualMin),
          actualStart:date+'T'+actualStart+':00.000Z',actualEnd:date+'T'+endTime(actualStart,actualMin)+':00.000Z',
          actualStartLocalMinute:clockMinute(actualStart),actualStartUtcOffsetMinutes:0,actualStartTimeZone:'Etc/UTC',
          sessionCount:pauseEvents&&pauseEvents.length?pauseEvents.length+1:1,
          skipped:completionSource==='skipped',doneFlag:completionSource==='finished-time'||completionSource==='finished-unverified'||completion>=98
        };
        if(shiftAmount)result.adjustedStart=adjustedStart;
        if(done!==null)result.done=done;
        if(total!==null)result.total=total;
        if(pauseEvents!==undefined)result.pauseEvents=pauseEvents;
        results[id]=result;
        return scheduleEntry;
      });
      const reflections=[
        'Good morning start. Current affairs stayed regular, but the final practice block needed a smaller target.',
        'Schedule shifted after lunch. Optional recovered partly because the evening block was protected.',
        'CSAT felt rusty. Keep it short but recurring instead of leaving it for a separate panic day.',
        'Strong review day. Error notebook converted scattered mistakes into a clear next-plan list.',
        'High planned load; actual focus did not rise equally. Tomorrow should reduce one late block.',
        'Mock review exposed avoidable mistakes. The lesson is useful, even though completion looks lower.',
        'Low-energy day with more breaks. Fixed anchors helped prevent the whole day from collapsing.',
        'Steady day. Revision and current affairs were clean; optional still needs deeper slots.',
        'Essay practice was short but valuable. Keep answer-writing frequency visible.',
        'Late starts hurt the third and fourth work blocks. Morning start discipline matters here.'
      ];
      const savedAt=date+'T21:35:00.000Z';
      const record={
        version:16,recordKind:'study',date,savedAt,updatedAt:savedAt,sourceRevision:1,
        quote:'Sample record for exploring Study Director.',reflection:reflections[dayIndex%reflections.length],
        studyQuality:[3,4,4,3,5,2,3,4,4,3,2,5,4,3,5,4,4,3,5,4][dayIndex%20],realTimeSnapshot:null,
        schedule,results,practiceRuns:samplePracticeRuns(schedule,dayIndex),
        carryForwardDraft:dayIndex%4===1?'Carry forward: revise weak questions before the next timed block.':dayIndex%6===3?'Carry forward: keep CSAT in a short recurring slot.':''
      };
      return record;
    }
    function records(context={}){
      const today=context.today||localIsoDate();
      return Array.from({length:PREVIEW_SAMPLE_DAYS},(_,index)=>buildRecord(dayOffset(today,index-PREVIEW_SAMPLE_DAYS),index));
    }
    return Object.freeze({records});
  })();
  function injectStyles(){
    if(document.getElementById('sd-guide-style'))return;
    const style=document.createElement('style');
    style.id='sd-guide-style';
    style.textContent=`
      /* GUIDE-01 · FRAME, HERO, ACTIONS, AND DAILY LOOP Owns the Guide shell, entry actions, lifecycle tabs, and flow connector. */
      .guide-wrap{
        --guide-line-card:rgba(var(--sd-rgb-neutral-overlay),.075);
        --guide-line-reference:rgba(var(--sd-rgb-neutral-overlay),.08);
        --guide-line-standard:rgba(var(--sd-rgb-neutral-overlay),.07);
        --guide-line-soft:rgba(var(--sd-rgb-neutral-overlay),.06);
        display:flex;flex-direction:column;gap:var(--sd-density-section-gap)
      }
      .guide-hero{--panel-line:var(--sd-color-border-2);--panel-padding:var(--sd-space-20) var(--sd-space-24);--panel-bg:var(--sd-material-panel);--panel-shadow:var(--sd-depth-panel)}
      .guide-title{margin:0;font-size:var(--sd-type-role-display-size);font-weight:var(--sd-font-weight-black);letter-spacing:2px}
      .guide-kicker,.guide-label{font-size:var(--sd-type-role-label-size);letter-spacing:4px}
      .guide-sub{margin-top:8px;max-width:760px}
      .guide-actions{display:flex;gap:8px;flex-wrap:wrap}
      .guide-lifecycle{display:flex;gap:8px;align-items:center;padding:8px 0 2px}
      .guide-life-node{flex:1 1 120px;min-height:38px;padding:var(--sd-space-09) var(--sd-space-12);transition:var(--sd-motion-control-transition);--btn-border:var(--sd-color-border-2);--btn-color:var(--sd-color-text-secondary);--btn-hover-border:var(--sd-color-border-1);--btn-hover-color:var(--sd-color-text-primary);--btn-hover-bg:var(--sd-material-guide-hover)}
      .guide-life-node.on,.guide-map-tab.on{--btn-border:var(--sd-color-accent-primary);--btn-color:var(--sd-color-accent-primary);--btn-bg:var(--sd-material-guide-selected);--btn-hover-border:var(--sd-color-accent-primary);--btn-hover-color:var(--sd-color-accent-primary);--btn-hover-bg:var(--sd-material-guide-selected-hover)}
      .guide-lifecycle .guide-life-node.on,.guide-map-tabs .guide-map-tab.on{color:var(--sd-color-accent-primary);border-color:var(--sd-color-accent-primary);background:var(--sd-material-guide-selected)}
      .guide-lifecycle .guide-life-node:not(.on):hover,.guide-map-tabs .guide-map-tab:not(.on):hover{color:var(--sd-color-text-primary);border-color:var(--sd-color-border-1);background:var(--sd-material-guide-hover)}
      .guide-flow-arrow{color:var(--sd-color-text-secondary);opacity:.7;flex:0 0 auto}
      /* GUIDE-02 · HANDBOOK AND REFERENCE MAP Owns stage copy, overview cards, field maps, chips, and save-flow guidance. */
      .guide-handbook{--card-bg:var(--sd-material-card);--card-shadow:var(--sd-depth-card);padding:var(--sd-space-16);display:grid;gap:14px}
      .guide-stage-panel,.guide-copy{display:grid;gap:13px;min-width:0}
      .guide-pane-title{margin:0;font-size:var(--sd-type-role-section-size);letter-spacing:1px}
      .guide-purpose{display:grid;gap:8px;color:var(--sd-color-text-primary);max-width:980px}
      .guide-purpose p{line-height:1.55}
      .guide-overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .guide-overview-card{min-width:0;border:1px solid var(--guide-line-card);padding:var(--sd-space-13) var(--sd-space-14);background:var(--sd-material-content-subtle)}
      .guide-overview-card h3{margin:0}
      .guide-overview-list{display:grid;gap:7px;margin:10px 0 0;padding-left:18px;color:var(--sd-color-text-primary)}
      .guide-overview-list li{line-height:1.45;padding-left:2px}
      .guide-note{padding:12px 14px;--sd-private-helper-line:var(--sd-state-accent-line);display:grid;gap:6px}
      .guide-reference{margin-top:2px;overflow:hidden}
      .guide-reference>.guide-map{border-top:1px solid var(--guide-line-reference)}
      .guide-map{display:grid;gap:13px;padding:var(--sd-space-14);background:var(--sd-material-content-faint)}
      .guide-map-head{display:grid;gap:8px}
      .guide-map-title{font-size:var(--sd-type-role-label-size);letter-spacing:4px}
      .guide-map-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px}
      .guide-map-tab{min-height:34px;padding:var(--sd-space-07) var(--sd-space-09);transition:var(--sd-motion-control-transition);font-size:var(--sd-type-role-label-size);width:100%;--btn-hover-border:var(--sd-color-border-1);--btn-hover-color:var(--sd-color-text-primary);--btn-hover-bg:var(--sd-material-guide-hover)}
      .guide-map-body,.guide-map-group{display:grid;gap:9px;min-width:0}
      .guide-field-list,.guide-save-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .guide-field-row{min-width:0;border:1px solid var(--guide-line-soft);padding:9px 10px;background:var(--sd-material-content-raised);line-height:1.45}
      .guide-field-key{display:inline;color:var(--sd-color-info);margin-right:7px;white-space:nowrap}
      .guide-field-desc{display:inline;color:var(--sd-color-text-primary);line-height:1.45}
      .guide-chip-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .guide-chip{border:1px solid var(--sd-color-border-2);padding:8px 10px;background:var(--sd-surface-neutral-wash);color:var(--sd-color-text-primary)}
      .guide-save-row{border-left:2px solid var(--sd-color-info);padding:9px 10px;background:var(--sd-material-guide-save);color:var(--sd-color-text-primary)}
      .guide-flow{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;max-width:100%;border:1px solid var(--guide-line-standard);padding:var(--sd-space-10);background:var(--sd-material-content-faint);scrollbar-width:thin;scrollbar-color:var(--sd-state-accent-line) transparent;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
      .guide-flow::-webkit-scrollbar{height:4px}
      .guide-flow::-webkit-scrollbar-track{background:var(--sd-value-transparent)}
      .guide-flow::-webkit-scrollbar-thumb{background:var(--sd-state-accent-line)}
      .guide-flow-node{flex:0 0 auto;white-space:nowrap;padding:8px 9px;border:1px solid var(--sd-color-border-2);background:var(--sd-material-content-raised);scroll-snap-align:start}
      /* GUIDE-03 · TEMPLATES AND DATA UTILITIES Owns template cards, utility actions, status, and data explanation blocks. */
      .guide-section{--card-bg:var(--sd-material-card);--card-shadow:var(--sd-depth-card);padding:var(--sd-space-15);display:grid;gap:11px}
      .guide-section h2{margin:0}
      .guide-install{grid-template-columns:minmax(0,1fr) auto;align-items:center}
      .guide-install-copy{display:grid;gap:5px;min-width:0}
      .guide-install-state{color:var(--sd-color-accent-primary)}
      .guide-install-help{grid-column:1/-1;border-top:1px solid var(--guide-line-soft);padding-top:10px;color:var(--sd-color-text-primary);line-height:1.5}
      .guide-install-context{margin:0 0 8px;color:var(--sd-color-info);font-weight:var(--sd-font-weight-bold)}
      .guide-install-steps{display:grid;gap:7px;margin:0;padding-left:22px}
      .guide-install-steps li{padding-left:3px}
      .guide-install-fallback{margin-top:10px;padding:9px 10px;border-left:2px solid var(--sd-color-info);background:var(--sd-material-content-faint)}
      .guide-templates{padding:0;overflow:hidden}
      .guide-template-body{display:grid;gap:12px;padding:14px 15px}
      .guide-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:8px}
      .guide-template{--card-bg:var(--sd-material-content-subtle);display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-content:start;border:1px solid var(--guide-line-standard);padding:11px;background:var(--sd-material-content-subtle)}
      .guide-template .mini-btn{width:100%;justify-content:center}
      .guide-template-title{font-weight:var(--sd-font-weight-extrabold);letter-spacing:1px}
      .guide-status{min-height:18px}
      .guide-utility{grid-template-columns:minmax(0,1fr) auto;align-items:center}
      .guide-data-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .guide-data-item{min-width:0;border:1px solid var(--guide-line-standard);padding:10px;background:var(--sd-material-content-subtle)}
      .guide-legal{grid-template-columns:minmax(0,1fr) auto;align-items:center}.guide-legal-links{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.guide-legal-owner{grid-column:1/-1;border-top:1px solid var(--guide-line-soft);padding-top:9px}
      .legal-center-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:22px;background:rgba(1,3,7,.78);opacity:0;transition:opacity var(--sd-motion-workspace-open-duration,.16s) var(--sd-motion-workspace-ease,ease)}
      .legal-center-overlay[hidden]{display:none!important}
      .legal-center-overlay.is-open{opacity:1}
      .legal-center-overlay.is-closing{opacity:0;transition-duration:var(--sd-motion-workspace-close-duration,.12s);pointer-events:none}
      .legal-center-dialog{display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1080px,calc(100vw - 44px));height:min(790px,calc(100dvh - 44px));min-height:0;border:1px solid var(--sd-color-border-2);border-top:2px solid var(--sd-color-info);background:var(--sd-color-surface-1);box-shadow:0 24px 80px rgba(0,0,0,.55);clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,0 100%);opacity:0;transform:translateY(4px);transition:opacity var(--sd-motion-workspace-open-duration,.16s) var(--sd-motion-workspace-ease,ease),transform var(--sd-motion-workspace-open-duration,.16s) var(--sd-motion-workspace-ease,ease)}
      .legal-center-overlay.is-open .legal-center-dialog{opacity:1;transform:none}
      .legal-center-overlay.is-closing .legal-center-dialog{opacity:0;transform:translateY(4px);transition-duration:var(--sd-motion-workspace-close-duration,.12s)}
      .legal-center-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px;border-bottom:1px solid var(--sd-color-border-1);background:linear-gradient(100deg,rgba(var(--sd-rgb-info),.08),transparent 52%)}
      .legal-center-kicker{color:var(--sd-color-info);letter-spacing:3px}.legal-center-title{margin:3px 0 0;font-family:var(--sd-font-condensed);font-size:var(--sd-type-role-title-size);letter-spacing:1px;text-transform:uppercase}.legal-center-close{min-width:76px;min-height:38px}
      .legal-center-layout{display:grid;grid-template-columns:180px minmax(0,1fr);min-height:0}
      .legal-center-nav{display:flex;flex-direction:column;gap:6px;padding:14px;border-right:1px solid var(--sd-color-border-1);background:rgba(var(--sd-rgb-neutral-overlay),.018);overflow-y:auto}
      .legal-center-nav-button{width:100%;min-height:40px;padding:9px 11px;text-align:left;justify-content:flex-start}.legal-center-nav-button.on{--btn-border:var(--sd-color-info);--btn-color:var(--sd-color-info);--btn-bg:rgba(var(--sd-rgb-info),.08)}
      .legal-center-content{min-width:0;min-height:0;overflow:auto;padding:22px 26px 34px;scrollbar-gutter:stable;outline:none}
      .legal-center-content:focus-visible{box-shadow:inset 0 0 0 2px var(--sd-color-info)}
      .legal-center-loading,.legal-center-error{padding:18px;border:1px solid var(--sd-color-border-1)}
      .legal-center-error+.mini-btn{margin-top:12px}
      .legal-center-document{max-width:850px;margin:0 auto;color:var(--sd-color-text-primary);line-height:1.62}
      .legal-center-document header{padding-bottom:18px;border-bottom:1px solid var(--sd-color-border-1);margin-bottom:24px}.legal-center-document .kicker{font-family:var(--sd-font-display);font-size:var(--sd-type-role-label-size);letter-spacing:3px;text-transform:uppercase;color:var(--sd-color-info)}.legal-center-document h1,.legal-center-document h2{font-family:var(--sd-font-condensed);text-transform:uppercase;letter-spacing:.7px}.legal-center-document h1{font-size:clamp(28px,5vw,46px);line-height:1.05;margin:7px 0 10px}.legal-center-document h2{font-size:var(--sd-type-role-section-size);margin:28px 0 8px;color:var(--sd-color-text-primary)}.legal-center-document p,.legal-center-document li{color:var(--sd-color-text-secondary);line-height:1.62}.legal-center-document strong{color:var(--sd-color-text-primary)}.legal-center-document a{color:var(--sd-color-info);text-underline-offset:3px}.legal-center-document .note{padding:12px 14px;border-left:3px solid var(--sd-color-info);background:rgba(var(--sd-rgb-info),.04)}.legal-center-document .warn{border-left-color:var(--sd-color-warning)}.legal-center-document .meta,.legal-center-document .rights{color:var(--sd-color-text-muted)}.legal-center-document .rights{margin-top:32px;padding-top:16px;border-top:1px solid var(--sd-color-border-1)}
      .legal-center-plain-text{max-width:850px;margin:0 auto;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--sd-color-text-secondary);font-family:var(--sd-font-mono);font-size:var(--sd-type-role-copy-compact-size);line-height:1.62}
      /* GUIDE-04 · RESPONSIVE AND TOUCH OVERRIDES Owns Guide-specific 860px and 680px breakpoints plus the original coarse-pointer override order. Core responsive rules remain core-owned. */
      @media(max-width:860px){.guide-lifecycle{flex-wrap:wrap}.guide-lifecycle .guide-flow-arrow{display:none}.guide-life-node{flex-basis:calc(33.333% - 8px)}.guide-data-grid{grid-template-columns:1fr}.guide-flow{align-items:stretch}}
      @media(prefers-reduced-motion:reduce){.legal-center-overlay,.legal-center-dialog{transition-duration:.01ms!important;transform:none!important}}
      @media(max-width:680px){.guide-title{font-size:var(--sd-type-role-section-size)}.guide-section,.guide-handbook{padding:var(--sd-space-13)}.guide-life-node{flex-basis:calc(50% - 8px)}.guide-overview-grid,.guide-field-list,.guide-save-list,.guide-chip-list,.guide-utility,.guide-install,.guide-legal{grid-template-columns:1fr}.guide-install .mini-btn{width:100%}.guide-legal-links{justify-content:flex-start}.guide-template-body{padding:var(--sd-space-12) var(--sd-space-13)}.guide-flow-node{text-align:center}.legal-center-overlay{padding:0}.legal-center-dialog{width:100vw;height:100dvh;clip-path:none;border-left:0;border-right:0;border-bottom:0}.legal-center-head{padding:max(13px,env(safe-area-inset-top,0px)) 14px 12px}.legal-center-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.legal-center-nav{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--sd-color-border-1);padding:9px 12px;scroll-snap-type:x proximity}.legal-center-nav-button{flex:0 0 auto;width:auto;min-height:42px;scroll-snap-align:start}.legal-center-content{padding:18px 16px max(28px,env(safe-area-inset-bottom,0px))}.legal-center-document h1{font-size:30px}}
      @media(hover:none) and (pointer:coarse){.guide-life-node,.guide-map-tab,.legal-center-nav-button{min-height:var(--_sd-touch-min,44px)}.guide-map-tab{font-size:var(--sd-type-role-label-size)}.guide-flow{padding-bottom:13px}}
    `;
    document.head.appendChild(style);
  }
  function setGuideTabState(tab,selected){
    tab.classList.toggle('on',selected);
    tab.setAttribute('aria-selected',selected?'true':'false');
    tab.tabIndex=selected?0:-1;
  }
  function bindGuideTabKeys(tabList,selector,activate){
    tabList.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const tabs=[...tabList.querySelectorAll(selector)];
      const current=tabs.indexOf(document.activeElement);
      if(current<0||!tabs.length)return;
      let next=current;
      if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      else next=(current+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();
      tabs[next].focus();
      activate(tabs[next]);
    });
  }
  function renderLifecycle(context,state,activeId){
    const ribbon=el('div','guide-lifecycle');
    ribbon.setAttribute('role','tablist');
    ribbon.setAttribute('aria-label','Daily loop stages');
    GUIDE_ORDER.forEach((id,idx)=>{
      if(idx){
        const arrow=el('div','guide-flow-arrow ui-mono','->');
        arrow.setAttribute('aria-hidden','true');
        ribbon.appendChild(arrow);
      }
      const section=GUIDE_SECTIONS[id];
      const tab=button('guide-life-node mini-btn ui-btn '+(id===activeId?'on':''),section.label,()=>updateGuideStage(context,state,id));
      tab.id=`guide-step-${id}`;
      tab.dataset.guideStep=id;
      tab.setAttribute('role','tab');
      tab.setAttribute('aria-controls','guide-stage-panel');
      setGuideTabState(tab,id===activeId);
      ribbon.appendChild(tab);
    });
    bindGuideTabKeys(ribbon,'.guide-life-node',tab=>updateGuideStage(context,state,tab.dataset.guideStep));
    return ribbon;
  }
  function renderPurpose(section){
    const block=el('div','guide-purpose');
    section.purpose.forEach(line=>block.appendChild(el('p','ui-body',line)));
    return block;
  }
  function renderSavedPanel(section){
    const panel=el('div','guide-map-group');
    panel.appendChild(el('div','guide-label ui-label','What gets saved'));
    const list=el('div','guide-save-list');
    section.saved.forEach(item=>list.appendChild(el('div','guide-save-row ui-body',item)));
    panel.appendChild(list);
    return panel;
  }
  function renderFlow(section){
    const flow=el('div','guide-flow');
    flow.tabIndex=0;
    flow.setAttribute('role','region');
    flow.setAttribute('aria-label',`${section.label} workflow`);
    section.flow.forEach((item,idx)=>{
      if(idx){
        const arrow=el('div','guide-flow-arrow ui-mono','->');
        arrow.setAttribute('aria-hidden','true');
        flow.appendChild(arrow);
      }
      flow.appendChild(el('div','guide-flow-node ui-mono',item));
    });
    return flow;
  }
  function renderMapGroup(label,items){
    const group=el('div','guide-map-group');
    group.appendChild(el('div','guide-label ui-label',label));
    const list=el('div','guide-chip-list');
    items.forEach(item=>list.appendChild(el('div','guide-chip ui-mono',item)));
    group.appendChild(list);
    return group;
  }
  function renderDefinitionGuide(label,rows,pairRows=false){
    if(!rows||!rows.length)return null;
    const group=el('div','guide-map-group');
    group.appendChild(el('div','guide-label ui-label',label));
    const list=el('div','guide-field-list');
    rows.forEach(([key,desc])=>{
      const row=el('div','guide-field-row'+(pairRows?' guide-pair-row':''));
      row.append(el('div','guide-field-key ui-mono',key),el('div','guide-field-desc ui-body',desc));
      list.appendChild(row);
    });
    group.appendChild(list);
    return group;
  }
  function renderReferenceTab(tab){
    if(!tab||!tab.items||!tab.items.length)return null;
    if(tab.kind==='pairs')return renderDefinitionGuide(tab.heading,tab.items,true);
    if(tab.kind==='fields')return renderDefinitionGuide(tab.heading,tab.items);
    return renderMapGroup(tab.heading,tab.items);
  }
  function mapTabDefinitions(section){
    const tabs=section.referenceTabs.map(tab=>({...tab,render:()=>renderReferenceTab(tab)}));
    tabs.push({id:'saved',label:'Saved',render:()=>renderSavedPanel(section)});
    return tabs;
  }
  function renderQuickMap(section,state,activeId){
    const disclosure=el('details','guide-reference ui-disclosure');
    if(!state.referenceOpen)state.referenceOpen={};
    disclosure.open=state.referenceOpen[activeId]===true;
    disclosure.addEventListener('toggle',()=>{state.referenceOpen[activeId]=disclosure.open;});
    disclosure.appendChild(el('summary','','Detailed reference'));
    const map=el('div','guide-map');
    const tabs=mapTabDefinitions(section);
    const previous=state.mapTabs&&state.mapTabs[activeId];
    const selected=tabs.some(tab=>tab.id===previous)?previous:tabs[0].id;
    if(!state.mapTabs)state.mapTabs={};
    state.mapTabs[activeId]=selected;
    const head=el('div','guide-map-head');
    head.appendChild(el('div','guide-map-title ui-label',`${section.label} reference`));
    const tabRow=el('div','guide-map-tabs');
    tabRow.setAttribute('role','tablist');
    tabRow.setAttribute('aria-label',`${section.label} reference topics`);
    const body=el('div','guide-map-body');
    body.id=`guide-reference-panel-${activeId}`;
    body.setAttribute('role','tabpanel');
    function selectReference(id){
      const active=tabs.find(tab=>tab.id===id)||tabs[0];
      state.mapTabs[activeId]=active.id;
      tabRow.querySelectorAll('.guide-map-tab').forEach(tab=>setGuideTabState(tab,tab.dataset.guideReference===active.id));
      body.setAttribute('aria-labelledby',`guide-reference-${activeId}-${active.id}`);
      const content=active.render();
      body.replaceChildren(...(content?[content]:[]));
    }
    tabs.forEach(tab=>{
      const tabButton=button('guide-map-tab mini-btn ui-btn '+(tab.id===selected?'on':''),tab.label,()=>selectReference(tab.id));
      tabButton.id=`guide-reference-${activeId}-${tab.id}`;
      tabButton.dataset.guideReference=tab.id;
      tabButton.setAttribute('role','tab');
      tabButton.setAttribute('aria-controls',body.id);
      setGuideTabState(tabButton,tab.id===selected);
      tabRow.appendChild(tabButton);
    });
    bindGuideTabKeys(tabRow,'.guide-map-tab',tab=>selectReference(tab.dataset.guideReference));
    head.appendChild(tabRow);
    map.appendChild(head);
    map.appendChild(body);
    selectReference(selected);
    disclosure.appendChild(map);
    return disclosure;
  }
  function renderOverviewList(label,items){
    const card=el('section','guide-overview-card');
    card.appendChild(el('h3','guide-label ui-label',label));
    const list=el('ul','guide-overview-list');
    items.forEach(item=>list.appendChild(el('li','ui-body',item)));
    card.appendChild(list);
    return card;
  }
  function renderStageContent(state,activeId){
    const section=GUIDE_SECTIONS[activeId];
    const fragment=document.createDocumentFragment();
    const intro=el('div','guide-copy');
    intro.append(el('div','guide-label ui-label','Purpose'),el('h2','guide-pane-title ui-title',section.title),renderPurpose(section));
    fragment.appendChild(intro);
    const overview=el('div','guide-overview-grid');
    overview.append(renderOverviewList('What you do',section.actions),renderOverviewList('What it records',section.records));
    fragment.appendChild(overview);
    const remember=el('div','guide-note ui-helper');
    remember.append(el('div','guide-label ui-label','Remember'),el('div','ui-body',section.remember));
    fragment.appendChild(remember);
    fragment.append(el('div','guide-label ui-label','Flow'),renderFlow(section),renderQuickMap(section,state,activeId));
    return fragment;
  }
  function updateGuideStage(context,state,requestedId){
    const activeId=GUIDE_SECTIONS[requestedId]?requestedId:'plan';
    state.step=activeId;
    const pane=context&&context.pane;
    if(!pane)return;
    pane.querySelectorAll('.guide-life-node').forEach(tab=>setGuideTabState(tab,tab.dataset.guideStep===activeId));
    const stage=pane.querySelector('#guide-stage-panel');
    if(!stage)return;
    const content=renderStageContent(state,activeId);
    stage.setAttribute('aria-labelledby',`guide-step-${activeId}`);
    stage.replaceChildren(content);
  }
  function renderHandbook(context,state){
    const activeId=GUIDE_SECTIONS[state.step]?state.step:'plan';
    const handbook=el('section','guide-handbook ui-card');
    handbook.append(el('div','guide-label ui-label','Daily loop'),renderLifecycle(context,state,activeId));
    const stage=el('div','guide-stage-panel');
    stage.id='guide-stage-panel';
    stage.setAttribute('role','tabpanel');
    stage.setAttribute('aria-labelledby',`guide-step-${activeId}`);
    stage.appendChild(renderStageContent(state,activeId));
    handbook.appendChild(stage);
    return handbook;
  }
  async function runInstallAction(context,api,state){
    const current=api.installation.status();
    if(current.installationAction==='install')await api.installation.prompt();
    else if(current.installationState==='manual'&&state.installHelpOpen)await api.installation.inspect();
    else if(current.installationAction==='help'||current.installationAction==='find'){
      state.installHelpOpen=true;api.installation.showHelp();
    }
    refreshInstallCard(context,api,state);
  }
  function renderInstallCard(context,api,state){
    const current=api.installation.status();
    if(current.installHelpRequested)state.installHelpOpen=true;
    const card=el('section','guide-section guide-install ui-card');
    card.id='guide-install-card';
    const copy=el('div','guide-install-copy');
    copy.append(
      el('h2','guide-label ui-label','Install Study Director'),
      el('div','guide-install-state ui-mono',current.installationLabel),
      el('div','ui-body',current.installationSummary)
    );
    card.appendChild(copy);
    let label='';
    if(current.installationAction==='install')label='Install app';
    else if(current.installationAction==='find'&&!state.installHelpOpen)label='Where to find it';
    else if(current.installationAction==='help')label=state.installHelpOpen?'Refresh install status':'How to install';
    if(label){
      const action=button('mini-btn ui-btn primary',current.installInspecting?'Checking…':label,()=>runInstallAction(context,api,state));
      action.disabled=current.installInspecting||current.installationState==='installing';
      card.appendChild(action);
    }
    if(state.installHelpOpen){
      const help=el('div','guide-install-help ui-body');
      help.id='guide-install-help';help.setAttribute('role','status');help.setAttribute('aria-live','polite');
      help.appendChild(el('div','guide-install-context ui-mono',`Steps for ${current.installationContext}`));
      if(Array.isArray(current.installationSteps)&&current.installationSteps.length){
        const steps=el('ol','guide-install-steps');
        current.installationSteps.forEach(step=>steps.appendChild(el('li','',step)));
        help.appendChild(steps);
      }
      if(Array.isArray(current.installationFallback)&&current.installationFallback.length){
        help.appendChild(el('div','guide-install-fallback ui-helper',current.installationFallback.join(' ')));
      }
      card.appendChild(help);
    }
    return card;
  }
  function refreshInstallCard(context,api,state){
    const pane=context&&context.pane;
    const current=pane&&pane.querySelector('#guide-install-card');
    if(current)current.replaceWith(renderInstallCard(context,api,state));
  }
  function renderGuide(context,api,state){
    const pane=context&&context.pane;
    if(!pane)return;
    state.context=context;
    injectStyles();
    const wrap=el('div','guide-wrap');
    const hero=el('section','guide-hero ui-panel');
    hero.append(el('div','guide-kicker ui-label','Study Director Handbook'),el('h1','guide-title ui-title','Guide'),el('div','guide-sub ui-body','Learn the daily loop one stage at a time. Start with the short overview; open Detailed reference only when you need a field or control explained.'));
    wrap.appendChild(hero);
    wrap.appendChild(renderInstallCard(context,api,state));
    wrap.appendChild(renderHandbook(context,state));
    const templates=el('details','guide-section guide-templates ui-card ui-disclosure');
    templates.appendChild(el('summary','','Starter templates'));
    const templateBody=el('div','guide-template-body');
    templateBody.appendChild(el('div','guide-note ui-helper','Templates load into Plan Draft only. They do not apply the plan or replace your default.'));
    const templateGrid=el('div','guide-template-grid');
    TEMPLATES.forEach(t=>{
      const row=el('div','guide-template');
      const copy=el('div');
      copy.append(el('div','guide-template-title ui-label',t.label),el('div','ui-body',t.note));
      const load=button('mini-btn ui-btn primary','Load into Draft',()=>loadTemplate(api,state,t,context));
      load.dataset.ownerMutation='plan-template';
      row.append(copy,load);
      templateGrid.appendChild(row);
    });
    templateBody.appendChild(templateGrid);
    const status=el('div','guide-status ui-status '+(state.ok?'ok':''),state.status||'');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    templateBody.appendChild(status);
    templates.appendChild(templateBody);
    wrap.appendChild(templates);
    const sample=el('section','guide-section guide-utility ui-card');
    const sampleCopy=el('div');
    sampleCopy.append(el('h2','guide-label ui-label','Preview Insights'),el('div','ui-body',`Explore a temporary, read-only ${PREVIEW_SAMPLE_DAYS}-day sample before your own Library is large enough.`));
    const sampleActions=el('div','guide-actions');
    sampleActions.append(button('mini-btn ui-btn primary',`Open ${PREVIEW_SAMPLE_DAYS}-Day Sample`,()=>showSample(api)),button('mini-btn ui-btn','Open My Insights',()=>{api.preview&&api.preview.clear&&api.preview.clear('insights');api.ui.goTab('insights');}));
    sample.append(sampleCopy,sampleActions);
    wrap.appendChild(sample);
    const data=el('section','guide-section guide-data ui-card');
    data.append(el('h2','guide-label ui-label','Data & Backup'),el('div','ui-body','Your plan, live session, notes and saved days stay in browser storage by default. Backup copies leave it only when you back up to a file or Google Drive, or configure an automatic device folder.'));
    const dataGrid=el('div','guide-data-grid');
    [
      ['Save the day','Review → Save Today creates the Study Day record used by Library and Insights.'],
      ['Keep a backup','Library → Data & Backup explains managed checkpoints and multi-device handoff. For computer ↔ phone/tablet, back up to Google Drive on the device you are leaving, then open Versions on the other device and Combine or Replace. Advanced → Export backup… creates a separate standalone file.'],
      ['Google Drive','Optional. Before Google authorization, Study Director explains that drive.file access is used only to create, list, read, verify, rotate or delete Study Director backup files and related metadata. Backups are integrity-checked; optional backup encryption can be enabled in Library.'],
      ['Sample data',`The ${PREVIEW_SAMPLE_DAYS}-day preview is temporary, read-only and never included in exports.`]
    ].forEach(([title,copy])=>{
      const item=el('div','guide-data-item');
      item.append(el('div','guide-field-key ui-mono',title),el('div','ui-body',copy));
      dataGrid.appendChild(item);
    });
    data.appendChild(dataGrid);
    wrap.appendChild(data);
    const legal=el('section','guide-section guide-legal ui-card');
    const legalCopy=el('div');
    legalCopy.append(el('h2','guide-label ui-label','Privacy, Legal & Security'),el('div','ui-body','Study Director is local-first with checkpoint-based handoff. Review the policies for local storage, optional Google Drive backup, software use, third-party notices and responsible security reporting.'));
    const legalLinks=el('nav','guide-legal-links');
    legalLinks.setAttribute('aria-label','Study Director legal documents');
    LegalCenter.documents.forEach(documentDefinition=>{
      const control=button('mini-btn ui-btn',documentDefinition.label,event=>LegalCenter.open(documentDefinition.id,event.currentTarget));
      control.setAttribute('aria-haspopup','dialog');
      legalLinks.appendChild(control);
    });
    const ownership=el('div','guide-legal-owner ui-helper','Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved. · Privacy, grievance & security: shubhamtiwari1212@gmail.com');
    legal.append(legalCopy,legalLinks,ownership);
    wrap.appendChild(legal);
    pane.replaceChildren(wrap);
  }
  function updateTemplateStatus(context,state){
    const status=context&&context.pane&&context.pane.querySelector('.guide-status');
    if(!status)return;
    status.textContent=state.status||'';
    status.classList.toggle('ok',state.ok);
  }
  async function loadTemplate(api,state,template,context){
    if(!api.plan||typeof api.plan.loadDraft!=='function')return;
    const result=await api.plan.loadDraft(template.schedule,{label:template.label});
    state.status=result&&result.ok?`${template.label} loaded into Plan Draft.`:result?.error==='cancelled'?'Current draft kept.':'Template could not load.';
    state.ok=!!result?.ok;updateTemplateStatus(context,state);
    if(result?.ok&&api.ui?.goTab)api.ui.goTab('plan');
  }
  async function showSample(api){
    if(!api.preview||typeof api.preview.useSample!=='function')return;
    const result=await api.preview.useSample({label:`Sample ${PREVIEW_SAMPLE_DAYS} days`,target:'insights'});
    if(result&&result.ok&&api.ui&&api.ui.goTab)api.ui.goTab('insights');
  }
  function supportsCapabilities(api,requirements){
    const capabilities=api&&api.capabilities;
    return !!capabilities&&Object.entries(requirements).every(([key,minimum])=>Number(capabilities[key]||0)>=Number(minimum));
  }
  function setup(api){
    if(!supportsCapabilities(api,REQUIRED_CAPABILITIES)||!api.ui||typeof api.ui.registerTab!=='function'||typeof api.ui.goTab!=='function'||!api.ui.workspaceHistory||typeof api.ui.workspaceHistory.register!=='function'||!api.plan||typeof api.plan.loadDraft!=='function'||!api.preview||typeof api.preview.useSample!=='function'||typeof api.preview.clear!=='function'||!api.installation||typeof api.installation.status!=='function'||typeof api.installation.prompt!=='function'||typeof api.installation.inspect!=='function'||typeof api.installation.showHelp!=='function')return false;
    if(!LegalCenter.connect(api.ui.workspaceHistory))return false;
    const state={step:'plan',pending:'',status:'',ok:false,mapTabs:{},referenceOpen:{},installHelpOpen:false,context:null};
    window.addEventListener(INSTALL_STATE_EVENT,event=>{
      if(event.detail&&event.detail.installHelpRequested)state.installHelpOpen=true;
      refreshInstallCard(state.context,api,state);
    });
    return api.ui.registerTab({
      id:TAB_ID,
      label:'Guide',
      icon:'?',
      render:context=>renderGuide(context,api,state)
    });
  }
  const PLUGIN_READY_EVENT='studydirector:ready';
  const PLUGIN_DESCRIPTOR=Object.freeze({
    name:'SD-guide',
    version:PLUGIN_VERSION,
    requires:REQUIRED_CAPABILITIES,
    previewProviders:Object.freeze({insights:SampleDataEngine.records}),
    setup
  });
  const MAX_REGISTRATION_ATTEMPTS=2;
  let registrationAttempts=0;
  let registrationComplete=false;
  function connectPlugin(){
    if(registrationComplete)return true;
    const register=window.StudyDirector&&window.StudyDirector.registerPlugin;
    if(typeof register!=='function'||registrationAttempts>=MAX_REGISTRATION_ATTEMPTS)return false;
    registrationAttempts+=1;
    try{registrationComplete=register(PLUGIN_DESCRIPTOR)===true;}catch(error){}
    if(!registrationComplete&&registrationAttempts<MAX_REGISTRATION_ATTEMPTS)Promise.resolve().then(connectPlugin);
    return registrationComplete;
  }
  function boot(){
    const api=window.StudyDirector;
    if(api&&typeof api.registerPlugin==='function')connectPlugin();
    else window.addEventListener(PLUGIN_READY_EVENT,connectPlugin,{once:true});
  }
  boot();
})();
