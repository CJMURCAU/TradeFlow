import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { RoleProvider } from '@/lib/roleContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type SessionState = 'loading' | 'authenticated' | 'unauthenticated';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [sessionState, setSessionState] = useState<SessionState>('loading');

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

  const checkSession = async () => {
    // If the session lookup throws (e.g. transient network/storage error) fall
    // back to unauthenticated instead of leaving the app stuck on a blank
    // loading screen forever. Surfaced by the web smoke test.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionState(session ? 'authenticated' : 'unauthenticated');
    } catch {
      setSessionState('unauthenticated');
    }
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RoleProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="light" />
        </RoleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
