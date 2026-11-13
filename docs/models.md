# Calculation definitions

Positions use SuperNOVAS 1.8.0 full-accuracy apparent geocentric positions and
its true equator/ecliptic of date. JPL DE440s supplies planetary system
barycenters, Earth geocenter and Sun/Moon centers through CALCEPH. Speed is a
centered one-TT-day difference; equatorial declination is never projected.
EARTH is explicitly symbolic Sun-opposite longitude with Sun speed/declination.

## Lahiri

The mean formula is transcribed from the PAC Indian Astronomical Ephemeris
2027, printed page 382. The official PDF was read independently from
https://packolkata.imd.gov.in/download/IAE2027.zip (linked by IMD).
The constant is 23 degrees 51 minutes 25.53 seconds at J2000, with the printed
precession polynomial in TT centuries. The printed T^4 coefficient is retained
literally; it is not fitted to another engine.

The reported offset adds original IAU 2000B nutation, implemented by ERFA
2.0.1 eraNut00b (77 luni-solar terms and the Luzum planetary-bias offsets).
The separate projection adds SuperNOVAS full IAU 2000A R06 nutation to match
the tropical coordinates it calculates. The centered daily rate is the change
in the projection offset. These two offsets differ slightly and are reported
separately; neither is a transcription of library calculation code.

The IAE page 423 definition is mean plus nutation in longitude. Its January 1,
2027 tabulated true value (24 degrees 14 minutes 13.9 seconds) provides a rounded
published check, distinct from sub-microarcsecond implementation agreement.

SuperNOVAS 1.8.0's function named iau2000b no longer implements original IAU
2000B: since 1.4.2 it uses a truncated IAU 2006 series. Therefore the original
model check uses the separately pinned ERFA implementation, not that name.
Primary sources: SuperNOVAS src/c99/nutation.c at the pinned revision; ERFA
src/nut00b.c and src/t_erfa_c.c at the pinned revision (dependencies.json).

## Fagan-Bradley

The definition is B1950 JD 2433282.42345905, mean offset 24 degrees 02 minutes
31.36 seconds with the 0.41256 arcsecond modern-precession correction.
SuperNOVAS P03 precession transports the date equinox to the B1950 frame;
its longitude in the mean B1950 ecliptic gives the accumulated offset.
Reported and applied offsets add the same full IAU 2000A R06 nutation.
Definition discussion: https://www.astro.com/swisseph/swisseph.htm
Only the documented definition is used; no implementation or reference tables
from that software are incorporated here.

## Comparison gates

Model conformance requires matching coordinate, speed and offset-model labels.
Reported Lahiri values in the same original-2000B convention use 1 microarcsecond.
Other angular quantities use 1 arcsecond; speeds/rates use 1 arcsecond/day.
Missing bodies or quantities, nonfinite values and altered labels are rejected.
Numerical agreement is distinct from absolute astronomical accuracy. Shared
standard coefficients make exact-model checks transcription/integration checks.

## Independent house geometry

The native layer supplies Greenwich apparent sidereal time from SuperNOVAS
IAU 2006 GMST plus the full equation of equinoxes, and true obliquity from
mean obliquity plus full nutation. Both use explicit TT; rotation uses explicit
UT1. Horizon/ecliptic intersection chooses the eastern root. Meridian/ecliptic
intersection supplies MC. Equal houses advance 30 degrees from Ascendant;
Whole Sign floors the selected-zodiac Ascendant to a 30-degree boundary.
Porphyry trisects each zodiac quadrant. Placidus solves each cusp's own
semi-diurnal or semi-nocturnal arc fraction by bracketed bisection.

These are original geometric implementations; no external house source code
or generated reference data is included. All returned cusp sets must progress
once around the zodiac. Polar Placidus is rejected or explicitly falls back to
Porphyry. Exact poles and coincident horizon/ecliptic planes are undefined.

## Lunar node definitions

The mean ascending node is SuperNOVAS `fund_args().Omega`, evaluated in TDB
centuries from J2000, plus full nutation in longitude. The fundamental argument
is from [IERS Conventions 2010, chapter 5, equation 5.43](https://iers-conventions.obspm.fr/content/chapter5/icc5.pdf)
and Simon et al. (1994). It represents a mean element, distinct from the
instantaneous orbital plane.

The osculating node starts with CALCEPH Moon (NAIF 301) relative to Earth
(399), in the DE440s inertial frame. TT is converted to TDB for the state.
Compute the unit orbital pole from the cross product of inertial position and
velocity. Only then rotate the pole with SuperNOVAS frame bias, precession,
nutation and true obliquity at TT. The reference north vector crossed with
this pole gives the ascending intersection. This avoids mistaking a velocity
in a rotating coordinate frame for an inertial orbital velocity. See the
[JPL description of osculating elements](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/oscltx_c.html).
Zero angular momentum and coplanar poles are rejected as undefined.

No light-time, aberration or gravitational deflection is applied to either
node. The equatorial declination is that of the zero-ecliptic-latitude node
direction using true obliquity. Geometric South negates this declination;
symbolic South deliberately retains North declination, matching the library's
reported opposite-body convention. Both use a 180-degree longitude offset and
the same speed. Mean and osculating models are never silently interchanged.

## Ceres and Chiron

Pinned JPL Horizons SPKs cover 1849-01-01 through 2150-01-01 TDB. Their
returned NAIF target IDs are 20000001 (Ceres) and 20002060 (Chiron), recorded
from the actual API response rather than assumed from older ID conventions.
CALCEPH supplies these states through the generic SuperNOVAS ephemeris
provider; `make_ephem_object` and `app_planet` apply the same apparent
geocentric pipeline used for planets. Longitude and declination use the true
frames of date and rates use centered TT ±0.5 day samples.

The [official Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
describes its base64 SPK output. Exact bytes and acquisition metadata are
committed because later requests can use updated solutions and produce
different files. Both data hashes are reported with every result.
