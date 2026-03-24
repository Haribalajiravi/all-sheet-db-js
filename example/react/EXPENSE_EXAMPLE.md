# Expense tracker example (React)

This demo uses **all-sheet-db-js** to treat a Google Sheet as an expense log.

**Auth:** The library uses **Google Identity Services (GIS)** and the OAuth 2.0 token client — not the deprecated `gapi.auth2` library. Your OAuth client must be a **Web application** client with the JavaScript origins configured as described below.

**APIs:** Enable **Google Sheets API** and **Google Drive API** in the same Google Cloud project. The demo uses scope **`drive.file`** so the app can create, list, and delete spreadsheets it created (and work with Sheets).

## Sheet layout

| Date | Category | Amount (USD) | Merchant | Notes | Expense ID |
|------|----------|----------------|----------|-------|------------|

- Create a Google Spreadsheet.
- Add a tab named **Expenses** (or change “Sheet tab name” in the UI).
- Column order must match the table above (the library maps fields by this order).

## One-time setup

### Google Cloud — Authorized JavaScript origins

The React demo uses a **fixed dev URL** so it matches what you register in Google:

| Authorized JavaScript origins (add each you will use) |
|--------------------------------------------------------|
| `http://127.0.0.1:5180` |
| `http://localhost:5180` (only if you open the app with `localhost` in the URL) |

**Important:**

1. The error (`…5176 has not been registered`) happens when Vite **used another port**. This demo is fixed to **5180** (`strictPort: true`). In Google Cloud add **`http://127.0.0.1:5180`** — not an old port like 5176 or 5177.
2. Open the app at the **same** origin you registered (`127.0.0.1` vs `localhost` are **different** to Google).
3. The origin must match **scheme + host + port** exactly (`http` vs `https` matters too).
4. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID** (Web application) → **Authorized JavaScript origins** → add the URL(s) above → **Save**. Changes can take a few minutes.
5. If you still see `idpiframe_initialization_failed`, compare the **exact** URL in the browser address bar to your origins list.

Then:

1. Enable **Google Sheets API** for the project and use the same OAuth client’s **Client ID** in the app.
2. Run: `npm run dev:react` (serves on **5180**; if the port is busy, free it or change `port` in `example/react/vite.config.ts` and register that new origin too).
3. In the app:
   - **Initialize**
   - **Authenticate** (use your OAuth Client ID)
   - **Setup header row (once)** — writes the header labels as the first row (the library skips row 1 when reading).
   - Add expenses with **Save expense to sheet**, or **Refresh from sheet** to reload.

## Code

- Schema: `src/expenseModel.ts` — `Expense` type + `EXPENSE_SHEET_MODEL` (`SheetModel`).
- UI: `src/ExpenseTracker.tsx` — `store` / `retrieve` with `append: true` for new rows.

## Notes

- The first row in the range is treated as a header by the Google Sheets service and **not** returned as data rows.
- If you already typed headers manually, skip **Setup header row** so you don’t duplicate them.
