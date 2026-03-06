// APK metadata interface
interface ApkMeta {
  packageName: string;
  versionName: string;
  versionCode: string | number;
  appName: string;
  permissions?: any;
  sdkVersion?: any;
  targetSdkVersion?: any;
  usesFeatures?: any;
}


// All imports at the top
import express from 'express';
import multer from 'multer';
import path from 'path';
// TODO: S3 integration will be added later
import { uploadFileToS3, getFileFromS3 } from './s3.js';
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
    logger.info({ headers: req.headers, contentLength: req.headers['content-length'] }, 'Upload request received');
    if (!req.customer) {
      logger.warn('Unauthorized upload attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if ((req as any).fileValidationError === 'Filename too long') {
      logger.warn('Filename too long');
      return res.status(400).json({ error: 'Filename too long' });
    }
    const file = req.file;
    logger.info({ file }, 'File received for upload');
    if (!file || !file.originalname) {
      logger.warn('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (file.originalname.length > 255) {
      logger.warn('Filename too long');
      return res.status(400).json({ error: 'Filename too long (max 255 characters)'});
    }

    // Only accept APK files
    if (!file.originalname.endsWith('.apk')) {
      logger.warn('Non-APK file upload attempted');
      return res.status(400).json({ error: 'Only APK files are supported' });
    }

    // Log file size
    logger.info({ size: file.size, path: file.path }, 'APK file size and path');

    logger.info('--- Begin APK upload flow ---');
    // Parse APK metadata
    let apkMeta: ApkMeta;
    try {
      logger.info({ path: file.path }, 'Parsing APK metadata');
      const nodeApkParser = await import('node-apk-parser');
      logger.info('node-apk-parser imported');
      const ApkReader = nodeApkParser.default || nodeApkParser;
      logger.info('ApkReader loaded');
      const reader = ApkReader.readFile(file.path);
      logger.info('ApkReader.readFile complete');
      const manifest = reader.readManifestSync();
      logger.info('readManifestSync complete');
      apkMeta = {
        packageName: manifest.package,
        versionName: manifest.versionName,
        versionCode: manifest.versionCode,
        appName: manifest.application.label,
        permissions: manifest.permissions,
        sdkVersion: manifest.sdkVersion,
        targetSdkVersion: manifest.targetSdkVersion,
        usesFeatures: manifest.usesFeatures,
      };
      logger.info({ apkMeta }, 'APK metadata parsed');
    } catch (err) {
      logger.error({ err }, 'APK parsing failed');
      return res.status(400).json({ error: 'Failed to parse APK metadata' });
    }

    logger.info('--- APK metadata parsed, proceeding to S3 upload ---');
    // Upload to S3
    const s3Key = file.originalname;
    logger.info({ s3Key, filePath: file.path }, 'Uploading APK to S3');
    try {
      await uploadFileToS3(s3Key, file.path);
      logger.info({ s3Key }, 'APK uploaded to S3');
    } catch (err) {
      logger.error({ err }, 'S3 upload failed');
      return res.status(500).json({ error: 'Failed to upload APK to S3', details: err instanceof Error ? err.message : String(err) });
    }

    logger.info('--- S3 upload complete, proceeding to DB ---');
    // Find or create app
    let appResult = await pool.query(
      'SELECT * FROM apps WHERE customer_id = $1::uuid AND bundle_id = $2',
      [req.customer.id, apkMeta.packageName]
    );
    let appId;
    if (appResult.rowCount === 0) {
      logger.info({ appName: apkMeta.appName, bundleId: apkMeta.packageName }, 'Creating new app record');
      appResult = await pool.query(
        'INSERT INTO apps (customer_id, name, bundle_id) VALUES ($1::uuid, $2, $3) RETURNING id',
        [req.customer.id, apkMeta.appName || apkMeta.packageName, apkMeta.packageName]
      );
      appId = appResult.rows[0].id;
      logger.info({ appId }, 'New app record created');
    } else {
      appId = appResult.rows[0].id;
      logger.info({ appId }, 'Existing app record found');
    }

    // Insert version
    logger.info({ appId, versionName: apkMeta.versionName, versionCode: apkMeta.versionCode }, 'Inserting app version record');
    const versionResult = await pool.query(
      'INSERT INTO app_versions (app_id, platform, version_name, version_code, folder, file_url, metadata) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7) RETURNING *',
      [appId, 'android', apkMeta.versionName, apkMeta.versionCode, null, s3Key, apkMeta]
    );
    logger.info({ version: versionResult.rows[0] }, 'App version record inserted');
    res.json({ success: true, app: { id: appId, name: apkMeta.appName || apkMeta.packageName, bundle_id: apkMeta.packageName }, version: versionResult.rows[0] });
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
    const s3Key = version.file_url;
    try {
      const s3Obj = await getFileFromS3(s3Key);
      res.setHeader('Content-Disposition', `attachment; filename="${s3Key}"`);
      if (s3Obj.Body && typeof (s3Obj.Body as any).pipe === 'function') {
        (s3Obj.Body as any).pipe(res);
      } else if (s3Obj.Body && Buffer.isBuffer(s3Obj.Body)) {
        res.end(s3Obj.Body);
      } else if (s3Obj.Body && typeof s3Obj.Body === 'string') {
        res.end(s3Obj.Body);
      } else {
        res.status(404).json({ error: 'File not found in S3' });
      }
    } catch (err) {
      logger.error({ err }, 'Download error');
      res.status(500).json({ error: 'File download failed' });
    }
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
