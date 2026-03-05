// backend/src/auth-login.ts

import express from 'express';
import pool from './db.js';
import logger from './logger.js';
import pkg from 'jsonwebtoken';
const { sign } = pkg;

const router = express.Router();

// POST /api/login - Authenticate user and return JWT session token
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
    const payload = {
      userId: user.id,
      customerId: user.customer_id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = sign(payload, secret, { expiresIn: '2h' });
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
