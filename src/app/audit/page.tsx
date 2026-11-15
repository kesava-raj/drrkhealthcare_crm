'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry, StockMovement } from '@/types/database';
import { fetchAuditLogs, fetchStockMovements } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import { 
  History, 
  Lock, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  User, 
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Package,
  Layers,
  Filter
} from 'lucide-react';

export default function AuditLogPage() {
  const { canViewAudit, role, switchTestRole } = useAuth();
  
  // Tab state: 'system' for database changes, 'movements' for Stock In/Out movements
  const [activeTab, setActiveTab] = useState<'system' | 'movements'>('movements');

  // System audit logs
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stock movements audit
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementFilterType, setMovementFilterType] = useState('ALL');

  const loadAll = async () => {
    setLoadingLogs(true);
    setLoadingMovements(true);

    const [auditData, movementsData] = await Promise.all([
      fetchAuditLogs(),
      fetchStockMovements(),
    ]);

    setLogs(auditData);
    setLoadingLogs(false);

    setMovements(movementsData.movements);
    setLoadingMovements(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const q = movementSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (m.medicine_name && m.medicine_name.toLowerCase().includes(q)) ||
        (m.batch_number && m.batch_number.toLowerCase().includes(q)) ||
        (m.reason && m.reason.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (movementFilterType !== 'ALL' && m.movement_type !== movementFilterType) {
        return false;
      }

      return true;
    });
  }, [movements, movementSearch, movementFilterType]);

  // Movement metrics
  const movementStats = useMemo(() => {
    let inQty = 0;
    let outQty = 0;
    movements.forEach((m) => {
      if (m.quantity_change > 0) inQty += m.quantity_change;
      else outQty += Math.abs(m.quantity_change);
    });
    return { inQty, outQty, count: movements.length };
  }, [movements]);

  if (!canViewAudit) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
        <p className="text-sm text-gray-500">
          Audit logs are restricted to <strong>Admin</strong> and <strong>Accountant</strong>. Pharmacists do not have audit viewing permissions.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => switchTestRole('admin')}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-md shadow-purple-200 transition"
          >
            Switch to Admin to View Audit Trail
          </button>
        </div>
      </div>
    );
  }

  const actionBadges: Record<string, { bg: string; text: string }> = {
    INSERT: { bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800' },
    UPDATE: { bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800' },
    SOFT_DELETE: { bg: 'bg-rose-100 border-rose-200', text: 'text-rose-800' },
    DELETE: { bg: 'bg-red-100 border-red-200', text: 'text-red-800' },
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-teal-600" />
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                System Audit &amp; Stock Movements
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Immutable ledger: Track every physical stock movement (In/Out) and system modification.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs || loadingMovements ? 'animate-spin text-teal-600' : ''}`} />
            <span>Refresh Audit Feed</span>
          </button>
        </div>

        {/* Tab Switcher: Stock Movements vs Database Mutations */}
        <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'movements'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-100'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stock In / Out Movement Audit</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'movements' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {movements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'system'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-100'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Database Mutations (Insert/Update/Delete)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'system' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {logs.length}
            </span>
          </button>
        </div>

        {/* TAB A: STOCK MOVEMENTS AUDIT */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  <span>Total Stock In (Received)</span>
                </span>
                <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                  +{movementStats.inQty} <span className="text-xs font-normal">packs</span>
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Purchases &amp; opening arrivals</p>
              </div>

              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  <span>Total Stock Out (Dispensed)</span>
                </span>
                <p className="text-2xl font-black text-rose-700 mt-1 font-mono">
                  -{movementStats.outQty} <span className="text-xs font-normal">packs</span>
                </p>
                <p className="text-[11px] text-rose-600 mt-0.5">Sales &amp; adjustments</p>
              </div>

              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span>Net Recorded Movements</span>
                </span>
                <p className="text-2xl font-black text-teal-700 mt-1 font-mono">
                  {movementStats.count} <span className="text-xs font-normal">entries</span>
                </p>
                <p className="text-[11px] text-teal-600 mt-0.5">Immutable inventory ledger</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  placeholder="Filter by medicine name, batch number, or reason..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={movementFilterType}
                  onChange={(e) => setMovementFilterType(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-xl font-medium text-gray-700 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="ALL">All Types</option>
                  <option value="initial">Initial Opening Stock</option>
                  <option value="purchase">Supplier Purchase (In)</option>
                  <option value="sale">Sales Dispensing (Out)</option>
                  <option value="adjustment">Stock Adjustment</option>
                  <option value="return">Return (In)</option>
                  <option value="expired_disposal">Expired Disposal (Out)</option>
                </select>
              </div>
            </div>

            {/* Movement Feed Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Live Stock Movements ({filteredMovements.length})
                </h2>
                <span className="text-xs text-gray-400">Recorded chronologically</span>
              </div>

              {loadingMovements ? (
                <div className="p-12 text-center text-xs text-gray-400">Loading stock movements...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400">No stock movements match your search.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredMovements.map((m) => {
                    const isPositive = m.quantity_change > 0;
                    return (
                      <div key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900">{m.medicine_name}</h3>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                              Batch: {m.batch_number}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPositive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPositive ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                              <span className="capitalize">{m.movement_type.replace('_', ' ')}</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-0.5">
                            {m.reason && (
                              <span className="text-gray-700 font-medium">Note: {m.reason}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" />
                              <span>{m.created_by_name || 'Staff Member'}</span>
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(m.created_at).toLocaleString()}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Change</p>
                            <p className={`text-base font-black font-mono ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? `+${m.quantity_change}` : m.quantity_change} <span className="text-xs font-normal">packs</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Balance After</p>
                            <p className="text-base font-bold font-mono text-gray-900">
                              {m.balance_after} <span className="text-xs font-normal text-gray-400">packs</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB B: DATABASE MUTATIONS AUDIT */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center gap-2.5 text-xs text-teal-900">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                <strong>Database Enforced:</strong> The audit table captures before-and-after JSON diffs on every update to medicines, batches, suppliers, and profiles.
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Database Modifications ({logs.length})
                </h2>
                <span className="text-xs text-gray-400">Click entry to inspect before/after diff</span>
              </div>

              {loadingLogs ? (
                <div className="p-12 text-center text-gray-400 text-sm">Loading audit records...</div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">No audit entries recorded yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {logs.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    const badge = actionBadges[entry.action] || { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-800' };

                    return (
                      <div key={entry.id} className="p-4 sm:p-5 hover:bg-gray-50/60 transition">
                        <div
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${badge.bg} ${badge.text}`}>
                                {entry.action}
                              </span>
                              <span className="text-xs font-bold font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                {entry.table_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                ID: <code className="font-mono text-[11px]">{entry.record_id.slice(0, 12)}...</code>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                              <span className="flex items-center gap-1 font-medium text-gray-800">
                                <User className="w-3.5 h-3.5 text-teal-600" />
                                <span>{entry.changed_by_name || 'System'}</span>
                              </span>
                              <span className="flex items-center gap-1 text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{new Date(entry.changed_at).toLocaleString()}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{isExpanded ? 'Hide Diff' : 'View Changes'}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Collapsible JSON Diff Box */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
                            <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100">
                              <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                                Previous State (Before)
                              </p>
                              <pre className="text-[11px] text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap p-2 bg-white rounded border border-rose-200 max-h-48">
                                {entry.old_data ? JSON.stringify(entry.old_data, null, 2) : '(None - New Record)'}
                              </pre>
                            </div>

                            <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                                Updated State (After)
                              </p>
                              <pre className="text-[11px] text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap p-2 bg-white rounded border border-emerald-200 max-h-48">
                                {entry.new_data ? JSON.stringify(entry.new_data, null, 2) : '(None - Deleted)'}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
