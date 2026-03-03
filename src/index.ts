import express from 'express';
import dotenv from 'dotenv';
import pool from './db.js';
import { apiKeyAuth } from './auth.js';
import apiRouter from './api.js';
import { createCustomer } from './customer.js';
import crypto from 'crypto';

const APP_VERSION = '1.0.0';

dotenv.config();

console.log(`AppHoster v${APP_VERSION} started`);

const app = express();
app.use(express.json());


// Public health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/', (req, res) => {
  console.log(`Root endpoint hit (v${APP_VERSION})`);
  res.send('AppHoster API is running');
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0] });
  } catch (err) {
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
    res.json({ customer, apiKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create customer', details: message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
