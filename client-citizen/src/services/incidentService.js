// Incident Service — Placeholder for Express backend integration
import { api } from './api';

export const incidentService = {
  async getIncidents(params = {}) {
    // GET /api/incidents?status=active&severity=critical
    // return api.get(`/incidents?${new URLSearchParams(params)}`);
    return [
      { id: 'inc_001', title: 'Seismic Activity Detected', severity: 'critical', sector: 'Sector 7', magnitude: 6.2, status: 'active', timestamp: new Date().toISOString() },
      { id: 'inc_002', title: 'Flood Relay Active', severity: 'warning', sector: 'River Basin Alpha', status: 'monitoring', timestamp: new Date().toISOString() },
      { id: 'inc_003', title: 'Structural Compromise', severity: 'critical', sector: 'Bridge 9', status: 'acknowledged', timestamp: new Date().toISOString() },
      { id: 'inc_004', title: 'Power Grid Fluctuation', severity: 'moderate', sector: 'Grid Node 14', status: 'resolved', timestamp: new Date().toISOString() },
    ];
  },

  async getIncidentById(id) {
    // GET /api/incidents/:id
    // return api.get(`/incidents/${id}`);
    return { id, title: 'Seismic Activity Detected', severity: 'critical', sector: 'Sector 7', description: 'Magnitude 6.2 reported. Infrastructure integrity at risk.', status: 'active' };
  },

  async createIncident(data) {
    // POST /api/incidents
    // return api.post('/incidents', data);
    return { id: 'inc_new', ...data, status: 'active', timestamp: new Date().toISOString() };
  },

  async updateIncident(id, data) {
    // PUT /api/incidents/:id
    // return api.put(`/incidents/${id}`, data);
    return { id, ...data, updatedAt: new Date().toISOString() };
  },

  async acknowledgeIncident(id) {
    // PATCH /api/incidents/:id/acknowledge
    // return api.patch(`/incidents/${id}/acknowledge`);
    return { id, status: 'acknowledged' };
  },
};
