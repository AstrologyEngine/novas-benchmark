// SPDX-License-Identifier: MIT
// PAC Indian Astronomical Ephemeris 2027, printed pp. 382 and 423.
// Preserve the published T^4 coefficient (-0.00023857), not a fitted value.
export const lahiriMean=jdTT=>{
  const t=(jdTT-2451545)/36525;
  return (23*3600+51*60+25.53 + 5028.796195*t+1.1054348*t**2+0.00007964*t**3-0.00023857*t**4-0.0000000383*t**5)/3600;
};
const at=(context,jdTT,zodiac)=>{
  if(zodiac==='tropical') return {mean:0,reported:0,projection:0};
  const mean=zodiac==='lahiri'?lahiriMean(jdTT):context.meanFaganBradley;
  return {mean,reported:mean+(zodiac==='lahiri'?context.dpsi2000b:context.dpsi2006),projection:mean+context.dpsi2006};
};
export const calculateOffsets=async(worker,jdTT,zodiac)=>{
  const [center,before,after]=await Promise.all([jdTT,jdTT-0.5,jdTT+0.5].map(tt=>worker.context(tt)));
  return {...at(center,jdTT,zodiac),dailyRate:at(after,jdTT+0.5,zodiac).projection-at(before,jdTT-0.5,zodiac).projection,
    models:{mean:zodiac==='lahiri'?'PAC-IAE-2027':zodiac==='fagan-bradley'?'B1950-P03-corrected':'zero',reportedNutation:zodiac==='lahiri'?'IAU-2000B-77-ERFA':'IAU-2000A-R06-SuperNOVAS',projectionNutation:'IAU-2000A-R06-SuperNOVAS'},
    nutation:center};
};
