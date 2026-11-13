// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const expected = 'c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2';
export const startWorker = async (kernel) => {
  const dataHash = createHash('sha256').update(readFileSync(kernel)).digest('hex');
  if (dataHash !== expected) throw new Error('JPL DE440s checksum mismatch');
  const binary = resolve(import.meta.dirname, '../.build/worker');
  const binaryHash = createHash('sha256').update(readFileSync(binary)).digest('hex');
  const child = spawn(binary, [kernel], {stdio:['pipe','pipe','inherit']});
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
  if (!ready.ready || ready.supernovas !== '1.8.0' || ready.calceph !== '5.0.1') { child.kill(); throw new Error('Native initialization failed'); }
  return {
    healthy:()=>!failure,
    provenance:{engine:'SuperNOVAS',version:ready.supernovas,calceph:ready.calceph,dataHash,binaryHash},
    coverage:{first:ready.first + 1,last:ready.last - 1,timeScale:'TT',marginDays:1},
    calculate: async (tt, body) => {
      const id = {SUN:10,MOON:11}[body];
      if (!id || !Number.isFinite(tt)) throw new Error('Invalid worker request');
      if (pending.length >= 128) throw new Error('Native queue full');
      const response = receive();
      if (!failure && pending.length) child.stdin.write(`${tt} ${id}\n`);
      const result = await response;
      if (result.error) throw new Error(result.error);
      if (!['longitude','declination','speed'].every(key => Number.isFinite(result[key]))) throw new Error('Invalid native result');
      return result;
    },
    close: () => {child.stdin.end();child.kill();},
  };
};
