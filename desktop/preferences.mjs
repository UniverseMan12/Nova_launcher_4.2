import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Never truncate the last saved game path/preferences before a replacement has
// been fully written. The temporary file lives beside its destination so rename
// stays on the same volume. io is injectable for disk-failure regression tests.
export function writePreferences(file,value,{io=fs}={}) {
  const contents=JSON.stringify(value);
  const temporary=file+'.'+randomUUID()+'.tmp';
  let descriptor;
  io.mkdirSync(path.dirname(file),{recursive:true});
  try {
    descriptor=io.openSync(temporary,'wx');
    io.writeFileSync(descriptor,contents,'utf8');
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);descriptor=undefined;
    io.renameSync(temporary,file);
  } finally {
    if(descriptor!==undefined)io.closeSync(descriptor);
    io.rmSync(temporary,{force:true});
  }
}
