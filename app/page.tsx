'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, Fuel, Truck, Database } from 'lucide-react';

export default function ExecutiveDashboard() {
  const [selectedStation, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'onboarding' | 'loads'>('loads');

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
            <p className="text-slate-400 text-xs">Real-time multi-station audit & wetstock tracking</p>
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
              <option value="station-1" className="bg-slate-900">📍 Airport Road Station</option>
              <option value="station-2" className="bg-slate-900">📍 East Legon Branch</option>
            </select>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex gap-6 overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
          <LayoutDashboard className="w-4 h-4" /> Overview & Variances
        </button>
        <button onClick={() => setActiveTab('loads')} className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'loads' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
          <Truck className="w-4 h-4" /> Fuel Load & Financial Realization
        </button>
        <button onClick={() => setActiveTab('pricing')} className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'pricing' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
          <TrendingUp className="w-4 h-4" /> Price Matrix
        </button>
        <button onClick={() => setActiveTab('onboarding')} className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'onboarding' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
          <Sliders className="w-4 h-4" /> Admin Onboarding
        </button>
      </div>

      {/* Main Content Area */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        
        {/* TAB 1: OVERVIEW (Shortened for brevity) */}
        {activeTab === 'overview' && (
          <div className="text-center mt-10">
            <h2 className="text-2xl font-bold text-white mb-2">Shift Overview</h2>
            <p className="text-slate-400">Select another tab to view specific modules.</p>
          </div>
        )}

        {/* TAB 2: FUEL LOAD LIFECYCLE TRACKER (NEW FEATURE!) */}
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

            {/* Active Load Batch Card */}
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
                {/* Left Side: Volume Tracking */}
                <div>
                  <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Inventory Depletion (FIFO)</h4>
                  
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Total Received: <span className="text-white font-bold">54,000 L</span></span>
                    <span className="text-blue-400 font-bold">18,500 L Remaining</span>
                  </div>
                  
                  {/* Progress Bar */}
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

                {/* Right Side: Financial Realization */}
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

        {/* TAB 3 & 4 (Pricing & Onboarding - Hidden here to keep code short, you saw them earlier!) */}
      </main>
    </div>
  );
}
