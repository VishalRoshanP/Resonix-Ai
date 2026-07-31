const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');

// Ensure required runtime directories exist
const uploadDir = path.join(__dirname, 'uploads');
const logDir = path.join(__dirname, 'logs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas and start server
connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      // Attach Socket.IO Real-Time Engine
      socketService.init(server);

      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e4b';
      console.log(`
======================================================
  🚀 RESONIX AI Backend Server Running
  📡 Environment : ${process.env.NODE_ENV || 'development'}
  🔗 URL         : http://localhost:${PORT}
  ⚡ Real-Time   : Socket.IO Engine Active
  🤖 AI Engine   : Powered by Local Gemma 4 (Ollama)
  📍 Provider    : Local Ollama (${ollamaUrl})
  🧠 Model       : ${ollamaModel}
======================================================
      `);
    });

    // Handle Unhandled Promise Rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`[Unhandled Rejection] ${err.name} - ${err.message}`);
      console.error('Unhandled Rejection! Shutting down server gracefully...', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle Uncaught Exceptions
    process.on('uncaughtException', (err) => {
      logger.error(`[Uncaught Exception] ${err.name} - ${err.message}`);
      console.error('Uncaught Exception! Shutting down server immediately...', err);
      process.exit(1);
    });

    // Handle SIGTERM signal
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down server gracefully...');
      server.close(() => {
        console.log('💥 Process terminated!');
      });
    });
  })
  .catch((err) => {
    console.error(`
======================================================
  ❌ MONGODB CONNECTION FAILED — SERVER NOT STARTED
======================================================
  Error Message : ${err.message}

  🔍 Debugging Checklist:
  1. Network Access (IP Whitelist): Check if your current IP is allowed in MongoDB Atlas (Network Access -> Add IP Address / Allow 0.0.0.0/0).
  2. Database Credentials: Verify database username and password in server/.env (special characters must be URL encoded).
  3. Cluster Status: Confirm MongoDB Atlas cluster 'Cluster0' is active and not paused.
  4. Firewall / Proxy: Ensure port 27017 or outbound SSL/TLS traffic is not blocked by local firewall.
======================================================
    `);
    process.exit(1);
  });
