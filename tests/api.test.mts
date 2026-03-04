import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../src/db.js';
import { hashSync } from 'bcryptjs';
import { apiKeyAuth } from '../src/auth.js';
import apiRouter from '../src/api.js';

// Only import the router for health check test to avoid circular dependency
let app: express.Express;

beforeAll(async () => {
  // Ensure a valid API key exists for tests
  await pool.query('TRUNCATE api_keys, customers CASCADE');
  const email = 'bootstrap@example.com';
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
  const keyHash = hashSync(API_KEY, 10);
  await pool.query(
    'INSERT INTO api_keys (customer_id, key_hash) VALUES ($1::uuid, $2)',
    [customerId, keyHash]
  );
  app = express();
  app.use(express.json());
  // Add public health check route to test app
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });
  app.use('/api', apiKeyAuth, apiRouter);
});

const API_KEY = process.env.TEST_API_KEY || 'test-bootstrap-key';
const INVALID_API_KEY = 'invalid-key';
const TEST_FILE = 'test-endpoint.txt';
const TEST_FILE_CONTENT = 'test file for endpoint testing';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function cleanupTestFiles() {
  try { fs.unlinkSync(TEST_FILE); } catch {}
  try { fs.unlinkSync(path.join(UPLOADS_DIR, TEST_FILE)); } catch {}
  try { fs.unlinkSync('downloaded-endpoint.txt'); } catch {}
}

describe('AppHoster API', () => {
  it('should return ok for health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('number');
  });
  beforeAll(() => {
    cleanupTestFiles();
    fs.writeFileSync(TEST_FILE, TEST_FILE_CONTENT);
  });
  afterAll(() => {
    cleanupTestFiles();
  });

  it('should return 401 for missing API key', async () => {
    const res = await request(app).get('/api/apps');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized|API key required/);
  });

  it('should return 403 for invalid API key', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('x-api-key', INVALID_API_KEY);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid API key/);
  });

  let appId: number | undefined;
let versionId: string | undefined;

  it('should upload a valid file', async () => {
    const res = await request(app)
      .post('/api/apps/upload')
      .set('x-api-key', API_KEY)
      .field('name', 'TestApp')
      .field('bundle_id', 'com.example.testapp')
      .field('platform', 'ios')
      .field('version_name', '1.0.0')
      .field('version_code', '100')
      .field('branch', 'main')
      .field('commit', 'abcdef123456')
      .field('folder', 'main')
      .attach('file', TEST_FILE);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.app).toBeDefined();
    expect(res.body.version).toBeDefined();
    appId = res.body.app.id;
    versionId = res.body.version.id;
    expect(typeof appId).toBe('string');
    expect(typeof versionId).toBe('string');
    if (typeof appId === 'string') {
      expect(/^[0-9a-fA-F-]{36}$/.test(appId)).toBe(true);
    }
    if (typeof versionId === 'string') {
      expect(/^[0-9a-fA-F-]{36}$/.test(versionId)).toBe(true);
    }
  });

  it('should list apps after upload', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should contain the uploaded version
    const uploadedVersion = res.body.find((v: any) => v.version_name === '1.0.0' && v.file_url.endsWith(TEST_FILE));
    expect(uploadedVersion).toBeTruthy();
    // Save versionId for later tests
    versionId = uploadedVersion.id;
    expect(typeof versionId).toBe('string');
    if (typeof versionId === 'string') {
      expect(/^[0-9a-fA-F-]{36}$/.test(versionId)).toBe(true);
    }
  });

  it('should download the uploaded file', async () => {
    const res = await request(app)
      .get(`/api/apps/${versionId}/download`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    fs.writeFileSync('downloaded-endpoint.txt', res.text);
    // Optionally check contents if text file
    // expect(res.text).toBe(TEST_FILE_CONTENT);
  });

  it('should delete the uploaded file', async () => {
    const res = await request(app)
      .delete(`/api/apps/${versionId}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should list apps after delete (should be empty)', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should be empty after delete
    expect(res.body.some((v: any) => v.id === versionId)).toBe(false);
  });

  it('should fail to upload with no file', async () => {
    const res = await request(app)
      .post('/api/apps/upload')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No file uploaded/);
  });

  it('should fail to upload with excessively long filename', async () => {
    const longName = 'a'.repeat(256) + '.txt';
    const res = await request(app)
      .post('/api/apps/upload')
      .set('x-api-key', API_KEY)
      .attach('file', Buffer.from('dummy'), longName);
      // Should pass only if the endpoint rejects the long filename
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Filename too long/);
  });

  it('should return 400 for invalid app ID on download', async () => {
    const res = await request(app)
      .get('/api/apps/abc/download')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid app version ID/);
  });

  it('should return 404 for non-existent app on download', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/apps/${fakeId}/download`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/App version not found/);
  });

  it('should return 404 for non-existent app on delete', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .delete(`/api/apps/${fakeId}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/App version not found/);
  });
});
