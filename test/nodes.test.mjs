// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {startWorker} from '../src/worker.mjs';
import {calculate,createService} from '../src/server.mjs';
import {compareResults} from '../src/compare.mjs';
import {signedAngle} from '../src/contract.mjs';
test('inertial orbital pole gives the ascending intersection and rejects degeneracy',()=>{
  const directory=mkdtempSync(join(tmpdir(),'novas-node-test-'));
  try{
    const source=join(directory,'test.c'),binary=join(directory,'test');
    writeFileSync(source,`#include "nodes.h"
int main(void) {
  const double rad=acos(-1.0)/180;
  for(int longitude=0;longitude<360;longitude+=15)for(int inclination=5;inclination<180;inclination+=20){
    double o=longitude*rad,i=inclination*rad,pole[3],actual;
    double state[6]={cos(o),sin(o),0,-sin(o)*cos(i),cos(o)*cos(i),sin(i)};
    if(orbital_pole(state,pole)||ascending_node(pole,&actual)||fabs(remainder(actual-longitude,360))>1e-10)return 1;
  }
  double zero[6]={0},pole[3],longitude;
  if(!orbital_pole(zero,pole))return 2;
  double coplanar[3]={0,0,1};if(!ascending_node(coplanar,&longitude))return 3;
  double invalid[6]={NAN,1,0,0,1,0};if(!orbital_pole(invalid,pole))return 4;
  return 0;
}`);
    execFileSync(process.env.CC??'cc',['-std=c99','-Wall','-Wextra','-Werror',`-I${resolve(import.meta.dirname,'../native')}`,source,'-lm','-o',binary]);
    execFileSync(binary);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('mean anchor, osculating opposition, selected-zodiac rates and explicit models',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  const jdTT=2451545,bodies=['NORTH_NODE','SOUTH_NODE'];
  for(const tt of [worker.coverage.first,worker.coverage.last])for(const nodeMode of ['mean','osculating']){
    const edge=await worker.calculate(tt,'NORTH_NODE',{nodeMode});
    assert.ok(Object.values(edge).every(Number.isFinite));assert.ok(edge.longitude>=0&&edge.longitude<360);
  }
  const context=await worker.context(jdTT);
  const mean=await worker.calculate(jdTT,'NORTH_NODE',{nodeMode:'mean'});
  assert.ok(Math.abs(signedAngle(mean.longitude,450160.398036/3600+context.dpsi2006))<1e-8);
  const osculating=await worker.calculate(jdTT,'NORTH_NODE',{nodeMode:'osculating'});
  assert.ok(Math.abs(signedAngle(mean.longitude,osculating.longitude))>0.1);
  for(const nodeMode of ['mean','osculating'])for(const southNode of ['symbolic','geometric'])for(const zodiac of ['tropical','lahiri','fagan-bradley']){
    const result=await calculate(worker,{jdTT,bodies,zodiac,nodeMode,southNode});
    const north=result.bodies.NORTH_NODE,south=result.bodies.SOUTH_NODE;
    assert.ok(Math.abs(Math.abs(signedAngle(south.longitude,north.longitude))-180)<1e-10);
    assert.equal(south.speed,north.speed);assert.equal(south.declination,southNode==='geometric'?-north.declination:north.declination);
    assert.ok(Math.abs(signedAngle(result.tropicalBodies.NORTH_NODE.longitude,north.longitude)-result.offsets.projection)<1e-10);
    assert.equal(north.speed,result.tropicalBodies.NORTH_NODE.speed-result.offsets.dailyRate);
    assert.equal(result.nodeConvention.mode,nodeMode);assert.equal(result.nodeConvention.southDeclination,southNode);
    assert.equal(compareResults(result,result).pass,true);
    const wrong=structuredClone(result);wrong.nodeConvention.mode='other';assert.throws(()=>compareResults(result,wrong),/node model/);
    const perturbed=structuredClone(result);perturbed.bodies.NORTH_NODE.longitude+=2/3600;assert.equal(compareResults(result,perturbed).pass,false);
  }
});
test('node API defaults are explicit and unsupported conventions are rejected',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  const server=createService(worker);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const post=input=>fetch(`http://127.0.0.1:${server.address().port}/v1/calculate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
  const input={jdTT:2451545,bodies:['NORTH_NODE','SOUTH_NODE']};
  const response=await post(input);assert.equal(response.status,200);const result=await response.json();assert.equal(result.nodeConvention.mode,'osculating');assert.equal(result.nodeConvention.southDeclination,'symbolic');
  for(const patch of [{nodeMode:null},{southNode:null},{nodeMode:'true'},{southNode:'same-latitude'},{bodies:['SUN'],nodeMode:'mean'}])assert.equal((await post({...input,...patch})).status,400);
});
