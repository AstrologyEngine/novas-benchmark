// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { startWorker } from './worker.mjs';
export const createService = (worker) => createServer({requestTimeout:15000}, async (req,res) => {
  const send = (status, value) => {res.writeHead(status, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(value));};
  if (req.method === 'GET' && req.url === '/health') return send(worker.healthy()?200:503,{status:worker.healthy()?'ok':'unavailable',provenance:worker.provenance});
  if (req.method === 'GET' && req.url === '/capabilities') return send(200,{bodies:['SUN','MOON'],time:'explicit-TT',zodiac:'tropical',speed:'centered-day',coverage:worker.coverage,provenance:worker.provenance});
  if (req.method !== 'POST' || req.url !== '/v1/calculate') {req.resume();return send(404,{error:'NOT_FOUND'});}
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {req.resume();return send(415,{error:'JSON_REQUIRED'});}
  let input;
  try {
    const chunks=[]; let bytes=0;
    for await (const chunk of req) {bytes+=chunk.length;if(bytes>65536){send(413,{error:'TOO_LARGE'});return;}chunks.push(chunk);}
    input=JSON.parse(Buffer.concat(chunks).toString());
    if (!input || Object.keys(input).some(key => !['jdTT','bodies'].includes(key)) || !Number.isFinite(input.jdTT)
      || !Array.isArray(input.bodies) || !input.bodies.length || input.bodies.length>2 || new Set(input.bodies).size!==input.bodies.length
      || input.bodies.some(body=>!['SUN','MOON'].includes(body)) || input.jdTT<worker.coverage.first || input.jdTT>worker.coverage.last) throw new Error('Invalid request');
  } catch {return send(400,{error:'INVALID_REQUEST'});}
  try {
    const bodies=Object.fromEntries(await Promise.all(input.bodies.map(async body=>[body,await worker.calculate(input.jdTT,body)])));
    send(200,{jdTT:input.jdTT,bodies,coordinates:'geocentric apparent tropical ecliptic of date; true equatorial declination',speed:'centered TT +/-0.5 day',provenance:worker.provenance});
  } catch {send(503,{error:'REFERENCE_UNAVAILABLE'});}
});
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (!process.env.JPL_KERNEL) throw new Error('Set JPL_KERNEL to pinned de440s.bsp');
  const worker=await startWorker(process.env.JPL_KERNEL);
  const server=createService(worker);
  server.listen(Number(process.env.PORT ?? 8788),'127.0.0.1');
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{server.close();server.closeIdleConnections();worker.close();});
}
