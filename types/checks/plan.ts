import type {BrowserRegistry} from '../browser-registry.ts';
import type {PlanModuleInput,PlanApplyOptions,PlanDraftPreviewOptions} from '../plan.ts';
declare const registry:BrowserRegistry;
declare const input:Readonly<PlanModuleInput>;
const module=registry.require('plan',1);
const controller=module.createController(input);
const applyOptions:Readonly<PlanApplyOptions>={source:'plan-board-edit',persistDraft:false};
void controller.apply(applyOptions);
const previewOptions:Readonly<PlanDraftPreviewOptions>={silent:true,enterDraft:false};
void controller.draft.preview(previewOptions);
void controller.draft.save({strictDurability:true});
void controller.draft.flush({backupCapture:true});
// @ts-expect-error -- Plan apply options are closed and boolean flags cannot be strings.
void controller.apply({persistDraft:'no'});
// @ts-expect-error -- draft preview options are closed.
void controller.draft.preview({enterDraft:'yes'});
// @ts-expect-error -- module identity is closed.
registry.load('plan',1,'study-director.startup-lifecycle',1);
