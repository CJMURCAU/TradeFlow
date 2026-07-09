import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase, UserRole, Employee } from './supabase';

type RoleContextValue = {
  role: UserRole | null;
  employeeRecord: Employee | null;
  ownerUserId: string | null;
  loading: boolean;
  refetch: () => void;
};

const RoleContext = createContext<RoleContextValue>({
  role: null,
  employeeRecord: null,
  ownerUserId: null,
  loading: true,
  refetch: () => {},
});

// Store a reason so the login page can show a helpful message after sign-out.
function storeSignOutReason(reason: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem('signout_reason', reason); } catch {}
  }
}

export function readAndClearSignOutReason(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const val = window.localStorage.getItem('signout_reason');
      if (val) window.localStorage.removeItem('signout_reason');
      return val;
    } catch {}
  }
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<Employee | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRole(null);
      setEmployeeRecord(null);
      setOwnerUserId(null);
      setLoading(false);
      return;
    }

    // Check user_roles table
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role, owner_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleRow) {
      setRole(roleRow.role as UserRole);
      if (roleRow.role === 'employee') {
        setOwnerUserId(roleRow.owner_id);
        const { data: emp } = await supabase
          .from('employees')
          .select('*')
          .eq('employee_user_id', user.id)
          .maybeSingle();

        if (!emp) {
          // Employee record was deleted — access has been revoked. Sign out immediately.
          storeSignOutReason('removed');
          setLoading(false);
          await supabase.auth.signOut();
          return;
        }

        setEmployeeRecord(emp);
      } else {
        setOwnerUserId(user.id);
        setEmployeeRecord(null);
      }
    } else {
      // No role row yet — treat as owner and create the row
      await supabase.from('user_roles').upsert({
        user_id: user.id,
        role: 'owner',
        owner_id: user.id,
      });
      setRole('owner');
      setOwnerUserId(user.id);
      setEmployeeRecord(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRole();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchRole();
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
        setEmployeeRecord(null);
        setOwnerUserId(null);
        setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Keep employee record in sync and detect deletion in real time.
  useEffect(() => {
    if (!employeeRecord?.id) return;

    const channel = supabase
      .channel(`employee-record-${employeeRecord.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employees',
          filter: `id=eq.${employeeRecord.id}`,
        },
        (payload) => {
          setEmployeeRecord(payload.new as Employee);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'employees',
          filter: `id=eq.${employeeRecord.id}`,
        },
        () => {
          // Owner has removed this employee — eject them immediately.
          storeSignOutReason('removed');
          supabase.auth.signOut();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeRecord?.id]);

  return (
    <RoleContext.Provider value={{ role, employeeRecord, ownerUserId, loading, refetch: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
