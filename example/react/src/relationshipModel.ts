import { SheetModel } from '../../../src/types';

export const CUSTOMER_SHEET_MODEL: SheetModel = {
  sheetName: 'Customers',
  columns: [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string' },
  ],
};

export const ORDER_SHEET_MODEL: SheetModel = {
  sheetName: 'Orders',
  columns: [
    { name: 'id', type: 'string', required: true },
    { name: 'customerId', type: 'string', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'date', type: 'string' },
  ],
};

export const initialCustomers = [
  { id: 'C1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 'C2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: 'C3', name: 'Charlie Brown', email: 'charlie@example.com' },
];

export const initialOrders = [
  { id: 'O1', customerId: 'C1', amount: 1500, date: '2024-01-01' },
  { id: 'O2', customerId: 'C2', amount: 2500, date: '2024-01-02' },
  { id: 'O3', customerId: 'C1', amount: 750, date: '2024-01-03' },
  { id: 'O4', customerId: 'C3', amount: 1200, date: '2024-01-04' },
];
