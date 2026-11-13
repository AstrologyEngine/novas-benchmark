# SuperNOVAS benchmark

MIT-licensed benchmark service around SuperNOVAS and CALCEPH. Current working
slice: live geocentric apparent tropical Sun/Moon longitude, equatorial
declination, and centered one-day longitudinal speed. This is not yet the full
chart benchmark: other planets, houses, nodes, sidereal offsets, comparison API,
Docker packaging and library QC are still pending.

## Build and run

Requires Node.js 22+, C99 compiler, make, CMake, git, curl and tar. macOS ARM64
has been exercised. Downloads and native builds stay in ignored local folders.

```sh
npm run setup
JPL_KERNEL=data/de440s.bsp npm test
JPL_KERNEL=data/de440s.bsp npm start
```

The service binds only to 127.0.0.1:8788. No remote deployment or bearer mode is
implemented yet. GET /health reports native worker health. GET /capabilities
reports supported inputs, guarded coverage and provenance.

```sh
curl --fail http://127.0.0.1:8788/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"jdTT":2451545,"bodies":["SUN","MOON"]}'
```

POST /v1/calculate accepts only jdTT and a nonempty unique selection of SUN/MOON.
All three quantities are returned for each selected body. Longitude/declination
are degrees; speed is degrees per TT day. TT is converted internally by
SuperNOVAS for JPL ephemeris evaluation. Coverage includes a conservative one-day
margin for centered samples and light time. Invalid inputs fail with HTTP 400;
calculation errors return HTTP 503 without fabricated values.

The worker serializes native calculations in one process; parallel HTTP requests
are correlated in FIFO order. Startup verifies DE440s bytes against the pinned
SHA-256. Responses include kernel and executable hashes. See dependencies.json
for source revisions and download hashes, and NOTICE for third-party terms.

Without JPL_KERNEL, live tests are explicitly skipped; that is not a live pass.
The independent Swiss agreement harness and all its reports belong exclusively
to the separate AGPL benchmark repository.
