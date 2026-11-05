'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, AppRole } from '@/types/database';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './data-service';
import { INITIAL_TEST_PROFILES } from './mockData';

interface AuthContextType {
  user: Profile | null;
  role: AppRole;
  isLoading: boolean;
  isConfigured: boolean;
  canEditInventory: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canViewAudit: boolean;
  canViewAccounts: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  switchTestRole: (role: AppRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_ROLE_STORAGE_KEY = 'drrk_current_test_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>('admin'); // Default to Admin for first-time owner testing
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (configured) {
      const supabase = createClient();
      if (supabase) {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            // Fetch profile
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
              .then(({ data, error }) => {
                if (data && !error) {
                  setUser(data);
                  setRole(data.role);
                } else {
                  // Fallback to meta role
                  const fallbackRole = (session.user.user_metadata?.role as AppRole) || 'pharmacist';
                  setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    full_name: session.user.user_metadata?.full_name || 'Staff Member',
                    role: fallbackRole,
                    is_active: true,
                    created_at: session.user.created_at,
                    updated_at: session.user.created_at,
                  });
                  setRole(fallbackRole);
                }
                setIsLoading(false);
              });
          } else {
            // No active session in Supabase, load test user default
            loadLocalTestUser();
          }
        });

        // Listen for auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            loadLocalTestUser();
          } else if (session?.user) {
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setUser(data);
                  setRole(data.role);
                }
              });
          }
        });

        return () => {
          authListener?.subscription.unsubscribe();
        };
      }
    }

    // Offline / Demo mode
    loadLocalTestUser();
  }, []);

  function loadLocalTestUser() {
    const savedRole = (typeof window !== 'undefined' ? localStorage.getItem(CURRENT_ROLE_STORAGE_KEY) : null) as AppRole | null;
    const initialRole: AppRole = savedRole && ['admin', 'pharmacist', 'accountant'].includes(savedRole) ? savedRole : 'admin';
    const profile = INITIAL_TEST_PROFILES.find((p) => p.role === initialRole) || INITIAL_TEST_PROFILES[0];
    setUser(profile);
    setRole(initialRole);
    setIsLoading(false);
  }

  const switchTestRole = (newRole: AppRole) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, newRole);
    }
    const profile = INITIAL_TEST_PROFILES.find((p) => p.role === newRole) || INITIAL_TEST_PROFILES[0];
    setUser(profile);
    setRole(newRole);
  };

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const configured = isSupabaseConfigured();

    if (configured && password) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            setUser(profile);
            setRole(profile.role);
          }
          setIsLoading(false);
          return { success: true };
        }
      }
    }

    // Match in test users
    const matchedProfile = INITIAL_TEST_PROFILES.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (matchedProfile) {
      switchTestRole(matchedProfile.role);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, error: 'User not found. Please check your credentials or pick one of the 3 test roles.' };
  };

  const logout = async () => {
    const configured = isSupabaseConfigured();
    if (configured) {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    switchTestRole('pharmacist');
  };

  // Role permissions
  const canEditInventory = role === 'admin' || role === 'pharmacist';
  const canDelete = role === 'admin';
  const canManageUsers = role === 'admin';
  const canViewAudit = role === 'admin' || role === 'accountant';
  const canViewAccounts = role === 'admin' || role === 'accountant';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        isConfigured,
        canEditInventory,
        canDelete,
        canManageUsers,
        canViewAudit,
        canViewAccounts,
        login,
        switchTestRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
