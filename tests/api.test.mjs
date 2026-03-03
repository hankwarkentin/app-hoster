import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
// Only import the router for health check test to avoid circular dependency
let app;
beforeAll(async () => {
    const { default: apiRouter } = await import('../src/api.js');
    const { apiKeyAuth } = await import('../src/auth.js');
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
    try {
        fs.unlinkSync(TEST_FILE);
    }
    catch { }
    try {
        fs.unlinkSync(path.join(UPLOADS_DIR, TEST_FILE));
    }
    catch { }
    try {
        fs.unlinkSync('downloaded-endpoint.txt');
    }
    catch { }
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
    let appId;
    it('should upload a valid file', async () => {
        const res = await request(app)
            .post('/api/apps/upload')
            .set('x-api-key', API_KEY)
            .attach('file', TEST_FILE);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.app).toBeDefined();
        appId = res.body.app.id;
    });
    it('should list apps after upload', async () => {
        const res = await request(app)
            .get('/api/apps')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((app) => app.filename === TEST_FILE)).toBe(true);
    });
    it('should download the uploaded file', async () => {
        const res = await request(app)
            .get(`/api/apps/${appId}/download`)
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        fs.writeFileSync('downloaded-endpoint.txt', res.text);
        // Optionally check contents if text file
        // expect(res.text).toBe(TEST_FILE_CONTENT);
    });
    it('should delete the uploaded file', async () => {
        const res = await request(app)
            .delete(`/api/apps/${appId}`)
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
        expect(res.body.length).toBe(0);
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
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Filename too long/);
    });
    it('should return 400 for invalid app ID on download', async () => {
        const res = await request(app)
            .get('/api/apps/abc/download')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid app ID/);
    });
    it('should return 400 for invalid app ID on delete', async () => {
        const res = await request(app)
            .delete('/api/apps/xyz')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid app ID/);
    });
    it('should return 404 for non-existent app on download', async () => {
        const res = await request(app)
            .get('/api/apps/9999/download')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/App not found/);
    });
    it('should return 404 for non-existent app on delete', async () => {
        const res = await request(app)
            .delete('/api/apps/9999')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/App not found/);
    });
});
//# sourceMappingURL=api.test.mjs.map