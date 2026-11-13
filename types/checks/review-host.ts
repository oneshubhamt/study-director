import type {BrowserRegistry} from '../browser-registry.ts';
import type {ReviewSubsystemInput} from '../review.ts';
declare const registry:BrowserRegistry;
declare const subsystemInput:Readonly<ReviewSubsystemInput>;
const host=registry.require('review-host',1);
const review=registry.require('review',1);
const subsystem=host.createSubsystem(Object.freeze({module:review,subsystem:subsystemInput}));
void subsystem.ReviewModel.evidenceFormat;
void subsystem.ReviewEditor.bindSession();
void subsystem.ReviewView.status();
void subsystem.SharedReviewPresentation.durationLabel(60);
// @ts-expect-error -- the Review host accepts only the Review feature module.
host.createSubsystem(Object.freeze({module:host,subsystem:subsystemInput}));
