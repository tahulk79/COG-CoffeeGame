# COG-CoffeeGame

2.5D isometric story game (Phaser 4, TypeScript, Vite).
Current scope: **chapter 1 (the old quarter) and chapter 2 (the cloud garden)** only. The café, farm and economy code was removed so it can be rebuilt; the docs under `docs/` still describe the old design.
Task tracking: [docs/task-list/TASK_LIST.md](docs/task-list/TASK_LIST.md) (update it whenever you change docs, see its README).

## Run
```
npm install
npx playwright install chromium   # once, for e2e
npm run dev        # http://localhost:5180
npm run typecheck
npm test           # unit (Vitest)
npm run e2e        # end-to-end (Playwright)
npm run build
```

## Branches
- `main`: untouched reference (baseline README + concept sheet).
- `dev`: all work.
