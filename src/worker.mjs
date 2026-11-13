// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {nativeSourceHash,dependencyHash,serviceHash} from './identity.mjs';
import {bodyIds,nodeModes,southNodeConventions,normalize} from './contract.mjs';
const lock=JSON.parse(readFileSync(new URL('../dependencies.json',import.meta.url)));
const expected=lock.kernel.sha256;
export const startWorker = async (kernel) => {
  const dataHash = createHash('sha256').update(readFileSync(kernel)).digest('hex');
  if (dataHash !== expected) throw new Error('JPL DE440s checksum mismatch');
  const minorPaths=Object.values(lock.minorKernels).map(entry=>{const path=resolve(import.meta.dirname,'..',entry.path);if(createHash('sha256').update(readFileSync(path)).digest('hex')!==entry.sha256)throw new Error('Minor kernel checksum mismatch');return path;});
  const binary = resolve(import.meta.dirname, '../.build/worker');
  const binaryHash = createHash('sha256').update(readFileSync(binary)).digest('hex');
  const manifest=JSON.parse(readFileSync(resolve(import.meta.dirname,'../.build/manifest.json')));
  if(manifest.binaryHash!==binaryHash||manifest.nativeSourceHash!==nativeSourceHash()||manifest.dependencyHash!==dependencyHash())throw new Error('Rebuild native worker: source/dependency/artifact identity mismatch');
  const codeHash=serviceHash();
  const child = spawn(binary, [kernel,...minorPaths], {stdio:['pipe','pipe','inherit']});
  const pending = [];
  let failure;
  const fail = (error) => { failure = error; for (const request of pending.splice(0)) request.reject(error); };
  child.on('error', fail);
  child.on('exit', () => fail(new Error('Native worker exited')));
  child.stdin.on('error', fail);
  const lines = createInterface({input:child.stdout});
  lines.on('line', line => {
    const request = pending.shift();
    if (!request) { fail(new Error('Unexpected native output')); child.kill(); return; }
    try { request.resolve(JSON.parse(line)); } catch (error) { request.reject(error); fail(error); child.kill(); }
  });
  const receive = () => new Promise((resolve,reject) => {
    if (failure) { reject(failure); return; }
    const timeout = setTimeout(() => { fail(new Error('Native worker timeout')); child.kill(); }, 15000);
    pending.push({resolve:value => {clearTimeout(timeout);resolve(value);}, reject:error => {clearTimeout(timeout);reject(error);}});
  });
  const ready = await receive();
  if (!ready.ready || ready.supernovas !== lock.supernovas.version || ready.calceph !== lock.calceph.version) { child.kill(); throw new Error('Native initialization failed'); }
  const query=async(tt,id,fields,ut1)=>{
    if(!Number.isFinite(tt)) throw new Error('Invalid worker instant');
    if(pending.length>=128) throw new Error('Native queue full');
    const response=receive();
    if(!failure && pending.length) child.stdin.write(`${tt} ${id}${ut1===undefined?'':` ${ut1}`}\n`);
    const result=await response;
    if(result.error) throw new Error(result.error);
    if(!fields.every(key=>Number.isFinite(result[key]))) throw new Error('Invalid native result');
    return result;
  };
  const calculate=async(tt,body,{nodeMode='osculating',southNode='symbolic'}={})=>{
    if(body==='NORTH_NODE'||body==='SOUTH_NODE'){
      if(!nodeModes.includes(nodeMode)||!southNodeConventions.includes(southNode))throw new Error('Invalid node convention');
      const value=await query(tt,nodeMode==='mean'?12:13,['longitude','declination','speed']);
      return body==='NORTH_NODE'?value:{...value,longitude:normalize(value.longitude+180),declination:southNode==='geometric'?-value.declination:value.declination};
    }
    const id=bodyIds[body==='EARTH'?'SUN':body];
    if(!id) throw new Error('Invalid worker body');
    const value=await query(tt,id,['longitude','declination','speed']);
    return body==='EARTH'?{...value,longitude:normalize(value.longitude+180)}:value;
  };
  return {
    healthy:()=>!failure,
    provenance:{engine:'SuperNOVAS',version:ready.supernovas,calceph:ready.calceph,erfa:lock.erfa.version,serviceHash:codeHash,dependencyHash:manifest.dependencyHash,dataHash,binaryHash,ceresDataHash:lock.minorKernels.ceres.sha256,chironDataHash:lock.minorKernels.chiron.sha256},
    coverage:{first:ready.first + 1,last:ready.last - 1,timeScale:'TT',marginDays:1},
    calculate,
    geometry:(tt,ut1)=>query(tt,100,['siderealTime'],ut1),
    context:tt=>query(tt,0,['dpsi2006','deps2006','dpsi2000b','deps2000b','meanFaganBradley','meanObliquity']),
    close:()=>{child.stdin.end();child.kill();},
  };
};
