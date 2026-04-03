# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-04-04

### Fixed

- **Stable Cache Keys**: Fixed an issue where the cache layer would fail to pick up cached data due to unstable JSON key generation for nested options. Implemented recursive stabilization for objects and Dates.
- **Granular Cache Invalidation**: Specialized cache prefixes to include the sheet Tab name, preventing over-invalidation when multiple tabs in the same spreadsheet are used.
- **Structural Check Caching**: Added an internal in-memory cache for `ensureSheetHeaderRow` to eliminate redundant API calls during tab switching in React.
- **Browser Build Parity**: Synchronized many missing core methods to the browser-only build, ensuring parity with the standard entry point.

## [1.3.0] - 2026-04-03

### Added

- **Relational Data Population**: Support for `populate` queries to join data across multiple sheets or tabs based on primary/foreign keys.
- **IndexedDB Caching**: Migrated from `localStorage` to **IndexedDB** for the caching layer. This provides significantly higher storage capacity (limitless vs 5MB), better performance for large datasets, and non-blocking asynchronous operations.
- **Async Cache API**: All cache management methods (`clearCache`, `invalidateCache`, `getCacheStats`) are now asynchronous (`Promise`-based).
- **Relational Tab Support**: Improved `ServiceManager` to handle cross-tab joins within the same spreadsheet automatically.

### Changed

- **Asynchronous Data Flow**: Updated core library internals to correctly `await` cache operations, leading to smoother performance.
- **Example App Upgrade**: Enhanced the React example app with a "Joins/Populate" demo and a live "Cache Stats" monitor.

## [1.2.0] - 2026-03-31

### Added

- **Advanced Query Engine**: In-memory `filter`, `sort`, `pagination`, and `groupBy` support for consistent behavior across all services.
- **Complex Filters**: Support for operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, and `in`.
- **Versioned Migration System**: sequential migration framework with `_db_metadata` version tracking.
- **Migration Actions**: New `add_column`, `delete_column`, `rename_column`, and custom `transform_data` actions.
- **Cache Statistics**: New `getCacheStats()` method on `AllSheetDB` to monitor cache size and keys.
- **Improved Type Safety**: Enhanced generics for filters and migration transforms.

### Fixed

- **Data Mapping**: Fixed edge case in `convertDataToRows` for non-object items.
- **Type Linting**: Resolved various `unknown` type warnings in tests and example code.

## [1.1.0] - 2026-03-30

### Added

- **Built-in Caching Layer**: Automated `localStorage` caching for `retrieve` calls with configurable TTL and `forceFetch` options.
- **Cache Invalidation**: Automatic cache invalidation for a specific sheet when `store`, `updateRows`, or `deleteRows` is called.
- **Cache Management API**: New `clearCache()` and `invalidateCache(sheetName)` methods on the `AllSheetDB` class.
- **Enhanced RetrieveResult**: Added `fromCache` boolean and `timestamp` number to identify cached data.

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
