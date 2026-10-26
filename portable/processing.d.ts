import type {markdownDocument} from '../rich-text/markdown';
import type {WorkerProgress} from './worker-contracts';
// This JS dispatcher validates its operations internally. Results stay unknown at the relay;
// operation/result relationships are admitted with the implementation in the portable phase.
export declare function createProcessingEngine(renderMarkdown?:typeof markdownDocument):Readonly<{
 run(type:string,data:unknown,progress?:(value:WorkerProgress)=>void):Promise<unknown>;
}>;
