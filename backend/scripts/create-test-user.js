// backend/scripts/create-test-user.js
import { hashSync } from 'bcryptjs';
import pool from '../src/db.js';

const email = process.argv[2] || 'bootstrap.user@example.com';
const password = process.argv[3] || 'testpassword';
const name = process.argv[4] || 'Bootstrap User';
const role = process.argv[5] || 'admin';
const customerName = process.argv[6] || 'bootstrap';

async function main() {
  // Find customer
  let result = await pool.query('SELECT id FROM customers WHERE name = $1', [customerName]);
  if (result.rowCount === 0) {
    throw new Error('Customer not found: ' + customerName);
  }
  const customerId = result.rows[0].id;
  const passwordHash = hashSync(password, 10);
  await pool.query(
    `INSERT INTO users (customer_id, email, password_hash, name, role)
     VALUES ($1::uuid, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    [customerId, email, passwordHash, name, role]
  );
  console.log(`Test user '${email}' created for customer '${customerName}'.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error creating test user:', err);
  process.exit(1);
});
