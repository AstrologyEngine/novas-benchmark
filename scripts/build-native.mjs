// SPDX-License-Identifier: MIT
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = process.env.SUPERNOVAS_SOURCE;
const prefix = process.env.CALCEPH_PREFIX;
if (!source || !prefix) throw new Error('Set SUPERNOVAS_SOURCE and CALCEPH_PREFIX to the pinned native builds');
if (execFileSync('git', ['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim() !== 'c7a2462a56c69b314a938360729a031622a1f312' || execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim()) throw new Error('SuperNOVAS source identity mismatch');
mkdirSync(resolve(root, '.build'), {recursive: true});
const result = spawnSync(process.env.CC ?? 'cc', ['-std=c99', '-O2', '-Wall', '-Wextra', '-Werror',
  `-I${source}/include`, `-I${prefix}/include`, resolve(root, 'native/worker.c'),
  `${source}/src/c99/obj/solsys-calceph.o`, `${source}/lib/libsupernovas.a`, `${prefix}/lib/libcalceph.a`,
  '-lm', '-lpthread', '-o', resolve(root, '.build/worker')], {stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
