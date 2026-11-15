'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppRole } from '@/types/database';
import { 
  Pill, 
  Users, 
  History, 
  BookOpen, 
  Menu, 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  ShoppingCart
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, switchTestRole, canManageUsers, canViewAudit, canViewAccounts, isConfigured } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const roleColors: Record<AppRole, { bg: string; text: string; label: string }> = {
    admin: { bg: 'bg-purple-100 text-purple-800 border-purple-200', text: 'text-purple-700', label: 'Admin (Full Access)' },
    pharmacist: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-700', label: 'Pharmacist (Stock/Meds)' },
    accountant: { bg: 'bg-sky-100 text-sky-800 border-sky-200', text: 'text-sky-700', label: 'Accountant (Audits/Ledger)' },
  };

  const navLinks = [
    {
      label: 'Inventory',
      href: '/',
      icon: Pill,
      show: true,
    },
    {
      label: 'POS Billing',
      href: '/billing',
      icon: ShoppingCart,
      show: true,
    },
    {
      label: 'Users & Staff',
      href: '/users',
      icon: Users,
      show: canManageUsers,
    },
    {
      label: 'Audit Log',
      href: '/audit',
      icon: History,
      show: canViewAudit,
    },
    {
      label: 'Accounts Register',
      href: '/accounts',
      icon: BookOpen,
      show: canViewAccounts,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Pharmacy Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-100 group-hover:bg-teal-700 transition">
                <Pill className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-tight">
                  DRRK Healthcare
                </h1>
                <p className="text-xs text-gray-500 font-medium">Pharmacy Inventory & Management</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              if (!item.show) return null;
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                  {item.tag && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 ml-1">
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Connection Status & Role Switcher */}
          <div className="hidden sm:flex items-center gap-3">
            
            {/* Supabase Connection Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={isConfigured ? 'Connected to live Supabase backend' : 'Using local demo data. Connect Supabase to go live.'}
            >
              {isConfigured ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Live Supabase</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Offline Demo Mode</span>
                </>
              )}
            </div>

            {/* Test Role Switcher Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition hover:opacity-90 ${roleColors[role].bg}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="truncate max-w-[130px]">{user?.full_name || role}</span>
                <span className="bg-white/70 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                  {role}
                </span>
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Switch Role (Testing)
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Instantly test permissions for each staff member:
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      switchTestRole('admin');
                      setRoleSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 ${
                      role === 'admin' ? 'bg-purple-50 font-bold text-purple-900' : 'text-gray-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">Dr. Rajesh (Admin)</p>
                      <p className="text-[11px] text-gray-500">Can add, edit, delete & manage users</p>
                    </div>
                    {role === 'admin' && <UserCheck className="w-4 h-4 text-purple-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchTestRole('pharmacist');
                      setRoleSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 ${
                      role === 'pharmacist' ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-gray-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">S. Priya (Pharmacist)</p>
                      <p className="text-[11px] text-gray-500">Can add/edit medicines. Cannot delete.</p>
                    </div>
                    {role === 'pharmacist' && <UserCheck className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchTestRole('accountant');
                      setRoleSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 ${
                      role === 'accountant' ? 'bg-sky-50 font-bold text-sky-900' : 'text-gray-700'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">M. Venkatesh (Accountant)</p>
                      <p className="text-[11px] text-gray-500">Can view stock only. Cannot edit inventory.</p>
                    </div>
                    {role === 'accountant' && <UserCheck className="w-4 h-4 text-sky-600" />}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-4 space-y-2 shadow-lg">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-xs text-gray-500">Current Role:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${roleColors[role].bg}`}>
              {role.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2">
            {(['admin', 'pharmacist', 'accountant'] as AppRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  switchTestRole(r);
                  setMobileMenuOpen(false);
                }}
                className={`px-2 py-1.5 rounded text-xs font-medium border text-center capitalize ${
                  role === r ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-2">
            {navLinks.map((item) => {
              if (!item.show) return null;
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                    isActive ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 text-gray-400" />
                  <span>{item.label}</span>
                  {item.tag && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 ml-auto">
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
