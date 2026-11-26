# Agent instructions

- Use Electron, TypeScript, and plain HTML/CSS. Keep the implementation and file count small.
- Use no frameworks or bundler. Dependencies: Electron, TypeScript, @types/node, Prettier, and ESLint only; keep the TypeScript 6/7 npm aliases (tsc from @typescript/native, tooling API from typescript).
- Comment only when the code cannot show why, using one line.
- Keep README.md to 5–10 lines and CLAUDE.md to `@AGENTS.md`.
- Keep renderer isolation and sandboxing enabled. Restrict source reads to the project root, spawn the CLI without a shell, and validate its answers.
- Run with `npm start`. Verify with `npm test`, `npm run typecheck`, and `npm run lint`.
- Write commits in English with a header only and no body.
