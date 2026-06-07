const { Pool } = require('pg');
const {
  handleMockQuery,
  mockUsers,
  mockOrders,
  mockSessions,
  mockBehaviors,
  mockFavorites,
} = require('./mock-database');
require('dotenv').config();

const NO_DB_MODE = process.env.NO_DB_MODE === 'true';

let pool;
let dbConnected = false;

if (!NO_DB_MODE) {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'handmade_jewelry',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    dbConnected = false;
  });
}

const testConnection = async () => {
  if (NO_DB_MODE) {
    console.log('⚠️  Running in NO_DB_MODE - using mock data');
    dbConnected = false;
    return true;
  }

  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    dbConnected = true;
    return true;
  } catch (err) {
    console.warn('⚠️  Database connection failed:', err.message);
    console.log('💡 Tip: Set NO_DB_MODE=true to run without database');
    dbConnected = false;
    return true;
  }
};

const query = async (text, params) => {
  if (NO_DB_MODE) {
    return handleMockQuery(text, params || []);
  }
  
  if (!dbConnected) {
    return handleMockQuery(text, params || []);
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', { text: text.substring(0, 50), error: error.message });
    throw error;
  }
};

const transaction = async (callback) => {
  if (NO_DB_MODE || !dbConnected) {
    const mockClient = {
      query: handleMockQuery,
      release: () => {},
    };
    try {
      const result = await callback(mockClient);
      return result;
    } catch (error) {
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  isDbConnected: () => dbConnected,
  NO_DB_MODE,
  mockUsers,
  mockOrders,
  mockSessions,
  mockFavorites,
  mockBehaviors,
};
