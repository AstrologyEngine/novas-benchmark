// SPDX-License-Identifier: MIT
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <novas.h>
#include <novas-calceph.h>

static int position(double tt, int id, double *longitude, double *declination) {
  object body;
  double ra, distance, latitude;
  if (make_planet(id, &body)) return 1;
  if (app_planet(tt, &body, NOVAS_FULL_ACCURACY, &ra, declination, &distance)) return 1;
  return equ2ecl(tt, NOVAS_TRUE_EQUATOR, NOVAS_FULL_ACCURACY, ra, *declination, longitude, &latitude);
}
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  t_calcephbin *kernel = calceph_open(argv[1]);
  if (!kernel || novas_use_calceph_planets(kernel)) return 2;
  double first, last;
  int continuous;
  if (!calceph_gettimespan(kernel, &first, &last, &continuous)) return 2;
  char calceph_version[CALCEPH_MAX_CONSTANTNAME];
  calceph_getversion_str(calceph_version);
  printf("{\"ready\":true,\"first\":%.17g,\"last\":%.17g,\"supernovas\":\"%d.%d.%d\",\"calceph\":\"%s\"}\n", first, last, SUPERNOVAS_MAJOR_VERSION, SUPERNOVAS_MINOR_VERSION, SUPERNOVAS_PATCHLEVEL, calceph_version);
  fflush(stdout);
  char line[256], extra;
  double tt;
  int id;
  while (fgets(line, sizeof line, stdin)) {
    double lon, dec, before, after, unused;
    if (sscanf(line, "%lf %d %c", &tt, &id, &extra) != 2 || !isfinite(tt)
        || !(id == NOVAS_SUN || id == NOVAS_MOON) || tt - 1 < first || tt + 1 > last) {
      puts("{\"error\":\"INVALID_NATIVE_INPUT\"}");
    } else if (position(tt, id, &lon, &dec) || position(tt - 0.5, id, &before, &unused)
               || position(tt + 0.5, id, &after, &unused)) {
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
