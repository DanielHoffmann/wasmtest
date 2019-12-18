import * as cstring from './cstring';

export default async function bridgeTest(wasm: any, wasmFs: any) {
  const {
    instance: { exports: exp },
  } = wasm;
  console.log(await wasmFs.getStdOut());

  console.log('This is computed in C and returned to JS: ' + exp.intTimes2(10));

  console.log(
    'This is computed in C and returned to JS: ' + exp.uLongTimes2(10),
  );

  const pointer = cstring.stringToCharPtr(wasm, 'JS-string');
  exp.bridgeTest(pointer);
  cstring.freeCharPtr(wasm, pointer);
}