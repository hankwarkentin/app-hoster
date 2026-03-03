
import dotenv from 'dotenv';
import logger from './logger.js';
import pkg from '../package.json' with { type: 'json' };
import app from './app.js';

dotenv.config();
const APP_VERSION = pkg.version;
logger.info({ event: 'startup', version: APP_VERSION }, 'AppHoster started');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  logger.info({ event: 'listen', port: PORT }, `AppHoster listening on port ${PORT}`);
});
