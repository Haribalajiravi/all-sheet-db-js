import { useCallback, useEffect, useMemo, useState } from 'react';
import integrationConfig from '../../integration-config.json';
import {
  allSheetDB,
  LogLevel,
  formatErrorMessage,
} from '../../../src/index';
import type { IntegrationConfig } from '../../../src/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog';

import ExpenseTracker from './ExpenseTracker';
import StockWatchlist from './StockWatchlist';
import { expenseHeaderValues, EXPENSE_SHEET_MODEL } from './expenseModel';

const LS_CLIENT = 'expense_demo_oauth_client_id';
const LS_SPREADSHEET = 'expense_demo_spreadsheet_id';

type Tab = 'expenses' | 'watchlist';

/**
 * Root shell that:
 *  - owns auth / client-ID state (shared by every tab)
 *  - owns the spreadsheet list + active spreadsheet
 *  - renders a tab bar to switch between features
 */
export default function App() {
  const parsedConfig = useMemo(() => integrationConfig as IntegrationConfig, []);

  // ── Shared auth state ─────────────────────────────────────────────────
  const [clientId, setClientId] = useState(() => localStorage.getItem(LS_CLIENT) || '');
  const [showClientDialog, setShowClientDialog] = useState(() => !localStorage.getItem(LS_CLIENT));
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // ── Shared spreadsheet state ──────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(LS_SPREADSHEET) || '');
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);

  // ── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('expenses');

  const persistClient = (id: string) => {
    localStorage.setItem(LS_CLIENT, id);
    setClientId(id);
  };

  const persistSpreadsheet = useCallback((id: string) => {
    localStorage.setItem(LS_SPREADSHEET, id);
    setSelectedId(id);
  }, []);

  // ── Bootstrap (init + auth + load sheet list) ─────────────────────────
  const bootstrap = useCallback(async () => {
    const cid = clientId.trim();
    if (!cid) return;

    const gs = allSheetDB.getGoogleSheetsService();
    if (!gs) {
      setStatus('Google Sheets service not available');
      return;
    }

    setBusy(true);
    setNeedsSignIn(false);
    setStatus('Connecting…');

    try {
      allSheetDB.setLogLevel(LogLevel.WARN);
      await allSheetDB.initialize(parsedConfig);
      allSheetDB.setService('google-sheets');

      let authed = await allSheetDB.isAuthenticated();
      if (!authed) {
        const silent = await allSheetDB.refreshAuth();
        authed = !!silent || (await allSheetDB.isAuthenticated());
      }

      if (!authed) {
        setNeedsSignIn(true);
        setStatus('Sign in with Google to continue');
        setBusy(false);
        return;
      }

      const list = await gs.listSpreadsheets(100);
      setSheets(list);

      let sid = localStorage.getItem(LS_SPREADSHEET) || '';
      if (!sid || !list.some(s => s.id === sid)) {
        if (list.length > 0) {
          sid = list[0].id;
        } else {
          setStatus('Creating your first workbook…');
          const { spreadsheetId } = await gs.createSpreadsheet(
            `Finance Tracker — ${new Date().toLocaleDateString()}`,
            EXPENSE_SHEET_MODEL.sheetName,
          );
          sid = spreadsheetId;
          await gs.ensureSheetHeaderRow({
            spreadsheetId: sid,
            sheetTabName: EXPENSE_SHEET_MODEL.sheetName,
            headerValues: expenseHeaderValues(),
          });
          const list2 = await gs.listSpreadsheets(100);
          setSheets(list2);
        }
      }

      persistSpreadsheet(sid);
      setStatus('Ready');
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [clientId, parsedConfig, persistSpreadsheet]);

  useEffect(() => {
    if (!clientId) return;
    void bootstrap();
  }, [clientId, bootstrap]);

  // ── Auth handlers ─────────────────────────────────────────────────────
  const handleClientSave = async (creds: { clientId: string }) => {
    const id = creds.clientId.trim();
    if (!id) throw new Error('Client ID required');
    persistClient(id);
    setShowClientDialog(false);
  };

  const handleSignIn = async () => {
    const cid = (localStorage.getItem(LS_CLIENT) || clientId).trim();
    if (!cid) {
      setShowClientDialog(true);
      return;
    }
    setBusy(true);
    setStatus('Opening Google sign-in…');
    try {
      await allSheetDB.authenticate({ clientId: cid });
      await bootstrap();
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await allSheetDB.clearAuth();
    setNeedsSignIn(true);
    setStatus('Signed out');
  };

  // ── Shared tab props ──────────────────────────────────────────────────
  const tabProps = {
    selectedId,
    sheets,
    busy,
    setBusy,
    status,
    setStatus,
    setSheets,
    persistSpreadsheet,
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8 pb-10">
      <div className="card space-y-6">
        {/* ── Header + auth bar ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>all-sheet-db-js</strong> demo — expenses &amp; stock watchlist backed by Google Sheets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {needsSignIn && (
              <button type="button" className="btn" onClick={handleSignIn} disabled={busy}>
                Sign in with Google
              </button>
            )}
            <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
              <DialogTrigger asChild>
                <button type="button" className="btn btn-outline" disabled={busy}>
                  Change Client ID
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Connect Google Sheets</DialogTitle>
                  <DialogDescription>
                    Paste your OAuth 2.0 Web Client ID from Google Cloud Console. It is stored in this browser only.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    await handleClientSave({
                      clientId: (e.currentTarget.elements.namedItem('clientId') as HTMLInputElement).value,
                    });
                  }}
                  className="mt-4"
                >
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="clientId" className="text-right text-sm font-medium leading-none">Client ID</label>
                      <input
                        id="clientId"
                        name="clientId"
                        defaultValue={clientId}
                        placeholder="xxxx.apps.googleusercontent.com"
                        className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn h-10 px-4 py-2"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <button type="button" className="btn btn-outline" onClick={handleSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
        </div>

        {/* ── Info bar ──────────────────────────────────────────────── */}
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200/90">
          OAuth origin: <code className="text-yellow-100 font-semibold">http://127.0.0.1:5180</code> — enable{' '}
          <strong>Google Drive API</strong> + <strong>Google Sheets API</strong>. Scopes include{' '}
          <code className="text-yellow-100">drive.file</code>.
        </div>

        {/* ── Status ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            {busy ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            )}
          </span>
          <span>Status:</span>
          <span className="font-medium text-foreground">{status || 'Ready'}</span>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="border-b">
          <nav className="flex gap-1 -mb-px" role="tablist">
            {([
              { key: 'expenses' as Tab, label: '💰 Expenses' },
              { key: 'watchlist' as Tab, label: '📈 Stock Watchlist' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab content ──────────────────────────────────────────── */}
        <div className="pt-2">
          {activeTab === 'expenses' && <ExpenseTracker {...tabProps} />}
          {activeTab === 'watchlist' && <StockWatchlist {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
