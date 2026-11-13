// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { startWorker } from './worker.mjs';
import {bodyNames,zodiacs,offsetCoverage,normalize,isRecord,validTime} from './contract.mjs';
import {calculateOffsets} from './offsets.mjs';
import {compareResults} from './compare.mjs';

const validateInput=(input,worker,offsetOnly=false)=>{
  const allowed=offsetOnly?['jdTT','zodiac']:['jdTT','bodies','zodiac'];
  if(!isRecord(input)||Object.keys(input).some(key=>!allowed.includes(key))) throw new Error('Invalid fields');
  if(!validTime(input.jdTT,offsetOnly?offsetCoverage:worker.coverage)) throw new Error('Invalid TT');
  if(!zodiacs.includes(input.zodiac??'tropical')) throw new Error('Invalid zodiac');
  if(!offsetOnly && (!Array.isArray(input.bodies)||!input.bodies.length||input.bodies.length>bodyNames.length
    ||new Set(input.bodies).size!==input.bodies.length||input.bodies.some(body=>!bodyNames.includes(body)))) throw new Error('Invalid bodies');
  return {...input,zodiac:input.zodiac??'tropical'};
};
export const calculate=async(worker,input,offsetOnly=false)=>{
  const offsets=await calculateOffsets(worker,input.jdTT,input.zodiac);
  const base={jdTT:input.jdTT,zodiac:input.zodiac,offsets,provenance:worker.provenance};
  if(offsetOnly) return base;
  const tropicalBodies=Object.fromEntries(await Promise.all(input.bodies.map(async body=>[body,await worker.calculate(input.jdTT,body)])));
  const bodies=Object.fromEntries(Object.entries(tropicalBodies).map(([body,value])=>[body,{...value,
    longitude:input.zodiac==='tropical'?value.longitude:normalize(value.longitude-offsets.projection),speed:value.speed-offsets.dailyRate}]));
  return {...base,bodies,tropicalBodies,coordinates:'geocentric apparent ecliptic of date in requested zodiac; true tropical equatorial declination',speed:'centered TT +/-0.5 day',
    conventions:{EARTH:'symbolic Sun-opposite longitude; Sun speed and declination',planetTargets:'DE440s planetary system barycenters; Earth geocenter; Sun and Moon centers'}};
};
export const createService=(worker)=>createServer({requestTimeout:15000},async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method==='GET'&&req.url==='/health') return send(worker.healthy()?200:503,{status:worker.healthy()?'ok':'unavailable',provenance:worker.provenance});
  if(req.method==='GET'&&req.url==='/capabilities') return send(200,{bodies:bodyNames,time:'explicit-TT',zodiacs,speed:'centered-day',coverage:worker.coverage,offsetCoverage,provenance:worker.provenance});
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
  try{result=await calculate(worker,input,offsetOnly);}catch{return send(503,{error:'REFERENCE_UNAVAILABLE'});}
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
