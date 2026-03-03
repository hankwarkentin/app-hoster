import express from 'express';
import multer from 'multer';
import path from 'path';
import { s3, bucketName } from './s3.js';
import { saveLocalFile, getLocalFilePath } from './localStorage.js';
import pool from './db.js';
const router = express.Router();
const upload = multer({ dest: path.join(new URL('.', import.meta.url).pathname, '../uploads') });
// POST /api/apps/upload - Upload app file
router.post('/apps/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'No file uploaded' });
    // Save locally for dev
    const localPath = saveLocalFile(file);
    // Upload to S3 (placeholder)
    // await s3.upload({
    //   Bucket: bucketName,
    //   Key: file.originalname,
    //   Body: fs.createReadStream(localPath)
    // }).promise();
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
    if (!req.customer)
        return res.status(401).json({ error: 'Unauthorized' });
    const appId = req.params.id;
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND customer_id = $2', [appId, req.customer.id]);
    const app = result.rows[0];
    if (!app)
        return res.status(404).json({ error: 'App not found' });
    const filePath = getLocalFilePath(app.filename);
    res.download(filePath);
});
// DELETE /api/apps/:id - Remove app
router.delete('/apps/:id', async (req, res) => {
    if (!req.customer)
        return res.status(401).json({ error: 'Unauthorized' });
    const appId = req.params.id;
    await pool.query('DELETE FROM apps WHERE id = $1 AND customer_id = $2', [appId, req.customer.id]);
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=api.js.map