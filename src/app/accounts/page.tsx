'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { BookOpen, Lock, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function AccountsRegisterPreviewPage() {
  const { role, canViewAccounts, switchTestRole } = useAuth();

  if (!canViewAccounts) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Restricted (Pharmacist)</h2>
        <p className="text-sm text-gray-500">
          As a <strong>Pharmacist</strong>, access to the financial Accounts Register, Daybook, and Ledgers is strictly restricted by security policy.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => switchTestRole('accountant')}
            className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 shadow-md shadow-sky-200 transition"
          >
            Switch to M. Venkatesh (Accountant) to Test Access
          </button>
        </div>
      </div>
    );
  }

  const sampleChartOfAccounts = [
    { code: '1001', name: 'Cash in Hand (Counter POS)', type: 'Asset', balance: '₹ 14,250.00' },
    { code: '1002', name: 'Bank Current Account (HDFC Bank)', type: 'Asset', balance: '₹ 2,45,800.00' },
    { code: '1010', name: 'Medicine Inventory Stock (At Cost)', type: 'Asset', balance: '₹ 5,82,410.00' },
    { code: '2001', name: 'Accounts Payable (Drug Wholesalers)', type: 'Liability', balance: '₹ 1,12,300.00' },
    { code: '2010', name: 'GST Output Tax Payable (12% / 5%)', type: 'Liability', balance: '₹ 18,450.00' },
    { code: '4001', name: 'Medicine Sales Revenue', type: 'Revenue', balance: '₹ 4,32,000.00' },
    { code: '5001', name: 'Cost of Goods Sold (Purchases)', type: 'Expense', balance: '₹ 2,90,100.00' },
    { code: '5010', name: 'Expired Stock Write-off Loss', type: 'Expense', balance: '₹ 3,450.00' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Accounts Register &amp; General Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Stage 3 Architecture Ready
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Access authorized for <strong>{role.toUpperCase()}</strong>. The database schema (tables, accounts, journal lines, RLS) is already established in your Supabase backend.
          </p>
        </div>

        {/* Info Card */}
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900 space-y-1">
            <p className="font-bold">Database Tables Already Deployed:</p>
            <p>
              Your database already includes <code className="font-mono font-semibold">ledger_accounts</code>, <code className="font-mono font-semibold">journal_entries</code>, and <code className="font-mono font-semibold">journal_entry_lines</code> tables. Full Daybook transaction entry, double-entry auto-journaling upon sales/purchases, and PDF financial reports will be activated in Stage 3 without any database restructuring.
            </p>
          </div>
        </div>

        {/* Pre-configured Chart of Accounts Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Pre-Configured Pharmacy Chart of Accounts
            </h2>
            <span className="text-xs text-sky-700 font-medium">Standard Pharmacy Setup</span>
          </div>

          <div className="divide-y divide-gray-100">
            {sampleChartOfAccounts.map((acc) => (
              <div key={acc.code} className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                      {acc.code}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">{acc.name}</h3>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{acc.type} Account</span>
                </div>

                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-gray-900">{acc.balance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
