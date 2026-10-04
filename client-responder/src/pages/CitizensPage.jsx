import { useState, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import CitizenDetailModal from '../components/citizens/CitizenDetailModal';
import { incidentApi } from '../services/api';

export default function CitizensPage() {
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch real incidents from backend MongoDB to extract active citizen directory telemetry
  useEffect(() => {
    fetchRealCitizenDirectory();
    const interval = setInterval(() => {
      fetchRealCitizenDirectory(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealCitizenDirectory = async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      const res = await incidentApi.getIncidents({ signal: AbortSignal.timeout(10000) });
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.data?.incidents || res?.data?.data || [];
      setIncidents(rawList);
      setFetchError(null);
    } catch (err) {
      console.warn('[CitizensPage] Failed to fetch citizen directory from backend:', err.message);
      if (!isBackground || incidents.length === 0) {
        setFetchError('Data temporarily unavailable: Waiting for live backend data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamically derive citizen directory records from real backend DB incidents
  const citizens = useMemo(() => {
    if (!incidents || incidents.length === 0) return [];

    const citizenMap = new Map();

    incidents.forEach((inc, idx) => {
      const citizenId = inc.userId || inc.citizenId || inc.packetId || `usr_citizen_${idx + 1}`;
      
      if (!citizenMap.has(citizenId)) {
        const priority = (inc.severity || inc.priority || 'MEDIUM').toUpperCase();
        let statusBadge = 'bg-secondary/15 border-secondary text-secondary font-bold';
        if (priority === 'CRITICAL') statusBadge = 'bg-error text-white font-bold animate-pulse';
        else if (priority === 'HIGH') statusBadge = 'bg-amber-500 text-white font-bold';

        citizenMap.set(citizenId, {
          id: String(citizenId),
          name: inc.userName || inc.name || `Citizen (${String(citizenId).substring(0, 10)})`,
          email: inc.userEmail || inc.email || 'N/A',
          phone: inc.phone || inc.contactPhone || 'N/A',
          isGuest: String(citizenId).includes('guest') || !inc.userEmail,
          bloodGroup: inc.bloodGroup || '',
          language: (inc.language || 'English').toUpperCase(),
          medicalConditions: inc.medicalConditions || inc.description || '',
          emergencyContactName: inc.emergencyContactName || '',
          emergencyContactPhone: inc.emergencyContactPhone || '',
          status: inc.status || 'ACTIVE_SOS',
          statusBadge,
          emergencyCount: 1,
          registeredDate: inc.createdAt ? new Date(inc.createdAt).toLocaleDateString() : 'Live Session',
          city: inc.sector || inc.location?.address || 'Location unavailable',
        });
      } else {
        const existing = citizenMap.get(citizenId);
        existing.emergencyCount += 1;
      }
    });

    return Array.from(citizenMap.values());
  }, [incidents]);

  // Filter citizens
  const filteredCitizens = useMemo(() => {
    return citizens.filter((cit) => {
      const matchesSearch =
        cit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cit.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cit.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cit.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === 'ALL' || cit.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [citizens, searchQuery, filterStatus]);

  const handleOpenDetail = (citizen) => {
    setSelectedCitizen(citizen);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Citizen Emergency Profiles</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Real-Time Registered Citizens & Active SOS Users from Backend DB</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchRealCitizenDirectory(false)} className="min-h-[40px]">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Refresh Real Citizens</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="material-symbols-outlined text-on-surface-variant text-xl">search</span>
          <input
            type="text"
            placeholder="Search by name, email, phone, or citizen ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-primary focus:outline-none font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-container text-xs font-bold text-primary focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE_SOS">Active SOS</option>
            <option value="EN_ROUTE">En Route</option>
            <option value="RESCUED">Rescued</option>
          </select>
        </div>
      </Card>

      {/* Citizens Table */}
      <Card className="p-5 border border-outline-variant/60 shadow-md space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container border-b border-outline-variant/60 text-[10px] uppercase font-mono font-bold text-on-surface-variant">
              <tr>
                <th className="p-3">Citizen Name & ID</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Account Type</th>
                <th className="p-3">Language</th>
                <th className="p-3">Medical / Notes</th>
                <th className="p-3">SOS Count</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {isLoading && citizens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-secondary font-mono font-bold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                      <span>Loading real citizen directory from MongoDB...</span>
                    </div>
                  </td>
                </tr>
              ) : fetchError && citizens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-amber-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-2xl text-amber-500">cloud_off</span>
                      <span className="text-xs font-bold text-primary">{fetchError}</span>
                      <Button variant="secondary" size="sm" onClick={() => fetchRealCitizenDirectory(false)} className="mt-1 text-xs">
                        <span className="material-symbols-outlined text-xs mr-1">refresh</span>
                        Retry Connection
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredCitizens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-on-surface-variant font-medium">
                    No active citizen emergency records found in backend database.
                  </td>
                </tr>
              ) : (
                filteredCitizens.map((cit) => (
                  <tr key={cit.id} className="hover:bg-surface-container-high/50 transition-colors">
                    <td className="p-3">
                      <span className="font-extrabold text-primary block">{cit.name}</span>
                      <span className="font-mono text-[10px] text-secondary font-bold block">{cit.id}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] text-primary block">{cit.phone}</span>
                      <span className="text-[10px] text-on-surface-variant block">{cit.email}</span>
                    </td>
                    <td className="p-3">
                      {cit.isGuest ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          GUEST SESSION
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/30">
                          REGISTERED
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] font-bold text-primary">{cit.language}</td>
                    <td className="p-3 text-[11px] text-on-surface-variant max-w-[200px] truncate">{cit.medicalConditions}</td>
                    <td className="p-3 font-mono font-extrabold text-secondary">{cit.emergencyCount} Signal(s)</td>
                    <td className="p-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => handleOpenDetail(cit)} className="text-[10px] py-1 px-2.5">
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Citizen Detail Modal */}
      {isDetailOpen && selectedCitizen && (
        <CitizenDetailModal citizen={selectedCitizen} onClose={() => setIsDetailOpen(false)} />
      )}
    </div>
  );
}
