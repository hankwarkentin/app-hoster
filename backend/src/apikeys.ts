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

// POST /api/keys/login - Authenticate user and return API key
// POST /api/keys/login - Authenticate user and return JWT session token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  logger.info({ email, password }, 'Login attempt');
  if (!email || !password) {
    logger.warn({ email, password }, 'Missing email or password');
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    // Find user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    logger.info({ rowCount: userResult.rowCount, email }, 'User query result');
    if (userResult.rowCount === 0) {
      logger.warn({ email }, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = userResult.rows[0];
    logger.info({ user }, 'User record');
    // Compare password
    const bcrypt = await import('bcryptjs');
    logger.info({ password, password_hash: user.password_hash }, 'Comparing password');
    const valid = bcrypt.compareSync(password, user.password_hash);
    logger.info({ valid }, 'Password comparison result');
    if (!valid) {
      logger.warn({ email }, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT session token
    const jwt = await import('jsonwebtoken');
    const payload = {
      userId: user.id,
      customerId: user.customer_id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign(payload, secret, { expiresIn: '2h' });
    logger.info({ token }, 'JWT generated');

    // Optionally update last_login timestamp
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({ token });
  } catch (err) {
    logger.error({ err }, 'User login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
