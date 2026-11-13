import {nativeSourceHash,dependencyHash,digest} from '../src/identity.mjs';
import { createHash } from 'node:crypto';
// SPDX-License-Identifier: MIT
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source=resolve(root,'.build/vendor/SuperNOVAS');
const prefix=resolve(root,'.build/install');
const lock=JSON.parse(readFileSync(resolve(root,'dependencies.json')));
const dependencies=JSON.parse(readFileSync(resolve(root,'.build/dependencies-manifest.json')));
if(dependencies.dependencyHash!==dependencyHash()||dependencies.recipeHash!==digest(['scripts/setup.mjs','scripts/download.mjs'])||dependencies.supernovasRevision!==lock.supernovas.revision)throw new Error('Run setup to rebuild dependencies');
const requiredArtifacts=['.build/vendor/SuperNOVAS/src/c99/obj/solsys-calceph.o','.build/vendor/SuperNOVAS/lib/libsupernovas.a','.build/install/lib/libcalceph.a','.build/install/include/calceph.h'];
if(!Array.isArray(dependencies.artifacts)||dependencies.artifacts.map(item=>item.path).sort().join(',')!==requiredArtifacts.sort().join(','))throw new Error('Incomplete dependency artifact manifest');
for(const artifact of dependencies.artifacts)if(createHash('sha256').update(readFileSync(resolve(root,artifact.path))).digest('hex')!==artifact.sha256)throw new Error('Linked dependency artifact changed; run setup');
if (execFileSync('git', ['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim() !== lock.supernovas.revision || execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim()) throw new Error('SuperNOVAS source identity mismatch');
const erfa=resolve(root,'.build/vendor/erfa');
for(const file of lock.erfa.files) if(createHash('sha256').update(readFileSync(resolve(erfa,file.name))).digest('hex')!==file.sha256) throw new Error('ERFA source identity mismatch');
mkdirSync(resolve(root, '.build'), {recursive: true});
const result = spawnSync(process.env.CC ?? 'cc', ['-std=c99', '-O2', '-Wall', '-Wextra', '-Werror',
  `-I${erfa}`, resolve(erfa,'nut00b.c'), `-I${source}/include`, `-I${prefix}/include`, resolve(root, 'native/worker.c'),
  `${source}/src/c99/obj/solsys-calceph.o`, `${source}/lib/libsupernovas.a`, `${prefix}/lib/libcalceph.a`,
  '-lm', '-lpthread', '-o', resolve(root, '.build/worker')], {stdio:'inherit'});
if (result.error) throw result.error;
if(result.status!==0)process.exit(result.status??1);
writeFileSync(resolve(root,'.build/manifest.json'),JSON.stringify({nativeSourceHash:nativeSourceHash(),dependencyHash:dependencyHash(),dependencyArtifacts:dependencies.artifacts,binaryHash:createHash('sha256').update(readFileSync(resolve(root,'.build/worker'))).digest('hex')},null,2)+'\n');
