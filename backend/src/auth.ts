import type { Request, Response, NextFunction } from 'express';
import pool from './db.js';
import logger from './logger.js';
import { compareSync } from 'bcryptjs';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    logger.info({ apiKey }, 'apiKey header');
    if (!apiKey) {
      logger.error({ event: 'auth', apiKey }, 'No API key provided');
      return res.status(401).json({ error: 'API key required' });
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
    logger.error({ err }, 'API key auth error');
    res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
  });
}
