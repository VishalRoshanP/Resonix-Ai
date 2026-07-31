// Map Service — Placeholder for Express backend integration
import { api } from './api';

export const mapService = {
  async getMapData() {
    // GET /api/map/data
    // return api.get('/map/data');
    return {
      incidents: [
        { id: 'map_inc_001', lat: 34.052, lng: -118.243, type: 'seismic', severity: 'critical', label: 'Seismic Activity' },
        { id: 'map_inc_002', lat: 34.055, lng: -118.250, type: 'flood', severity: 'warning', label: 'Flood Risk Zone' },
      ],
      responders: [
        { id: 'map_res_001', lat: 34.053, lng: -118.245, name: 'Alpha Squad', status: 'active' },
        { id: 'map_res_002', lat: 34.051, lng: -118.248, name: 'Medical Unit C', status: 'in-transit' },
      ],
      zones: [
        { id: 'zone_001', name: 'Evacuation Zone A', severity: 'critical', population: 12400 },
        { id: 'zone_002', name: 'Safe Zone B', severity: 'clear', population: 3200 },
      ],
    };
  },

  async getSignalStrength() {
    // GET /api/map/signals
    // return api.get('/map/signals');
    return {
      coverage: 87,
      deadZones: 3,
      relayNodes: [
        { id: 'sig_001', lat: 34.054, lng: -118.244, strength: 5 },
        { id: 'sig_002', lat: 34.050, lng: -118.249, strength: 2 },
      ],
    };
  },

  async getHeatmapData(type) {
    // GET /api/map/heatmap?type=population|damage|signal
    // return api.get(`/map/heatmap?type=${type}`);
    return { type, dataPoints: [], lastUpdated: new Date().toISOString() };
  },
};
