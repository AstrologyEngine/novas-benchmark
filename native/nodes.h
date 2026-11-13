// SPDX-License-Identifier: MIT
#ifndef BENCHMARK_NODES_H
#define BENCHMARK_NODES_H
#include <math.h>
// Build an orbital plane from inertial state vectors, before rotating its pole.
static inline int orbital_pole(const double state[6], double pole[3]) {
  for (int i=0; i<6; i++) if (!isfinite(state[i])) return 1;
  pole[0]=state[1]*state[5]-state[2]*state[4];
  pole[1]=state[2]*state[3]-state[0]*state[5];
  pole[2]=state[0]*state[4]-state[1]*state[3];
  double norm=hypot(hypot(pole[0],pole[1]),pole[2]);
  if (!isfinite(norm) || norm<=0) return 1;
  for (int i=0; i<3; i++) pole[i]/=norm;
  return 0;
}
// k cross h points along the ascending intersection with the reference plane.
static inline int ascending_node(const double pole[3], double *longitude) {
  if (!isfinite(pole[0]) || !isfinite(pole[1]) || !isfinite(pole[2]) || hypot(pole[0],pole[1])<1e-12) return 1;
  *longitude=fmod(atan2(pole[0],-pole[1])*180/acos(-1.0)+360,360);
  return 0;
}
#endif
