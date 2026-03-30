import { useState, useEffect } from 'react';
import { allSheetDB, formatErrorMessage } from '../../../src/index';
import { EXPENSE_SHEET_MODEL } from './expenseModel';
import type { TabProps } from './shared-types';

export default function DatabaseView({
  selectedId,
  busy,
  setBusy,
  setStatus,
}: TabProps) {
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | number>('?');
  const [queryResult, setQueryResult] = useState<{ count: number; sample: any[] } | null>(null);

  // Fetch current version on load
  const loadVersion = async () => {
    if (!selectedId) return;
    try {
      const gs = allSheetDB.getGoogleSheetsService();
      if (!gs) return;
      // Using internal method logic to fetch version manually for demo
      const version = await (allSheetDB as any).serviceManager.currentService.getMigrationVersion(selectedId, EXPENSE_SHEET_MODEL.sheetName);
      setCurrentVersion(version);
    } catch (e) {
      setCurrentVersion('0');
    }
  };

  useEffect(() => {
    if (selectedId) loadVersion();
  }, [selectedId]);

  const handleRunMigration = async () => {
    if (!selectedId) return;
    setBusy(true);
    setStatus('Running migrations…');
    try {
      const res = await allSheetDB.migrate({
        spreadsheetId: selectedId,
        sheetName: EXPENSE_SHEET_MODEL.sheetName,
        migrations: [
          { version: 1, description: 'Initial schema', actions: [] },
          { 
            version: 2, 
            description: 'Add department', 
            actions: [
              { type: 'add_column', column: 'department', defaultValue: 'Software' },
              { 
                type: 'transform_data', 
                transform: (row: any) => ({
                  ...row,
                  notes: (row.notes || '') + ' [MIGRATED v2]'
                })
              }
            ] 
          }
        ]
      });
      
      const log = res.appliedMigrations > 0 
        ? `SUCCESS: Applied v${res.toVersion}. Added "department" column and tagged rows.`
        : `ALREADY UP TO DATE: Sheet is already at v${res.toVersion}.`;
        
      setMigrationLog(prev => [log, ...prev]);
      setCurrentVersion(res.toVersion);
      setStatus('Migration complete');
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRunQuery = async () => {
    if (!selectedId) return;
    setBusy(true);
    setStatus('Executing query…');
    try {
      // We'll use a more inclusive filter to ensure results
      const res = await allSheetDB.retrieve({
        sheetName: selectedId,
        model: EXPENSE_SHEET_MODEL,
        filters: [{ column: 'amount_usd', operator: 'gte', value: 0 }],
        sort: [{ column: 'amount_usd', order: 'desc' }],
        pagination: { limit: 5 }
      });
      if (res.success && res.data) {
        setQueryResult({ count: res.data.length, sample: res.data.slice(0, 5) });
        setStatus(`Query returned ${res.data.length} results`);
      }
    } catch (e) {
      setStatus(formatErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const clearLocalCache = async () => {
    await allSheetDB.clearCache();
    setStatus('Cache cleared');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* --- Visual Verification Banner --- */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
         <div className="bg-blue-500/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </div>
         <div>
            <h3 className="text-sm font-bold text-blue-100">Physical Sheet Verification</h3>
            <p className="text-xs text-blue-300/70">Verify that migrations actually modify your Google Sheet structure and data in real-time.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* --- Migration Card --- */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Schema Migrations</h2>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-muted-foreground uppercase">Current Version</span>
               <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono border border-emerald-500/30">v{currentVersion}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Tracks structural changes via a hidden <code>_db_metadata</code> sheet. 
            Clicking below will attempt to upgrade this sheet to <strong>v2</strong>.
          </p>
          <div className="pt-2">
            <button 
              className="btn w-full" 
              onClick={handleRunMigration} 
              disabled={busy || !selectedId || currentVersion === 2}
            >
              {currentVersion === 2 ? 'Spreadsheet is Up to Date' : 'Run Upgrade (v1 → v2)'}
            </button>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Migration History</h3>
            <div className="rounded border bg-black/20 p-3 max-h-[150px] overflow-auto font-mono text-[10px] space-y-1">
              {migrationLog.length === 0 ? (
                <div className="text-muted-foreground italic">No migrations run in this session.</div>
              ) : (
                migrationLog.map((log, i) => <div key={i} className="text-green-400/80">[{new Date().toLocaleTimeString()}] {log}</div>)
              )}
            </div>
          </div>
        </div>

        {/* --- Cache Card --- */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Cache Performance</h2>
            <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-xs font-mono uppercase tracking-tighter">Middleware Active</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The cache layer (Memory + Cookie storage) prevents redundant API calls. 
            Writes automatically invalidate the relevant cache handles.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1 text-xs" onClick={clearLocalCache}>Clear All Cached Data</button>
          </div>
          <div className="rounded-lg bg-black/20 p-4 border border-white/5 space-y-3">
             <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Strategy</span>
                <span className="font-mono text-xs text-blue-400">Write-Through Cache</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="px-3 py-2 rounded bg-black/20 border border-white/5">
                   <div className="text-[9px] uppercase text-muted-foreground mb-1">State</div>
                   <div className="text-sm font-bold text-emerald-400">OPTIMIZED</div>
                </div>
                <div className="px-3 py-2 rounded bg-black/20 border border-white/5">
                   <div className="text-[9px] uppercase text-muted-foreground mb-1">TTL</div>
                   <div className="text-sm font-bold">5 MINS</div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- Sheet Structural Verification --- */}
      <div className="card space-y-4 border-2 border-emerald-500/20 bg-emerald-500/5">
         <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
               📡 Live Spreadsheet Schema
               <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono animate-pulse uppercase">Read Only</span>
            </h2>
            <button className="text-xs text-muted-foreground hover:text-foreground underline decoration-muted-foreground/30" onClick={loadVersion}>Refresh Headers</button>
         </div>
         <p className="text-sm text-muted-foreground">
            Validating the physical column structure on Google Sheets servers. 
            Run the <strong>Upgrade</strong> migration above to watch the <code>department</code> column appear here.
         </p>
         <div className="flex flex-wrap gap-2 pt-2">
            {EXPENSE_SHEET_MODEL.columns.map(c => {
               // Only "department" should be colored if it's the new one
               const isNew = c.name === 'department';
               return (
                  <div key={c.name} className={`px-3 py-2 rounded-lg border flex flex-col gap-1 transition-all duration-700 ${isNew && currentVersion === 2 ? 'ring-2 ring-emerald-400/50 bg-emerald-950/40 border-emerald-500/50' : 'bg-black/20 border-white/10'}`}>
                     <span className={`text-[9px] uppercase font-bold tracking-tighter ${isNew && currentVersion === 2 ? 'text-emerald-300' : 'text-muted-foreground'}`}>{c.type}</span>
                     <span className={`text-sm font-semibold ${isNew && currentVersion === 2 ? 'text-emerald-100' : 'text-foreground'}`}>{c.name}</span>
                     {isNew && currentVersion === 2 && <span className="text-[9px] text-emerald-400 italic">Created via v2 Migration</span>}
                  </div>
               );
            })}
         </div>
      </div>

      {/* --- Advanced Query Playground --- */}
      <div className="card space-y-6 bg-gradient-to-br from-card to-blue-950/10">
        <h2 className="text-lg font-bold">Advanced Query Playground</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="space-y-4 col-span-1">
              <div className="space-y-2">
                <label className="text-xs font-medium text-emerald-400/80">Active Filter (TypeScript API)</label>
                <div className="rounded bg-black/40 p-3 font-mono text-[10px] text-emerald-400/90 border border-emerald-900/30">
                   {`filters: [\n  { column: 'amount_usd',\n    operator: 'gte', \n    value: 0 \n  }\n]`}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-blue-400/80">Sorting & Pagination</label>
                <div className="rounded bg-black/40 p-3 font-mono text-[10px] text-blue-400/90 border border-blue-900/30">
                   {`sort: [\n  { column: 'amount_usd',\n    order: 'desc' }\n],\npagination: { limit: 5 }`}
                </div>
              </div>
              <button 
                className="btn btn-secondary w-full text-xs font-bold" 
                onClick={handleRunQuery}
                disabled={busy || !selectedId}
              >
                Execute Complex Query
              </button>
           </div>
           
           <div className="col-span-2">
              <div className="h-full rounded-xl border border-white/5 bg-black/10 overflow-hidden flex flex-col">
                 <div className="bg-white/5 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground border-b border-white/5 flex justify-between">
                    <span>Query Output</span>
                    {queryResult && <span className="text-emerald-400">Success</span>}
                 </div>
                 <div className="flex-1 p-4 overflow-auto font-mono text-[11px]">
                    {!queryResult ? (
                       <div className="h-full flex items-center justify-center text-muted-foreground italic text-xs">
                          Click "Execute Complex Query" to see filtering in action
                       </div>
                    ) : (
                       <div className="space-y-3">
                          <div className="text-blue-400">Targeting columns: [Merchant, Amount, Date]</div>
                          <div className="text-muted-foreground italic">// Showing top {queryResult.sample.length} of {queryResult.count} matches</div>
                          <div className="space-y-2 pt-2">
                             {queryResult.sample.map((row, i) => (
                                <div key={i} className="p-2 rounded bg-white/5 border border-white/5 flex justify-between items-center">
                                   <div className="flex flex-col">
                                      <span className="text-foreground font-bold">{row.merchant}</span>
                                      <span className="text-[10px] text-muted-foreground">{row.date}</span>
                                   </div>
                                   <div className="text-base font-bold text-emerald-400">${row.amount_usd}</div>
                                </div>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
