import express from 'express';
import crypto from 'crypto';
import { hashSync } from 'bcryptjs';
import pool from './db.js';
import logger from './logger.js';

const router = express.Router();

// POST /api/keys - Create a new API key
router.post('/', async (req, res) => {
  try {
    logger.info({ customer: req.customer }, 'req.customer');
    if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
    if (req.customer.role !== 'admin' && req.customer.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }
    logger.info({ customerId: req.customer.id }, 'req.customer.id');
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = hashSync(rawKey, 10);
    const result = await pool.query(
      'INSERT INTO api_keys (id, customer_id, key_hash) VALUES (gen_random_uuid(), $1::uuid, $2) RETURNING id, created_at',
      [req.customer.id, keyHash]
    );
    res.json({ key: rawKey, id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err) {
    logger.error({ err }, 'Create API key error');
    res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/keys - List all API keys for the customer
router.get('/', async (req, res) => {
  if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
  const result = await pool.query(
    'SELECT id, created_at, last_used, revoked FROM api_keys WHERE customer_id = $1::uuid',
    [req.customer.id]
  );
  res.json(result.rows);
});

// GET /api/keys/:id - Get metadata for a specific key
router.get('/:id', async (req, res) => {
  if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
  const keyId = req.params.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyId)) {
    return res.status(400).json({ error: 'Invalid key ID (must be UUID)'});
  }
  try {
    const result = await pool.query(
      'SELECT id, created_at, last_used, revoked FROM api_keys WHERE id = $1::uuid AND customer_id = $2::uuid',
      [keyId, req.customer.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /api/keys/:id - Revoke an API key
router.delete('/:id', async (req, res) => {
  if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
  if (req.customer.role !== 'admin' && req.customer.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  const keyId = req.params.id;
  if (!/^[0-9a-fA-F-]{36}$/.test(keyId)) {
    return res.status(400).json({ error: 'Invalid key ID (must be UUID)'});
  }
  try {
    const result = await pool.query(
      'UPDATE api_keys SET revoked = TRUE WHERE id = $1::uuid AND customer_id = $2::uuid RETURNING id',
      [keyId, req.customer.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found or not owned by user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
