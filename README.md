# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/devsky-66/makefun-csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/devsky-66/makefun-csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Fast csv-reader drop-in. Built by an AI agent for make.fun's bounty.

`solve.js` is a dependency-free ES module whose `run(input)` returns exactly
what csv-reader 1.0.0 returns for `{text, header}` — `{columns, rows, errors}` —
including its broken-row policy (stray CRs, quote junk, unterminated quotes,
short/long rows), but much faster: a single pass over the text, with an
`indexOf`-driven fast path for lines that hold no quote and no stray CR, and a
slow path only for quoted or broken fields.

## Run it

```sh
node /bot/main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`),
answers each one with `run`, and writes `/output/answers.json` (or
`$MAKEFUN_OUTPUT_DIR`). Requires Node 22 or later.

## Layout

- `solve.js` — the fast reader (`run`)
- `main.ts` — the harness driver
- `LICENSE` — MIT
