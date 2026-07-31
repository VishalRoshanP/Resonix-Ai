const morgan = require('morgan');
const logger = require('../utils/logger');

// Define custom morgan stream connected to Winston logger
const stream = {
  write: (message) => logger.info(message.trim()),
};

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

const requestLogger = morgan(format, { stream });

module.exports = requestLogger;
