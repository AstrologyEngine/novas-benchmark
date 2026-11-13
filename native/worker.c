// SPDX-License-Identifier: MIT
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <novas.h>
#include <novas-calceph.h>
#include <erfa.h>
#include "nodes.h"

static int node_position(t_calcephbin *kernel, double tt, int id, double *longitude, double *declination) {
  const double degrees=180/acos(-1.0);
  const double tdb=tt+tt2tdb(tt)/86400;
  double obliquity, dpsi;
  if (e_tilt(tt,NOVAS_FULL_ACCURACY,NULL,&obliquity,NULL,&dpsi,NULL)) return 1;
  if (id==12) {
    novas_delaunay_args arguments;
    if (fund_args((tdb-2451545)/36525,&arguments)) return 1;
    *longitude=fmod(arguments.Omega*degrees+dpsi/3600+360,360);
  } else {
    double state[6],pole[3],tod[3],ecliptic[3];
    if (!calceph_compute_unit(kernel,2451545,tdb-2451545,301,399,
        CALCEPH_UNIT_KM|CALCEPH_UNIT_DAY|CALCEPH_USE_NAIFID,state)) return 1;
    if (orbital_pole(state,pole) || gcrs_to_tod(tt,NOVAS_FULL_ACCURACY,pole,tod)
        || equ2ecl_vec(tt,NOVAS_TRUE_EQUATOR,NOVAS_FULL_ACCURACY,tod,ecliptic)
        || ascending_node(ecliptic,longitude)) return 1;
  }
  *declination=asin(sin(*longitude/degrees)*sin(obliquity/degrees))*degrees;
  return 0;
}
static int position(t_calcephbin *kernel, double tt, int id, double *longitude, double *declination) {
  if (id==12 || id==13) return node_position(kernel,tt,id,longitude,declination);
  object body;
  double ra, distance, latitude;
  if (id==20000001 || id==20002060) {
    if (make_ephem_object(id==20000001?"Ceres":"Chiron",id,&body)) return 1;
  } else if (make_planet(id, &body)) return 1;
  if (app_planet(tt, &body, NOVAS_FULL_ACCURACY, &ra, declination, &distance)) return 1;
  return equ2ecl(tt, NOVAS_TRUE_EQUATOR, NOVAS_FULL_ACCURACY, ra, *declination, longitude, &latitude);
}
static int context(double tt) {
  const double degrees = 180.0 / acos(-1.0);
  const double b1950 = 2433282.42345905;
  double dp, de, dpb, deb, vector[3], equinox[3] = {1, 0, 0};
  if (iau2000a(2451545.0, tt - 2451545.0, &dp, &de)) return 1;
  eraNut00b(2451545.0, tt - 2451545.0, &dpb, &deb);
  if (precession(tt, equinox, b1950, vector)) return 1;
  double epsilon = mean_obliq(b1950) / 3600.0 / degrees;
  double longitude = atan2(vector[1]*cos(epsilon) + vector[2]*sin(epsilon), vector[0]) * degrees;
  double mean_fagan = 24.0 + 2.0/60 + (31.36 - 0.41256)/3600 - longitude;
  printf("{\"dpsi2006\":%.17g,\"deps2006\":%.17g,\"dpsi2000b\":%.17g,\"deps2000b\":%.17g,\"meanFaganBradley\":%.17g,\"meanObliquity\":%.17g}\n",
    dp*degrees, de*degrees, dpb*degrees, deb*degrees, mean_fagan, mean_obliq(tt)/3600);
  return 0;
}
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  double first=-INFINITY,last=INFINITY;
  int continuous;
  for (int i=1;i<argc;i++) {
    double begin,end;
    t_calcephbin *part=calceph_open(argv[i]);
    if (!part || !calceph_gettimespan(part,&begin,&end,&continuous) || continuous!=1 || !isfinite(begin) || !isfinite(end)) return 2;
    first=fmax(first,begin);last=fmin(last,end);calceph_close(part);
  }
  if (first>=last) return 2;
  t_calcephbin *kernel=calceph_open_array(argc-1,(const char *const *)(argv+1));
  if (!kernel || novas_use_calceph(kernel) || novas_use_calceph_planets(kernel) || novas_calceph_use_ids(NOVAS_ID_NAIF)) return 2;
  char calceph_version[CALCEPH_MAX_CONSTANTNAME];
  calceph_getversion_str(calceph_version);
  printf("{\"ready\":true,\"first\":%.17g,\"last\":%.17g,\"supernovas\":\"%d.%d.%d\",\"calceph\":\"%s\"}\n", first, last, SUPERNOVAS_MAJOR_VERSION, SUPERNOVAS_MINOR_VERSION, SUPERNOVAS_PATCHLEVEL, calceph_version);
  fflush(stdout);
  char line[256], extra;
  double tt, ut1;
  int id;
  while (fgets(line, sizeof line, stdin)) {
    double lon, dec, before, after, unused;
    if (sscanf(line, "%lf %d %lf %c", &tt, &id, &ut1, &extra) == 3 && id == 100) {
      double gst, equation;
      if (!isfinite(tt) || !isfinite(ut1) || tt < first || tt > last || fabs(tt-ut1) > 1
          || e_tilt(tt, NOVAS_FULL_ACCURACY, NULL, NULL, &equation, NULL, NULL))
        puts("{\"error\":\"INVALID_GEOMETRY_INPUT\"}");
      else {
        /* Evaluate at the explicit TT: novas_gast caches UT1 without its TT offset. */
        gst = novas_gmst(ut1, (tt-ut1)*86400) + equation/3600;
        printf("{\"siderealTime\":%.17g}\n", fmod(gst*15+360,360));
      }
      fflush(stdout);
      continue;
    }
    if (sscanf(line, "%lf %d %c", &tt, &id, &extra) != 2 || !isfinite(tt)
        || id < 0 || (id > 13 && id != 20000001 && id != 20002060) || id == NOVAS_EARTH
        || (id == 0 ? (tt < 2378496.0 || tt > 2524594.0) : (tt - 1 < first || tt + 1 > last))) {
      puts("{\"error\":\"INVALID_NATIVE_INPUT\"}");
    } else if (id == 0) {
      if (context(tt)) puts("{\"error\":\"CONTEXT_UNAVAILABLE\"}");
    } else if (position(kernel, tt, id, &lon, &dec) || position(kernel, tt - 0.5, id, &before, &unused)
               || position(kernel, tt + 0.5, id, &after, &unused)) {
      puts("{\"error\":\"REFERENCE_UNAVAILABLE\"}");
    } else {
      double speed = remainder(after - before, 360.0);
      if (!isfinite(lon) || !isfinite(dec) || !isfinite(speed)) puts("{\"error\":\"NONFINITE_RESULT\"}");
      else printf("{\"longitude\":%.17g,\"declination\":%.17g,\"speed\":%.17g}\n", lon, dec, speed);
    }
    fflush(stdout);
  }
  calceph_close(kernel);
  return 0;
}
