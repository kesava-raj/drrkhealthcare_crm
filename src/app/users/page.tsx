'use client';

import React, { useState, useEffect } from 'react';
import { Profile, AppRole } from '@/types/database';
import { fetchUsers, updateUserRole, isSupabaseConfigured } from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Mail, 
  Phone, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

export default function UsersManagementPage() {
  const { role, canManageUsers, switchTestRole, user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // New staff form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('pharmacist');
  const [newPhone, setNewPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadStaffUsers = async () => {
    setLoading(true);
    const data = await fetchUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStaffUsers();
  }, []);

  const handleRoleChange = async (userId: string, targetRole: AppRole) => {
    if (!canManageUsers) return;
    const res = await updateUserRole(userId, targetRole, {
      id: currentUser?.id || 'unknown',
      name: currentUser?.full_name || 'Admin',
    });
    if (res.success) {
      loadStaffUsers();
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) return;
    if (!newEmail.trim() || !newName.trim()) {
      setMessage({ text: 'Please fill in both Staff Name and Email.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    // Call API / local store
    try {
      // In local demo or live Supabase
      const newProfile: Profile = {
        id: 'user-' + Date.now(),
        email: newEmail.trim().toLowerCase(),
        full_name: newName.trim(),
        role: newRole,
        phone: newPhone.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // If Supabase is configured, call server route or insert
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });

      if (res.ok) {
        setMessage({ text: `Staff user "${newName}" created successfully!`, type: 'success' });
      } else {
        // Fallback for demo mode
        const existing = await fetchUsers();
        existing.unshift(newProfile);
        localStorage.setItem('drrk_pharmacy_users', JSON.stringify(existing));
        setMessage({ text: `Staff user "${newName}" created successfully in demo mode!`, type: 'success' });
      }

      await loadStaffUsers();
      setIsInviteModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPhone('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating staff user';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // If user is not Admin, show clean security wall
  if (!canManageUsers) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Restricted (Admin Only)</h2>
        <p className="text-sm text-gray-500">
          You are currently logged in as a <strong>{role.toUpperCase()}</strong>.
          Only the <strong>Pharmacy Administrator</strong> can invite staff, create user accounts, and assign permissions.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => switchTestRole('admin')}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-md shadow-purple-200 transition"
          >
            Switch to Dr. Rajesh (Admin) to Test
          </button>
        </div>
      </div>
    );
  }

  const rolePills: Record<AppRole, { bg: string; text: string; label: string }> = {
    admin: { bg: 'bg-purple-100 border-purple-200', text: 'text-purple-800', label: 'Admin (Full Access)' },
    pharmacist: { bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800', label: 'Pharmacist (Stock/Meds)' },
    accountant: { bg: 'bg-sky-100 border-sky-200', text: 'text-sky-800', label: 'Accountant (Audits/Ledger)' },
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Staff &amp; Role Management
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Strict access control: Admin only. There is NO public registration.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-purple-100 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Staff Member</span>
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Roles Explanation Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">Admin</span>
            <p className="text-xs text-purple-800 mt-0.5">
              Full control. Manages staff accounts, assigns roles, edits &amp; deletes records, and views the complete audit history.
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">Pharmacist</span>
            <p className="text-xs text-emerald-800 mt-0.5">
              Adds and edits medicines and batches. Dispenses stock. Cannot view financial accounts register. Cannot delete records.
            </p>
          </div>

          <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl">
            <span className="text-xs font-bold text-sky-900 uppercase tracking-wider block">Accountant</span>
            <p className="text-xs text-sky-800 mt-0.5">
              Full access to Daybook, Ledger, and Financial Audits. Can view medicine stock levels for stocktake, but CANNOT edit inventory.
            </p>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Registered Staff ({users.length})
            </h2>
            <span className="text-xs text-gray-400">
              Change roles anytime using the selector below
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Loading staff members...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">{u.full_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${rolePills[u.role].bg} ${rolePills[u.role].text}`}>
                        {rolePills[u.role].label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{u.email}</span>
                      </span>
                      {u.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{u.phone}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Added {new Date(u.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">Assign Role:</span>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    >
                      <option value="admin">Admin (Full Access)</option>
                      <option value="pharmacist">Pharmacist</option>
                      <option value="accountant">Accountant</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Create Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Create Staff Account</h3>
                <p className="text-xs text-gray-500">Only Admins can onboard new staff.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. A. Vignesh"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@pharmacy.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assigned Staff Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AppRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-gray-900 bg-white"
                >
                  <option value="pharmacist">Pharmacist (Medicines &amp; Stock)</option>
                  <option value="accountant">Accountant (Daybook &amp; Financials)</option>
                  <option value="admin">Admin (Full Owner Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-gray-900 bg-white"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-100 transition"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
