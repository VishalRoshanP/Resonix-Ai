// Personnel Service — Placeholder for Express backend integration
import { api } from './api';

export const personnelService = {
  async getPersonnel(params = {}) {
    // GET /api/personnel
    // return api.get(`/personnel?${new URLSearchParams(params)}`);
    return [
      { id: 'per_001', name: 'Sgt. Maria Chen', role: 'Field Commander', status: 'active', sector: 'Sector 4', heartRate: 82, signal: 5, lastCheckIn: '2 min ago' },
      { id: 'per_002', name: 'Lt. James Walker', role: 'Medic Lead', status: 'active', sector: 'Sector 7', heartRate: 91, signal: 4, lastCheckIn: '5 min ago' },
      { id: 'per_003', name: 'Cpl. Aisha Patel', role: 'Comms Specialist', status: 'in-transit', sector: 'En route S7', heartRate: 76, signal: 3, lastCheckIn: '8 min ago' },
      { id: 'per_004', name: 'Pvt. Derek Yamamoto', role: 'Search & Rescue', status: 'offline', sector: 'Sector 2', heartRate: null, signal: 0, lastCheckIn: '45 min ago' },
    ];
  },

  async getPersonnelById(id) {
    // GET /api/personnel/:id
    // return api.get(`/personnel/${id}`);
    return { id, name: 'Sgt. Maria Chen', role: 'Field Commander', status: 'active', biometrics: { heartRate: 82, temperature: 98.6, oxygenSat: 97 } };
  },

  async updatePersonnelStatus(id, status) {
    // PATCH /api/personnel/:id/status
    // return api.patch(`/personnel/${id}/status`, { status });
    return { id, status, updatedAt: new Date().toISOString() };
  },

  async getTeamFormation() {
    // GET /api/personnel/teams
    // return api.get('/personnel/teams');
    return [
      { id: 'team_alpha', name: 'Alpha Squad', members: 8, status: 'deployed' },
      { id: 'team_bravo', name: 'Bravo Squad', members: 6, status: 'standby' },
    ];
  },
};
