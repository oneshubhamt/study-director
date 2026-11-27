import {pathToFileURL} from 'node:url';
import {runBugRegressionPolicy} from './bug-regression-policy.mts';
export {evaluateBugRegressionPolicy} from './bug-regression-policy.mts';
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)runBugRegressionPolicy();
