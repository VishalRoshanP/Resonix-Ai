const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('../utils/logger');

// Resolve MongoDB Atlas SRV TXT records using public DNS servers (fixes local ISP/system DNS ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Fallback silently if custom DNS setting is constrained
}

/**
 * Configure Mongoose event listeners for automatic reconnection and health tracking
 */
const setupMongooseEvents = () => {
  mongoose.connection.on('connected', () => {
    const host = mongoose.connection.host || 'MongoDB Atlas Cluster';
    const dbName = mongoose.connection.name || 'resonix_ai';
    console.log(`[MongoDB Connected] Successfully established connection to ${host}/${dbName}`);
    logger.info(`[MongoDB Connected] Established connection to ${host}/${dbName}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB Error] Database connection error: ${err.message}`);
    logger.error(`[MongoDB Error] ${err.message}`, { stack: err.stack });
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB Disconnected] Lost connection to MongoDB Atlas. Attempting automatic reconnection...');
    logger.warn('[MongoDB Disconnected] Connection lost to database.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB Reconnected] Successfully re-established connection to MongoDB Atlas.');
    logger.info('[MongoDB Reconnected] Database re-established.');
  });
};

/**
 * Async MongoDB Atlas Connection function with retry mechanism
 */
const connectDB = async (retries = 5, delay = 5000) => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    const errorMsg = '[Database Config Error] MONGODB_URI is not defined in environment variables.';
    console.error(errorMsg);
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Register connection event listeners once
  setupMongooseEvents();

  const options = {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MongoDB Connection Attempt ${attempt}/${retries}] Connecting to MongoDB Atlas...`);
      const conn = await mongoose.connect(mongoURI, options);
      return conn;
    } catch (err) {
      console.error(`[MongoDB Connection Failed] Attempt ${attempt}/${retries} failed: ${err.message}`);
      logger.error(`[MongoDB Connection Failed] Attempt ${attempt}: ${err.message}`);

      if (attempt === retries) {
        console.error('[MongoDB Critical Error] Max reconnection attempts reached. Could not connect to MongoDB Atlas.');
        throw err;
      }

      console.log(`[MongoDB Retry] Waiting ${delay / 1000} seconds before next connection attempt...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;
