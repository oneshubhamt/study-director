// Classic-script VM boundary: no untyped result escapes this helper.
export function method(owner:unknown,name:string):(...args:unknown[])=>unknown{
  if((typeof owner!=='object'&&typeof owner!=='function')||owner===null)throw new TypeError('Missing capability owner: '+name);
  const fn:unknown=Reflect.get(owner,name);
  if(typeof fn!=='function')throw new TypeError('Missing capability: '+name);
  return (...args:unknown[]):unknown=>Reflect.apply(fn,owner,args);
}
export function registeredExports(scope:object,name:string,input?:unknown):unknown{
  const registry:unknown=Reflect.get(scope,Symbol.for('studyDirector.internalModules.v1'));
  return method(registry,'require')(name,1,input);
}
