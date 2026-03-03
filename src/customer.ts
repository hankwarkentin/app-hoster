import pool from './db.js';
import crypto from 'crypto';

export async function findCustomerByApiKey(apiKey: string) {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const result = await pool.query(
    'SELECT * FROM customers WHERE api_key_hash = $1',
    [hash]
  );
  return result.rows[0];
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function createCustomer(name: string, email: string, apiKey: string, role: string = 'user') {
  const api_key_hash = hashApiKey(apiKey);
  const result = await pool.query(
    'INSERT INTO customers (name, email, api_key_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, email, api_key_hash, role]
  );
  return result.rows[0];
}
