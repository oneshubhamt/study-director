import type {ReviewModule,ReviewSubsystem,ReviewSubsystemInput} from './review.ts';

export interface ReviewHostInput{
  readonly module:ReviewModule;
  readonly subsystem:Readonly<ReviewSubsystemInput>;
}
export interface ReviewHostModule{
  readonly format:'study-director.review-host-module';
  readonly contractVersion:1;
  createSubsystem(input:Readonly<ReviewHostInput>):Readonly<ReviewSubsystem>;
}
