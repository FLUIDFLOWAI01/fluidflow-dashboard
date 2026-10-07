'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, DollarSign, Fuel } from 'lucide-react';

export default function ExecutiveDashboard() {
  const [selectedStation, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'onboarding'>('overview');

  // Form states for Admin Onboarding Portal
  const [newStationName, setNewStationName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [pumpCount, setPumpCount] = useState(2);

  // Form states for Price Management
  const [targetFuel, setTargetFuel] = useState('Diesel');
  const [newPrice, setNewPrice] = useState('');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/30">
            <Fuel className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FluidFlow AI <span className="text-emerald-400 text-sm font-normal">Executive & Control Center</span></h1>
            <p className="text-slate-400 text-xs">Real-time multi-station audit, wetstock tracking, and pricing engine</p>
          </div>
        </div>

        {/* Station Selector Dropdown (Multi-Station Control) */}
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
              <option value="station-1" className="bg-slate-900">📍 Airport Road Station</option>
              <option value="station-2" className="bg-slate-900">📍 East Legon Branch</option>
              <option value="station-3" className="bg-slate-900">📍 Tema Harbour Terminal</option>
            </select>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Sync Active
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'overview' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview & Variances
        </button>
        <button 
          onClick={() => setActiveTab('pricing')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'pricing' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <TrendingUp className="w-4 h-4" /> Price Management Matrix
        </button>
        <button 
          onClick={() => setActiveTab('onboarding')}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'onboarding' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          <Sliders className="w-4 h-4" /> Admin Station Onboarding
        </button>
      </div>

      {/* Main Content Area */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        
        {/* TAB 1: OVERVIEW & VARIANCES */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Volume Sold Today</p>
                <p className="text-3xl font-extrabold text-white mt-2">24,450 <span className="text-base font-normal text-slate-400">L</span></p>
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 font-medium">↑ 12% vs yesterday</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Expected Revenue</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-2">GHS 366,750</p>
                <div className="mt-2 text-xs text-slate-400">Calculated via pump meter deltas</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unbanked Cash Balance</p>
                <p className="text-3xl font-extrabold text-amber-400 mt-2">GHS 42,100</p>
                <div className="mt-2 text-xs text-slate-400">Pending Monday bulk deposit</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Wetstock / Shortage Flags</p>
                <p className="text-3xl font-extrabold text-rose-500 mt-2">1 Station</p>
                <div className="mt-2 text-xs text-rose-400 font-medium">⚠️ Action Required</div>
              </div>
            </div>

            {/* Station Status Health Grid */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" /> Live Station Health & Reconciliation Grid
              </h3>
              
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
                    <tr className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 font-medium text-white">Airport Road Station</td>
                      <td className="py-4 text-slate-300">4 Pumps (2 Twin)</td>
                      <td className="py-4"><span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md text-xs font-semibold">OPEN (Shift #12)</span></td>
                      <td className="py-4 font-semibold">GHS 125,000</td>
                      <td className="py-4 text-slate-300">GHS 125,000</td>
                      <td className="py-4"><span className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs"><CheckCircle className="w-4 h-4" /> Balanced (0.00)</span></td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 font-medium text-white">East Legon Branch</td>
                      <td className="py-4 text-slate-300">6 Pumps (3 Twin)</td>
                      <td className="py-4"><span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-md text-xs font-semibold">PENDING BANKING</span></td>
                      <td className="py-4 font-semibold">GHS 161,750</td>
                      <td className="py-4 text-slate-300">GHS 140,000</td>
                      <td className="py-4"><span className="flex items-center gap-1.5 text-rose-400 font-medium text-xs"><AlertTriangle className="w-4 h-4" /> Shortage: -GHS 21,750</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRICE MANAGEMENT MATRIX */}
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

        {/* TAB 3: ADMIN ONBOARDING PORTAL */}
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
