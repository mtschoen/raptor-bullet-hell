# raptor-bullet-hell - Test Report

`2026-10-13T07:54:18Z`

| Field        | Value                                                                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**   | PASS                                                                                                                                                                                                                                                                                                                                   |
| **Mode**     | best-effort                                                                                                                                                                                                                                                                                                                            |
| **Tests**    | `22` total (`22` passed, `0` failed, `0` skipped)                                                                                                                                                                                                                                                                                      |
| **Git**      | `7ff78e7` (main) plus stick-size and background-flicker changes                                                                                                                                                                                                                                                                        |
| **Coverage** | 7.32% statements, 7.21% branches, 9% functions, 7.6% lines overall; waves 100%, input 67.71% lines, particles 59.7% lines, patterns 51.2% lines, collision 33.3% lines; baseline held from 7.34% statements, Canvas/audio/render glue uncovered (pre-existing); `tools/*.py` asset scripts not covered (manual pipeline, pre-existing) |
| **Lint**     | `eslint`: `0` findings (`0` errors, `0` warnings); `prettier`: `0` findings (format check passes); `0` per-case suppressions, `0` documented exceptions                                                                                                                                                                                |

## Commands

```bash
npm run lint
npm run format:check
npm run coverage
npm run build:pages
```
