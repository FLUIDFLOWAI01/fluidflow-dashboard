'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LayoutDashboard, Building2, Sliders, AlertTriangle, CheckCircle, TrendingUp, Database, Fuel, ArrowLeft, Smartphone, Bell } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ExecutiveDashboard() {
  // --- REAL-TIME DATABASE STATES ---
  const [stations, setStations] = useState<any[]>([]);
  const [waybills, setWaybills] = useState<any[]>([]);
  const [reorders, setReorders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATES ---
  const [selectedStation, setSelectedStation] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'onboarding'>('overview');

  // --- FORM STATES: ADMIN ONBOARDING ---
  const [newStationName, setNewStationName] = useState('');
  const [stationNumber, setStationNumber] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [pumpCount, setPumpCount] = useState(2);
  const [deadstockLimit, setDeadstockLimit] = useState('');
  const [dispensers, setDispensers] = useState<any[]>([
    { id: 1, type: 'Twin', n1Fuel: 'Super', n1Label: 'Super 1', n2Fuel: 'Diesel', n2Label: 'Diesel 1' },
    { id: 2, type: 'Twin', n1Fuel: 'Super', n1Label: 'Super 2', n2Fuel: 'Diesel', n2Label: 'Diesel 2' }
  ]);

  // --- FORM STATES: PRICE MANAGEMENT ---
  const [targetFuel, setTargetFuel] = useState('Diesel');
  const [newPrice, setNewPrice] = useState('');
  const [targetScope, setTargetScope] = useState<'global' | 'specific'>('global');
  const [selectedTargetStations, setSelectedTargetStations] = useState<string[]>([]);

  // --- DATA FETCHING & REAL-TIME SYNC ---
  useEffect(() => {
    fetchDashboardData();
    
    const channel = supabase
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const [stRes, wbRes, reRes] = await Promise.all([
        supabase.from('stations').select('*').order('created_at', { ascending: false }),
        supabase.from('waybills').select('*, stations(name)').eq('status', 'Active').order('created_at', { ascending: false }),
        supabase.from('reorder_requests').select('*, stations(name)').eq('status', 'Pending Verification').order('created_at', { ascending: false })
      ]);

      if (stRes.data) setStations(stRes.data);
      if (wbRes.data) setWaybills(wbRes.data);
      if (reRes.data) setReorders(reRes.data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- API SUBMISSIONS ---
  async function handleProvisionStation(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        station_name: newStationName,
        station_number: stationNumber,
        manager_phone: managerPhone,
        base_deadstock: parseFloat(deadstockLimit) || 0,
        dispensers: dispensers
      };

      const res = await fetch('/api/stations/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || '' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Station "${newStationName}" successfully provisioned!`);
        setNewStationName('');
        setStationNumber('');
        setManagerPhone('');
        fetchDashboardData();
      } else {
        alert('Error provisioning station: ' + data.detail);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while provisioning station.');
    }
  }

  async function handlePriceUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (targetScope === 'specific' && selectedTargetStations.length === 0) {
      alert("Please select at least one station before deploying.");
      return;
    }

    try {
      const payload = {
        fuel_grade: targetFuel,
        new_price: parseFloat(newPrice),
        target_scope: targetScope,
        target_stations: selectedTargetStations
      };

      const res = await fetch('/api/prices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || '' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert(`Price updated to GHS ${newPrice} for ${targetScope === 'global' ? 'all stations' : selectedTargetStations.length + ' stations'}.`);
        setNewPrice('');
        fetchDashboardData();
      } else {
        alert('Failed to update prices: ' + data.detail);
      }
    } catch (err) {
      console.error(err);
      alert('Network error during price update.');
    }
  }

  // --- DYNAMIC DATA FILTERING & CALCS ---
  const filteredStations = selectedStation === 'all' 
    ? stations 
    : stations.filter(s => s.id === selectedStation);

  const filteredWaybills = selectedStation === 'all'
    ? waybills
    : waybills.filter(w => w.station_id === selectedStation);

  const totals = useMemo(() => {
    return filteredStations.reduce((acc, station) => {
      acc.unbanked += (parseFloat(station.unbanked_cash_balance) || 0);
      acc.deadstock += (parseFloat(station.deadstock_limit) || 0);
      if ((parseFloat(station.unbanked_cash_balance) || 0) > 50000) acc.riskCount += 1;
      return acc;
    }, { unbanked: 0, deadstock: 0, riskCount: 0 });
  }, [filteredStations]);

  // --- DISPENSER LOGIC ---
  const handlePumpCountChange = (val: string) => {
    const count = parseInt(val) || 1;
    setPumpCount(count);
    
    setDispensers(prev => {
      const newDispensers = [...prev];
      if (count > prev.length) {
        for (let i = prev.length; i < count; i++) {
          newDispensers.push({ 
            id: i + 1, type: 'Twin', 
            n1Fuel: 'Super', n1Label: `Super ${i+1}`, 
            n2Fuel: 'Diesel', n2Label: `Diesel ${i+1}` 
          });
        }
      } else if (count < prev.length) {
        newDispensers.length = count;
      }
      return newDispensers;
    });
  };

  const updateDispenser = (index: number, field: string, value: string) => {
    const newDisps = [...dispensers];
    newDisps[index][field] = value;
    setDispensers(newDisps);
  };

  async function resolveReorder(id: string) {
    await supabase.table('reorder_requests').update({ status: 'Resolved' }).eq('id', id).execute();
    fetchDashboardData();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
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
              {stations.map(s => (
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

      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        
        {/* TAB 1: OVERVIEW & VARIANCES */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* LIVE REORDER ALERTS */}
            {reorders.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl animate-in fade-in slide-in-from-top-4">
                <h3 className="text-rose-400 font-bold flex items-center gap-2 mb-3">
                  <Bell className="w-5 h-5 animate-pulse" /> Urgent Low-Stock Alerts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reorders.map(alert => (
                    <div key={alert.id} className="bg-slate-900/50 p-4 rounded-xl border border-rose-500/20 flex justify-between items-center">
                      <div>
                        <p className="text-white font-semibold">{alert.stations?.name || 'Unknown Station'}</p>
                        <p className="text-slate-400 text-sm">Requested: <span className="text-rose-400 font-medium">{alert.requested_product}</span></p>
                        <p className="text-slate-500 text-xs mt-1">Note: "{alert.manager_notes}"</p>
                      </div>
                      <button onClick={() => resolveReorder(alert.id)} className="bg-rose-500 hover:bg-rose-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                        Mark Resolved
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unbanked Cash Exposure</p>
                <p className="text-3xl font-extrabold text-amber-400 mt-2">GHS {totals.unbanked.toLocaleString()}</p>
                <div className="mt-2 text-xs text-slate-400">Total physical cash pending bank deposit</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Deliveries (FIFO)</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-2">{filteredWaybills.length}</p>
                <div className="mt-2 text-xs text-slate-400">Trucks mapped in perpetual tracker</div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg transition-all">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">High Risk Branches</p>
                <p className={`text-3xl font-extrabold mt-2 ${totals.riskCount > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                  {totals.riskCount} {totals.riskCount === 1 ? 'Station' : 'Stations'}
                </p>
                <div className="mt-2 text-xs text-rose-400 font-medium">{totals.riskCount > 0 ? 'Unbanked > 50K GHS' : 'All Clear'}</div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" /> 
                  {selectedStation === 'all' ? 'Live Station Health & Recon Grid' : 'Branch Health Overview'}
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
                      <th className="pb-3 font-semibold">Locked Price</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Unbanked Cash</th>
                      <th className="pb-3 font-semibold">Deadstock Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {filteredStations.map((station) => (
                      <tr 
                        key={station.id} 
                        onClick={() => setSelectedStation(station.id)}
                        className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 font-medium text-white group-hover:text-emerald-400 transition-colors">{station.name}</td>
                        <td className="py-4 text-slate-300">GHS {(parseFloat(station.current_price)||0).toFixed(2)}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${station.status === 'PROVISIONED' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {station.status}
                          </span>
                        </td>
                        <td className="py-4 font-semibold text-amber-400">GHS {(parseFloat(station.unbanked_cash_balance)||0).toLocaleString()}</td>
                        <td className="py-4 text-slate-300">{(parseFloat(station.deadstock_limit)||0).toLocaleString()} L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredWaybills.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" /> Perpetual Load Lifecycle Tracker
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Tracks overlapping FIFO deliveries, deadstock triggers, and remote WhatsApp OCR scans.</p>
                  </div>
                  
                  <button 
                    onClick={() => alert("Scan request ping sent! The Manager will receive a WhatsApp prompt to snap the new waybill.")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" /> Request Mobile Scan (WhatsApp)
                  </button>
                </div>

                {filteredWaybills.map((waybill) => (
                  <div key={waybill.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-slate-800/60 px-6 py-5 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider mr-3 ${waybill.status === 'Active' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                          {waybill.status.toUpperCase()}
                        </span>
                        <span className="text-white font-semibold text-lg">{waybill.stations?.name || 'Waybill Entry'}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Date</p>
                          <p className="text-white font-medium">{waybill.delivery_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Driver Name</p>
                          <p className="text-white font-medium">{waybill.driver_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Car No.</p>
                          <p className="text-white font-medium">{waybill.truck_reg}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Fuel / Amount</p>
                          <p className="text-emerald-400 font-bold">{parseFloat(waybill.volume).toLocaleString()} L <span className="text-slate-300 font-normal">({waybill.fuel_type})</span></p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Inventory Depletion (FIFO)</h4>
                      
                      <div className="flex justify-between text-sm mb-1 items-center">
                        <span className="text-slate-300">Total Received: <span className="text-white font-bold">{parseFloat(waybill.volume).toLocaleString()} L</span></span>
                        
                        {parseFloat(waybill.remaining_volume) <= 0 ? (
                          <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3"/> Deadstock Reached
                          </span>
                        ) : (
                          <span className="text-blue-400 font-bold">{parseFloat(waybill.remaining_volume).toLocaleString()} L Remaining</span>
                        )}
                      </div>
                      
                      <div className="w-full bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
                        <div className={`h-3 rounded-full transition-all duration-1000 ${parseFloat(waybill.remaining_volume) <= 0 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${((parseFloat(waybill.volume) - parseFloat(waybill.remaining_volume)) / parseFloat(waybill.volume)) * 100}%` }}></div>
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
            <p className="text-slate-400 text-sm mb-6">
              Update pump prices globally or target specific stations. Manager shift calculations are strictly locked to these rates to prevent margin manipulation.
            </p>

            <form onSubmit={handlePriceUpdate} className="space-y-5">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">New Price per Liter (GHS)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-medium">GHS</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    required
                    placeholder="e.g., 15.50"
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
                    {stations.map((station) => (
                      <label key={station.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={selectedTargetStations.includes(station.station_number)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargetStations([...selectedTargetStations, station.station_number]);
                            } else {
                              setSelectedTargetStations(selectedTargetStations.filter(num => num !== station.station_number));
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
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
              >
                Deploy Price Update to Stations 🚀
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: ADMIN ONBOARDING PORTAL (WITH DISPENSER CONFIGURATION) */}
        {activeTab === 'onboarding' && (
          <div className="max-w-4xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" /> Automated Station Provisioning Portal
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Instantly provision a new filling station, map dispenser topologies, calibrate deadstock thresholds, and link manager WhatsApp numbers.
            </p>

            <form onSubmit={handleProvisionStation} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Station Name & Location</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., Alinco Oil - Tema Harbour Terminal"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Station Number / ID</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., AL-4099"
                    value={stationNumber}
                    onChange={(e) => setStationNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Manager WhatsApp Phone Number</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., +233241234567"
                    value={managerPhone}
                    onChange={(e) => setManagerPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Base Deadstock (Liters)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required
                      placeholder="e.g., 1500"
                      value={deadstockLimit}
                      onChange={(e) => setDeadstockLimit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-emerald-400"
                    />
                    <span className="absolute right-4 top-3.5 text-slate-400 font-medium text-sm">L</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Dispenser & Nozzle Topology</h4>
                    <p className="text-xs text-slate-400 mt-1">Configure physical hardware layout for accurate AI tank depletion tracking.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Total Usable Dispensers:</label>
                    <input 
                      type="number" 
                      min="1"
                      value={pumpCount}
                      onChange={(e) => handlePumpCountChange(e.target.value)}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {dispensers.map((disp, index) => (
                    <div key={disp.id} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 shadow-inner">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-3">
                        <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                          <Database className="w-4 h-4" /> Physical Dispenser {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 uppercase font-semibold">Hardware Type:</span>
                          <select 
                            value={disp.type} 
                            onChange={(e) => updateDispenser(index, 'type', e.target.value)} 
                            className="bg-slate-900 border border-slate-600 rounded-md text-xs text-white px-3 py-1.5 focus:outline-none focus:border-emerald-400"
                          >
                            <option value="Single">Single Pump (1 Nozzle)</option>
                            <option value="Twin">Twin Pump (2 Nozzles)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nozzle 1 Configuration</label>
                          <div className="flex gap-2">
                            <select 
                              value={disp.n1Fuel} 
                              onChange={(e) => updateDispenser(index, 'n1Fuel', e.target.value)} 
                              className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-1/3"
                            >
                              <option value="Super">Super</option>
                              <option value="Diesel">Diesel</option>
                            </select>
                            <input 
                              type="text"
                              value={disp.n1Label} 
                              onChange={(e) => updateDispenser(index, 'n1Label', e.target.value)} 
                              className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-2/3" 
                              placeholder="System Label (e.g., Super 1)" 
                            />
                          </div>
                        </div>

                        {disp.type === 'Twin' && (
                          <div className="space-y-2 animate-in fade-in">
                            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nozzle 2 Configuration</label>
                            <div className="flex gap-2">
                              <select 
                                value={disp.n2Fuel} 
                                onChange={(e) => updateDispenser(index, 'n2Fuel', e.target.value)} 
                                className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-1/3"
                              >
                                <option value="Super">Super</option>
                                <option value="Diesel">Diesel</option>
                              </select>
                              <input 
                                type="text"
                                value={disp.n2Label} 
                                onChange={(e) => updateDispenser(index, 'n2Label', e.target.value)} 
                                className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-3 py-2 focus:outline-none w-2/3" 
                                placeholder="System Label (e.g., Diesel 1)" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 mt-6"
              >
                Provision Station Database & Hardware Map ⚡
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
