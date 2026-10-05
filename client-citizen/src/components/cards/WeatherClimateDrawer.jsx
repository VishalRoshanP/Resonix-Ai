import React from 'react';

/**
 * WeatherClimateDrawer: Collapsible drawer for historical climate archives and 5-year trends
 * Preserves 100% of historical analytics, dual-axis SVG chart profiles, and YoY baseline shift.
 */
export default function WeatherClimateDrawer({
  isClimateExpanded,
  setIsClimateExpanded,
  climateData,
  isClimateLoading,
  climateTab,
  setClimateTab,
  selectedHistoricalYear,
  setSelectedHistoricalYear,
  fetchClimateData,
  selectedLanguage,
}) {
  return (
    <div className="rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container-low/40">
      <button
        id="btn-toggle-climate"
        type="button"
        onClick={() => {
          const next = !isClimateExpanded;
          setIsClimateExpanded(next);
          if (next && !climateData) {
            fetchClimateData();
          }
        }}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-surface-container-high/40 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="material-symbols-outlined text-secondary text-sm group-hover:scale-110 transition-transform shrink-0">
            history
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-primary group-hover:text-secondary transition-colors">
                Climate & History
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                2021–2025 Archive
              </span>
            </div>
            <span className="text-[9px] text-on-surface-variant block truncate sm:whitespace-normal">
              Historical weather observations, monthly profile & 5-year climate trends
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant group-hover:text-primary shrink-0 ml-2">
          <span>{isClimateExpanded ? 'Hide' : 'Explore'}</span>
          <span className="material-symbols-outlined text-xs transition-transform" style={{ transform: isClimateExpanded ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </div>
      </button>

      {isClimateExpanded && (
        <div className="p-3 border-t border-outline-variant/30 space-y-3 animate-fade-in">
          {/* Quick Historical Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div className="p-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40">
              <div className="flex items-center gap-1 text-[9px] font-mono text-amber-500 mb-0.5">
                <span className="material-symbols-outlined text-xs">local_fire_department</span>
                <span>{selectedLanguage === 'ta' ? 'வெப்பமான மாதம்' : 'HOTTEST MONTH'}</span>
              </div>
              <div className="text-xs font-bold text-primary truncate">
                {climateData?.hottestMonth?.monthName || '—'}
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant">
                {climateData?.hottestMonth?.averageMaxTemp != null
                  ? `${climateData.hottestMonth.averageMaxTemp} °C Avg Max`
                  : '—'}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40">
              <div className="flex items-center gap-1 text-[9px] font-mono text-sky-400 mb-0.5">
                <span className="material-symbols-outlined text-xs">water_drop</span>
                <span>{selectedLanguage === 'ta' ? 'அதிக மழை மாதம்' : 'WETTEST MONTH'}</span>
              </div>
              <div className="text-xs font-bold text-primary truncate">
                {climateData?.wettestMonth?.monthName || '—'}
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant">
                {climateData?.wettestMonth?.totalRainfallMm != null
                  ? `${climateData.wettestMonth.totalRainfallMm} mm`
                  : '—'}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40">
              <div className="flex items-center gap-1 text-[9px] font-mono text-indigo-400 mb-0.5">
                <span className="material-symbols-outlined text-xs">thunderstorm</span>
                <span>{selectedLanguage === 'ta' ? 'அதிக 1-நாள் மழை' : 'HEAVIEST 1-DAY'}</span>
              </div>
              <div className="text-xs font-bold text-primary truncate">
                {climateData?.extremeEvents?.heaviestRainDay?.date
                  ? climateData.extremeEvents.heaviestRainDay.date.slice(5)
                  : '—'}
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant">
                {climateData?.extremeEvents?.heaviestRainDay?.rainfallMm != null
                  ? `${climateData.extremeEvents.heaviestRainDay.rainfallMm} mm`
                  : '—'}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40">
              <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 mb-0.5">
                <span className="material-symbols-outlined text-xs">trending_up</span>
                <span>{selectedLanguage === 'ta' ? '5-ஆண்டு மாற்றம்' : '5-YR YOY SHIFT'}</span>
              </div>
              <div className="text-xs font-bold text-primary truncate">
                {climateData?.overallShift?.rainfallShiftPercentage != null
                  ? `${climateData.overallShift.rainfallShiftPercentage > 0 ? '+' : ''}${climateData.overallShift.rainfallShiftPercentage}%`
                  : '—'}
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant">
                {selectedLanguage === 'ta' ? 'மழைப்பொழிவு' : 'vs 5-Yr Baseline'}
              </div>
            </div>
          </div>

          {/* Collapsible Chart Panel */}
          <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 space-y-3">
            {/* Tab Selector: 12-Month Profile vs 5-Year Trend */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-surface-container rounded-lg p-0.5 border border-outline-variant/40">
                <button
                  id="tab-climate-monthly"
                  data-testid="tab-climate-monthly"
                  type="button"
                  onClick={() => setClimateTab('monthly')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                    climateTab === 'monthly'
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {selectedLanguage === 'ta' ? `12-மாத விவரம் (${selectedHistoricalYear})` : `12-Month Profile (${selectedHistoricalYear})`}
                </button>
                <button
                  id="tab-climate-five-year"
                  data-testid="tab-climate-five-year"
                  type="button"
                  onClick={() => setClimateTab('fiveYear')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                    climateTab === 'fiveYear'
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {selectedLanguage === 'ta' ? '5-ஆண்டு போக்கு (2021–2025)' : '5-Year Trend (2021–2025)'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {climateTab === 'monthly' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-on-surface-variant">Year:</span>
                    <select
                      id="select-historical-year"
                      value={selectedHistoricalYear}
                      onChange={(e) => {
                        const yr = Number(e.target.value);
                        setSelectedHistoricalYear(yr);
                        fetchClimateData(yr);
                      }}
                      className="text-[10px] font-mono bg-surface-container border border-outline-variant/40 rounded px-1.5 py-0.5 text-primary cursor-pointer focus:outline-none"
                      aria-label="Select historical calendar year"
                    >
                      {[2025, 2024, 2023, 2022, 2021].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isClimateLoading && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-secondary">
                    <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                    <span>{selectedLanguage === 'ta' ? 'ஏற்றுகிறது...' : 'Retrieving archive...'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 1: 12-Month Profile */}
            {climateTab === 'monthly' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-sky-400 inline-block" />
                      <span>Rainfall (mm)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                      <span>Avg Max Temp (°C)</span>
                    </span>
                  </div>
                  <span>{climateData?.annualSummary?.totalRainfallMm != null ? `Total: ${climateData.annualSummary.totalRainfallMm} mm` : ''}</span>
                </div>

                {(!climateData?.monthlyBreakdown || climateData.monthlyBreakdown.length === 0) ? (
                  <div className="py-8 text-center text-xs font-mono text-on-surface-variant bg-surface-container/30 rounded-xl border border-outline-variant/30">
                    {isClimateLoading ? 'Ingesting historical observations...' : `Monthly historical archive unavailable for ${selectedHistoricalYear}`}
                  </div>
                ) : (
                  <div className="w-full bg-surface-container/70 rounded-xl p-2 border border-outline-variant/30 overflow-x-auto">
                    <svg viewBox="0 0 360 135" className="w-full h-32 select-none" preserveAspectRatio="none">
                      <line x1="20" y1="20" x2="350" y2="20" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3,3" />
                      <line x1="20" y1="60" x2="350" y2="60" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3,3" />
                      <line x1="20" y1="100" x2="350" y2="100" stroke="currentColor" strokeOpacity="0.15" />

                      {(() => {
                        const months = climateData.monthlyBreakdown;
                        const maxRain = Math.max(...months.map((m) => m.totalRainfallMm || 0), 50);
                        const minTemp = Math.min(...months.map((m) => m.averageMaxTemp || 25), 20);
                        const maxTemp = Math.max(...months.map((m) => m.averageMaxTemp || 35), 38);
                        const tempRange = Math.max(maxTemp - minTemp, 5);

                        const points = months.map((m, idx) => {
                          const x = 28 + idx * 27;
                          const tempY = 100 - (((m.averageMaxTemp || 25) - minTemp) / tempRange) * 75;
                          return `${x + 8},${tempY.toFixed(1)}`;
                        }).join(' ');

                        return (
                          <>
                            {months.map((m, idx) => {
                              const x = 28 + idx * 27;
                              const barHeight = Math.max(((m.totalRainfallMm || 0) / maxRain) * 75, 2);
                              const barY = 100 - barHeight;
                              return (
                                <g key={idx}>
                                  <rect
                                    x={x}
                                    y={barY}
                                    width="16"
                                    height={barHeight}
                                    rx="2"
                                    fill="#38bdf8"
                                    fillOpacity="0.7"
                                    className="transition-all hover:fillOpacity-100"
                                  >
                                    <title>{`${m.monthName}: ${m.totalRainfallMm ?? 0} mm, Max ${m.averageMaxTemp ?? '—'}°C`}</title>
                                  </rect>
                                  <text
                                    x={x + 8}
                                    y="114"
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="currentColor"
                                    opacity="0.75"
                                    fontFamily="monospace"
                                  >
                                    {m.monthName ? m.monthName.slice(0, 1) : idx + 1}
                                  </text>
                                </g>
                              );
                            })}

                            <polyline
                              points={points}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {months.map((m, idx) => {
                              const x = 28 + idx * 27;
                              const tempY = 100 - (((m.averageMaxTemp || 25) - minTemp) / tempRange) * 75;
                              return (
                                <circle
                                  key={`circle-${idx}`}
                                  cx={x + 8}
                                  cy={tempY}
                                  r="2.5"
                                  fill="#f97316"
                                  stroke="#1e293b"
                                  strokeWidth="1"
                                >
                                  <title>{`${m.monthName} Avg Max: ${m.averageMaxTemp ?? '—'}°C`}</title>
                                </circle>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Chart 2: 5-Year YoY Trend */}
            {climateTab === 'fiveYear' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
                      <span>Annual Rainfall (mm)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" />
                      <span>5-Yr Mean</span>
                    </span>
                  </div>
                  <span>{climateData?.overallShift?.rainfallShiftPercentage != null ? `Net Shift: ${climateData.overallShift.rainfallShiftPercentage > 0 ? '+' : ''}${climateData.overallShift.rainfallShiftPercentage}%` : ''}</span>
                </div>

                {(!climateData?.climateTrends || climateData.climateTrends.length === 0) ? (
                  <div className="py-8 text-center text-xs font-mono text-on-surface-variant bg-surface-container/30 rounded-xl border border-outline-variant/30">
                    {isClimateLoading ? 'Ingesting climate trend records...' : 'Multi-year climate trend records unavailable for this location'}
                  </div>
                ) : (
                  <div className="w-full bg-surface-container/70 rounded-xl p-2 border border-outline-variant/30 overflow-x-auto">
                    <svg viewBox="0 0 360 135" className="w-full h-32 select-none" preserveAspectRatio="none">
                      <line x1="20" y1="20" x2="350" y2="20" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3,3" />
                      <line x1="20" y1="60" x2="350" y2="60" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3,3" />
                      <line x1="20" y1="100" x2="350" y2="100" stroke="currentColor" strokeOpacity="0.15" />

                      {(() => {
                        const years = climateData.climateTrends;
                        const maxRain = Math.max(...years.map((y) => y.totalRainfallMm || 0), 500) * 1.15;
                        const avgRain = years.reduce((acc, y) => acc + (y.totalRainfallMm || 0), 0) / (years.length || 1);
                        const avgY = 100 - (avgRain / maxRain) * 75;

                        return (
                          <>
                            <line
                              x1="25"
                              y1={avgY}
                              x2="345"
                              y2={avgY}
                              stroke="#94a3b8"
                              strokeDasharray="4,3"
                              strokeWidth="1.2"
                            />
                            <text
                              x="345"
                              y={avgY - 3}
                              textAnchor="end"
                              fontSize="8"
                              fill="#94a3b8"
                              fontFamily="monospace"
                            >
                              5-Yr Avg ({Math.round(avgRain)}mm)
                            </text>

                            {years.map((y, idx) => {
                              const x = 38 + idx * 62;
                              const barHeight = Math.max(((y.totalRainfallMm || 0) / maxRain) * 75, 4);
                              const barY = 100 - barHeight;
                              const delta = climateData?.yearOverYearDeltas?.find((d) => d.year === y.year);

                              return (
                                <g key={idx}>
                                  <rect
                                    x={x}
                                    y={barY}
                                    width="38"
                                    height={barHeight}
                                    rx="3"
                                    fill="#3b82f6"
                                    fillOpacity="0.85"
                                  >
                                    <title>{`${y.year}: ${y.totalRainfallMm != null ? `${y.totalRainfallMm} mm` : '—'}, Avg Temp ${y.averageTemp != null ? `${y.averageTemp}°C` : '—'}`}</title>
                                  </rect>
                                  <text
                                    x={x + 19}
                                    y={barY - 3}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill="currentColor"
                                    fontFamily="monospace"
                                  >
                                    {y.totalRainfallMm != null ? `${Math.round(y.totalRainfallMm)}mm` : '—'}
                                  </text>
                                  <text
                                    x={x + 19}
                                    y="114"
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="bold"
                                    fill="currentColor"
                                    fontFamily="monospace"
                                  >
                                    {y.year}
                                  </text>
                                  <text
                                    x={x + 19}
                                    y="126"
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="#f97316"
                                    fontFamily="monospace"
                                  >
                                    {y.averageTemp != null ? `${y.averageTemp}°C` : '—'}
                                  </text>
                                  {delta && (
                                    <text
                                      x={x + 19}
                                      y={barY + 12}
                                      textAnchor="middle"
                                      fontSize="7"
                                      fill="#ffffff"
                                      fontWeight="bold"
                                      fontFamily="monospace"
                                    >
                                      {delta.rainfallDeltaPercentage > 0 ? `+${delta.rainfallDeltaPercentage}%` : `${delta.rainfallDeltaPercentage}%`}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[9px] font-mono text-on-surface-variant">
              <span>Data: Open-Meteo Historical Archive (Real Observations)</span>
              <span className="text-emerald-400">Zero-Hallucination Grounded</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
