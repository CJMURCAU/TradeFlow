import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, AppState, AppStateStatus, useWindowDimensions } from 'react-native';
import { MAX_APP_WIDTH } from '@/lib/constants';
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
  const router = useRouter();
  const segments = useSegments();
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const { wasJustReconnected, isOnline } = useNetworkStatus();
  const appState = useRef(AppState.currentState);
  const isSeedingRef = useRef(false);
  const segmentsRef = useRef(segments);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const seedCacheInBackground = () => {
    if (isSeedingRef.current) return;
    isSeedingRef.current = true;
    seedCacheFromServer().finally(() => { isSeedingRef.current = false; });
  };

  useEffect(() => {
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'PASSWORD_RECOVERY') {
          setSessionState('authenticated');
          return;
        }
        if (session) {
          setSessionState('authenticated');
          if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
            const seg = segmentsRef.current;
            const onAuthScreen = seg[0] === 'login' || seg[0] === 'auth' || seg[0] === 'invite' || seg[0] === 'landing';
            if (onAuthScreen) {
              router.replace('/(tabs)');
            }
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
    const onLanding = segments[0] === 'landing';
    const onContact = segments[0] === 'contact';

    if (sessionState === 'unauthenticated' && !inAuthGroup && !inAuthCallback && !inInvite && !onLanding && !onContact) {
      router.replace('/landing');
    } else if (sessionState === 'authenticated' && (inAuthGroup || onLanding)) {
      router.replace('/(tabs)');
    }
  }, [sessionState, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="login" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const { width } = useWindowDimensions();
  const isDesktop = width > MAX_APP_WIDTH;

  return (
    <GestureHandlerRootView style={[styles.root, isDesktop && styles.rootDesktop]}>
      <SafeAreaProvider style={styles.safeArea}>
        <RoleProvider>
          <View style={styles.appShell}>
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
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F3F4F6',
  },
  rootDesktop: {
    alignItems: 'stretch',
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  appShell: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
  },
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
