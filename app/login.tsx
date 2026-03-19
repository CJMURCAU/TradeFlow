import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { emitGuestSessionCreated } from '@/lib/guestSessionEvents';
import * as SecureStore from 'expo-secure-store';

const GUEST_SESSION_KEY = 'tradeflow_guest_session_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
    setForgotLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setForgotSent(true);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setAuthLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthLoading(false);
    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setAuthLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) {
      setAuthLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      await migrateGuestData(data.user.id);
    }

    setAuthLoading(false);
    router.replace('/(tabs)');
  };

  const migrateGuestData = async (newUserId: string) => {
    let guestSessionId: string | null = null;
    if (Platform.OS !== 'web') {
      guestSessionId = await SecureStore.getItemAsync(GUEST_SESSION_KEY);
    } else {
      guestSessionId = localStorage.getItem(GUEST_SESSION_KEY);
    }
    if (!guestSessionId) return;

    const { data: session } = await supabase
      .from('guest_sessions')
      .select('id')
      .eq('id', guestSessionId)
      .maybeSingle();

    if (!session) return;

    await Promise.all([
      supabase.from('jobs').update({ user_id: newUserId }).eq('guest_session_id', guestSessionId),
      supabase.from('clients').update({ user_id: newUserId }).eq('guest_session_id', guestSessionId),
      supabase.from('guest_sessions').update({ user_id: newUserId }).eq('id', guestSessionId),
    ]);
  };

  const handleGuestTrial = async () => {
    setGuestLoading(true);
    setError(null);

    try {
      let existingId: string | null = null;
      if (Platform.OS !== 'web') {
        existingId = await SecureStore.getItemAsync(GUEST_SESSION_KEY);
      } else {
        existingId = localStorage.getItem(GUEST_SESSION_KEY);
      }

      if (existingId) {
        const { data: existing } = await supabase
          .from('guest_sessions')
          .select('id, expires_at')
          .eq('id', existingId)
          .maybeSingle();

        if (existing) {
          const expires = new Date(existing.expires_at);
          if (expires < new Date()) {
            setGuestLoading(false);
            setTrialExpired(true);
            return;
          }
          emitGuestSessionCreated();
          setGuestLoading(false);
          return;
        }
      }

      const DEVICE_ID_KEY = 'tradeflow_device_id';
      let deviceId: string | null = null;
      if (Platform.OS !== 'web') {
        deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUUID();
          await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
        }
      } else {
        deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUUID();
          localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
      }

      const { data, error: insertError } = await supabase
        .from('guest_sessions')
        .insert({ device_identifier: deviceId })
        .select()
        .single();

      if (insertError || !data) {
        setError('Could not start trial. Please try again.');
        return;
      }

      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(GUEST_SESSION_KEY, data.id);
      } else {
        localStorage.setItem(GUEST_SESSION_KEY, data.id);
      }

      emitGuestSessionCreated();
    } catch {
      setError('Could not start trial. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/tradepro_emblem.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>TradeFlow</Text>
          <Text style={styles.tagline}>Job management for tradespeople</Text>
        </View>

        {trialExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredTitle}>Your 30-day trial has ended</Text>
            <Text style={styles.expiredText}>Create a free account to keep all your data and continue using TradeFlow.</Text>
          </View>
        )}

        <View style={styles.card}>
          {mode !== 'forgot' && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === 'signin' && styles.tabActive]}
                onPress={() => { setMode('signin'); setError(null); }}>
                <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'signup' && styles.tabActive]}
                onPress={() => { setMode('signup'); setError(null); }}>
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {mode === 'forgot' ? (
            <View style={styles.form}>
              <Text style={styles.forgotTitle}>Reset Password</Text>
              {forgotSent ? (
                <>
                  <Text style={styles.forgotSentText}>
                    Check your email for a password reset link.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => { setMode('signin'); setForgotSent(false); setForgotEmail(''); setError(null); }}>
                    <Text style={styles.primaryButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotSubtext}>
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#9CA3AF"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, forgotLoading && styles.buttonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={forgotLoading}>
                    {forgotLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.backLink}
                    onPress={() => { setMode('signin'); setError(null); setForgotEmail(''); }}>
                    <Text style={styles.backLinkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {mode === 'signin' && (
                <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => { setMode('forgot'); setError(null); setForgotEmail(email); }}>
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {mode === 'signin' ? (
                <TouchableOpacity
                  style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  disabled={authLoading}>
                  {authLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
                  onPress={handleSignUp}
                  disabled={authLoading}>
                  {authLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {!trialExpired && (
          <View style={styles.trialSection}>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>
            <TouchableOpacity
              style={[styles.trialButton, guestLoading && styles.buttonDisabled]}
              onPress={handleGuestTrial}
              disabled={guestLoading}>
              {guestLoading ? (
                <ActivityIndicator color="#F59E0B" />
              ) : (
                <>
                  <Text style={styles.trialButtonText}>Use as Guest</Text>
                  <Text style={styles.trialSubtext}>Free 30-day trial - no account needed</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#6B7280',
  },
  expiredBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  expiredTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  expiredText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
  },
  form: {
    padding: 24,
    gap: 12,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  trialSection: {
    marginTop: 28,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  trialButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  trialSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotLinkText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  forgotSubtext: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  forgotSentText: {
    fontSize: 15,
    color: '#059669',
    lineHeight: 22,
    marginBottom: 20,
    fontWeight: '500',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backLinkText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});
