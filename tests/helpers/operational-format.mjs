import assert from 'node:assert/strict';
import {OPERATIONAL_FORMATS} from '../../contracts/format-ledger.mjs';

export function assertOperationalFormat(name,value){
  const {constants,fields,optional}=OPERATIONAL_FORMATS[name];
  assert.deepEqual(Object.keys(value).sort(),[...fields,...optional.filter(key=>Object.hasOwn(value,key))].sort(),name+' fields');
  for(const [key,expected] of Object.entries(constants))assert.equal(value[key],expected,name+'.'+key);
}
