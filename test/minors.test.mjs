// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {startWorker} from '../src/worker.mjs';
import {calculate} from '../src/server.mjs';
import {signedAngle} from '../src/contract.mjs';
test('minor bodies remain finite at guarded coverage edges and apply zodiac rates',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  assert.match(worker.provenance.ceresDataHash,/^[a-f0-9]{64}$/);assert.match(worker.provenance.chironDataHash,/^[a-f0-9]{64}$/);
  for(const jdTT of [worker.coverage.first,2451545,worker.coverage.last]){
    const value=await calculate(worker,{jdTT,bodies:['CERES','CHIRON'],zodiac:'lahiri'});
    for(const body of ['CERES','CHIRON']){
      const tropical=value.tropicalBodies[body],selected=value.bodies[body];
      assert.ok(Object.values(tropical).every(Number.isFinite));assert.ok(tropical.longitude>=0&&tropical.longitude<360);
      assert.ok(Math.abs(signedAngle(tropical.longitude,selected.longitude)-value.offsets.projection)<1e-10);
      assert.equal(selected.speed,tropical.speed-value.offsets.dailyRate);
      assert.equal(selected.declination,tropical.declination);
    }
  }
});
