/**
 * RESONIX AI — Main Express & Socket.IO HTTP Server Entry Point
 * 
 * Responsibilities:
 * - Loads environment variables from .env
 * - Connects to MongoDB Atlas database
 * - Attaches Socket.IO real-time synchronization engine
 * - Starts Express HTTP Server on configured PORT (default: 5000)
 * Updated: 2026-08-26 21:58
 */

const path = require('path');
const http = require('http');

// Load environment variables from server/.env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');
const socketService = require('./services/socketService');
const weatherIngestionWorker = require('./services/weather/weatherIngestionWorker');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// 1. Create HTTP Server using Express app
const server = http.createServer(app);

// 2. Initialize Socket.IO Real-Time Synchronization Engine
socketService.init(server);

// 3. Connect to MongoDB Atlas Database
async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      logger.info('[Server] ✅ MongoDB Atlas connected successfully.');
    } else {
      logger.warn('[Server] ⚠️ MONGODB_URI missing from environment. Operating in memory-mode.');
    }

    server.listen(PORT, HOST, () => {
      console.log('==================================================');
      console.log(`🚀 RESONIX AI Backend Server Running on ${HOST}:${PORT}`);
      console.log(`• Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`• Health Check: http://${HOST}:${PORT}/health`);
      console.log(`• Socket.IO:    http://${HOST}:${PORT}`);
      console.log('==================================================');
    });

    // 4. Start Background Scheduled Weather Ingestion Worker (SIH26068)
    weatherIngestionWorker.start();
  } catch (err) {
    logger.error(`[Server] ❌ Failed to start server: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

// Graceful Shutdown Handler (Handles Render container lifecycle & Ctrl+C)
async function gracefulShutdown(signal) {
  logger.info(`[Server] ${signal} received. Shutting down gracefully...`);
  try {
    weatherIngestionWorker.stop();
    if (socketService.io) {
      logger.info('[Server] Closing Socket.IO connections...');
      socketService.io.close();
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.info('[Server] Disconnecting MongoDB Atlas...');
      await mongoose.disconnect();
    }
    server.close(() => {
      logger.info('[Server] Server closed cleanly.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('[Server] Forcing shutdown after timeout.');
      process.exit(0);
    }, 10000).unref();
  } catch (err) {
    logger.error(`[Server] Error during shutdown: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
