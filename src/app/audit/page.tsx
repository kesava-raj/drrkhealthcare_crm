'use client';

import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '@/types/database';
import { fetchAuditLogs } from '@/lib/data-service';
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
  ChevronUp
} from 'lucide-react';

export default function AuditLogPage() {
  const { canViewAudit, role, switchTestRole } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

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
                System Audit Trail
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Immutable log: Every change to medicines, batches, and prices is recorded automatically. Users cannot modify or delete audit entries.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            <span>Refresh Log</span>
          </button>
        </div>

        {/* Security Banner */}
        <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center gap-2.5 text-xs text-teal-900">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            <strong>Database Enforced:</strong> The audit table is protected by PostgreSQL security policies. It records timestamps, user IDs, and JSON state diffs on every update.
          </span>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Recent Modifications ({logs.length})
            </h2>
            <span className="text-xs text-gray-400">
              Click any entry to view full before/after JSON diff
            </span>
          </div>

          {loading ? (
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
                        {/* Old Data */}
                        <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100">
                          <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span>Previous State (Before)</span>
                          </p>
                          <pre className="text-[11px] text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap p-2 bg-white rounded border border-rose-200 max-h-48">
                            {entry.old_data ? JSON.stringify(entry.old_data, null, 2) : '(None - New Record)'}
                          </pre>
                        </div>

                        {/* New Data */}
                        <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span>Updated State (After)</span>
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

      </main>
    </div>
  );
}
