import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function InvitePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<'loading' | 'invalid' | 'signup' | 'signin' | 'linking' | 'done'>('loading');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStage('invalid');
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    const { data: employee } = await supabase
      .from('employees')
      .select('id, name, email, status, employee_user_id')
      .eq('invite_token', token)
      .maybeSingle();

    if (!employee) {
      setStage('invalid');
      return;
    }

    setEmployeeName(employee.name);
    setEmployeeEmail(employee.email);
    setEmployeeId(employee.id);

    // If already linked, just redirect to sign in
    if (employee.employee_user_id) {
      setStage('signin');
    } else {
      setStage('signup');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: employeeEmail,
      password,
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? 'Sign up failed. Please try again.');
      return;
    }

    await linkEmployee(data.user.id);
  };

  const handleSignIn = async () => {
    setError(null);
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: employeeEmail,
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message ?? 'Sign in failed.');
      return;
    }

    await linkEmployee(data.user.id);
  };

  const linkEmployee = async (userId: string) => {
    setStage('linking');

    // Get the owner's user_id from the employee record
    const { data: emp } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employeeId)
      .maybeSingle();

    // Update employee record to link this auth user
    await supabase
      .from('employees')
      .update({ employee_user_id: userId, status: 'active' })
      .eq('id', employeeId);

    // Insert or update user_roles for this employee
    await supabase.from('user_roles').upsert({
      user_id: userId,
      role: 'employee',
      owner_id: emp?.user_id ?? null,
    });

    setLoading(false);
    setStage('done');

    // Navigate to main app after a short delay
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/tradepro_emblem.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>TradeFlow</Text>
        </View>

        {stage === 'loading' && (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Validating invitation...</Text>
          </View>
        )}

        {stage === 'invalid' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invalid Invitation</Text>
            <Text style={styles.cardBody}>
              This invitation link is invalid or has already been used. Please ask your employer to resend the invite.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/login')}>
              <Text style={styles.primaryButtonText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {(stage === 'signup' || stage === 'signin') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {stage === 'signup' ? 'Create Your Account' : 'Sign In to Accept'}
            </Text>
            <Text style={styles.cardBody}>
              {stage === 'signup'
                ? `Welcome, ${employeeName}! Create a password to get started.`
                : `Welcome back, ${employeeName}. Sign in to link your account.`}
            </Text>

            <View style={styles.emailRow}>
              <Text style={styles.emailLabel}>Email</Text>
              <Text style={styles.emailValue}>{employeeEmail}</Text>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {stage === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={stage === 'signup' ? handleSignUp : handleSignIn}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {stage === 'signup' ? 'Create Account & Accept' : 'Sign In & Accept'}
                </Text>
              )}
            </TouchableOpacity>

            {stage === 'signup' && (
              <TouchableOpacity onPress={() => setStage('signin')} style={styles.switchLink}>
                <Text style={styles.switchLinkText}>Already have an account? Sign in instead</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {stage === 'linking' && (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Linking your account...</Text>
          </View>
        )}

        {stage === 'done' && (
          <View style={styles.card}>
            <Text style={styles.doneTitle}>All set!</Text>
            <Text style={styles.cardBody}>Your account has been linked. Redirecting you to the app...</Text>
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
  scroll: {
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
    width: 64,
    height: 64,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  centred: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  cardBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  emailRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 2,
  },
  emailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
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
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLinkText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
  },
});
