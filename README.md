# SuperNOVAS benchmark

An MIT-licensed live benchmark using SuperNOVAS and CALCEPH, with ERFA for the
original IAU 2000B conformance check. It currently covers Sun, Moon, Mercury
through Pluto, symbolic Earth, tropical coordinates, PAC Lahiri and
Fagan-Bradley offsets, four house systems, and mean/osculating lunar nodes.
Ceres and Chiron are supported from pinned JPL Horizons kernels.

## Build and run

Requires Node.js 22+, a C99 compiler, make, CMake, git, curl and tar.

```sh
npm run setup
JPL_KERNEL=data/de440s.bsp npm test
JPL_KERNEL=data/de440s.bsp npm start
```

Setup verifies pinned sources, rebuilds native dependencies cleanly and records
linked-artifact hashes. Downloads recover from interrupted caches. Later edits
to original native code need `npm run build:native`; dependency or recipe changes
need `npm run setup`. Builds/data stay in ignored `.build/` and `data/` folders.
The service binds only to localhost port 8788. Remote/bearer mode and Docker
packaging remain pending. Native globals are isolated in a serialized worker.

## HTTP contract

GET /health reports worker readiness. GET /capabilities lists supported bodies,
zodiacs and coverage. Every result identifies source, binary, dependency and data
hashes. Startup rejects stale native builds or changed kernel bytes.

```sh
curl --fail http://127.0.0.1:8788/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"jdTT":2451545,"bodies":["SUN","MOON","MARS"],"zodiac":"lahiri"}'
```

`POST /v1/calculate`: explicit TT Julian date, unique nonempty body selection,
and optional zodiac (`tropical`, `lahiri`, `fagan-bradley`; default tropical).
Returns selected and tropical bodies, reported/projection offsets and centered
one-day rates. Units are degrees and degrees/day. All requested bodies supply
longitude, speed and declination. Chart time coverage is guarded by one day
inside DE440s coverage for sample and light-time calculations.

`POST /v1/offsets`: `{jdTT, zodiac}` without bodies. Supports 1800-01-01 through
2200-01-01 TT inclusive, independently of the planetary kernel's date coverage.
The current worker still requires the verified kernel to initialize.

`POST /v1/compare`: `{input, candidate}`, where input is a calculate request and
candidate has the corresponding complete calculation shape. It rejects model
and coverage mismatches and reports per-quantity residuals with fixed thresholds.
HTTP 200 means comparison ran; inspect `pass`. HTTP 400 indicates invalid inputs,
415 wrong media type, 413 excessive request size, 503 reference unavailable.

See [model definitions](docs/models.md) for the distinction between reported and
applied Lahiri offsets and why original IAU 2000B uses a separate implementation.
The external cross-engine harness and reports remain in the separate AGPL repo.

## Evidence and remaining work

Tests cover live calculations, concurrent requests, reference/model identity,
negative comparisons, original-model published checks and download recovery.
Live tests explicitly skip without JPL_KERNEL; skipped tests are not live passes.
The repository has not yet delivered complete chart coverage, a Docker image,
or a stable release. Dependency terms are retained in NOTICE and notices/;
original code is MIT, not a relicensing of native dependencies or JPL data.

## House geometry

`POST /v1/calculate` also accepts `jdUT1`, `location: {latitude, longitude}`
(degrees, east-positive longitude), `houseSystem` (`whole-sign`, `equal`,
`placidus`, `porphyry`) and optional `polarHouses` (`error`, default, or
`porphyry`). Supply the time, location and system together; TT minus UT1 must
be within one day. Bodies are still required. The response adds `geometry`
with twelve selected-zodiac cusps, four angles, requested/actual system,
fallback reason, GAST and true obliquity. `/v1/compare` checks every cusp and
angle, astronomical geometry and system/model identity.

Placidus is undefined at or beyond the polar circle. An explicit Porphyry
fallback can be requested. Exact geographic poles and degenerate horizon
intersections return HTTP 422. No invented cusp set is returned for undefined
geometry. Whole Sign cusps are constructed from the selected-zodiac Ascendant.

## Lunar nodes

Include `NORTH_NODE` and/or `SOUTH_NODE` in `bodies`. `nodeMode` selects
`osculating` (default) or `mean`; `southNode` selects `symbolic` (default,
same declination as North) or `geometric` (opposite declination). Both South
conventions use North longitude plus 180 degrees and the same longitude rate.
These options require at least one node in the request. Null/unknown values
are rejected. Responses state the effective choices in `nodeConvention`,
which candidate comparisons must match exactly.

Nodes are geometric directions, without light-time, aberration or deflection.
The mean node uses the IERS/Simon lunar argument plus full nutation; the
osculating node uses the instantaneous Moon–Earth inertial orbital plane from
DE440s, rotated to the true ecliptic/equinox of date. Their rates use the same
centered TT ±0.5 day sampling and selected-zodiac rate correction as planets.
See [model definitions](docs/models.md) for sources and frame details.

## Minor-body inputs

Ceres and Chiron use SuperNOVAS apparent geocentric positions from the exact
JPL Horizons SPKs committed under `data/`. Their request URLs, returned target
IDs and response metadata are retained beside the binaries. Setup and startup
verify both kernel checksums. They are supplied reference inputs; setup does
not regenerate them from a changing online orbital solution.

Advertised chart coverage is the intersection of all three kernel spans,
with a one-day guard for rates and light-time evaluation. Discontinuous,
nonfinite or disjoint coverage is rejected. Provenance includes separate
`ceresDataHash` and `chironDataHash` fields. The original service code is MIT;
JPL input provenance is retained separately in NOTICE and the metadata files.
