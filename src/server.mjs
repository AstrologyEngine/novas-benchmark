// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { startWorker } from './worker.mjs';
import {bodyNames,nodeModes,southNodeConventions,zodiacs,offsetCoverage,normalize,isRecord,validTime} from './contract.mjs';
import {calculateOffsets} from './offsets.mjs';
import {calculateHouses,houseSystems} from './houses.mjs';
import {compareResults} from './compare.mjs';

const validateInput=(input,worker,offsetOnly=false)=>{
  const allowed=offsetOnly?['jdTT','zodiac']:['jdTT','bodies','zodiac','jdUT1','location','houseSystem','polarHouses','nodeMode','southNode'];
  if(!isRecord(input)||Object.keys(input).some(key=>!allowed.includes(key))) throw new Error('Invalid fields');
  if(!validTime(input.jdTT,offsetOnly?offsetCoverage:worker.coverage)) throw new Error('Invalid TT');
  if(!zodiacs.includes(input.zodiac??'tropical')) throw new Error('Invalid zodiac');
  if(!offsetOnly && (!Array.isArray(input.bodies)||!input.bodies.length||input.bodies.length>bodyNames.length
    ||new Set(input.bodies).size!==input.bodies.length||input.bodies.some(body=>!bodyNames.includes(body)))) throw new Error('Invalid bodies');
  if(!offsetOnly){
    const hasNodes=input.bodies.some(body=>body==='NORTH_NODE'||body==='SOUTH_NODE');
    if(('nodeMode' in input||'southNode' in input)&&!hasNodes)throw new Error('Node convention without nodes');
    if(!nodeModes.includes(input.nodeMode===undefined?'osculating':input.nodeMode)||!southNodeConventions.includes(input.southNode===undefined?'symbolic':input.southNode))throw new Error('Invalid node convention');
    const hasGeometry=['jdUT1','location','houseSystem','polarHouses'].some(key=>key in input);
    if(hasGeometry&&(!Number.isFinite(input.jdUT1)||Math.abs(input.jdTT-input.jdUT1)>1
      ||!isRecord(input.location)||Object.keys(input.location).sort().join(',')!=='latitude,longitude'
      ||!Number.isFinite(input.location.latitude)||Math.abs(input.location.latitude)>90
      ||!Number.isFinite(input.location.longitude)||Math.abs(input.location.longitude)>180
      ||!houseSystems.includes(input.houseSystem)||!['error','porphyry'].includes(input.polarHouses??'error')))throw new Error('Invalid geometry');
  }
  return {...input,zodiac:input.zodiac??'tropical'};
};
export const calculate=async(worker,input,offsetOnly=false)=>{
  const offsets=await calculateOffsets(worker,input.jdTT,input.zodiac);
  const base={jdTT:input.jdTT,zodiac:input.zodiac,offsets,provenance:worker.provenance};
  if(offsetOnly) return base;
  const tropicalBodies=Object.fromEntries(await Promise.all(input.bodies.map(async body=>[body,await worker.calculate(input.jdTT,body,input)])));
  const bodies=Object.fromEntries(Object.entries(tropicalBodies).map(([body,value])=>[body,{...value,
    longitude:input.zodiac==='tropical'?value.longitude:normalize(value.longitude-offsets.projection),speed:value.speed-offsets.dailyRate}]));
  const geometry=input.houseSystem?calculateHouses({...await worker.geometry(input.jdTT,input.jdUT1),
    obliquity:offsets.nutation.meanObliquity+offsets.nutation.deps2006,location:input.location,
    houseSystem:input.houseSystem,polarHouses:input.polarHouses,projection:offsets.projection}):undefined;
  const nodeConvention=input.bodies.some(body=>body==='NORTH_NODE'||body==='SOUTH_NODE')?{
    mode:input.nodeMode??'osculating',southDeclination:input.southNode??'symbolic',
    model:(input.nodeMode??'osculating')==='mean'?'IERS-2010-Simon-1994-Omega-plus-full-nutation':'DE440s-geocentric-inertial-orbital-plane',
    frame:'true ecliptic/equinox of date; true tropical equatorial declination',
    corrections:'geometric; no light-time, aberration or deflection',
    southLongitude:'north plus 180 degrees; same longitude rate',
  }:undefined;
  return {...base,...(nodeConvention?{nodeConvention}:{}),...(geometry?{jdUT1:input.jdUT1,location:input.location,geometry}:{}),bodies,tropicalBodies,coordinates:nodeConvention?'planets apparent; nodes geometric; ecliptic of date in requested zodiac; true tropical equatorial declination':'geocentric apparent ecliptic of date in requested zodiac; true tropical equatorial declination',speed:'centered TT +/-0.5 day',
    conventions:{EARTH:'symbolic Sun-opposite longitude; Sun speed and declination',planetTargets:'DE440s planetary system barycenters; Earth geocenter; Sun and Moon centers',minorTargets:'pinned JPL Horizons Ceres and Chiron centers; apparent geocentric positions'}};
};
export const createService=(worker)=>createServer({requestTimeout:15000},async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method==='GET'&&req.url==='/health') return send(worker.healthy()?200:503,{status:worker.healthy()?'ok':'unavailable',provenance:worker.provenance});
  if(req.method==='GET'&&req.url==='/capabilities') return send(200,{bodies:bodyNames,time:'explicit-TT; houses require explicit UT1',houseSystems,zodiacs,nodeModes,southNodeConventions,speed:'centered-day',coverage:worker.coverage,offsetCoverage,provenance:worker.provenance});
  if(req.method!=='POST'||!['/v1/calculate','/v1/offsets','/v1/compare'].includes(req.url)){req.resume();return send(404,{error:'NOT_FOUND'});}
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json'){req.resume();return send(415,{error:'JSON_REQUIRED'});}
  const offsetOnly=req.url==='/v1/offsets';
  const comparing=req.url==='/v1/compare';
  let input,candidate;
  try{
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){send(413,{error:'TOO_LARGE'});return;}chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString());
    if(comparing){
      if(!isRecord(body)||Object.keys(body).some(key=>!['input','candidate'].includes(key))||!isRecord(body.candidate)) throw new Error('Invalid comparison');
      candidate=body.candidate;
    }
    input=validateInput(comparing?body.input:body,worker,offsetOnly);
  }catch{return send(400,{error:'INVALID_REQUEST'});}
  let result;
  try{result=await calculate(worker,input,offsetOnly);}catch(error){return send(['HORIZON_UNDEFINED','PLACIDUS_UNDEFINED','HOUSE_ORDER_UNDEFINED'].includes(error.code)?422:503,{error:error.code??'REFERENCE_UNAVAILABLE'});}
  if(comparing){
    try{return send(200,compareResults(result,candidate));}catch{return send(400,{error:'INVALID_CANDIDATE'});}
  }
  send(200,result);
});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.env.JPL_KERNEL) throw new Error('Set JPL_KERNEL to pinned de440s.bsp');
  const worker=await startWorker(process.env.JPL_KERNEL);
  const server=createService(worker);
  server.listen(Number(process.env.PORT??8788),'127.0.0.1');
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeIdleConnections();worker.close();});
}
