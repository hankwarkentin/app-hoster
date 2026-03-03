import express from 'express';
import dotenv from 'dotenv';
import pool from './db.js';
import { apiKeyAuth } from './auth.js';
import apiRouter from './api.js';
dotenv.config();
const app = express();
app.use(express.json());
app.get('/', (req, res) => {
    res.send('AppHoster API is running');
});
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ time: result.rows[0] });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: 'Database connection failed', details: message });
    }
});
app.use('/api', apiRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map