import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useRole } from './roleContext';

/**
 * Route-level guard for owner-only screens (audit P-C2).
 *
 * Role gating used to be cosmetic — restricted screens were merely hidden from
 * the tab bar, so an employee could still deep-link to /newjob, /newclient,
 * /client/[id] or /business. This redirects a signed-in non-owner back to their
 * Jobs tab. (Row-Level Security is the real protection for the data; this is the
 * UX/navigation guard on top of it.)
 *
 * Returns true once the current user is confirmed to be an owner.
 */
export function useRequireOwner(): boolean {
  const { role, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role && role !== 'owner') {
      router.replace('/(tabs)/jobs');
    }
  }, [role, loading]);

  return role === 'owner';
}
