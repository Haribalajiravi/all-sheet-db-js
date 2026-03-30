/**
 * Comprehensive example of all-sheet-db-js capabilities.
 * 
 * Features showcased:
 * 1. Basic CRUD (Store, Retrieve)
 * 2. Caching Layer
 * 3. Schema Migrations (Structural & Data Changes)
 * 4. Advanced Filtering (Operators like gt, contains, in)
 * 5. Sorting & Pagination
 * 6. Nested Grouping
 */

import { allSheetDB, LogLevel } from '../src/index';
// @ts-ignore - Assuming a config file exists in local environment
import integrationConfig from './integration-config.json';

const SPREADSHEET_ID = 'your-spreadsheet-id';
const SHEET_NAME = 'Sheet1';

async function runExample() {
  try {
    // Stage 1: Setup
    allSheetDB.setLogLevel(LogLevel.INFO);
    await allSheetDB.initialize(integrationConfig as any);
    allSheetDB.setService('google-sheets');

    // Authenticate (in browser this pops up the Google Auth window)
    const isAuth = await allSheetDB.isAuthenticated();
    if (!isAuth) {
      await allSheetDB.authenticate({ clientId: 'your-google-client-id' });
    }

    // Define initial model
    const model = {
      sheetName: SHEET_NAME,
      columns: [
        { name: 'id', type: 'number' as const, required: true },
        { name: 'name', type: 'string' as const },
        { name: 'type', type: 'string' as const },
        { name: 'price', type: 'number' as const },
        { name: 'created_at', type: 'date' as const }
      ],
    };

    // Stage 2: Basic Operations
    console.log('\n--- 1. Basic Store & Retrieve ---');
    const products = [
      { id: 1, name: 'Apple', type: 'Fruit', price: 1.2, created_at: new Date() },
      { id: 2, name: 'Broccoli', type: 'Vegetable', price: 2.5, created_at: new Date() },
      { id: 3, name: 'Banana', type: 'Fruit', price: 0.8, created_at: new Date() },
    ];

    await allSheetDB.store(products, { sheetName: SPREADSHEET_ID, model });
    const basicRes = await allSheetDB.retrieve({ sheetName: SPREADSHEET_ID, model });
    console.log(`Fetched ${basicRes.data?.length} rows`);

    // Stage 3: Caching Layer
    console.log('\n--- 2. Built-in Caching Layer ---');
    // First call (Cache Miss, fetches from API)
    const start1 = Date.now();
    await allSheetDB.retrieve({ 
      sheetName: SPREADSHEET_ID, 
      model,
      cache: { enabled: true, ttl: 60000 } // 1 minute cache
    });
    console.log(`First call (API): ${Date.now() - start1}ms`);

    // Second call (Cache Hit, instant)
    const start2 = Date.now();
    const cacheRes = await allSheetDB.retrieve({ 
      sheetName: SPREADSHEET_ID, 
      model,
      cache: { enabled: true } 
    });
    console.log(`Second call (Cache): ${Date.now() - start2}ms`);
    console.log(`Data served from cache: ${cacheRes.fromCache}`);

    // Stage 4: Advanced Manipulation (Filtering, Sorting, Pagination)
    console.log('\n--- 3. Advanced Filtering & Sorting ---');
    const filteredRes = await allSheetDB.retrieve({
      sheetName: SPREADSHEET_ID,
      model,
      filters: [
        { column: 'type', operator: 'eq', value: 'Fruit' },
        { column: 'price', operator: 'lt', value: 1.0 }
      ],
      sort: [{ column: 'price', order: 'desc' }],
      pagination: { limit: 10, offset: 0 }
    });
    console.log('Filtered & Sorted Fruits:', filteredRes.data);

    // Stage 5: Nested Grouping
    console.log('\n--- 4. Data Grouping ---');
    const groupedRes = await allSheetDB.retrieve({
      sheetName: SPREADSHEET_ID,
      model,
      groupBy: 'type'
    });
    console.log('Data grouped by type:', Object.keys(groupedRes.data as any));

    // Stage 6: Schema Migrations
    console.log('\n--- 5. Automated Schema Migrations ---');
    const migrationResult = await allSheetDB.migrate({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      migrations: [
        {
          version: 1,
          description: 'Initial schema',
          actions: [] // Actions can be empty for the first version if sheet exists
        },
        {
          version: 2,
          description: 'Add instock column and capitalize names',
          actions: [
            { type: 'add_column', column: 'instock', defaultValue: 'TRUE' },
            { 
              type: 'transform_data', 
              transform: (row: any) => ({
                ...row,
                name: row.name?.toUpperCase() || ''
              })
            }
          ]
        }
      ]
    });
    console.log(`Migration successful: ${migrationResult.appliedMigrations} steps applied`);

    // Logout
    // await allSheetDB.clearAuth();

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// runExample();
