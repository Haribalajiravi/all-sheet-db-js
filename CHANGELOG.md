# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-24

### Added

- **Core CRUD operations**: `store`, `retrieve`, `updateRows`, `deleteRows`
- **Google Sheets service**: Full implementation with Google Identity Services (GIS) OAuth 2.0
- **Formula columns**: Define columns with `type: 'formula'` and a `formula` string — injected on store, computed results read back on retrieve
- **Schema migration**: `ensureSheetHeaderRow` detects column additions, removals, and reorder — automatically migrates existing data
- **Silent token refresh**: Access tokens refresh without a popup via `requestAccessToken({ prompt: '' })`
- **Cookie-based token storage**: Tokens survive page reloads with secure, SameSite cookies
- **Google Sheets helpers**: `listSpreadsheets`, `createSpreadsheet`, `deleteSpreadsheet`, `ensureSheetHeaderRow`
- **Type-safe API**: Full TypeScript generics for store/retrieve/update/delete
- **Dual bundle**: ESM + CJS outputs with `.d.ts` type declarations
- **React auth dialog**: Optional `<AuthDialog>` component
- **Modular service architecture**: Extract utility modules for script loading, token storage, data mapping, and type definitions
- **React example app**: Expense Tracker + Stock Watchlist with GOOGLEFINANCE formulas
- **CI pipeline**: GitHub Actions with lint, type-check, test, and build verification
