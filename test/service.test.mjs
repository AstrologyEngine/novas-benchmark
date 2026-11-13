// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createService} from '../src/server.mjs';
import {startWorker} from '../src/worker.mjs';
const kernel=process.env.JPL_KERNEL;
test('live HTTP calculations, concurrency and invalid-input boundaries', {skip:!kernel}, async t=>{
  const worker=await startWorker(kernel);
  const server=createService(worker);
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));worker.close();});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=body=>fetch(`${base}/v1/calculate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const request={jdTT:2451545,bodies:['SUN','MOON']};
  const result=await (await post(request)).json();
  assert.ok(result.bodies.SUN.longitude>280 && result.bodies.SUN.longitude<281);
  assert.ok(result.bodies.MOON.longitude>223 && result.bodies.MOON.longitude<224);
  const repeated=await Promise.all(Array.from({length:12},()=>post(request).then(r=>r.json())));
  for(const value of repeated) assert.deepEqual(value,result);
  for(const input of [{...request,bodies:['SUN','SUN']},{...request,bodies:['MARS']},{...request,jdTT:0},{...request,jdTT:null},{...request,extra:true},{}]) assert.equal((await post(input)).status,400);
  assert.equal((await fetch(`${base}/missing`)).status,404);
  const cap=await (await fetch(`${base}/capabilities`)).json();
  assert.equal(cap.provenance.dataHash,result.provenance.dataHash);
});
test('native kernel identity fails closed',{skip:!kernel},async()=>{
  await assert.rejects(startWorker(new URL('../package.json',import.meta.url)),/checksum/);
});

test('service rejects unknown fields and reports backend failure',async t=>{
  const worker={healthy:()=>false,coverage:{first:2400000,last:2500000},provenance:{},calculate:async()=>{throw new Error('failure');}};
  const server=createService(worker);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status,503);
  const post=body=>fetch(`${base}/v1/calculate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({jdTT:2451545,bodies:['SUN'],zodiac:'sidereal'})).status,400);
  assert.equal((await post({jdTT:2451545,bodies:['SUN']})).status,503);
});
