import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { supabase } from '@/lib/supabase';
import { onGuestSessionCreated } from '@/lib/guestSessionEvents';
import * as SecureStore from 'expo-secure-store';

const GUEST_SESSION_KEY = 'tradeflow_guest_session_id';
const TRIAL_BANNER_DISMISSED_KEY = 'tradeflow_trial_banner_dismissed';

type SessionState = 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    return SecureStore.getItemAsync(key);
  }
  return localStorage.getItem(key);
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

export default function RootLayout() {
  useFrameworkReady();
  const router = useRouter();
  const segments = useSegments();
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
          await checkGuestSession();
        }
      })();
    });

    const unsubscribeGuest = onGuestSessionCreated(() => {
      checkGuestSession();
    });

    return () => {
      authListener.subscription.unsubscribe();
      unsubscribeGuest();
    };
  }, []);

  const checkGuestSession = async () => {
    const guestId = await getStorageItem(GUEST_SESSION_KEY);
    if (!guestId) {
      setSessionState('unauthenticated');
      return;
    }

    const { data } = await supabase
      .from('guest_sessions')
      .select('id, expires_at')
      .eq('id', guestId)
      .maybeSingle();

    if (!data) {
      setSessionState('unauthenticated');
      return;
    }

    const expires = new Date(data.expires_at);
    const now = new Date();
    if (expires < now) {
      setSessionState('unauthenticated');
      return;
    }

    const msLeft = expires.getTime() - now.getTime();
    const remaining = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    setDaysLeft(remaining);
    setSessionState('guest');

    const dismissed = await getStorageItem(TRIAL_BANNER_DISMISSED_KEY);
    if (dismissed === 'true') {
      setBannerDismissed(true);
    }
  };

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSessionState('authenticated');
      return;
    }
    await checkGuestSession();
  };

  useEffect(() => {
    if (sessionState === 'loading') return;

    const inAuthGroup = segments[0] === 'login';
    const inAuthCallback = segments[0] === 'auth';

    if (sessionState === 'unauthenticated' && !inAuthGroup && !inAuthCallback) {
      router.replace('/login');
    } else if ((sessionState === 'authenticated' || sessionState === 'guest') && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [sessionState, segments]);

  const dismissBanner = async () => {
    setBannerDismissed(true);
    await setStorageItem(TRIAL_BANNER_DISMISSED_KEY, 'true');
  };

  const showTrialBanner =
    sessionState === 'guest' &&
    daysLeft !== null &&
    daysLeft <= 3 &&
    !bannerDismissed;

  if (sessionState === 'loading') {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {showTrialBanner && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerText}>
            {daysLeft === 1
              ? 'Your free trial ends tomorrow. Create an account to keep your data.'
              : daysLeft === 2
              ? '2 days left in your free trial. Create an account to keep your data.'
              : '3 days left in your free trial. Sign up now to keep your data.'}
          </Text>
          <TouchableOpacity onPress={dismissBanner} style={styles.trialBannerDismiss}>
            <Text style={styles.trialBannerDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  trialBanner: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#92400E',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  trialBannerText: {
    flex: 1,
    color: '#FEF3C7',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginRight: 12,
  },
  trialBannerDismiss: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  trialBannerDismissText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
