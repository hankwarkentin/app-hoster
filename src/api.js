import express from 'express';
import multer from 'multer';
import path from 'path';
import { s3, bucketName } from './s3.js';
import { saveLocalFile, getLocalFilePath } from './localStorage.js';
import pool from './db.js';
const router = express.Router();
const upload = multer({
    dest: path.join(new URL('.', import.meta.url).pathname, '../uploads'),
    fileFilter: (req, file, cb) => {
        if (file.originalname.length > 255) {
            const err = new Error('Filename too long');
            err.code = 'FILENAME_TOO_LONG';
            return cb(err);
        }
        cb(null, true);
    }
});
// POST /api/apps/upload - Upload app file
router.post('/apps/upload', (req, res, next) => {
    upload.single('file')(req, res, function (err) {
        if (err) {
            if (err.code === 'FILENAME_TOO_LONG') {
                return res.status(400).json({ error: 'Filename too long' });
            }
            return res.status(500).json({ error: err.message || 'File upload error' });
        }
        next();
    });
}, async (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'No file uploaded' });
    // Save locally for dev
    const localPath = saveLocalFile(file);
    // Store metadata in DB
    if (!req.customer)
        return res.status(401).json({ error: 'Unauthorized' });
    const result = await pool.query('INSERT INTO apps (filename, customer_id, uploaded_at) VALUES ($1, $2, NOW()) RETURNING *', [file.originalname, req.customer.id]);
    res.json({ success: true, app: result.rows[0] });
});
// GET /api/apps - List uploaded apps
router.get('/apps', async (req, res) => {
    if (!req.customer)
        return res.status(401).json({ error: 'Unauthorized' });
    const result = await pool.query('SELECT * FROM apps WHERE customer_id = $1', [req.customer.id]);
    res.json(result.rows);
});
// GET /api/apps/:id/download - Download app file
router.get('/apps/:id/download', async (req, res) => {
    try {
        if (!req.customer)
            return res.status(401).json({ error: 'Unauthorized' });
        const appId = Number(req.params.id);
        if (!Number.isInteger(appId) || appId <= 0)
            return res.status(400).json({ error: 'Invalid app ID' });
        const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND customer_id = $2', [appId, req.customer.id]);
        const app = result.rows[0];
        if (!app)
            return res.status(404).json({ error: 'App not found' });
        const filePath = getLocalFilePath(app.filename);
        res.download(filePath, app.filename, err => {
            if (err) {
                console.error('Download error:', err);
                res.status(500).json({ error: 'File download failed' });
            }
        });
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/apps/:id - Remove app
router.delete('/apps/:id', async (req, res) => {
    try {
        if (!req.customer)
            return res.status(401).json({ error: 'Unauthorized' });
        const appId = Number(req.params.id);
        if (!Number.isInteger(appId) || appId <= 0)
            return res.status(400).json({ error: 'Invalid app ID' });
        const result = await pool.query('DELETE FROM apps WHERE id = $1 AND customer_id = $2 RETURNING *', [appId, req.customer.id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'App not found or not owned by user' });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
//# sourceMappingURL=api.js.map