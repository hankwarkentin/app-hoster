import pool from './db.js';
export async function createCustomer(name: string, email: string, role: string = 'user') {
  const result = await pool.query(
    'INSERT INTO customers (name, email, role) VALUES ($1, $2, $3) RETURNING *',
    [name, email, role]
  );
  return result.rows[0];
}
