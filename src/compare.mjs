// SPDX-License-Identifier: MIT
import {isRecord,signedAngle} from './contract.mjs';
export const compareResults=(reference,candidate)=>{
  if(!isRecord(candidate)||candidate.jdTT!==reference.jdTT||candidate.zodiac!==reference.zodiac||!isRecord(candidate.bodies)||!isRecord(candidate.offsets))throw new Error('Candidate identity or shape mismatch');
  if(Object.keys(candidate.bodies).sort().join(',')!==Object.keys(reference.bodies).sort().join(','))throw new Error('Candidate coverage mismatch');
  if(candidate.coordinates!==reference.coordinates||candidate.speed!==reference.speed||!isRecord(candidate.offsets.models)
    ||Object.keys(candidate.offsets.models).sort().join(',')!==Object.keys(reference.offsets.models).sort().join(',')
    ||Object.entries(reference.offsets.models).some(([key,value])=>candidate.offsets.models[key]!==value))throw new Error('Candidate model mismatch');
  const rows=[];
  const append=(path,actual,expected,angular=false,speed=false)=>{
    if(!Number.isFinite(actual))throw new Error(`Missing/nonfinite ${path}`);
    const delta=angular?signedAngle(actual,expected):actual-expected;
    const tolerance=path==='offsets.reported'&&reference.zodiac==='lahiri'?1e-6/3600:1/3600;
    rows.push({path,actual,expected,delta,tolerance,unit:speed?'degrees/day':'degrees',pass:Math.abs(delta)<=tolerance});
  };
  for(const [body,values]of Object.entries(reference.bodies)){
    if(!isRecord(candidate.bodies[body])||Object.keys(candidate.bodies[body]).sort().join(',')!=='declination,longitude,speed')throw new Error('Candidate quantity coverage mismatch');
    for(const [field,expected]of Object.entries(values))append(`bodies.${body}.${field}`,candidate.bodies[body][field],expected,field==='longitude',field==='speed');
  }
  if(Boolean(reference.geometry)!==Boolean(candidate.geometry))throw new Error('Candidate geometry coverage mismatch');
  if(reference.geometry){
    const expected=reference.geometry,actual=candidate.geometry;
    if(candidate.jdUT1!==reference.jdUT1||!isRecord(candidate.location)||candidate.location.latitude!==reference.location.latitude||candidate.location.longitude!==reference.location.longitude
      ||['requestedSystem','actualSystem','fallbackReason','model','siderealModel'].some(key=>actual[key]!==expected[key])
      ||!isRecord(actual.angles)||Object.keys(actual.angles).sort().join(',')!==Object.keys(expected.angles).sort().join(',')
      ||!Array.isArray(actual.cusps)||actual.cusps.length!==12)throw new Error('Candidate geometry model mismatch');
    for(const key of ['siderealTime','obliquity'])append(`geometry.${key}`,actual[key],expected[key],key==='siderealTime');
    for(const [key,value]of Object.entries(expected.angles))append(`geometry.angles.${key}`,actual.angles[key],value,true);
    expected.cusps.forEach((value,i)=>append(`geometry.cusps.${i}`,actual.cusps[i],value,true));
  }
  for(const field of ['reported','projection','dailyRate'])append(`offsets.${field}`,candidate.offsets[field],reference.offsets[field],field!=='dailyRate',field==='dailyRate');
  return {kind:'model-conformance',pass:rows.every(row=>row.pass),compared:rows.length,rows,reference};
};
