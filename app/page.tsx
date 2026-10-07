'use client';

import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, Truck, Database, Fuel, ArrowLeft } from 'lucide-react';

// --- MOCK DATABASE (For interactive filtering) ---
const mockStations = [
  { id: 'station-1', name: 'Airport Road Station', pumps: '4 Pumps (2 Twin)', status: 'OPEN (Shift #12)', expected: 125000, banked: 125000, variance: 0, volume: 8200 },
  { id: 'station-2', name: 'East Legon Branch', pumps: '6 Pumps (3 Twin)', status: 'PENDING BANKING', expected: 161750, banked: 140000, variance: -21750, volume: 10500 },
  { id: 'station-3', name: 'Tema Harbour Terminal', pumps: '8 Pumps (4 Twin)', status: 'CLOSED', expected: 80000, banked: 80000, variance: 0, volume: 5750 },
];

export default function ExecutiveDashboard() {
  const [selectedStation, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'loads' | 'pricing' | 'onboarding'>('overview');

  // Form states for Admin Onboarding
  const [newStationName, setNewStationName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [pumpCount, setPumpCount] = useState(2);

  // Form states for Price Management
  const [targetFuel, setTargetFuel] = useState('Diesel');
  const [newPrice, setNewPrice] = useState('');

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
          <LayoutDashboard className="w-4 h-4" /> Overview & Variances
        </button>
        <button 
          onClick={() => setActiveTab('loads')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'loads' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Truck className="w-4 h-4" /> Fuel Load & Financial Realization
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
          <div className="space-y-6">
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
                  {selectedStation === 'all' ? 'Live Station Health & Reconciliation Grid' : 'Branch Deep Dive'}
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
                        title="Click to inspect this branch"
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
          </div>
        )}

        {/* TAB 2: FUEL LOAD LIFECYCLE TRACKER */}
        {activeTab === 'loads' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Perpetual Load Realization Tracker
                </h3>
                <p className="text-slate-400 text-sm mt-1">Track expected cash vs actual banked cash for continuous overlapping deliveries (FIFO).</p>
              </div>
              <button className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500/20 transition">
                + Register New Waybill Drop
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex justify-between items-center">
                <div>
                  <span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md text-xs font-bold tracking-wider mr-3">ACTIVE BATCH</span>
                  <span className="text-white font-semibold">Waybill #AGO-54012 (Diesel)</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Dropped at</p>
                  <p className="text-sm text-white font-medium">Airport Road Station</p>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Inventory Depletion (FIFO)</h4>
                  
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Total Received: <span className="text-white font-bold">54,000 L</span></span>
                    <span className="text-blue-400 font-bold">18,500 L Remaining</span>
                  </div>
                  
                  <div className="w-full bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
                    <div className="bg-blue-500 h-3 rounded-full" style={{ width: '65%' }}></div>
                  </div>

                  <div className="space-y-3 mt-6">
                    <div className="flex justify-between items-center text-sm p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                      <span className="text-slate-300">Sold @ GHS 14.50 (Old Price)</span>
                      <span className="text-white font-semibold">12,000 L</span>
                    </div>
                    <div className="flex justify-between items-center text-sm p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                      <span className="text-slate-300">Sold @ GHS 15.20 (Current Price)</span>
                      <span className="text-white font-semibold">23,500 L</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Financial Realization Audit</h4>
                  
                  <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                    <div className="flex justify-between mb-4 border-b border-slate-700 pb-4">
                      <span className="text-slate-400">Dynamic Expected Revenue</span>
                      <span className="text-white font-bold text-lg">GHS 531,200</span>
                    </div>
                    
                    <div className="flex justify-between mb-2">
                      <span className="text-emerald-400">Verified Bank Deposits (Matching Dates)</span>
                      <span className="text-emerald-400 font-bold">GHS 480,000</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-emerald-400">MoMo Settlements</span>
                      <span className="text-emerald-400 font-bold">GHS 35,000</span>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-700 items-center">
                      <span className="text-slate-300 font-medium">Unrealized / Outstanding Cash</span>
                      <span className="text-amber-400 font-extrabold text-xl">GHS 16,200</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors border border-slate-600">
                    View Linked Deposit Slips
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRICE MANAGEMENT MATRIX */}
        {activeTab === 'pricing' && (
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Multi-Station Fuel Price Update Matrix
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Update pump prices globally or target specific stations. New shift openings will automatically calculate expected revenue using these active rates.
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
                  <label className="flex items-center gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700 cursor-pointer hover:border-slate-600">
                    <input type="radio" name="scope" defaultChecked className="accent-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">All Stations (Global)</p>
                      <p className="text-xs text-slate-400">Apply instantly across entire network</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700 cursor-pointer hover:border-slate-600">
                    <input type="radio" name="scope" className="accent-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">Selected Stations Only</p>
                      <p className="text-xs text-slate-400">Pick specific branches</p>
                    </div>
                  </label>
                </div>
              </div>

              <button 
                onClick={() => alert(`Price update deployed successfully for ${targetFuel} at GHS ${newPrice || '0.00'}!`)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
              >
                Deploy Price Update to Stations 🚀
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: ADMIN ONBOARDING PORTAL */}
        {activeTab === 'onboarding' && (
          <div className="max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" /> Automated Station Provisioning Portal
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Instantly provision a new filling station, generate its database UUID, configure pumps, and link manager WhatsApp numbers without writing raw SQL.
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Total Dispensers / Pumps</label>
                <input 
                  type="number" 
                  value={pumpCount}
                  onChange={(e) => setPumpCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button 
                onClick={() => alert(`Station "${newStationName || 'New Station'}" successfully provisioned in Supabase with ${pumpCount} pumps!`)}
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
