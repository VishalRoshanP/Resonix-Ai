/**
 * RESONIX AI — High-Performance SQLite & Offline Persistence Engine
 * 
 * Responsibilities:
 * - SQLite database management for native Android environment via Capacitor SQLite / Web fallback.
 * - Stores emergency SOS items across system restarts and airplane mode cycles.
 * - Enforces schema with columns:
 *   sosId (UUID PRIMARY KEY), userId, timestamp, latitude, longitude, address,
 *   priority, message, imagePath, voicePath, deliveryStatus, retryCount, relayHistoryJson.
 * - Status transitions: QUEUED -> DISCOVERING -> FORWARDED -> UPLOADED -> DELIVERED.
 */

const DB_NAME = 'resonix_disaster_mesh.db';
const TABLE_NAME = 'offline_emergencies';
const LOCAL_STORAGE_FALLBACK_KEY = 'resonix_sqlite_fallback_queue';

class SqliteStorageEngine {
  constructor() {
    this.sqlitePlugin = null;
    this.isNativeSqlite = false;
    this.isInitialized = false;

    this._initEngine();
  }

  async _initEngine() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
      const sqlitePluginName = '@capacitor-community/sqlite';
      const { CapacitorSQLite } = await import(/* @vite-ignore */ sqlitePluginName);
        if (CapacitorSQLite) {
          this.sqlitePlugin = CapacitorSQLite;
          this.isNativeSqlite = true;
          await this._initSqliteTable();
        }
      }
    } catch (_) {
      this.isNativeSqlite = false;
    }
    this.isInitialized = true;
  }

  async _initSqliteTable() {
    if (!this.isNativeSqlite || !this.sqlitePlugin) return;
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          sosId TEXT PRIMARY KEY,
          userId TEXT,
          timestamp TEXT,
          latitude REAL,
          longitude REAL,
          address TEXT,
          priority TEXT,
          message TEXT,
          imagePath TEXT,
          voicePath TEXT,
          deliveryStatus TEXT,
          retryCount INTEGER DEFAULT 0,
          relayCount INTEGER DEFAULT 0,
          relayHistoryJson TEXT
        );
      `;
      await this.sqlitePlugin.execute({ database: DB_NAME, statements: createTableQuery });
    } catch (err) {
      console.warn('[SqliteStorageEngine] SQLite table creation fallback to IndexedDB:', err.message);
      this.isNativeSqlite = false;
    }
  }

  /**
   * Saves or updates an emergency SOS item in offline storage
   * @param {Object} record
   */
  async saveSOS(record) {
    if (!record) return null;

    const sosId = record.sosId || record.packetId || record.messageId || `sos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userId = record.userId || 'usr_guest';
    const timestamp = record.timestamp || new Date().toISOString();
    const latitude = record.latitude != null ? Number(record.latitude) : null;
    const longitude = record.longitude != null ? Number(record.longitude) : null;
    const address = record.address || 'Last Known GPS Location';
    const priority = record.priority || 'HIGH';
    const message = record.message || record.emergencyText || record.description || '';
    const imagePath = record.imagePath || record.photoReference?.dataUrl || null;
    const voicePath = record.voicePath || record.audioReference?.dataUrl || null;
    const deliveryStatus = record.deliveryStatus || 'QUEUED';
    const retryCount = Number(record.retryCount || 0);
    const relayCount = Number(record.relayCount || 0);
    const relayHistoryJson = JSON.stringify(record.relayHistory || []);

    const formattedRecord = {
      sosId,
      packetId: sosId,
      userId,
      timestamp,
      latitude,
      longitude,
      address,
      priority,
      message,
      emergencyText: message,
      description: message,
      imagePath,
      voicePath,
      photoReference: record.photoReference || (imagePath ? { dataUrl: imagePath, hasPhoto: true } : { hasPhoto: false }),
      audioReference: record.audioReference || (voicePath ? { dataUrl: voicePath, hasAudio: true } : { hasAudio: false }),
      deliveryStatus,
      retryCount,
      relayCount,
      relayHistory: record.relayHistory || [],
    };

    if (this.isNativeSqlite && this.sqlitePlugin) {
      try {
        const query = `
          INSERT OR REPLACE INTO ${TABLE_NAME} 
          (sosId, userId, timestamp, latitude, longitude, address, priority, message, imagePath, voicePath, deliveryStatus, retryCount, relayCount, relayHistoryJson)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const values = [
          sosId, userId, timestamp, latitude, longitude, address,
          priority, message, imagePath, voicePath, deliveryStatus,
          retryCount, relayCount, relayHistoryJson
        ];
        await this.sqlitePlugin.run({ database: DB_NAME, statement: query, values });
        return formattedRecord;
      } catch (err) {
        console.warn('[SqliteStorageEngine] Native SQLite save failed, switching to persistent local storage:', err.message);
      }
    }

    // Persistent LocalStorage / IndexedDB Fallback
    const queue = this._getFallbackQueue();
    const existingIndex = queue.findIndex(item => (item.sosId === sosId || item.packetId === sosId));
    if (existingIndex >= 0) {
      queue[existingIndex] = formattedRecord;
    } else {
      queue.push(formattedRecord);
    }
    this._saveFallbackQueue(queue);
    return formattedRecord;
  }

  /**
   * Retrieves all offline emergency records
   * @returns {Promise<Array<Object>>}
   */
  async getAllSOS() {
    if (this.isNativeSqlite && this.sqlitePlugin) {
      try {
        const query = `SELECT * FROM ${TABLE_NAME} ORDER BY timestamp ASC;`;
        const res = await this.sqlitePlugin.query({ database: DB_NAME, statement: query });
        if (res?.values) {
          return res.values.map(row => ({
            ...row,
            packetId: row.sosId,
            emergencyText: row.message,
            description: row.message,
            photoReference: row.imagePath ? { dataUrl: row.imagePath, hasPhoto: true } : { hasPhoto: false },
            audioReference: row.voicePath ? { dataUrl: row.voicePath, hasAudio: true } : { hasAudio: false },
            relayHistory: row.relayHistoryJson ? JSON.parse(row.relayHistoryJson) : [],
          }));
        }
      } catch (err) {
        console.warn('[SqliteStorageEngine] SQLite read error:', err.message);
      }
    }

    return this._getFallbackQueue();
  }

  /**
   * Updates delivery status & retry count for an existing SOS record
   * @param {string} sosId
   * @param {string} status - QUEUED | DISCOVERING | FORWARDED | UPLOADED | DELIVERED
   * @param {number} [retryIncrement]
   */
  async updateStatus(sosId, status, retryIncrement = 0) {
    if (!sosId) return null;

    if (this.isNativeSqlite && this.sqlitePlugin) {
      try {
        const query = `
          UPDATE ${TABLE_NAME} 
          SET deliveryStatus = ?, retryCount = retryCount + ? 
          WHERE sosId = ?;
        `;
        await this.sqlitePlugin.run({ database: DB_NAME, statement: query, values: [status, retryIncrement, sosId] });
      } catch (_) {}
    }

    const queue = this._getFallbackQueue();
    const item = queue.find(i => (i.sosId === sosId || i.packetId === sosId));
    if (item) {
      item.deliveryStatus = status;
      item.retryCount = Number(item.retryCount || 0) + retryIncrement;
      this._saveFallbackQueue(queue);
      return item;
    }
    return null;
  }

  /**
   * Deletes an SOS record upon successful backend delivery confirmation
   * @param {string} sosId
   */
  async deleteSOS(sosId) {
    if (!sosId) return false;

    if (this.isNativeSqlite && this.sqlitePlugin) {
      try {
        const query = `DELETE FROM ${TABLE_NAME} WHERE sosId = ?;`;
        await this.sqlitePlugin.run({ database: DB_NAME, statement: query, values: [sosId] });
      } catch (_) {}
    }

    const queue = this._getFallbackQueue();
    const filtered = queue.filter(item => item.sosId !== sosId && item.packetId !== sosId);
    if (filtered.length !== queue.length) {
      this._saveFallbackQueue(filtered);
      return true;
    }
    return false;
  }

  // --- Fallback Storage Helpers ---

  _getFallbackQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (_) {}
    return [];
  }

  _saveFallbackQueue(queue) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(queue));
      }
    } catch (_) {}
  }
}

export const sqliteStorageEngine = new SqliteStorageEngine();
export default sqliteStorageEngine;
