
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

const logger = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          targets: [
            {
              target: 'pino-pretty',
              options: { colorize: true }
            }
          ]
        }
      }
    : {
        level: process.env.LOG_LEVEL || 'info'
      }
);

export default logger;
