
import express from 'express';
import dotenv from 'dotenv';
import pool from './db.js';
import { apiKeyAuth } from './auth.js';
import apiRouter from './api.js';
import { createCustomer } from './customer.js';
import crypto from 'crypto';
import logger from './logger.js';
import pkg from '../package.json' with { type: 'json' };

dotenv.config();

const APP_VERSION = pkg.version;
dotenv.config();
logger.info({ event: 'startup', version: APP_VERSION }, 'AppHoster started');

const app = express();
app.use(express.json());


// Public health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});


app.get('/', (req, res) => {
  logger.info({ event: 'root', version: APP_VERSION }, 'Root endpoint hit');
  res.send(`AppHoster API version ${APP_VERSION} is running`);
});


app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0] });
  } catch (err) {
    logger.error({ event: 'db-test', err }, 'Database connection failed');
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Database connection failed', details: message });
  }
});

app.use('/api', apiKeyAuth, apiRouter);


app.post('/create-test-customer', async (req, res) => {
  const name = req.body.name || 'Test User';
  const email = req.body.email || `testuser${Date.now()}@example.com`;
  const apiKey = req.body.apiKey || crypto.randomBytes(24).toString('hex');
  try {
    const customer = await createCustomer(name, email, apiKey);
    logger.info({ event: 'create-test-customer', customerId: customer.id }, 'Test customer created');
    res.json({ customer, apiKey });
  } catch (err) {
    logger.error({ event: 'create-test-customer', err }, 'Failed to create customer');
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create customer', details: message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ event: 'listen', port: PORT }, `Server listening on port ${PORT}`);
});
