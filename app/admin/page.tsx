'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Fuel, LogOut, Plus } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  status: string;
  createdAt: string | null;
  stations: number;
  users: number;
}

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', ownerName: '', password: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api('/api/admin/companies', 'GET');
    if (res.ok) setCompanies(res.data.companies ?? []);
    else setMessage({ kind: 'error', text: res.data?.error || 'Could not load companies' });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const res = await api('/api/admin/companies', 'POST', form);
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: 'error', text: res.data?.error || 'Could not create the company' });
      return;
    }
    setMessage({ kind: 'ok', text: `${form.name} was created. Give ${form.email} their password so they can sign in.` });
    setForm({ name: '', email: '', ownerName: '', password: '' });
    load();
  };

  const setStatus = async (c: Company) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    if (next === 'suspended' && !window.confirm(`Suspend ${c.name}? Nobody from this company will be able to sign in.`)) return;
    const res = await api('/api/admin/companies', 'PATCH', { id: c.id, status: next });
    if (!res.ok) setMessage({ kind: 'error', text: res.data?.error || 'Could not update the company' });
    load();
  };

  const logout = async () => {
    await fetch('/api/login', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const input = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-400';
  const label = 'block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/30">
              <Fuel className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">FluidFlow AI: Platform admin</h1>
              <p className="text-slate-400 text-xs">Every oil marketing company (OMC) gets its own private dashboard</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </header>

        {message && (
          <p className={message.kind === 'ok' ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'} role="alert">
            {message.text}
          </p>
        )}

        <form onSubmit={create} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" /> Add an OMC
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="c-name">Company name</label>
              <input id="c-name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor="c-owner">Owner's name (optional)</label>
              <input id="c-owner" className={input} value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor="c-email">Owner's login email</label>
              <input id="c-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor="c-pass">Starting password (8+ characters)</label>
              <input id="c-pass" type="text" autoComplete="off" className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 8}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl"
          >
            {busy ? 'Creating…' : 'Create OMC'}
          </button>
        </form>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <h2 className="font-bold text-white flex items-center gap-2 p-6 pb-3">
            <Building2 className="w-4 h-4 text-emerald-400" /> Companies
          </h2>
          {loading ? (
            <p className="text-slate-400 text-sm p-6 pt-0">Loading…</p>
          ) : companies.length === 0 ? (
            <p className="text-slate-400 text-sm p-6 pt-0">No companies yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {companies.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.stations} station{c.stations === 1 ? '' : 's'} · {c.users} login{c.users === 1 ? '' : 's'} ·{' '}
                      <span className={c.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}>{c.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/?company=${encodeURIComponent(c.id)}`}
                      className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2"
                    >
                      Open dashboard
                    </a>
                    <button onClick={() => setStatus(c)} className="text-sm border border-slate-700 hover:bg-slate-800 rounded-xl px-3 py-2">
                      {c.status === 'active' ? 'Suspend' : 'Re-activate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
