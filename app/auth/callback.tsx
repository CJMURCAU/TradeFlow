import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const redirected = useRef(false);

  const go = (path: string) => {
    if (redirected.current) return;
    redirected.current = true;
    router.replace(path as any);
  };

  useEffect(() => {
    // Listen for the auth event that Supabase fires after processing the URL tokens.
    // PASSWORD_RECOVERY must redirect to the reset form, not the app.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        go('/auth/reset-password');
      } else if (session) {
        go('/(tabs)');
      } else {
        go('/login');
      }
    });

    // Fallback: if the auth event never fires (e.g. token already consumed),
    // check the existing session after a short delay.
    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      go(session ? '/(tabs)' : '/login');
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F59E0B" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
