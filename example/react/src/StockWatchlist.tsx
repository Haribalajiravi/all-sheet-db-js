import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { allSheetDB, formatErrorMessage } from '../../../src/index';
import {
  STOCK_SHEET_MODEL,
  stockHeaderValues,
  type Stock,
} from './stockWatchlistModel';
import type { TabProps } from './shared-types';

export default function StockWatchlist({
  selectedId,
  sheets,
  busy,
  setBusy,
  setStatus,
  setSheets,
  persistSpreadsheet,
}: TabProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [ticker, setTicker] = useState('');

  const sheetTab = STOCK_SHEET_MODEL.sheetName;
  const modelForSheet = useMemo(
    () => ({ ...STOCK_SHEET_MODEL, sheetName: sheetTab }),
    [sheetTab],
  );
  const retrieveRange = `${sheetTab}!A:I`;

  const loadStocks = useCallback(
    async (spreadsheetId: string) => {
      const res = await allSheetDB.retrieve<Stock>({
        sheetName: spreadsheetId,
        range: retrieveRange,
        model: modelForSheet,
      });
      if (res.success && res.data) {
        setStocks(res.data);
        setStatus(`Loaded ${res.data.length} stock(s)`);
      } else {
        setStocks([]);
        setStatus(res.error ?? 'Could not load watchlist');
      }
    },
    [retrieveRange, modelForSheet, setStatus],
  );

  // when the selected spreadsheet changes, ensure the Watchlist tab + header
  // exist and load data
  useEffect(() => {
    if (!selectedId) return;
    const gs = allSheetDB.getGoogleSheetsService();
    if (!gs) return;

    (async () => {
      try {
        await gs.ensureSheetHeaderRow({
          spreadsheetId: selectedId,
          sheetTabName: sheetTab,
          headerValues: stockHeaderValues(),
        });
        await loadStocks(selectedId);
      } catch (e) {
        setStatus(formatErrorMessage(e));
      }
    })();
  }, [selectedId, sheetTab, loadStocks, setStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSelectSheet = async (id: string) => {
    const gs = allSheetDB.getGoogleSheetsService();
    if (!gs) return;
    setBusy(true);
    setStatus('Opening workbook…');
    try {
      persistSpreadsheet(id);
      await gs.ensureSheetHeaderRow({
        spreadsheetId: id,
        sheetTabName: sheetTab,
        headerValues: stockHeaderValues(),
      });
      await loadStocks(id);
      setStatus('Ready');
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleNewWorkbook = async () => {
    const gs = allSheetDB.getGoogleSheetsService();
    if (!gs) return;
    setBusy(true);
    setStatus('Creating spreadsheet…');
    try {
      const { spreadsheetId } = await gs.createSpreadsheet(
        `Watchlist — ${new Date().toLocaleString()}`,
        sheetTab,
      );
      await gs.ensureSheetHeaderRow({
        spreadsheetId,
        sheetTabName: sheetTab,
        headerValues: stockHeaderValues(),
      });
      persistSpreadsheet(spreadsheetId);
      const list = await gs.listSpreadsheets(100);
      setSheets(list);
      setStocks([]);
      setStatus('New workbook ready');
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWorkbook = async () => {
    const gs = allSheetDB.getGoogleSheetsService();
    if (!selectedId || !gs) return;
    const name = sheets.find(s => s.id === selectedId)?.name ?? selectedId;
    if (!window.confirm(`Delete spreadsheet "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    setStatus('Deleting…');
    try {
      await gs.deleteSpreadsheet(selectedId);
      persistSpreadsheet('');
      setStocks([]);
      const list = await gs.listSpreadsheets(100);
      setSheets(list);
      if (list.length > 0) {
        await handleSelectSheet(list[0].id);
      } else {
        setStatus('No workbooks left');
      }
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddStock = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setStatus('Select or create a spreadsheet first');
      return;
    }
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setStatus('Enter a valid NSE ticker');
      return;
    }
    const row: Stock = {
      ticker: t,
      stock_name: '',       // formula
      current_price: 0,     // formula
      low_52w: 0,           // formula
      high_52w: 0,          // formula
      industry_avg_pe: 0,   // optional manual
      current_pe: 0,        // formula
      current_book_value: 0, // formula
      today_change_pct: 0,  // formula
    };
    setBusy(true);
    try {
      const res = await allSheetDB.store([row], {
        sheetName: selectedId,
        append: true,
        model: modelForSheet,
      });
      if (!res.success) {
        setStatus(res.error ?? 'Save failed');
        return;
      }
      setTicker('');
      await loadStocks(selectedId);
      setStatus('Ticker added — Google Sheets will populate the remaining fields');
    } catch (err) {
      setStatus(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStock = async (tickerVal: string, idx: number) => {
    if (!selectedId) return;
    if (!window.confirm(`Remove ${tickerVal} from the watchlist?`)) return;
    setBusy(true);
    try {
      // Match by exact row position (idx is the 0-based index in the data array)
      let currentRow = 0;
      const res = await allSheetDB.deleteRows<Stock>({
        sheetName: selectedId,
        model: modelForSheet,
        where: () => {
          const match = currentRow === idx;
          currentRow++;
          return match;
        },
      });
      if (!res.success) {
        setStatus(res.error ?? 'Delete failed');
        return;
      }
      await loadStocks(selectedId);
      setStatus(`Removed ${tickerVal}`);
    } catch (err) {
      setStatus(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const fmt = (v: unknown) => {
    if (v === '' || v === undefined || v === null) return '—';
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v);
  };

  return (
    <div className="space-y-6">
      {/* ── Spreadsheet selector ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end bg-muted/30 p-4 rounded-lg border">
        <div>
          <label className="label">Active Spreadsheet</label>
          <select
            className="field"
            value={selectedId}
            onChange={e => void handleSelectSheet(e.target.value)}
            disabled={busy || sheets.length === 0}
          >
            {sheets.length === 0 ? (
              <option value="">No spreadsheets yet</option>
            ) : (
              sheets.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))
            )}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={handleNewWorkbook} disabled={busy}>New workbook</button>
          <button type="button" className="btn btn-destructive" onClick={handleDeleteWorkbook} disabled={busy || !selectedId}>Delete workbook</button>
          <button type="button" className="btn btn-outline" onClick={() => void loadStocks(selectedId)} disabled={busy || !selectedId}>Refresh data</button>
        </div>
      </div>

      {/* ── Data table ────────────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Stock Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">52W Low</th>
              <th className="px-4 py-3 text-right">52W High</th>
              <th className="px-4 py-3 text-right">Ind. PE</th>
              <th className="px-4 py-3 text-right">PE</th>
              <th className="px-4 py-3 text-right">Book Value</th>
              <th className="px-4 py-3 text-right">Change %</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                  No stocks yet — add a ticker below.
                </td>
              </tr>
            ) : (
              stocks.map((row, i) => {
                const changePct = Number(row.today_change_pct);
                const changeColor = Number.isFinite(changePct)
                  ? changePct > 0
                    ? 'text-emerald-400'
                    : changePct < 0
                      ? 'text-red-400'
                      : 'text-foreground'
                  : 'text-muted-foreground';
                return (
                  <tr key={`${row.ticker}-${i}`} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold tracking-wide">{row.ticker}</td>
                    <td className="px-4 py-2.5">{row.stock_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">₹{fmt(row.current_price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">₹{fmt(row.low_52w)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">₹{fmt(row.high_52w)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(row.industry_avg_pe)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(row.current_pe)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(row.current_book_value)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${changeColor}`}>
                      {fmt(row.today_change_pct)}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button type="button" className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors" onClick={() => handleDeleteStock(row.ticker, i)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add stock form ────────────────────────────────────────────── */}
      <form onSubmit={handleAddStock} className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold tracking-tight">Add stock to watchlist</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter an Indian (NSE) stock ticker. Google Sheets will auto-fill name, price, PE, and
            other fields via GOOGLEFINANCE formulas.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="label">NSE Ticker</label>
            <input
              className="field uppercase"
              placeholder="e.g. RELIANCE, TCS, INFY"
              value={ticker}
              onChange={ev => setTicker(ev.target.value)}
              disabled={busy}
              required
            />
          </div>
          <button type="submit" className="btn min-w-[150px] h-10" disabled={busy || !selectedId}>
            Add ticker
          </button>
        </div>
      </form>
    </div>
  );
}
