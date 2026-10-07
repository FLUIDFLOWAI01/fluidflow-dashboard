'use client';

import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, Database, Fuel, ArrowLeft, Smartphone } from 'lucide-react';

// --- MOCK DATABASE (For interactive filtering) ---
const mockStations = [
  { id: 'station-1', name: 'Airport Road Station', pumps: '4 Pumps (2 Twin)', status: 'OPEN (Shift #12)', expected: 125000, banked: 125000, variance: 0, volume: 8200 },
  { id: 'station-2', name: 'East Legon Branch', pumps: '6 Pumps (3 Twin)', status: 'PENDING BANKING', expected: 161750, banked: 140000, variance: -21750, volume: 10500 },
  { id: 'station-3', name: 'Tema Harbour Terminal', pumps: '8 Pumps (4 Twin)', status: 'CLOSED', expected: 80000, banked: 80000, variance: 0, volume: 5750 },
];

// --- MULTIPLE MOCK WAYBILLS PER STATION (To track every load separately) ---
const mockWaybills: Record<string, any[]> = {
  'station-1': [
    { id: 'AGO-54012', fuel: 'Diesel', volume: 54000, remaining: 18500, date: 'Oct 6, 2026', driver: 'Kwame Mensah', truckReg: 'GT-405-21', expectedRev: 531200, bankedRev: 480000, momoRev: 35000, status: 'Active' },
    { id: 'PMS-11223', fuel: 'Super (PMS)', volume: 36000, remaining: 0, date: 'Oct 1, 2026', driver: 'Kofi Annan', truckReg: 'GR-2022-20', expectedRev: 547200, bankedRev: 547200, momoRev: 0, status: 'Completed (Fully Realized)' }
  ],
  'station-2': [
    { id: 'PMS-99011', fuel: 'Super (PMS)', volume: 36000, remaining: 12000, date: 'Oct 5, 2026', driver: 'Yaw Boakye', truckReg: 'GR-1122-19', expectedRev: 345000, bankedRev: 310000, momoRev: 15000, status: 'Active' }
  ],
  'station-3': [
    { id: 'AGO-88220', fuel: 'Diesel', volume: 45000, remaining: 45000, date: 'Oct 6, 2026', driver: 'Ali Hassan', truckReg: 'GN-889-22', expectedRev: 0, bankedRev: 0, momoRev: 0, status: 'Active' }
  ],
};

export default function ExecutiveDashboard() {
  const [selectedStation, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'onboarding'>('overview');

  // Form states for Admin Onboarding
  const [newStationName, setNewStationName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [pumpCount, setPumpCount] = useState(2);
  const [deadstockLimit, setDeadstockLimit] = useState('');

  // Form states for Price Management
  const [targetFuel, setTargetFuel] = useState('Diesel');
  const [newPrice, setNewPrice] = useState('');
  const [targetScope, setTargetScope] = useState<'global' | 'specific'>('global');
  const [selectedTargetStations, setSelectedTargetStations] = useState<string[]>([]);

  // --- DYNAMIC DATA FILTERING ---
  const filteredStations = selectedStation === 'all' 
    ? mockStations 
    : mockStations.filter(s => s.id === selectedStation);

  const totals = useMemo(() => {
    return filteredStations.reduce((acc, station) => {
      acc.volume += station.volume;
      acc.expected += station.expected;
      acc.banked += station.banked;
      if (station.variance < 0) acc.shortages += 1;
      return acc;
    }, { volume: 0, expected: 0, banked: 0, shortages: 0 });
  }, [filteredStations]);

  const unbankedCash = totals.expected - totals.banked;
  
  // Now gets an ARRAY of waybills for the selected station
  const stationWaybills = selectedStation !== 'all' ? (mockWaybills[selectedStation] || []) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/30">
            <Fuel className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FluidFlow AI <span className="text-emerald-400 text-sm font-normal">Executive Center</span></h1>
            <p className="text-slate-400 text-xs">Real-time multi-station audit, wetstock tracking, and pricing engine</p>
          </div>
        </div>

        {/* Station Selector Dropdown */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">View Station:</span>
            <select 
              value={selectedStation} 
              onChange={(e) => setSelectedStation(e.target.value)}
              className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">🏢 All Stations (Consolidated)</option>
              {mockStations.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900">📍 {s.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Sync Active
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview & Live Fleet
        </button>
        <button 
          onClick={() => setActiveTab('pricing')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'pricing' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <TrendingUp className="w-4 h-4" /> Price Management Matrix
        </button>
        <button 
          onClick={() => setActiveTab('onboarding')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'onboarding' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Sliders className="w-4 h-4" /> Admin Station Onboarding
        </button>
      </div>

      {/* Main Content Area */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        
        {/* TAB 1: OVERVIEW & VARIANCES */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Dynamic KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Volume Sold {selectedStation !== 'all' ? '(Branch)' : '(Total)'}</p>
                <p className="text-3xl font-extrabold text-white mt-2">{totals.volume.toLocaleString()} <span className="text-base font-normal text-slate-400">L</span></p>
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 font-medium">↑ 12% vs yesterday</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Expected Revenue</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-2">GHS {totals.expected.toLocaleString()}</p>
                <div className="mt-2 text-xs text-slate-400">Calculated via pump meter deltas</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unbanked Balance</p>
                <p className="text-3xl font-extrabold text-amber-400 mt-2">GHS {unbankedCash.toLocaleString()}</p>
                <div className="mt-2 text-xs text-slate-400">Total physical cash pending bank deposit</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Shortages</p>
                <p className={`text-3xl font-extrabold mt-2 ${totals.shortages > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                  {totals.shortages} {totals.shortages === 1 ? 'Station' : 'Stations'}
                </p>
                <div className="mt-2 text-xs text-rose-400 font-medium">{totals.shortages > 0 ? '⚠️ Action Required' : 'All Clear'}</div>
              </div>
            </div>

            {/* Station Status Health Grid */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" /> 
                  {selectedStation === 'all' ? 'Live Station Health & Reconciliation Grid' : 'Branch Health Overview'}
                </h3>
                {selectedStation !== 'all' && (
                  <button 
                    onClick={() => setSelectedStation('all')}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to All Stations
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Station Name</th>
                      <th className="pb-3 font-semibold">Active Pumps</th>
                      <th className="pb-3 font-semibold">Shift Status</th>
                      <th className="pb-3 font-semibold">Expected Sales</th>
                      <th className="pb-3 font-semibold">Banked / Verified</th>
                      <th className="pb-3 font-semibold">Variance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {filteredStations.map((station) => (
                      <tr 
                        key={station.id} 
                        onClick={() => setSelectedStation(station.id)}
                        className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                        title="Click to inspect this branch's active waybills"
                      >
                        <td className="py-4 font-medium text-white group-hover:text-emerald-400 transition-colors">{station.name}</td>
                        <td className="py-4 text-slate-300">{station.pumps}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${station.status.includes('OPEN') ? 'bg-emerald-500/10 text-emerald-400' : station.status.includes('PENDING') ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            {station.status}
                          </span>
                        </td>
                        <td className="py-4 font-semibold">GHS {station.expected.toLocaleString()}</td>
                        <td className="py-4 text-slate-300">GHS {station.banked.toLocaleString()}</td>
                        <td className="py-4">
                          {station.variance < 0 ? (
                            <span className="flex items-center gap-1.5 text-rose-400 font-medium text-xs">
                              <AlertTriangle className="w-4 h-4" /> Shortage: {station.variance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs">
                              <CheckCircle className="w-4 h-4" /> Balanced (0.00)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* --- WAYBILL TRACKERS LOOP --- */}
            {selectedStation !== 'all' && stationWaybills.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" /> Perpetual Load Lifecycle Tracker
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Tracks overlapping FIFO deliveries, deadstock triggers, and remote WhatsApp scans.</p>
                  </div>
                  
                  <button 
                    onClick={() => alert("Scan request ping sent! The Manager will receive a WhatsApp prompt on their mobile phone to snap the new waybill. Once uploaded, OpenAI will read the data and auto-populate a new tracker card here.")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" /> Request Mobile Scan (WhatsApp)
                  </button>
                </div>

                {/* Map through every individual waybill and display a separate tracker card for it */}
                {stationWaybills.map((waybill, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-slate-800/60 px-6 py-5 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider mr-3 ${waybill.status.includes('Active') ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                          {waybill.status.toUpperCase()}
                        </span>
                        <span className="text-white font-semibold text-lg">Waybill #{waybill.id}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Date</p>
                          <p className="text-white font-medium">{waybill.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Driver Name</p>
                          <p className="text-white font-medium">{waybill.driver}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Car No.</p>
                          <p className="text-white font-medium">{waybill.truckReg}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Fuel / Amount</p>
                          <p className="text-emerald-400 font-bold">{waybill.volume.toLocaleString()} L <span className="text-slate-300 font-normal">({waybill.fuel})</span></p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Inventory Depletion (FIFO)</h4>
                        
                        <div className="flex justify-between text-sm mb-1 items-center">
                          <span className="text-slate-300">Total Received: <span className="text-white font-bold">{waybill.volume.toLocaleString()} L</span></span>
                          
                          {waybill.remaining === 0 ? (
                            <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3"/> Deadstock Reached
                            </span>
                          ) : (
                            <span className="text-blue-400 font-bold">{waybill.remaining.toLocaleString()} L Remaining</span>
                          )}
                        </div>
                        
                        <div className="w-full bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
                          <div className={`h-3 rounded-full transition-all duration-1000 ${waybill.remaining === 0 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${((waybill.volume - waybill.remaining) / waybill.volume) * 100}%` }}></div>
                        </div>

                        <div className="space-y-3 mt-6">
                          <div className="flex justify-between items-center text-sm p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                            <span className="text-slate-300">Volume Sold (Depleted)</span>
                            <span className="text-white font-semibold">{(waybill.volume - waybill.remaining).toLocaleString()} L</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Financial Realization Audit</h4>
                        
                        <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                          <div className="flex justify-between mb-4 border-b border-slate-700 pb-4">
                            <span className="text-slate-400">Dynamic Expected Revenue</span>
                            <span className="text-white font-bold text-lg">GHS {waybill.expectedRev.toLocaleString()}</span>
                          </div>
                          
                          <div className="flex justify-between mb-2">
                            <span className="text-emerald-400">Verified Bank Deposits</span>
                            <span className="text-emerald-400 font-bold">GHS {waybill.bankedRev.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between mb-4">
                            <span className="text-emerald-400">MoMo Settlements</span>
                            <span className="text-emerald-400 font-bold">GHS {waybill.momoRev.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between pt-4 border-t border-slate-700 items-center">
                            <span className="text-slate-300 font-medium">Unrealized / Outstanding</span>
                            <span className="text-amber-400 font-extrabold text-xl">GHS {(waybill.expectedRev - waybill.bankedRev - waybill.momoRev).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRICE MANAGEMENT MATRIX */}
        {activeTab === 'pricing' && (
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Multi-Station Fuel Price Update Matrix
            </h3>
            {/* UPDATED SUBTITLE TEXT HERE */}
            <p className="text-slate-400 text-sm mb-6">
              Update pump prices globally or target specific stations. Manager shift calculations are strictly locked to these rates to prevent margin manipulation.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Select Fuel Grade</label>
                <select 
                  value={targetFuel} 
                  onChange={(e) => setTargetFuel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="Diesel">Diesel (AGO)</option>
                  <option value="Super">Super PMS (Gasoline)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">New Price per Liter (GHS / USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-medium">GHS</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="15.50"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-14 pr-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Target Scope</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center gap-3 bg-slate-800/60 p-4 rounded-xl border cursor-pointer transition-colors ${targetScope === 'global' ? 'border-emerald-400' : 'border-slate-700 hover:border-slate-600'}`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'global'}
                      onChange={() => setTargetScope('global')}
                      className="accent-emerald-400 w-4 h-4" 
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">All Stations (Global)</p>
                      <p className="text-xs text-slate-400">Apply instantly across entire network</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 bg-slate-800/60 p-4 rounded-xl border cursor-pointer transition-colors ${targetScope === 'specific' ? 'border-emerald-400' : 'border-slate-700 hover:border-slate-600'}`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'specific'}
                      onChange={() => setTargetScope('specific')}
                      className="accent-emerald-400 w-4 h-4" 
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">Selected Stations Only</p>
                      <p className="text-xs text-slate-400">Pick specific branches</p>
                    </div>
                  </label>
                </div>

                {targetScope === 'specific' && (
                  <div className="mt-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Select Target Branches</p>
                    {mockStations.map((station) => (
                      <label key={station.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={selectedTargetStations.includes(station.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargetStations([...selectedTargetStations, station.id]);
                            } else {
                              setSelectedTargetStations(selectedTargetStations.filter(id => id !== station.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-emerald-400 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{station.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                  if (targetScope === 'specific' && selectedTargetStations.length === 0) {
                    alert("Please select at least one station before deploying.");
                    return;
                  }
                  const scopeMsg = targetScope === 'global' ? 'ALL STATIONS globally' : `${selectedTargetStations.length} selected station(s)`;
                  alert(`Price update deployed successfully for ${targetFuel} at GHS ${newPrice || '0.00'} to ${scopeMsg}! 🚀`);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
              >
                Deploy Price Update to Stations 🚀
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN ONBOARDING PORTAL */}
        {activeTab === 'onboarding' && (
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" /> Automated Station Provisioning Portal
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Instantly provision a new filling station, generate its database UUID, configure pumps, calibrate deadstock thresholds, and link manager WhatsApp numbers.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Station Name & Location</label>
                <input 
                  type="text" 
                  placeholder="e.g., Kumasi Central Express"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Manager WhatsApp Phone Number</label>
                <input 
                  type="text" 
                  placeholder="e.g., +233241234567"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Total Dispensers / Pumps</label>
                  <input 
                    type="number" 
                    value={pumpCount}
                    onChange={(e) => setPumpCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
                
                {/* FIELD: BASE DEADSTOCK CALIBRATION */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Base Deadstock (Liters)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="e.g., 1500"
                      value={deadstockLimit}
                      onChange={(e) => setDeadstockLimit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-emerald-400"
                    />
                    <span className="absolute right-4 top-3.5 text-slate-400 font-medium text-sm">L</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-tight">Un-pumpable volume threshold. AI will use this baseline to detect pre-drop shortages.</p>
                </div>
              </div>

              <button 
                onClick={() => alert(`Station "${newStationName || 'New Station'}" successfully provisioned with ${pumpCount} pumps and a locked deadstock limit of ${deadstockLimit || '0'}L!`)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
              >
                Provision Station Database ⚡
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
