import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../src/db.js';
import { hashSync } from 'bcryptjs';
import { apiKeyOrJwtAuth } from '../src/auth.js';
import apiRouter from '../src/api.js';
console.log('apiKeyOrJwtAuth type:', typeof apiKeyOrJwtAuth);
console.log('apiKeyOrJwtAuth value:', apiKeyOrJwtAuth);
const app = express();
app.use(express.json());
app.use('/api', apiKeyOrJwtAuth);
app.use('/api', apiRouter);

const API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const INVALID_API_KEY = 'invalid-key';
const TEST_FILE = path.join(process.cwd(), 'Battleship.apk');
const TEST_FILE_CONTENT = '';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function cleanupTestFiles() {
  // Do not delete the source test APK file
  try { fs.unlinkSync(path.join(UPLOADS_DIR, TEST_FILE)); } catch {}
  try { fs.unlinkSync('downloaded-endpoint.txt'); } catch {}
}

describe('AppHoster API', () => {
  beforeAll(() => {
    cleanupTestFiles();
    // Ensure the test APK file exists and is not empty
    if (!fs.existsSync(TEST_FILE)) {
      throw new Error(`Test APK file not found: ${TEST_FILE}`);
    }
    const stats = fs.statSync(TEST_FILE);
    if (stats.size === 0) {
      throw new Error(`Test APK file is empty: ${TEST_FILE}`);
    }
    // Rely on test customer and API key created by deploy-minikube.sh
    // No customer or API key creation here
  });
  afterAll(() => {
    cleanupTestFiles();
  });
  it('should return ok for health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('number');
  });

  it('should return 401 for missing API key', async () => {
    const res = await request(app).get('/api/apps');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized|API key required|API key or JWT required/);
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

  it.skip('should upload a valid file', async () => {
    const res = await request(app)
      .post('/api/apps/upload')
      .set('x-api-key', API_KEY)
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

  it.skip('should list apps after upload', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Log the response body for debugging
    console.log('List apps response:', res.body);
    // Should contain the uploaded version
    const uploadedVersion = res.body.find((v: any) => v.version_name === '0.1' && v.file_url === 'Battleship.apk');
    expect(uploadedVersion).toBeTruthy();
    // Save versionId for later tests
    versionId = uploadedVersion?.id;
    expect(typeof versionId).toBe('string');
    if (typeof versionId === 'string') {
      expect(/^[0-9a-fA-F-]{36}$/.test(versionId)).toBe(true);
    }
  });

  it.skip('should download the uploaded file', async () => {
    const res = await request(app)
      .get(`/api/apps/${versionId}/download`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    fs.writeFileSync('downloaded-endpoint.txt', res.text);
    // Optionally check contents if text file
    // expect(res.text).toBe(TEST_FILE_CONTENT);
  });

  it.skip('should delete the uploaded file', async () => {
    const res = await request(app)
      .delete(`/api/apps/${versionId}`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it.skip('should list apps after delete (should be empty)', async () => {
    const res = await request(app)
      .get('/api/apps')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should be empty after delete
    expect(res.body.some((v: any) => v.id === versionId)).toBe(false);
  });

  it.skip('should fail to upload with no file', async () => {
    const res = await request(app)
      .post('/api/apps/upload')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No file uploaded/);
  });

  it.skip('should fail to upload with excessively long filename', async () => {
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
