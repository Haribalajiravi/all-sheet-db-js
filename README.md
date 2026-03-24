# all-sheet-db-js

> Use **Google Sheets as a database** — store, retrieve, update & delete rows with a typed, ORM-like API.

[![npm version](https://img.shields.io/npm/v/all-sheet-db-js.svg)](https://www.npmjs.com/package/all-sheet-db-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/haribalajiravi/all-sheet-db-js/actions/workflows/ci.yml/badge.svg)](https://github.com/haribalajiravi/all-sheet-db-js/actions)

## ✨ Features

| Feature | Description |
|---|---|
| **CRUD operations** | `store`, `retrieve`, `updateRows`, `deleteRows` — full database-style operations |
| **Formula columns** | Define columns with Google Sheets formulas (e.g. `GOOGLEFINANCE`, `SUM`) — values are auto-computed |
| **Schema migration** | Detects column changes and automatically migrates existing data when your model evolves |
| **Silent OAuth refresh** | Tokens refresh without a popup while the user has an active Google session |
| **Type-safe** | Full TypeScript generics — your data types flow through store → retrieve → update |
| **Dual format** | Ships ESM + CJS bundles with `.d.ts` type declarations |
| **Framework agnostic** | Works with React, Vue, Angular, Svelte, or vanilla JS |

## 📦 Installation

```bash
npm install all-sheet-db-js
```

## 🚀 Quick start

### 1. Create an integration config

```json
{
  "services": [
    {
      "name": "google-sheets",
      "enabled": true,
      "credentials": {
        "scopes": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
      }
    }
  ]
}
```

### 2. Initialize & authenticate

```typescript
import { allSheetDB } from 'all-sheet-db-js';
import config from './integration-config.json';

await allSheetDB.initialize(config);
allSheetDB.setService('google-sheets');

// First-time sign-in — opens the Google consent screen
await allSheetDB.authenticate({
  clientId: 'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com',
});
```

### 3. Define a model

```typescript
import type { SheetModel } from 'all-sheet-db-js';

interface Contact {
  name: string;
  email: string;
  age: number;
}

const contactModel: SheetModel = {
  sheetName: 'Contacts',
  columns: [
    { name: 'name',  type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'age',   type: 'number' },
  ],
};
```

### 4. CRUD operations

```typescript
const SPREADSHEET_ID = 'your-spreadsheet-id';

// ── Store ────────────────────────────────────────────
await allSheetDB.store<Contact>(
  [{ name: 'Alice', email: 'alice@example.com', age: 30 }],
  { sheetName: SPREADSHEET_ID, model: contactModel, append: true },
);

// ── Retrieve ─────────────────────────────────────────
const { data } = await allSheetDB.retrieve<Contact>({
  sheetName: SPREADSHEET_ID,
  model: contactModel,
});
console.log(data); // [{ name: 'Alice', email: 'alice@example.com', age: 30 }]

// ── Update ───────────────────────────────────────────
await allSheetDB.updateRows<Contact>({
  sheetName: SPREADSHEET_ID,
  model: contactModel,
  where: row => row.email === 'alice@example.com',
  set:   row => ({ ...row, age: 31 }),
});

// ── Delete ───────────────────────────────────────────
await allSheetDB.deleteRows<Contact>({
  sheetName: SPREADSHEET_ID,
  model: contactModel,
  where: row => row.email === 'alice@example.com',
});
```

## 🧮 Formula columns

Define columns whose cell values are Google Sheets formulas. When a row is appended, the formula is injected into the cell — Google Sheets computes the result automatically.

```typescript
const invoiceModel: SheetModel = {
  sheetName: 'Invoices',
  columns: [
    { name: 'item',      type: 'string' },
    { name: 'amount',    type: 'number' },
    { name: 'tax',       type: 'number' },
    {
      name: 'total',
      type: 'formula',
      formula: '=INDIRECT("B"&ROW())+INDIRECT("C"&ROW())',
    },
  ],
};
```

Works with any Google Sheets function — `SUM`, `GOOGLEFINANCE`, `VLOOKUP`, `IF`, etc.

## 🔄 Schema migration

When you add, remove, or reorder columns in your model, the library automatically detects the schema change and migrates existing data:

```typescript
// v1 model – 3 columns
const modelV1: SheetModel = {
  sheetName: 'Users',
  columns: [
    { name: 'name',  type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'role',  type: 'string' },
  ],
};

// v2 model – added "department", removed "role"
const modelV2: SheetModel = {
  sheetName: 'Users',
  columns: [
    { name: 'name',       type: 'string' },
    { name: 'email',      type: 'string' },
    { name: 'department', type: 'string' },
  ],
};

// ensureSheetHeaderRow detects the change and remaps data automatically
const gs = allSheetDB.getGoogleSheetsService();
await gs.ensureSheetHeaderRow({
  spreadsheetId: SPREADSHEET_ID,
  sheetTabName: 'Users',
  headerValues: ['Name', 'Email', 'Department'],
});
```

## 🔐 Authentication

The library uses **Google Identity Services (GIS)** — the modern OAuth 2.0 token client, not the deprecated `gapi.auth2`.

| Feature | Details |
|---|---|
| **First sign-in** | `authenticate({ clientId, oauthPrompt: 'consent' })` opens the Google consent screen |
| **Silent refresh** | `refreshAuth()` or `ensureAccessToken()` get a new token without a popup when the Google session is still active |
| **Token storage** | Access tokens are stored in secure, SameSite cookies — survive page reloads |
| **Revocation** | `clearAuth()` revokes the token and clears all cookies |

### Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** of type **Web application**
3. Add your dev origin (e.g. `http://127.0.0.1:5180`) under **Authorized JavaScript origins**
4. Enable **Google Sheets API** and **Google Drive API**

## 🗂️ Google Sheets service helpers

Access Google Sheets-specific features via `allSheetDB.getGoogleSheetsService()`:

```typescript
const gs = allSheetDB.getGoogleSheetsService();

// List all spreadsheets
const sheets = await gs.listSpreadsheets();

// Create a new spreadsheet
const { spreadsheetId } = await gs.createSpreadsheet('My App Data', 'Sheet1');

// Ensure a tab has the right header row (auto-migrates on schema change)
await gs.ensureSheetHeaderRow({
  spreadsheetId,
  sheetTabName: 'Sheet1',
  headerValues: ['Name', 'Email', 'Age'],
});

// Delete a spreadsheet
await gs.deleteSpreadsheet(spreadsheetId);
```

## 📖 API reference

### `AllSheetDB` class

| Method | Description |
|---|---|
| `initialize(config)` | Initialize with integration config |
| `setService(name)` | Set active service (`'google-sheets'`) |
| `authenticate(credentials)` | Authenticate with OAuth |
| `isAuthenticated()` | Check if authenticated |
| `refreshAuth()` | Refresh token silently |
| `clearAuth()` | Sign out and revoke token |
| `store(data, options)` | Append or overwrite rows |
| `retrieve(options)` | Retrieve typed rows |
| `updateRows(options)` | Update rows matching a predicate |
| `deleteRows(options)` | Delete rows matching a predicate |
| `getGoogleSheetsService()` | Access Google Sheets helpers |
| `setLogLevel(level)` | Set logger verbosity |

### Types

```typescript
import type {
  SheetModel,      // { sheetName, columns }
  ColumnDefinition, // { name, type, formula?, required?, defaultValue? }
  StoreOptions,    // { sheetName, model?, append? }
  StoreResult,     // { success, rowsAffected?, error? }
  RetrieveOptions, // { sheetName, model?, range?, filters? }
  RetrieveResult,  // { success, data?, error? }
  DeleteOptions,   // { sheetName, model?, where }
  DeleteResult,    // { success, deletedCount?, error? }
  UpdateOptions,   // { sheetName, model?, where, set }
  UpdateResult,    // { success, updatedCount?, error? }
  AuthCredentials, // { clientId, oauthPrompt? }
  AuthToken,       // { accessToken, expiresAt, ... }
} from 'all-sheet-db-js';
```

## 🎉 Example apps

The repo includes a full **React example** with two tabs:

| Tab | Description |
|---|---|
| **💰 Expense Tracker** | Full CRUD with schema migration and formula columns (`total_price = amount + gst_tax`) |
| **📈 Stock Watchlist** | Enter an NSE ticker — `GOOGLEFINANCE` formulas auto-fill price, PE, 52W range, etc. |

```bash
# Run the example locally
npm run dev:react
# → http://127.0.0.1:5180
```

## 🏗️ Project structure

```
src/
├── index.ts                           # AllSheetDB class + default instance
├── core/ServiceManager.ts             # Service registry & routing
├── types/
│   ├── index.ts                       # All public types
│   └── service.interface.ts           # ISpreadsheetService interface
├── services/google-sheets/
│   ├── GoogleSheetsService.ts         # Core service implementation
│   ├── gapi-types.ts                  # GAPI/GIS type definitions
│   ├── constants.ts                   # Cookie keys, script URLs, scopes
│   ├── script-loader.ts              # Idempotent <script> loader
│   ├── token-store.ts                 # Cookie-based token persistence
│   └── data-mapper.ts                # Row ↔ object conversion
├── utils/
│   ├── errors.ts                      # Typed error classes
│   ├── logger.ts                      # Configurable logger
│   └── cookie.ts                      # Cookie helpers
└── auth/AuthDialog.tsx                # Optional React auth dialog
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the library (ESM + CJS + .d.ts)
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run type-check

# Run React example
npm run dev:react
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

[MIT](./LICENSE) © [Hari Balaji Ravi](https://github.com/haribalajiravi)
