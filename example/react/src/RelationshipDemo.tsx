import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { allSheetDB } from '../../../src/index';
import {
  CUSTOMER_SHEET_MODEL,
  ORDER_SHEET_MODEL,
  initialCustomers,
  initialOrders,
} from './relationshipModel';

interface RelationshipDemoProps {
  selectedId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  status: string;
  setStatus: (s: string) => void;
}

export default function RelationshipDemo({
  selectedId,
  busy,
  setBusy,
  setStatus,
}: RelationshipDemoProps) {
  const [populatedOrders, setPopulatedOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Form states
  const [customerForm, setCustomerForm] = useState({ name: '', email: '' });
  const [orderForm, setOrderForm] = useState({
    customerId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const setupAndFetch = useCallback(async () => {
    if (!selectedId) return;

    setBusy(true);
    setStatus('Setting up relationship demo sheets...');

    try {
      const gs = allSheetDB.getGoogleSheetsService();
      if (!gs) throw new Error('Google Sheets service not available');

      const customerHeaders = CUSTOMER_SHEET_MODEL.columns.map(c => c.name);
      const orderHeaders = ORDER_SHEET_MODEL.columns.map(c => c.name);

      // 1. Ensure Tabs exist + header rows are present
      setStatus('Provisioning relational sheets...');
      await gs.ensureSheetHeaderRow({
        spreadsheetId: selectedId,
        sheetTabName: CUSTOMER_SHEET_MODEL.sheetName,
        headerValues: customerHeaders,
      });
      await gs.ensureSheetHeaderRow({
        spreadsheetId: selectedId,
        sheetTabName: ORDER_SHEET_MODEL.sheetName,
        headerValues: orderHeaders,
      });

      // 2. Ensure Customers sheet has data
      const customersCheck = await allSheetDB.retrieve({
        sheetName: selectedId,
        model: CUSTOMER_SHEET_MODEL,
        pagination: { limit: 1 },
        cache: { enabled: true, ttl: 60000 },
      });

      if (!customersCheck.success || !customersCheck.data?.length) {
        setStatus('Initializing Customers data...');
        await allSheetDB.store(initialCustomers, {
          sheetName: selectedId,
          model: CUSTOMER_SHEET_MODEL,
          append: true,
        });
      }

      // 3. Ensure Orders sheet has data
      const ordersCheck = await allSheetDB.retrieve({
        sheetName: selectedId,
        model: ORDER_SHEET_MODEL,
        pagination: { limit: 1 },
        cache: { enabled: true, ttl: 60000 },
      });

      if (!ordersCheck.success || !ordersCheck.data?.length) {
        setStatus('Initializing Orders data...');
        await allSheetDB.store(initialOrders, {
          sheetName: selectedId,
          model: ORDER_SHEET_MODEL,
          append: true,
        });
      }

      // 4. Fetch Customers for dropdown
      const custResult = await allSheetDB.retrieve({
        sheetName: selectedId,
        model: CUSTOMER_SHEET_MODEL,
        cache: { enabled: true, ttl: 300000 },
      });
      if (custResult.success) {
        setCustomers(custResult.data || []);
      }

      // 5. Fetch Populated Orders
      setStatus('Fetching orders with customer details...');
      const result = await allSheetDB.retrieve({
        sheetName: selectedId,
        model: ORDER_SHEET_MODEL,
        populate: [
          {
            localField: 'customerId',
            from: CUSTOMER_SHEET_MODEL.sheetName,
            foreignField: 'id',
            as: 'customer',
          },
        ],
        sort: [{ column: 'date', order: 'desc' }],
        cache: { enabled: true, ttl: 300000 },
      });

      if (result.success) {
        setPopulatedOrders(result.data || []);
        setStatus('Ready');
      } else {
        setStatus(`Error: ${result.error}`);
      }
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [selectedId, setBusy, setStatus]);

  useEffect(() => {
    if (selectedId) {
      void setupAndFetch();
    }
  }, [selectedId, setupAndFetch]);

  const handleCreateCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerForm.name) return;

    setBusy(true);
    setStatus('Creating customer...');
    try {
      const newCustomer = {
        id: `C${Date.now().toString().slice(-4)}`,
        name: customerForm.name,
        email: customerForm.email,
      };

      const res = await allSheetDB.store([newCustomer], {
        sheetName: selectedId,
        append: true,
        model: CUSTOMER_SHEET_MODEL,
      });

      if (res.success) {
        setCustomerForm({ name: '', email: '' });
        await setupAndFetch();
        setStatus('Customer created');
      } else {
        setStatus(`Error: ${res.error}`);
      }
    } catch (err: any) {
      setStatus(`Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderForm.customerId || !orderForm.amount) return;

    setBusy(true);
    setStatus('Creating order...');
    try {
      const newOrder = {
        id: `O${Date.now().toString().slice(-4)}`,
        customerId: orderForm.customerId,
        amount: Number(orderForm.amount),
        date: orderForm.date,
      };

      const res = await allSheetDB.store([newOrder], {
        sheetName: selectedId,
        append: true,
        model: ORDER_SHEET_MODEL,
      });

      if (res.success) {
        setOrderForm(f => ({ ...f, amount: '' }));
        await setupAndFetch();
        setStatus('Order created');
      } else {
        setStatus(`Error: ${res.error}`);
      }
    } catch (err: any) {
      setStatus(`Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relational Data & Joins</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Demonstrating <strong>Foreign Key</strong> relationships and <code>populate</code> queries.
          </p>
        </div>
        <button
          onClick={() => void setupAndFetch()}
          className="btn btn-outline"
          disabled={busy}
        >
          Refresh Data
        </button>
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <h3 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
          Relational Logic
        </h3>
        <p className="text-xs text-indigo-200/70 leading-relaxed mb-4">
          This demo uses two sheets: <strong>Customers</strong> and <strong>Orders</strong>. 
          Orders are linked to Customers via <code>customerId</code>. The <code>populate</code> option 
          automatically fetches and merges the related customer data into each order.
        </p>
        <pre className="p-3 bg-black/40 rounded-lg text-[10px] text-indigo-300 overflow-x-auto font-mono border border-indigo-500/10">
{`const result = await allSheetDB.retrieve({
  sheetName: 'Orders',
  populate: [{
    localField: 'customerId',  // Field in Orders
    from: 'Customers',         // Target Sheet
    foreignField: 'id',        // Field in Customers
    as: 'customer'             // Output property name
  }]
});`}
        </pre>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Customer */}
        <div className="card p-6 border-indigo-500/10">
          <h3 className="text-lg font-semibold mb-4">1. Create Customer</h3>
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input 
                type="text" 
                className="field" 
                placeholder="Alice Johnson"
                value={customerForm.name}
                onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input 
                type="email" 
                className="field" 
                placeholder="alice@example.com"
                value={customerForm.email}
                onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))}
                disabled={busy}
              />
            </div>
            <button type="submit" className="btn w-full" disabled={busy}>
              Add Customer
            </button>
          </form>
        </div>

        {/* Create Order */}
        <div className="card p-6 border-emerald-500/10">
          <h3 className="text-lg font-semibold mb-4">2. Create Linked Order</h3>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label className="label">Link to Customer</label>
              <select 
                className="field"
                value={orderForm.customerId}
                onChange={e => setOrderForm(f => ({ ...f, customerId: e.target.value }))}
                required
                disabled={busy || customers.length === 0}
              >
                <option value="">-- Choose a Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (₹)</label>
                <input 
                  type="number" 
                  className="field" 
                  placeholder="0.00"
                  value={orderForm.amount}
                  onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
                  required
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label">Order Date</label>
                <input 
                  type="date" 
                  className="field" 
                  value={orderForm.date}
                  onChange={e => setOrderForm(f => ({ ...f, date: e.target.value }))}
                  required
                  disabled={busy}
                />
              </div>
            </div>
            <button type="submit" className="btn w-full btn-secondary bg-emerald-600 hover:bg-emerald-700 border-none" disabled={busy}>
              Create Order
            </button>
          </form>
        </div>
      </div>

      {/* Results Table */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground/80">Orders & Linked Details</h3>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-4">Order ID</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Customer ID</th>
                <th className="px-4 py-4">Customer Info (Auto-found)</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {populatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground italic">
                    {busy ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                        Loading joined records...
                      </div>
                    ) : 'No orders found. Add a customer and then an order!'}
                  </td>
                </tr>
              ) : (
                populatedOrders.map(order => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{order.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{order.date}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">₹ {order.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                        {order.customerId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.customer ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{order.customer.name}</span>
                          <span className="text-xs text-muted-foreground">{order.customer.email || 'No email'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 italic text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                          Data Not Found
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
