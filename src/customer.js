import pool from './db.js';
import crypto from 'crypto';
export async function findCustomerByApiKey(apiKey) {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const result = await pool.query('SELECT * FROM customers WHERE api_key_hash = $1', [hash]);
    return result.rows[0];
}
export function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}
//# sourceMappingURL=customer.js.map