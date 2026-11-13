// SPDX-License-Identifier: MIT
export const bodyIds=Object.freeze({SUN:10,MOON:11,MERCURY:1,VENUS:2,MARS:4,JUPITER:5,SATURN:6,URANUS:7,NEPTUNE:8,PLUTO:9});
export const bodyNames=Object.freeze([...Object.keys(bodyIds),'EARTH']);
export const zodiacs=Object.freeze(['tropical','lahiri','fagan-bradley']);
export const offsetCoverage=Object.freeze({first:2378496.5,last:2524593.5,timeScale:'TT'});
export const normalize=value=>((value%360)+360)%360;
export const signedAngle=(a,b)=>normalize(a-b+180)-180;
export const isRecord=value=>value!==null && typeof value==='object' && !Array.isArray(value);
export const validTime=(jd,coverage)=>Number.isFinite(jd)&&jd>=coverage.first&&jd<=coverage.last;
