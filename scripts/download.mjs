// SPDX-License-Identifier: MIT
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,renameSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export const fileHash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const transfer=(url,path)=>execFileSync('curl',['--fail','--location','--retry','2','--proto','=https','--proto-redir','=https',url,'--output',path],{stdio:'inherit'});
export const downloadVerified=(entry,path,fetchFile=transfer)=>{
  if(existsSync(path)&&fileHash(path)===entry.sha256)return;
  const temporary=`${path}.part-${process.pid}`;
  try{
    fetchFile(entry.url,temporary);
    if(fileHash(temporary)!==entry.sha256)throw new Error(`Checksum mismatch: ${path}`);
    renameSync(temporary,path);
  }finally{rmSync(temporary,{force:true});}
};
