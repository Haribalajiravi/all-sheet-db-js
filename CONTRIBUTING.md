# Contributing to all-sheet-db-js

Thank you for your interest in contributing! Here's how to get started.

## Development setup

```bash
git clone https://github.com/haribalajiravi/all-sheet-db-js.git
cd all-sheet-db-js
npm install
```

## Workflow

1. **Fork** the repo and create a feature branch from `main`.
2. Run `npm test` to make sure existing tests pass.
3. If you're adding a feature, add corresponding tests.
4. Run `npm run lint` and `npm run format:check` before committing.
5. Commit with [conventional commits](https://www.conventionalcommits.org/):
   - `feat: add new feature`
   - `fix: resolve bug`
   - `docs: update README`
   - `chore: update dependency`
6. Open a pull request against `main`.

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Build ESM + CJS bundles and type declarations |
| `npm test` | Run unit tests via Jest |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint source code |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format source code with Prettier |
| `npm run type-check` | TypeScript type checking only |
| `npm run dev:react` | Start the React example app |

## Code style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- No `any` — use `unknown` and type guards

## Adding a new service

To add support for a new spreadsheet provider (e.g. Microsoft Excel):

1. Create `src/services/your-service/YourService.ts`
2. Implement the `ISpreadsheetService` interface (see `src/types/service.interface.ts`)
3. Register it in `AllSheetDB.registerDefaultServices()` in `src/index.ts`
4. Add tests in `__tests__/`

## Reporting bugs

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and Node.js version
- Relevant console errors

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
