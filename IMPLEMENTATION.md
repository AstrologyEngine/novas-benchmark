# SuperNOVAS benchmark implementation contract

Status: major planets, symbolic Earth, Lahiri/Fagan-Bradley offsets and strict comparisons implemented. Partial native/Wasm library QC is being integrated. Houses, nodes, minor bodies, Docker and full coverage remain outstanding. See README for reproducible setup.

## Approved boundaries
- Public target repository: AstrologyEngine/novas-benchmark. Original code MIT; dependencies retain their terms.
- SuperNOVAS C functional API, Node ESM HTTP boundary, persistent native worker; CALCEPH under CeCILL-B, pinned JPL inputs.
- Swiss server and Swiss comparison harness remain in ../benchmark under AGPL. No Swiss dependency, reference artifact, or report enters this repository or ../library.
- Common contract and comparison utilities originate here; dependency direction is MIT to AGPL only.
- Library QC base: fix/lahiri-full-nutation-import, commit 9f84a6e9ec815fb52418f26d98a6ccdd78d688dd. Dedicated branch feat/novas-qc in library/.worktrees/novas-qc.

## Implementation still required
1. Pin and build SuperNOVAS and CALCEPH; preserve notices and checksum all source/data inputs. SuperNOVAS v1.8.0 resolves to c7a2462a56c69b314a938360729a031622a1f312.
2. Implement health, capabilities, calculation and candidate comparison APIs. Explicit TT; UT1 required for geometry. Include effective times, frames, engine/data identity and coverage.
3. Implement independent planets, Ceres/Chiron, symbolic Earth, mean and osculating nodes; apparent tropical longitude, equatorial declination and centered-day speed.
4. Implement independent Whole Sign, Equal, Placidus and Porphyry, with actual-system metadata and explicit polar fallback.
5. Implement PAC Lahiri and Fagan-Bradley from published definitions. Separate reported offset, projection and rate. Offset range 1800-2200 TT; chart coverage is the declared data intersection with speed margins. True Sky divisions excluded.
6. Replace benchmark fixed corpus/legacy APIs with live Swiss adapter consuming this contract; keep cross-engine reports there.
7. Add pinned native and configurable-chart Wasm QC to library, plus explicit full-data CI with nonzero failures and reports. Preserve calculation behavior and regression fixtures.
8. Publish reproducible native/Docker builds, API docs, source/data provenance and validation reports.

## Acceptance
Swiss agreement and model conformance are distinct. Initial Swiss thresholds: 1 arcsecond and 1 arcsecond/day. Freeze thresholds before acceptance; no adjustment to hide discrepancies. Preserve 1 microarcsecond checks for matching Lahiri IAU 2000B definitions/instants.

The library base reports 77-term nutation but projects with five terms. Test reported and applied offsets separately. Shared NOVAS coefficient ancestry tests transcription/integration, not independent astronomical truth. Historic external NOVAS reports were not supplied and must not count as current evidence.

Test published examples, geometry invariants, deterministic and held-out sweeps, angle wrapping, retrograde motion, polar geometry, coverage edges, node opposition and sidereal rates. Negative controls: perturbation, missing/duplicate cases, nonfinite values, provenance changes, unsupported configurations and incomplete coverage.

Report library discrepancies and gate QC; library calculation/dataset fixes are separate work. End-to-end UTC checks and matched-time diagnostics must identify distinct planetary and geometry time conventions.
