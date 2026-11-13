// SPDX-License-Identifier: MIT
import {normalize,signedAngle} from './contract.mjs';
export const houseSystems=Object.freeze(['whole-sign','equal','placidus','porphyry']);
const radians=Math.PI/180;
const sin=x=>Math.sin(x*radians);
const cos=x=>Math.cos(x*radians);
const atan2=(y,x)=>Math.atan2(y,x)/radians;
const geometryError=code=>{throw Object.assign(new Error(code),{code});};
const ordered=cusps=>{
  const widths=cusps.map((value,i)=>normalize(cusps[(i+1)%12]-value));
  if(widths.some(width=>width<1e-10)||Math.abs(widths.reduce((a,b)=>a+b,0)-360)>1e-7) geometryError('HOUSE_ORDER_UNDEFINED');
  return cusps;
};
const trisect=anchors=>anchors.flatMap((start,i)=>Array.from({length:3},(_,j)=>normalize(start+normalize(anchors[(i+1)%4]-start)*j/3)));
// Placidus divides each point's own diurnal/nocturnal semi-arc in thirds.
const placidus=(asc,mc,latitude,epsilon,theta)=>{
  const ic=normalize(mc+180);
  const solve=(start,end,fraction,nocturnal)=>{
    const width=normalize(end-start);
    const residual=distance=>{
      const longitude=normalize(start+distance);
      const declination=Math.asin(sin(longitude)*sin(epsilon));
      const semiArc=Math.acos(-Math.tan(latitude*radians)*Math.tan(declination))/radians;
      const ra=atan2(sin(longitude)*cos(epsilon),cos(longitude));
      const target=nocturnal?180-fraction*(180-semiArc):fraction*semiArc;
      return signedAngle(ra-theta,target);
    };
    let low=0,high=width;
    if(!Number.isFinite(residual(low))||!Number.isFinite(residual(high))||residual(low)>1e-8||residual(high)<-1e-8) geometryError('PLACIDUS_UNDEFINED');
    for(let i=0;i<70;i++){
      const middle=(low+high)/2;
      if(residual(middle)>0)high=middle;else low=middle;
    }
    return normalize(start+(low+high)/2);
  };
  const c11=solve(mc,asc,1/3,false),c12=solve(mc,asc,2/3,false);
  const c2=solve(asc,ic,2/3,true),c3=solve(asc,ic,1/3,true);
  return [asc,c2,c3,ic,normalize(c11+180),normalize(c12+180),normalize(asc+180),normalize(c2+180),normalize(c3+180),mc,c11,c12];
};
export const calculateHouses=({siderealTime,obliquity,location,houseSystem,polarHouses='error',projection=0})=>{
  const {latitude,longitude}=location;
  if(Math.abs(latitude)>=90)geometryError('HORIZON_UNDEFINED');
  const theta=normalize(siderealTime+longitude);
  const a=cos(latitude)*cos(theta);
  const b=cos(latitude)*sin(theta)*cos(obliquity)+sin(latitude)*sin(obliquity);
  if(Math.hypot(a,b)<1e-12)geometryError('HORIZON_UNDEFINED');
  let asc=normalize(atan2(-a,b));
  const east=-cos(asc)*sin(theta)+sin(asc)*cos(obliquity)*cos(theta);
  if(Math.abs(east)<1e-12)geometryError('HORIZON_UNDEFINED');
  if(east<0)asc=normalize(asc+180);
  const mc=normalize(atan2(sin(theta),cos(theta)*cos(obliquity)));
  const angles={ascendant:normalize(asc-projection),midheaven:normalize(mc-projection),descendant:normalize(asc+180-projection),imumCoeli:normalize(mc+180-projection)};
  let actualSystem=houseSystem,fallbackReason=null;
  if(houseSystem==='placidus'&&Math.abs(latitude)+obliquity>=90){
    if(polarHouses!=='porphyry')geometryError('PLACIDUS_UNDEFINED');
    actualSystem='porphyry';fallbackReason='PLACIDUS_UNDEFINED';
  }
  let cusps;
  if(actualSystem==='whole-sign')cusps=Array.from({length:12},(_,i)=>normalize(Math.floor(angles.ascendant/30)*30+i*30));
  else if(actualSystem==='equal')cusps=Array.from({length:12},(_,i)=>normalize(angles.ascendant+i*30));
  else {
    const tropical=actualSystem==='placidus'?placidus(asc,mc,latitude,obliquity,theta):trisect([asc,normalize(mc+180),normalize(asc+180),mc]);
    cusps=tropical.map(value=>normalize(value-projection));
  }
  return {siderealTime,obliquity,siderealModel:'IAU-2006-GMST-plus-full-equation-of-equinoxes',requestedSystem:houseSystem,actualSystem,fallbackReason,angles,cusps:ordered(cusps),model:'true-equator-ecliptic; geometric horizon; semiarc Placidus'};
};
