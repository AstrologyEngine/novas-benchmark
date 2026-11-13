// SPDX-License-Identifier: MIT
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const lock=JSON.parse(readFileSync(resolve(root,'dependencies.json')));
const build=resolve(root,'.build');
const vendor=resolve(build,'vendor');
const prefix=resolve(build,'install');
mkdirSync(vendor,{recursive:true});mkdirSync(resolve(root,'data'),{recursive:true});
const run=(cmd,args,options={})=>execFileSync(cmd,args,{stdio:'inherit',...options});
const download=(entry,path)=>{
  if(!existsSync(path)) run('curl',['--fail','--location','--retry','2','--proto','=https',entry.url,'--output',path]);
  if(createHash('sha256').update(readFileSync(path)).digest('hex')!==entry.sha256) throw new Error(`Checksum mismatch: ${path}`);
};
const source=resolve(vendor,'SuperNOVAS');
if(!existsSync(source)) run('git',['clone','--depth','1','--branch',`v${lock.supernovas.version}`,lock.supernovas.repository,source]);
const revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(revision!==lock.supernovas.revision || execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim()) throw new Error('SuperNOVAS source identity mismatch');
const archive=resolve(vendor,'calceph.tar.gz');download(lock.calceph,archive);
run('tar',['-xzf',archive,'-C',vendor]);
const calBuild=resolve(build,'calceph');
run('cmake',['-S',resolve(vendor,`calceph-${lock.calceph.version}`),'-B',calBuild,`-DCMAKE_INSTALL_PREFIX=${prefix}`,'-DENABLE_FORTRAN=OFF','-DENABLE_PYTHON=OFF','-DENABLE_MEX=OFF']);
run('cmake',['--build',calBuild,'-j4']);run('cmake',['--install',calBuild]);
run('make',['-j4','static','WITHOUT_CURL=1','CALCEPH_SUPPORT=1',`CPPFLAGS=-DWITHOUT_CURL -I${source}/include -I${prefix}/include`,`LDFLAGS=-L${prefix}/lib`],{cwd:source});
run(process.execPath,[resolve(root,'scripts/build-native.mjs')],{env:{...process.env,SUPERNOVAS_SOURCE:source,CALCEPH_PREFIX:prefix}});
download(lock.kernel,resolve(root,'data/de440s.bsp'));
console.log('Ready: JPL_KERNEL=data/de440s.bsp npm start');
