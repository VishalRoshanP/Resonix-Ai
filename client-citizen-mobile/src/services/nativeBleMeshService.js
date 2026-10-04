/**
 * RESONIX AI — Native BLE Mesh Service Wrapper (React Native)
 * Interacts with NativeModules.ResonixBleModule and dispatches events.
 */

let NativeModules = {};
let NativeEventEmitter = class {
  addListener() { return { remove: () => {} }; }
};
let Platform = { OS: 'unknown' };

try {
  const rn = require('react-native');
  if (rn) {
    NativeModules = rn.NativeModules || {};
    NativeEventEmitter = rn.NativeEventEmitter || NativeEventEmitter;
    Platform = rn.Platform || Platform;
  }
} catch (_) {}

const ResonixBleModule = NativeModules?.ResonixBleModule;

class NativeBleMeshService {
  constructor() {
    this.isSupported = Platform.OS === 'android' && Boolean(ResonixBleModule);
    this.eventEmitter = (this.isSupported && ResonixBleModule) ? new NativeEventEmitter(ResonixBleModule) : null;
    this.listeners = new Map();
    this.discoveredPeers = new Map();
    this.isRunning = false;

    if (this.isSupported && this.eventEmitter) {
      this._setupSubscriptions();
    }
  }

  _setupSubscriptions() {
    this.eventEmitter.addListener('onPeerDiscovered', (peer) => {
      if (peer && peer.address) {
        this.discoveredPeers.set(peer.address, {
          ...peer,
          discoveredAt: Date.now(),
        });
        this._notify('peerDiscovered', peer);
      }
    });

    this.eventEmitter.addListener('onPacketReceived', (packet) => {
      console.log('[NativeBleMeshService] 🎯 Inbound packet received over BLE:', packet.packetId);
      this._notify('packetReceived', packet);
    });

    this.eventEmitter.addListener('onPacketRelayed', (result) => {
      console.log('[NativeBleMeshService] ✅ Packet relayed successfully to peer:', result);
      this._notify('packetRelayed', result);
    });

    this.eventEmitter.addListener('onDeliveryAck', (ack) => {
      console.log('[NativeBleMeshService] 🏆 End-to-end cloud delivery ACK received:', ack);
      this._notify('deliveryAck', ack);
    });

    this.eventEmitter.addListener('onNetworkStatusChanged', (status) => {
      console.log('[NativeBleMeshService] 🌐 Native network status changed:', status);
      this._notify('networkStatusChanged', status);
    });

    this.eventEmitter.addListener('onMeshError', (err) => {
      console.warn('[NativeBleMeshService] ⚠️ Native mesh error:', err);
      this._notify('meshError', err);
    });
  }

  /**
   * Requests necessary Android 12+ (API 31+) and 13+ (API 33+) runtime permissions
   */
  async requestPermissions() {
    if (Platform.OS !== 'android') return true;
    try {
      const rn = require('react-native');
      const PermissionsAndroid = rn.PermissionsAndroid;
      if (!PermissionsAndroid) return true;

      const perms = [];
      if (Platform.Version >= 31) {
        perms.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
        );
      }
      if (Platform.Version >= 33) {
        perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      perms.push(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      const results = await PermissionsAndroid.requestMultiple(perms);
      console.log('[NativeBleMeshService] Permissions granted:', results);
      return true;
    } catch (e) {
      console.warn('[NativeBleMeshService] Permission request warning:', e.message);
      return false;
    }
  }

  /**
   * Starts the GATT Server, Scanner, and Foreground Service.
   */
  async startMesh(options = {}) {
    if (!this.isSupported) {
      console.log('[NativeBleMeshService] Native BLE mesh unavailable on this platform/environment.');
      return false;
    }
    try {
      await this.requestPermissions();
      const res = await ResonixBleModule.startMesh(options);
      this.isRunning = Boolean(res);
      console.log('[NativeBleMeshService] ✅ Native BLE Mesh started successfully.');
      return this.isRunning;
    } catch (err) {
      console.error('[NativeBleMeshService] Failed to start native mesh:', err.message);
      return false;
    }
  }

  /**
   * Stops the GATT Server, Scanner, and removes Foreground Service notification.
   */
  async stopMesh() {
    if (!this.isSupported) return false;
    try {
      const res = await ResonixBleModule.stopMesh();
      this.isRunning = false;
      this.discoveredPeers.clear();
      console.log('[NativeBleMeshService] Native BLE Mesh stopped.');
      return Boolean(res);
    } catch (err) {
      console.warn('[NativeBleMeshService] Error stopping mesh:', err.message);
      return false;
    }
  }

  /**
   * Transmits an Emergency SOS packet over BLE to the best available peer.
   */
  async sendPacket(payload) {
    if (!this.isSupported) {
      throw new Error('Native BLE Mesh is not available on this platform.');
    }
    const excludeList = Array.isArray(payload.excludeAddresses) ? payload.excludeAddresses : [];
    if (payload.excludeAddress && !excludeList.includes(payload.excludeAddress)) {
      excludeList.push(payload.excludeAddress);
    }
    if (payload.receivedFromAddress && !excludeList.includes(payload.receivedFromAddress)) {
      excludeList.push(payload.receivedFromAddress);
    }

    return await ResonixBleModule.sendPacket({
      packetId: payload.packetId || `pkt_${Date.now()}`,
      latitude: payload.latitude || payload.location?.lat || payload.gpsCoordinates?.latitude || 0.0,
      longitude: payload.longitude || payload.location?.lng || payload.gpsCoordinates?.longitude || 0.0,
      categoryCode: this._mapCategoryToCode(payload.category),
      priorityCode: payload.priority === 'CRITICAL' ? 1 : 2,
      hopCount: payload.hopCount != null ? Number(payload.hopCount) : 0,
      ttl: payload.ttl != null ? Number(payload.ttl) : 7,
      excludeAddresses: excludeList,
      payloadJson: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  /**
   * Retrieves active mesh status and peer count.
   */
  async getMeshStatus() {
    if (!this.isSupported) {
      return { isRunning: false, isSupported: false, peerCount: 0 };
    }
    try {
      const status = await ResonixBleModule.getMeshStatus();
      return { ...status, isSupported: true };
    } catch (_) {
      return { isRunning: false, isSupported: true, peerCount: 0 };
    }
  }

  /**
   * Returns list of currently discovered nearby peers.
   */
  async getDiscoveredPeers() {
    if (!this.isSupported) {
      return Array.from(this.discoveredPeers.values());
    }
    try {
      return await ResonixBleModule.getDiscoveredPeers();
    } catch (_) {
      return Array.from(this.discoveredPeers.values());
    }
  }

  /**
   * Reads the phone's physical GPS location via native Android LocationManager.
   */
  async getCurrentLocation() {
    if (!this.isSupported || typeof ResonixBleModule?.getCurrentLocation !== 'function') {
      return { hasLocation: false, latitude: null, longitude: null, accuracy: null };
    }
    try {
      await this.requestPermissions();
      const loc = await ResonixBleModule.getCurrentLocation();
      return loc || { hasLocation: false, latitude: null, longitude: null, accuracy: null };
    } catch (err) {
      console.warn('[NativeBleMeshService] getCurrentLocation error:', err.message);
      return { hasLocation: false, latitude: null, longitude: null, accuracy: null, error: err.message };
    }
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
  }

  _notify(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[NativeBleMeshService] Error in '${eventName}' listener:`, e);
        }
      });
    }
  }

  _mapCategoryToCode(cat) {
    const map = {
      FIRE: 0x01,
      FLOOD: 0x02,
      MEDICAL: 0x03,
      BUILDING_COLLAPSE: 0x04,
      CYCLONE_STORM: 0x05,
      EARTHQUAKE: 0x06,
      LANDSLIDE: 0x07,
      TSUNAMI: 0x08,
      AVALANCHE: 0x09,
      URBAN_FLOOD: 0x0a,
      CHEMICAL_EMERGENCY: 0x0b,
    };
    return map[String(cat).toUpperCase()] || 0xff;
  }
}

const nativeBleMeshService = new NativeBleMeshService();
nativeBleMeshService.default = nativeBleMeshService;
module.exports = nativeBleMeshService;
