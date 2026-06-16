import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { supabase } from '@/lib/supabase';
import { RoleProvider } from '@/lib/roleContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initLocalDb } from '@/lib/localDb';
import { seedCacheFromServer, syncOfflineQueue } from '@/lib/syncService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type SessionState = 'loading' | 'authenticated' | 'unauthenticated';

initLocalDb();

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner} pointerEvents="none">
      <Text style={styles.offlineBannerText}>Offline — changes will sync when reconnected</Text>
    </View>
  );
}

function AppRoot() {
  useFrameworkReady();
  const router = useRouter();
  const segments = useSegments();
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const { wasJustReconnected, isOnline } = useNetworkStatus();
  const appState = useRef(AppState.currentState);
  const isSeedingRef = useRef(false);

  const seedCacheInBackground = () => {
    if (isSeedingRef.current) return;
    isSeedingRef.current = true;
    seedCacheFromServer().finally(() => { isSeedingRef.current = false; });
  };

  useEffect(() => {
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session) {
          setSessionState('authenticated');
          if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
            router.replace('/(tabs)');
          }
        } else {
          setSessionState('unauthenticated');
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionState === 'authenticated' && isOnline) {
      seedCacheInBackground();
    }
  }, [sessionState]);

  useEffect(() => {
    if (wasJustReconnected) {
      syncOfflineQueue().catch(() => {});
    }
  }, [wasJustReconnected]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && isOnline) {
        seedCacheInBackground();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [isOnline]);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSessionState(session ? 'authenticated' : 'unauthenticated');
  };

  useEffect(() => {
    if (sessionState === 'loading') return;

    const inAuthGroup = segments[0] === 'login';
    const inAuthCallback = segments[0] === 'auth';
    const inInvite = segments[0] === 'invite';

    if (sessionState === 'unauthenticated' && !inAuthGroup && !inAuthCallback && !inInvite) {
      router.replace('/login');
    } else if (sessionState === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [sessionState, segments]);

  if (sessionState === 'loading') {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RoleProvider>
          <View style={{ flex: 1 }}>
            <AppRoot />
            <OfflineBanner />
          </View>
          <StatusBar style="light" />
        </RoleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  offlineBannerText: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '600',
  },
});
