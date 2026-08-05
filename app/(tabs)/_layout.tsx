import { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Calendar, LayoutDashboard, Users, Briefcase, Building2, UsersRound, MessageCircle } from 'lucide-react-native';
import { useRole } from '@/lib/roleContext';
import { MESSAGES_OWNER_USER_ID } from '@/lib/constants';

const EMPLOYEE_RESTRICTED = ['index', 'dashboard', 'clients', 'business', 'team'];

export default function TabLayout() {
  const { role, loading, ownerUserId } = useRole();
  const router = useRouter();
  const segments = useSegments();

  const isEmployee = role === 'employee';
  const isMessagesOwner = ownerUserId === MESSAGES_OWNER_USER_ID;

  useEffect(() => {
    if (loading || !role) return;
    const currentTab = segments[segments.length - 1];
    if (isEmployee && EMPLOYEE_RESTRICTED.includes(currentTab)) {
      router.replace('/(tabs)/jobs');
      return;
    }
    if (currentTab === 'messages' && !isMessagesOwner) {
      router.replace('/(tabs)/');
    }
  }, [role, loading, segments, isMessagesOwner]);

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
        name="messages"
        options={{
          title: 'Messages',
          href: (isEmployee || !isMessagesOwner) ? null : undefined,
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
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
