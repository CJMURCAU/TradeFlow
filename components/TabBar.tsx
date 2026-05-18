import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Calendar, LayoutDashboard, Users, Briefcase, Building2 } from 'lucide-react-native';
import { useRole } from '@/lib/roleContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OWNER_TABS = [
  { name: 'Calendar', path: '/(tabs)/', icon: Calendar },
  { name: 'Dashboard', path: '/(tabs)/dashboard', icon: LayoutDashboard },
  { name: 'Clients', path: '/(tabs)/clients', icon: Users },
  { name: 'Jobs', path: '/(tabs)/jobs', icon: Briefcase },
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
            activeOpacity={0.7}>
            <Icon size={20} color={active ? '#F59E0B' : '#6B7280'} strokeWidth={active ? 2.5 : 2} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.name}</Text>
          </TouchableOpacity>
        );
      })}
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
});
