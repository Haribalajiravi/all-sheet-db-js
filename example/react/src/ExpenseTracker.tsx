import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { allSheetDB, formatErrorMessage } from '../../../src/index';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SHEET_MODEL,
  expenseHeaderValues,
  type Expense,
  newExpenseId,
} from './expenseModel';
import type { TabProps } from './shared-types';

export default function ExpenseTracker({
  selectedId,
  sheets,
  busy,
  setBusy,
  setStatus,
  setSheets,
  persistSpreadsheet,
}: TabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'Food',
    amount_usd: '',
    gst_tax: '',
    merchant: '',
    notes: '',
  });

  const sheetTab = EXPENSE_SHEET_MODEL.sheetName;
  const modelForSheet = useMemo(
    () => ({ ...EXPENSE_SHEET_MODEL, sheetName: sheetTab }),
    [sheetTab],
  );
  const retrieveRange = `${sheetTab}!A:H`;

  const loadExpensesFor = useCallback(
    async (spreadsheetId: string) => {
      const res = await allSheetDB.retrieve<Expense>({
        sheetName: spreadsheetId,
        range: retrieveRange,
        model: modelForSheet,
      });
      if (res.success && res.data) {
        setExpenses(res.data);
        setStatus(`Loaded ${res.data.length} row(s)`);
      } else {
        setExpenses([]);
        setStatus(res.error ?? 'Could not load sheet');
      }
    },
    [retrieveRange, modelForSheet, setStatus],
  );

  // When the selected spreadsheet changes, ensure the Expenses tab + header
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
          headerValues: expenseHeaderValues(),
        });
        await loadExpensesFor(selectedId);
      } catch (e) {
        setStatus(formatErrorMessage(e));
      }
    })();
  }, [selectedId, sheetTab, loadExpensesFor, setStatus]);

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
        headerValues: expenseHeaderValues(),
      });
      await loadExpensesFor(id);
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
        `Expenses — ${new Date().toLocaleString()}`,
        sheetTab,
      );
      await gs.ensureSheetHeaderRow({
        spreadsheetId,
        sheetTabName: sheetTab,
        headerValues: expenseHeaderValues(),
      });
      persistSpreadsheet(spreadsheetId);
      const list = await gs.listSpreadsheets(100);
      setSheets(list);
      setExpenses([]);
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
      setExpenses([]);
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

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setStatus('Select or create a spreadsheet first');
      return;
    }
    const amount = Number(form.amount_usd);
    if (!Number.isFinite(amount) || amount < 0) {
      setStatus('Enter a valid amount');
      return;
    }
    const gst = Number(form.gst_tax) || 0;
    const row: Expense = {
      expense_id: newExpenseId(),
      date: form.date,
      category: form.category,
      amount_usd: amount,
      gst_tax: gst,
      total_price: 0,
      merchant: form.merchant.trim() || '—',
      notes: form.notes.trim(),
    };
    setBusy(true);
    try {
      if (editingId) {
        // ── Update existing row ──
        const res = await allSheetDB.updateRows<Expense>({
          sheetName: selectedId,
          model: modelForSheet,
          where: r => r.expense_id === editingId,
          set: () => row,
        });
        if (!res.success) {
          setStatus(res.error ?? 'Update failed');
          return;
        }
        setEditingId(null);
        setForm(f => ({ ...f, amount_usd: '', gst_tax: '', notes: '', merchant: '' }));
        await loadExpensesFor(selectedId);
        setStatus(`Updated expense ${editingId.substring(0, 8)}`);
      } else {
        // ── Add new row ──
        const res = await allSheetDB.store([row], {
          sheetName: selectedId,
          append: true,
          model: modelForSheet,
        });
        if (!res.success) {
          setStatus(res.error ?? 'Save failed');
          return;
        }
        setForm(f => ({ ...f, amount_usd: '', gst_tax: '', notes: '', merchant: '' }));
        await loadExpensesFor(selectedId);
        setStatus('Saved');
      }
    } catch (err) {
      setStatus(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!selectedId) return;
    if (!window.confirm('Delete this expense?')) return;
    setBusy(true);
    try {
      const res = await allSheetDB.deleteRows<Expense>({
        sheetName: selectedId,
        model: modelForSheet,
        where: r => r.expense_id === expenseId,
      });
      if (!res.success) {
        setStatus(res.error ?? 'Delete failed');
        return;
      }
      await loadExpensesFor(selectedId);
      setStatus(`Deleted ${res.deletedCount} row(s)`);
    } catch (err) {
      setStatus(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (row: Expense) => {
    setEditingId(row.expense_id);
    setForm({
      date: row.date,
      category: row.category,
      amount_usd: String(row.amount_usd),
      gst_tax: String(row.gst_tax),
      merchant: row.merchant,
      notes: row.notes,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(f => ({ ...f, amount_usd: '', gst_tax: '', notes: '', merchant: '' }));
  };

  const totalUsd = expenses.reduce((sum, x) => sum + (Number(x.amount_usd) || 0), 0);
  const totalGst = expenses.reduce((sum, x) => sum + (Number(x.gst_tax) || 0), 0);
  const totalPrice = expenses.reduce((sum, x) => sum + (Number(x.total_price) || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────

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
          <button type="button" className="btn btn-outline" onClick={() => void loadExpensesFor(selectedId)} disabled={busy || !selectedId}>Refresh data</button>
        </div>
      </div>

      {/* ── Data table ────────────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">GST Tax</th>
              <th className="px-4 py-3 text-right">Total Price</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Ref ID</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No expenses yet — add one below.
                </td>
              </tr>
            ) : (
              expenses.map(row => (
                <tr key={row.expense_id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    ${typeof row.amount_usd === 'number' ? row.amount_usd.toFixed(2) : row.amount_usd}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    ${typeof row.gst_tax === 'number' ? row.gst_tax.toFixed(2) : row.gst_tax}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-400">
                    ${typeof row.total_price === 'number' ? row.total_price.toFixed(2) : row.total_price}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{row.merchant}</td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate" title={row.notes}>
                    {row.notes}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{row.expense_id.substring(0, 8)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex justify-center gap-1">
                      <button type="button" className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors" onClick={() => handleEdit(row)} disabled={busy}>Edit</button>
                      <button type="button" className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors" onClick={() => handleDelete(row.expense_id)} disabled={busy}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot className="border-t bg-muted/50">
              <tr className="font-semibold text-foreground">
                <td colSpan={2} className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right tabular-nums">${totalUsd.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">${totalGst.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-400">${totalPrice.toFixed(2)}</td>
                <td colSpan={4} className="px-4 py-3 text-muted-foreground text-xs font-normal">{expenses.length} record(s)</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Add expense form ──────────────────────────────────────────── */}
      <form onSubmit={handleAddExpense} className="rounded-xl border bg-card p-8 shadow-sm space-y-8">
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{editingId ? 'Edit expense' : 'Add new expense'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {editingId ? `Editing ${editingId.substring(0, 8)}… Change fields and save.` : 'Fill in the details below to track a new expense.'}
            </p>
          </div>
          {editingId && (
            <button type="button" className="btn btn-outline text-sm" onClick={cancelEdit}>Cancel edit</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-8">
          <div>
            <label className="label">Date</label>
            <input type="date" className="field" value={form.date} onChange={ev => setForm(f => ({ ...f, date: ev.target.value }))} disabled={busy} required />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="field" value={form.category} onChange={ev => setForm(f => ({ ...f, category: ev.target.value }))} disabled={busy}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              <input type="number" step="0.01" min="0" className="field pl-7" placeholder="0.00" value={form.amount_usd} onChange={ev => setForm(f => ({ ...f, amount_usd: ev.target.value }))} disabled={busy} required />
            </div>
          </div>
          <div>
            <label className="label">GST Tax</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              <input type="number" step="0.01" min="0" className="field pl-7" placeholder="0.00" value={form.gst_tax} onChange={ev => setForm(f => ({ ...f, gst_tax: ev.target.value }))} disabled={busy} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Price = Amount + GST (auto-calculated by sheet formula)</p>
          </div>
          <div>
            <label className="label">Merchant</label>
            <input className="field" placeholder="e.g. Coffee Shop" value={form.merchant} onChange={ev => setForm(f => ({ ...f, merchant: ev.target.value }))} disabled={busy} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className="label">Notes</label>
            <input className="field" placeholder="Optional details about this expense" value={form.notes} onChange={ev => setForm(f => ({ ...f, notes: ev.target.value }))} disabled={busy} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" className="btn min-w-[150px]" disabled={busy || !selectedId}>
            {editingId ? 'Update expense' : 'Save expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
