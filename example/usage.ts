/**
 * Example usage of all-sheet-db-js
 */

import { allSheetDB, LogLevel } from '../src/index';
import integrationConfig from './integration-config.json';

async function example() {
  try {
    // Set log level
    allSheetDB.setLogLevel(LogLevel.DEBUG);

    // Initialize the library
    await allSheetDB.initialize(integrationConfig);

    // Set the active service
    allSheetDB.setService('google-sheets');

    // Authenticate (in real usage, this would be triggered by user action)
    const credentials = {
      clientId: 'your-google-client-id',
    };

    const isAuth = await allSheetDB.isAuthenticated();
    if (!isAuth) {
      await allSheetDB.authenticate(credentials);
    }

    // Define a model for the sheet
    const model = {
      sheetName: 'Sheet1',
      columns: [
        { name: 'id', type: 'number', required: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'created_at', type: 'date', format: 'YYYY-MM-DD' },
      ],
    };

    // Store data
    const data = [
      { id: 1, name: 'John Doe', email: 'john@example.com', created_at: new Date() },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: new Date() },
    ];

    const storeResult = await allSheetDB.store(data, {
      sheetName: 'your-spreadsheet-id',
      model,
      append: true,
    });

    if (storeResult.success) {
      console.log(`Successfully stored ${storeResult.rowsAffected} rows`);
    } else {
      console.error('Failed to store data:', storeResult.error);
    }

    // Retrieve data
    const retrieveResult = await allSheetDB.retrieve({
      sheetName: 'your-spreadsheet-id',
      model,
    });

    if (retrieveResult.success && retrieveResult.data) {
      console.log('Retrieved data:', retrieveResult.data);
    } else {
      console.error('Failed to retrieve data:', retrieveResult.error);
    }

    // Clear authentication
    // await allSheetDB.clearAuth();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run
// example();
