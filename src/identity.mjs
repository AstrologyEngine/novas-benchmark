// SPDX-License-Identifier: MIT
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export const digest=files=>{
  const hash=createHash('sha256');
  for(const name of [...files].sort())hash.update(name+'\0').update(readFileSync(resolve(root,name))).update('\0');
  return hash.digest('hex');
};
export const nativeSourceHash=()=>digest(readdirSync(resolve(root,'native')).filter(name=>name.endsWith('.c')||name.endsWith('.h')).map(name=>'native/'+name));
export const dependencyHash=()=>digest(['dependencies.json']);
export const serviceHash=()=>digest(['package.json','dependencies.json',...readdirSync(resolve(root,'src')).filter(name=>name.endsWith('.mjs')).map(name=>'src/'+name),...readdirSync(resolve(root,'native')).filter(name=>name.endsWith('.c')||name.endsWith('.h')).map(name=>'native/'+name)]);
