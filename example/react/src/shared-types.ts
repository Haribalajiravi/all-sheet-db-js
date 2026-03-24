/** Props shared between all tab components (Expense, Stock Watchlist, etc.) */
export interface TabProps {
  selectedId: string;
  sheets: { id: string; name: string }[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  status: string;
  setStatus: (s: string) => void;
  setSheets: (sheets: { id: string; name: string }[]) => void;
  persistSpreadsheet: (id: string) => void;
}
