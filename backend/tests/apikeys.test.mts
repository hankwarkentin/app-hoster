import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db.js';
import crypto from 'crypto';
import { hashSync } from 'bcryptjs';

const API_KEY = process.env.TEST_API_KEY || 'test-bootstrap-key';

beforeAll(async () => {
  // Clean up tables before tests
  await pool.query('TRUNCATE api_keys, customers CASCADE');
  // Ensure bootstrap customer exists
  const email = `bootstrap+${Date.now()}@example.com`;
  const name = 'bootstrap';
  const role = 'admin';
  let result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
  let customerId;
  if (result.rowCount === 0) {
    result = await pool.query(
      'INSERT INTO customers (name, email, role) VALUES ($1, $2, $3) RETURNING id',
      [name, email, role]
    );
    customerId = result.rows[0].id;
  } else {
    customerId = result.rows[0].id;
  }
  // Ensure bootstrap API key exists in api_keys table
  const keyHash = hashSync(API_KEY, 10);
  await pool.query(
    'INSERT INTO api_keys (customer_id, key_hash) VALUES ($1::uuid, $2)',
    [customerId, keyHash]
  );
});

describe('API Key Endpoints', () => {
  let createdKeyId: string;
  let createdKeyValue: string;

  it('should create a new API key', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(res.body.key).toBeDefined();
    expect(res.body.id).toBeDefined();
    // Ensure createdKeyId is a string (UUID)
    createdKeyId = String(res.body.id);
    createdKeyValue = res.body.key;
    console.log('createdKeyId:', createdKeyId, 'type:', typeof createdKeyId);
  });

  it('should list API keys', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    console.log('createdKeyId:', createdKeyId);
    console.log('Returned ids:', res.body.map((k: any) => k.id));
    console.log('Full response:', JSON.stringify(res.body, null, 2));
    if (!res.body.some((k: any) => String(k.id) === String(createdKeyId))) {
      console.error('createdKeyId not found!');
      console.error('createdKeyId:', createdKeyId);
      console.error('Returned ids:', res.body.map((k: any) => k.id));
      console.error('Full response:', JSON.stringify(res.body, null, 2));
    }
    expect(res.body.some((k: any) => String(k.id) === String(createdKeyId))).toBe(true);
  });

  it('should get metadata for a specific key', async () => {
    const res = await request(app)
      .get(`/api/keys/${createdKeyId}`)
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(res.body.id).toBe(createdKeyId);
    expect(res.body.revoked).toBe(false);
  });

  it('should revoke an API key', async () => {
    const res = await request(app)
      .delete(`/api/keys/${createdKeyId}`)
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(res.body.success).toBe(true);

    // Confirm revoked
    const meta = await request(app)
      .get(`/api/keys/${createdKeyId}`)
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(meta.body.revoked).toBe(true);
  });

  it('should fail to create a key with missing authentication', async () => {
    const res = await request(app)
      .post('/api/keys')
      .expect(401);
    expect(res.body.error).toMatch(/Unauthorized|API key required|API key or JWT required/);
  });

  it('should fail to get a non-existent key', async () => {
    // Use a valid UUID that does not exist
    const nonExistentUUID = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .get(`/api/keys/${nonExistentUUID}`)
      .set('x-api-key', API_KEY)
      .expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('should fail to revoke a non-existent key', async () => {
    // Use a valid UUID that does not exist
    const nonExistentUUID = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .delete(`/api/keys/${nonExistentUUID}`)
      .set('x-api-key', API_KEY)
      .expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('should not authenticate with a revoked key', async () => {
    // Try to use the revoked key for a protected endpoint
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', createdKeyValue)
      .expect(403);
    expect(res.body.error).toMatch(/revoked|invalid/i);
  });

  it('should handle invalid key ID format', async () => {
    const res = await request(app)
      .get('/api/keys/notanumber')
      .set('x-api-key', API_KEY)
      .expect(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('should list keys when none exist (after revoking all)', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All keys should be revoked, so forbidden
  });

  it('should fail key operations for non-admin user', async () => {
    // Create a non-admin customer and key
    const email = 'user@example.com';
    const name = 'user';
    const role = 'user';
    let result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    let customerId;
    if (result.rowCount === 0) {
      result = await pool.query(
        'INSERT INTO customers (name, email, role) VALUES ($1, $2, $3) RETURNING id',
        [name, email, role]
      );
      customerId = result.rows[0].id;
    } else {
      customerId = result.rows[0].id;
    }
    const keyValue = 'user-key';
    const keyHash = hashSync(keyValue, 10);
    result = await pool.query('SELECT * FROM api_keys WHERE customer_id = $1', [customerId]);
    let keyId;
    if (result.rowCount === 0) {
      const insert = await pool.query(
        'INSERT INTO api_keys (customer_id, key_hash) VALUES ($1, $2) RETURNING id',
        [customerId, keyHash]
      );
      keyId = insert.rows[0].id;
    } else {
      keyId = result.rows[0].id;
    }
    // Try to create a key as non-admin
    const resCreate = await request(app)
      .post('/api/keys')
      .set('x-api-key', keyValue)
      .expect(403);
    expect(resCreate.body.error).toMatch(/forbidden|admin/i);
    // Try to revoke a key as non-admin
    const resDelete = await request(app)
      .delete(`/api/keys/${keyId}`)
      .set('x-api-key', keyValue)
      .expect(403);
    expect(resDelete.body.error).toMatch(/forbidden|admin/i);
  });
});
