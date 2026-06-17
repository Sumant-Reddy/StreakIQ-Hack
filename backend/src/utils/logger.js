const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  transports: [
    // Console — colorized simple output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // Daily rotating combined log: logs/yami-YYYY-MM-DD.log
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'yami-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '30d',  // keep 30 days of logs
      level: 'info',
      format: fileFormat,
    }),

    // Error-only log for quick triage: logs/yami-error-YYYY-MM-DD.log
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'yami-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '30d',
      level: 'error',
      format: fileFormat,
    }),
  ],
});

module.exports = logger;
