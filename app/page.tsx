export default function ExecutiveDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">🚀 FluidFlow AI</h1>
          <p className="text-slate-400 text-sm mt-1">Executive Fuel Station Analytics & Anomaly Dashboard</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium">
          System Status: Live
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium">Total Volume Sold Today</h3>
          <p className="text-3xl font-bold mt-2">14,250 <span className="text-lg font-normal text-slate-400">Liters</span></p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium">Expected Cash Revenue</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-400">GHS 185,250</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium">Fuel Variance Alert</h3>
          <p className="text-3xl font-bold mt-2 text-rose-500">-120 <span className="text-lg font-normal text-slate-400">L (Flagged)</span></p>
        </div>
      </main>
    </div>
  );
}
