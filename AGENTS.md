# Agent instructions

- Use Electron, TypeScript, and plain HTML/CSS. Keep the implementation and file count small.
- Use no frameworks, bundler, or dependencies beyond Electron, TypeScript, and @types/node.
- Comment only when the code cannot show why, using one line.
- Keep README.md to 5–10 lines and CLAUDE.md to `@AGENTS.md`.
- Keep renderer isolation and sandboxing enabled. Restrict source reads to the project root, spawn the CLI without a shell, and validate its answers.
- Run with `npm start`. Verify with `npm test` and `npm run typecheck`.
- Write commits in English with a header only and no body.
