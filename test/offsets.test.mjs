// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {startWorker} from '../src/worker.mjs';
import {calculate} from '../src/server.mjs';
import {lahiriMean} from '../src/offsets.mjs';
import {compareResults} from '../src/compare.mjs';
import {bodyNames,signedAngle} from '../src/contract.mjs';
test('PAC mean anchor and published polynomial',()=>{
  assert.ok(Math.abs(lahiriMean(2451545)-(23+51/60+25.53/3600))<1e-13);
});
test('major planets, original nutation model, and sidereal transformation',{skip:!process.env.JPL_KERNEL},async t=>{
  const worker=await startWorker(process.env.JPL_KERNEL);t.after(()=>worker.close());
  // ERFA 2.0.1 t_erfa_c.c published nut00b validation, radians at MJD 53736.
  const context=await worker.context(2453736.5);
  assert.ok(Math.abs(context.dpsi2000b*Math.PI/180-(-0.9632552291148362783e-5))<1e-13);
  assert.ok(Math.abs(context.deps2000b*Math.PI/180-0.4063197106621159367e-4)<1e-13);
  const result=await calculate(worker,{jdTT:2451545,bodies:bodyNames,zodiac:'lahiri'});
  assert.equal(Object.keys(result.bodies).length,11);
  for(const body of bodyNames){
    assert.ok(Math.abs(signedAngle(result.tropicalBodies[body].longitude,result.bodies[body].longitude)-result.offsets.projection)<1e-12);
    assert.equal(result.bodies[body].declination,result.tropicalBodies[body].declination);
  }
  assert.equal(compareResults(result,result).pass,true);
  const broken=structuredClone(result);broken.bodies.SUN.longitude+=0.01;
  assert.equal(compareResults(result,broken).pass,false);
  const nearOffset=structuredClone(result);nearOffset.offsets.reported+=0.5e-6/3600;assert.equal(compareResults(result,nearOffset).pass,true);
  const badOffset=structuredClone(result);badOffset.offsets.reported+=2e-6/3600;assert.equal(compareResults(result,badOffset).pass,false);
  const badModel=structuredClone(result);badModel.offsets.models.reportedNutation='other';assert.throws(()=>compareResults(result,badModel),/model/);
  delete broken.bodies.MOON;assert.throws(()=>compareResults(result,broken),/coverage/);
  const nan=structuredClone(result);nan.bodies.SUN.speed=NaN;assert.throws(()=>compareResults(result,nan),/nonfinite/);
  // IAE 2027 printed p. 423: Jan 1 true ayanamsa 24d14m13.9s, rounded 0.1s.
  const table=await calculate(worker,{jdTT:2461406.5,zodiac:'lahiri'},true);
  assert.ok(Math.abs(table.offsets.reported*3600-(24*3600+14*60+13.9))<0.055);
  // The full-series projection is explicitly distinct from the 77-term reported value.
  assert.notEqual(result.offsets.projection,result.offsets.reported);
});
