import { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Calendar, LayoutDashboard, Users, Briefcase, Building2, UsersRound, NotebookPen } from 'lucide-react-native';
import { useRole } from '@/lib/roleContext';

const EMPLOYEE_RESTRICTED = ['index', 'dashboard', 'clients', 'business', 'team'];

export default function TabLayout() {
  const { role, loading } = useRole();
  const router = useRouter();
  const segments = useSegments();

  const isEmployee = role === 'employee';

  useEffect(() => {
    if (loading || !isEmployee) return;
    const currentTab = segments[segments.length - 1];
    if (EMPLOYEE_RESTRICTED.includes(currentTab)) {
      router.replace('/(tabs)/jobs');
    }
  }, [role, loading, segments]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { display: 'none' },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calendar',
          href: isEmployee ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isEmployee ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          href: isEmployee ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ size, color }) => (
            <Briefcase size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ size, color }) => (
            <NotebookPen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          href: isEmployee ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <UsersRound size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: 'Business',
          href: isEmployee ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <Building2 size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
