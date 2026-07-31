/**
 * Production-Ready Bluetooth Low Energy (BLE) Discovery Service for RESONIX AI (Responder Command Center)
 * 
 * Capabilities:
 * - Uses native Web Bluetooth API (navigator.bluetooth) with zero mock/simulated devices
 * - Detects BLE hardware connection availability
 * - Maintains real nearby device list Map<deviceId, deviceDescriptor>
 * - Listens for gattserverdisconnected events to handle reconnects and device removals
 * - Integrates seamlessly with meshRelayService
 */

import { meshRelayService } from './meshRelayService';

const RESONIX_SERVICE_UUID = '0000feaa-0000-1000-8000-00805f9b34fb';

class BleDiscoveryService {
  constructor() {
    this.nearbyDevices = new Map();
    this.listeners = new Set();
    this.isScanning = false;
    this.isSupported = typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  }

  async checkAvailability() {
    if (!this.isSupported) {
      return false;
    }
    try {
      if (typeof navigator.bluetooth.getAvailability === 'function') {
        return await navigator.bluetooth.getAvailability();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  async discoverNearbyDevices() {
    if (!this.isSupported) {
      console.warn('[BleDiscoveryService] Web Bluetooth API is not supported in this browser environment.');
      return { success: false, reason: 'BLE_NOT_SUPPORTED', devices: [] };
    }

    try {
      this.isScanning = true;
      this.notifyListeners();

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'RESONIX' },
          { services: [RESONIX_SERVICE_UUID] },
        ],
        optionalServices: ['battery_service', 'device_information'],
      }).catch(async (_) => {
        return await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service'],
        });
      });

      if (device) {
        this.registerDiscoveredDevice(device);
        await this.connectGattServer(device);
      }

      this.isScanning = false;
      this.notifyListeners();

      return {
        success: true,
        devices: this.getNearbyDevicesList(),
      };
    } catch (err) {
      this.isScanning = false;
      this.notifyListeners();
      console.warn('[BleDiscoveryService] BLE discovery cancelled or failed:', err.message);
      return { success: false, reason: err.message, devices: this.getNearbyDevicesList() };
    }
  }

  registerDiscoveredDevice(device) {
    if (!device || !device.id) return;

    const deviceId = device.id;
    const existing = this.nearbyDevices.get(deviceId) || {};

    const descriptor = {
      deviceId,
      name: device.name || `RESONIX-BLE-${deviceId.substring(0, 6).toUpperCase()}`,
      deviceRef: device,
      gattConnected: Boolean(device.gatt && device.gatt.connected),
      status: device.gatt && device.gatt.connected ? 'CONNECTED' : 'DISCOVERED',
      lastSeenAt: new Date().toISOString(),
      reconnectAttempts: existing.reconnectAttempts || 0,
    };

    device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    device.addEventListener('gattserverdisconnected', (event) => this.handleDeviceDisconnected(event.target));

    this.nearbyDevices.set(deviceId, descriptor);
    meshRelayService.registerPeerNode(descriptor.name);

    this.notifyListeners();
    return descriptor;
  }

  async connectGattServer(device) {
    if (!device || !device.gatt) return false;

    try {
      const gattServer = await device.gatt.connect();
      const descriptor = this.nearbyDevices.get(device.id);
      if (descriptor) {
        descriptor.gattConnected = gattServer.connected;
        descriptor.status = 'CONNECTED';
        descriptor.lastSeenAt = new Date().toISOString();
        descriptor.reconnectAttempts = 0;
        this.nearbyDevices.set(device.id, descriptor);
        this.notifyListeners();
      }
      return gattServer.connected;
    } catch (err) {
      console.warn(`[BleDiscoveryService] GATT connection failed for device ${device.id}:`, err.message);
      return false;
    }
  }

  async handleDeviceDisconnected(device) {
    if (!device || !device.id) return;

    const descriptor = this.nearbyDevices.get(device.id);
    if (!descriptor) return;

    console.warn(`[BleDiscoveryService] BLE Device ${descriptor.name} (${device.id}) disconnected.`);
    descriptor.gattConnected = false;
    descriptor.status = 'DISCONNECTED';
    this.notifyListeners();

    if (descriptor.reconnectAttempts < 3) {
      descriptor.reconnectAttempts += 1;
      console.log(`[BleDiscoveryService] Attempting auto-reconnect (${descriptor.reconnectAttempts}/3) for ${descriptor.name}...`);
      setTimeout(async () => {
        const reconnected = await this.connectGattServer(device);
        if (!reconnected && descriptor.reconnectAttempts >= 3) {
          this.removeDisconnectedDevice(device.id);
        }
      }, 2000);
    } else {
      this.removeDisconnectedDevice(device.id);
    }
  }

  removeDisconnectedDevice(deviceId) {
    if (this.nearbyDevices.has(deviceId)) {
      const descriptor = this.nearbyDevices.get(deviceId);
      console.log(`[BleDiscoveryService] Removing disconnected device ${descriptor?.name || deviceId} from active list.`);
      this.nearbyDevices.delete(deviceId);
      this.notifyListeners();
    }
  }

  getNearbyDevicesList() {
    return Array.from(this.nearbyDevices.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      gattConnected: d.gattConnected,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
    }));
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners() {
    const payload = {
      isSupported: this.isSupported,
      isScanning: this.isScanning,
      deviceCount: this.nearbyDevices.size,
      devices: this.getNearbyDevicesList(),
    };
    this.listeners.forEach((fn) => {
      try { fn(payload); } catch (_) {}
    });
  }
}

const bleDiscoveryService = new BleDiscoveryService();
export default bleDiscoveryService;
export { bleDiscoveryService };
