// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {calculateHouses,houseSystems} from '../src/houses.mjs';
import {createService} from '../src/server.mjs';
import {startWorker} from '../src/worker.mjs';
const input={siderealTime:0,obliquity:23.439,location:{latitude:0,longitude:0}};
test('equatorial cardinal geometry and sidereal Whole Sign construction',()=>{
  for(const houseSystem of houseSystems){
    const value=calculateHouses({...input,houseSystem});
    assert.equal(value.angles.ascendant,90);
    assert.equal(value.angles.midheaven,0);
    assert.equal(value.cusps.length,12);
    for(let i=0;i<6;i++)assert.ok(Math.abs((value.cusps[i+6]-value.cusps[i]+360)%360-180)<1e-10);
  }
  const sidereal=calculateHouses({...input,houseSystem:'whole-sign',projection:24});
  assert.equal(sidereal.angles.ascendant,66);
  assert.deepEqual(sidereal.cusps,[60,90,120,150,180,210,240,270,300,330,0,30]);
});
test('polar errors and fallback are explicit; degenerate horizon is rejected',()=>{
  const polar={...input,location:{latitude:70,longitude:0},houseSystem:'placidus'};
  assert.throws(()=>calculateHouses(polar),{code:'PLACIDUS_UNDEFINED'});
  const result=calculateHouses({...polar,polarHouses:'porphyry'});
  assert.equal(result.actualSystem,'porphyry');assert.equal(result.fallbackReason,'PLACIDUS_UNDEFINED');
  assert.throws(()=>calculateHouses({...polar,siderealTime:270,location:{latitude:90-input.obliquity,longitude:0},polarHouses:'porphyry'}),{code:'HORIZON_UNDEFINED'});
  assert.throws(()=>calculateHouses({...polar,location:{latitude:90,longitude:0}}),{code:'HORIZON_UNDEFINED'});
});
test('live house API validates time/location, geometry comparisons and polar errors',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  const server=createService(worker);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const post=(path,value)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  const request={jdTT:2451545,jdUT1:2451545-64/86400,bodies:['SUN'],location:{latitude:45,longitude:0},houseSystem:'placidus'};
  const response=await post('/v1/calculate',request);assert.equal(response.status,200);const candidate=await response.json();
  assert.equal(candidate.geometry.actualSystem,'placidus');
  const compare=async value=>(await post('/v1/compare',{input:request,candidate:value})).json();
  assert.equal((await compare(candidate)).pass,true);
  const perturbed=structuredClone(candidate);perturbed.geometry.cusps[1]+=2/3600;
  assert.equal((await compare(perturbed)).pass,false);
  const wrongSystem=structuredClone(candidate);wrongSystem.geometry.actualSystem='porphyry';
  assert.equal((await post('/v1/compare',{input:request,candidate:wrongSystem})).status,400);
  for(const patch of [{jdUT1:null},{jdUT1:2451540},{location:{latitude:91,longitude:0}},{houseSystem:'unknown'}])assert.equal((await post('/v1/calculate',{...request,...patch})).status,400);
  assert.equal((await post('/v1/calculate',{...request,location:{latitude:70,longitude:0}})).status,422);
});

test('explicit TT and UT1 vary independently without stale sidereal context',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  const tt=2451545,ut1=tt-64/86400;
  const sample=async(tt,ut1)=>({...await worker.geometry(tt,ut1),obliquity:(await worker.context(tt)).meanObliquity+(await worker.context(tt)).deps2006});
  const first=await sample(tt,ut1),changedTT=await sample(tt+0.25,ut1),restored=await sample(tt,ut1),changedUT1=await sample(tt,ut1+0.25);
  assert.notEqual(first.siderealTime,changedTT.siderealTime);assert.notEqual(first.obliquity,changedTT.obliquity);
  assert.deepEqual(restored,first);assert.equal(changedUT1.obliquity,first.obliquity);
  assert.ok(Math.abs(changedUT1.siderealTime-first.siderealTime)>80);
});
test('both hemispheres respect the Placidus polar boundary',()=>{
  for(const sign of [-1,1]){
    const base={...input,houseSystem:'placidus'};
    assert.equal(calculateHouses({...base,location:{latitude:sign*(90-input.obliquity-0.01),longitude:0}}).actualSystem,'placidus');
    assert.throws(()=>calculateHouses({...base,location:{latitude:sign*(90-input.obliquity+0.01),longitude:0}}),{code:'PLACIDUS_UNDEFINED'});
    assert.equal(calculateHouses({...base,location:{latitude:sign*70,longitude:0},polarHouses:'porphyry'}).actualSystem,'porphyry');
  }
});
