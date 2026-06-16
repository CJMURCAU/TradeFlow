import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Calendar, LayoutDashboard, Users, Briefcase, Building2, LogOut, UsersRound } from 'lucide-react-native';
import { useRole } from '@/lib/roleContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const OWNER_TABS = [
  { name: 'Calendar', path: '/(tabs)/', icon: Calendar },
  { name: 'Dashboard', path: '/(tabs)/dashboard', icon: LayoutDashboard },
  { name: 'Clients', path: '/(tabs)/clients', icon: Users },
  { name: 'Jobs', path: '/(tabs)/jobs', icon: Briefcase },
  { name: 'Team', path: '/(tabs)/team', icon: UsersRound },
  { name: 'Business', path: '/(tabs)/business', icon: Building2 },
];

const EMPLOYEE_TABS = [
  { name: 'Jobs', path: '/(tabs)/jobs', icon: Briefcase },
];

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, loading } = useRole();
  const insets = useSafeAreaInsets();

  const TABS = role === 'employee' ? EMPLOYEE_TABS : OWNER_TABS;

  if (loading) return null;

  const isActive = (path: string) => {
    if (path === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)/';
    return pathname.startsWith(path.replace('/(tabs)', ''));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 8 }]}>
      {TABS.map(tab => {
        const active = isActive(tab.path);
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.name}>
            <Icon size={20} color={active ? '#F59E0B' : '#6B7280'} strokeWidth={active ? 2.5 : 2} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.name}</Text>
          </TouchableOpacity>
        );
      })}
      {role === 'employee' && (
        <TouchableOpacity style={styles.logoutTab} onPress={handleLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Log out">
          <LogOut size={20} color="#EF4444" strokeWidth={2} />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  labelActive: {
    color: '#F59E0B',
  },
  logoutTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  logoutLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
  },
});
