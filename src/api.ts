

// All imports at the top
import express from 'express';
import multer from 'multer';
import path from 'path';
// TODO: S3 integration will be added later
import { saveLocalFile, getLocalFilePath } from './localStorage.js';
import pool from './db.js';
import apikeysRouter from './apikeys.js';
import logger from './logger.js';

// Router initialization
const router = express.Router();

// Multer error handler for fileFilter
import type { Request, Response, NextFunction } from 'express';
function multerErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err && err.message === 'Filename too long') {
    return res.status(400).json({ error: 'Filename too long' });
  }
  next(err);
}
const upload = multer({ dest: path.join(new URL('.', import.meta.url).pathname, '../uploads') });
// Multer fileFilter to enforce filename length
const filenameLimit = 255;
const uploadWithFilter = multer({
  dest: path.join(new URL('.', import.meta.url).pathname, '../uploads'),
  fileFilter: (req, file, cb) => {
    if (file.originalname.length > filenameLimit) {
      // Multer expects error to be null or an instance of MulterError, but null is safest for custom error
      // Instead, set a custom property on req and reject the file
      (req as any).fileValidationError = 'Filename too long';
      return cb(null, false);
    }
    cb(null, true);
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// POST /api/apps/upload - Upload app file
router.post('/apps/upload', uploadWithFilter.single('file'), async (req, res) => {
  try {
    if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
    // Check for Multer fileFilter error
    if ((req as any).fileValidationError === 'Filename too long') {
      return res.status(400).json({ error: 'Filename too long' });
    }
    const file = req.file;
    // Defensive: check for file and body before destructuring
    if (!file || !file.originalname) return res.status(400).json({ error: 'No file uploaded' });
    if (!req.body) return res.status(400).json({ error: 'Missing app or version metadata' });
    const { name, bundle_id, platform, version_name, version_code, branch, commit, folder } = req.body;
    if (!name || !bundle_id || !platform || !version_name) return res.status(400).json({ error: 'Missing app or version metadata' });
    if (file.originalname.length > 255) return res.status(400).json({ error: 'Filename too long (max 255 characters)'});
    // Save locally for dev
    const localPath = saveLocalFile(file);
    // Find or create app
    let appResult = await pool.query(
      'SELECT * FROM apps WHERE customer_id = $1::uuid AND name = $2 AND bundle_id = $3',
      [req.customer.id, name, bundle_id]
    );
    let appId;
    if (appResult.rowCount === 0) {
      appResult = await pool.query(
        'INSERT INTO apps (customer_id, name, bundle_id) VALUES ($1::uuid, $2, $3) RETURNING id',
        [req.customer.id, name, bundle_id]
      );
      appId = appResult.rows[0].id;
    } else {
      appId = appResult.rows[0].id;
    }
    // Insert version
    const versionResult = await pool.query(
      'INSERT INTO app_versions (app_id, platform, version_name, version_code, branch, commit, folder, file_url) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [appId, platform, version_name, version_code || null, branch || null, commit || null, folder || null, localPath]
    );
    res.json({ success: true, app: { id: appId, name, bundle_id }, version: versionResult.rows[0] });
  } catch (err) {
    logger.error({ err }, 'Upload error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount API key router
// Register Multer error handler as error middleware (after all routes)
router.use(multerErrorHandler);
router.use('/keys', apikeysRouter);
// GET /api/apps - List uploaded apps
// List all app versions for the customer
router.get('/apps', async (req, res) => {
  try {
    if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
    const result = await pool.query(
      `SELECT av.*, a.name, a.bundle_id
       FROM app_versions av
       JOIN apps a ON av.app_id = a.id
       WHERE a.customer_id = $1::uuid
       ORDER BY av.uploaded_at DESC`,
      [req.customer.id]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, 'List app versions error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/apps/:id/download - Download app file
// Download a specific app version file
router.get('/apps/:id/download', async (req, res) => {
  try {
    if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
    const versionId = req.params.id;
    if (!/^[0-9a-fA-F-]{36}$/.test(versionId)) return res.status(400).json({ error: 'Invalid app version ID' });
    const result = await pool.query(
      `SELECT av.*, a.name, a.bundle_id
       FROM app_versions av
       JOIN apps a ON av.app_id = a.id
       WHERE av.id = $1::uuid AND a.customer_id = $2::uuid`,
      [versionId, req.customer.id]
    );
    const version = result.rows[0];
    if (!version) return res.status(404).json({ error: 'App version not found' });
    // Only use the filename for download, not the full path
    const filename = path.basename(version.file_url);
    const filePath = getLocalFilePath(filename);
    res.download(filePath, filename, err => {
      if (err) {
        logger.error({ err }, 'Download error');
        res.status(500).json({ error: 'File download failed' });
      }
    });
  } catch (err) {
    logger.error({ err }, 'Download error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/apps/:id - Remove app
// Delete a specific app version
router.delete('/apps/:id', async (req, res) => {
  try {
    if (!req.customer) return res.status(401).json({ error: 'Unauthorized' });
    const versionId = req.params.id;
    if (!/^[0-9a-fA-F-]{36}$/.test(versionId)) return res.status(400).json({ error: 'Invalid app version ID' });
    const result = await pool.query(
      `DELETE FROM app_versions
       WHERE id = $1::uuid
       AND app_id IN (SELECT id FROM apps WHERE customer_id = $2::uuid)
       RETURNING *`,
      [versionId, req.customer.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'App version not found' });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export router after all endpoints are defined
export default router;
