
import pkg from 'jsonwebtoken';
import pool from './db.js';
import logger from './logger.js';
import { compareSync } from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
const { verify } = pkg;

export function apiKeyOrJwtAuth(req: Request, res: Response, next: NextFunction) {
  (async () => {
    // Try JWT first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const payload = verify(token, secret);
        // Attach user info from JWT
        (req as any).user = payload;
        // Optionally, fetch customer from DB if needed
        // Handle JWT payload type
        const customerId = typeof payload === 'string' ? undefined : (payload as any).customerId;
        if (!customerId) {
          logger.error({ event: 'auth', token }, 'JWT payload missing customerId');
          return res.status(403).json({ error: 'Invalid JWT: missing customerId'});
        }
        const custResult = await pool.query('SELECT * FROM customers WHERE id = $1::uuid', [customerId]);
        if (custResult.rowCount === 0) {
          logger.error({ event: 'auth', token }, 'Customer not found for JWT');
          return res.status(403).json({ error: 'Invalid JWT: customer not found'});
        }
        (req as any).customer = custResult.rows[0];
        return next();
      } catch (err) {
        logger.warn({ err }, 'JWT verification failed');
        // Fall through to API key check
      }
    }
    // Fallback to API key
    const apiKey = req.headers['x-api-key'] as string | undefined;
    logger.info({ apiKey }, 'apiKey header');
    if (!apiKey) {
      logger.error({ event: 'auth', apiKey }, 'No API key or JWT provided');
      return res.status(401).json({ error: 'API key or JWT required' });
    }
    // Find all keys (including revoked)
    const keyResult = await pool.query('SELECT customer_id, key_hash, revoked FROM api_keys');
    let customerId: string | undefined;
    let isRevoked = false;
    for (const row of keyResult.rows) {
      if (compareSync(apiKey, row.key_hash)) {
        customerId = row.customer_id;
        isRevoked = row.revoked;
        break;
      }
    }
    if (!customerId) {
      logger.error({ event: 'auth', apiKey }, 'Invalid API key');
      return res.status(403).json({ error: 'Invalid API key' });
    }
    if (isRevoked) {
      logger.error({ event: 'auth', apiKey }, 'Revoked API key');
      return res.status(403).json({ error: 'API key revoked' });
    }
    const custResult = await pool.query('SELECT * FROM customers WHERE id = $1::uuid', [customerId]);
    if (custResult.rowCount === 0) {
      logger.error({ event: 'auth', apiKey }, 'Customer not found for API key');
      return res.status(403).json({ error: 'Invalid API key'});
    }
    (req as any).customer = custResult.rows[0];
    next();
  })().catch((err) => {
    logger.error({ err }, 'Auth error');
    res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
  });
}
