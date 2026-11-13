// SPDX-License-Identifier: MIT
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {downloadVerified} from '../scripts/download.mjs';
test('interrupted download is replaced only after checksum verification',t=>{
  const dir=mkdtempSync(join(tmpdir(),'novas-download-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'artifact');writeFileSync(path,'partial');
  const entry={url:'https://example.invalid/artifact',sha256:createHash('sha256').update('complete').digest('hex')};
  assert.throws(()=>downloadVerified(entry,path,(_url,file)=>writeFileSync(file,'corrupt')),/Checksum/);
  assert.equal(readFileSync(path,'utf8'),'partial');assert.deepEqual(readdirSync(dir),['artifact']);
  downloadVerified(entry,path,(_url,file)=>writeFileSync(file,'complete'));assert.equal(readFileSync(path,'utf8'),'complete');
  downloadVerified(entry,path,()=>assert.fail('Valid cached artifact must not download'));
});
