import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { supabase, BusinessDetails } from '@/lib/supabase';
import { Save, Lock, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import TabBar from '@/components/TabBar';

export default function BusinessPage() {
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    tradesman_name: '',
    job_email: '',
    default_hourly_rate: '',
  });

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchBusinessDetails();
  }, []);

  const fetchBusinessDetails = async () => {
    const { data } = await supabase
      .from('business_details')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setBusinessDetails(data);
      setFormData({
        company_name: data.company_name,
        tradesman_name: data.tradesman_name,
        job_email: data.job_email,
        default_hourly_rate: data.default_hourly_rate > 0 ? data.default_hourly_rate.toString() : '',
      });
    }
  };

  const saveBusinessDetails = async () => {
    if (!businessDetails) return;

    const { error } = await supabase
      .from('business_details')
      .update({
        company_name: formData.company_name,
        tradesman_name: formData.tradesman_name,
        job_email: formData.job_email,
        default_hourly_rate: parseFloat(formData.default_hourly_rate) || 0,
      })
      .eq('id', businessDetails.id);

    if (error) {
      Alert.alert('Error', 'Failed to save business details');
    } else {
      Alert.alert('Success', 'Business details saved successfully');
      fetchBusinessDetails();
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in both fields.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    setPasswordLoading(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
      Alert.alert('Success', 'Password updated successfully.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? All your data including jobs, clients, and business details will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This action cannot be undone. Your account and all associated data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: executeDeleteAccount,
        },
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setDeleteLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setDeleteLoading(false);
      Alert.alert('Error', 'Unable to identify your account. Please sign in again.');
      return;
    }

    const userId = user.id;

    const jobsRes = await supabase.from('jobs').select('id').eq('user_id', userId);
    const jobIds = (jobsRes.data || []).map((j: { id: string }) => j.id);

    if (jobIds.length > 0) {
      await supabase.from('parts').delete().in('job_id', jobIds);
      await supabase.from('time_entries').delete().in('job_id', jobIds);
    }

    await supabase.from('jobs').delete().eq('user_id', userId);
    await supabase.from('clients').delete().eq('user_id', userId);
    await supabase.from('business_details').delete().eq('user_id', userId);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      await supabase.auth.signOut();
    } else {
      await supabase.auth.signOut();
    }

    setDeleteLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/tradepro_emblem.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.title}>Business Details</Text>
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Company Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter company name"
            placeholderTextColor="#9CA3AF"
            value={formData.company_name}
            onChangeText={text => setFormData(prev => ({ ...prev, company_name: text }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#9CA3AF"
            value={formData.tradesman_name}
            onChangeText={text => setFormData(prev => ({ ...prev, tradesman_name: text }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Job Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#9CA3AF"
            value={formData.job_email}
            onChangeText={text => setFormData(prev => ({ ...prev, job_email: text }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Default Hourly Rate</Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.inputWithCurrency}
              placeholder=""
              placeholderTextColor="#9CA3AF"
              value={formData.default_hourly_rate}
              onChangeText={text => setFormData(prev => ({ ...prev, default_hourly_rate: text }))}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveBusinessDetails}>
          <Save size={20} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionHeading}>Account Settings</Text>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => {
            setShowChangePassword(!showChangePassword);
            setPasswordError('');
            setPasswordForm({ newPassword: '', confirmPassword: '' });
          }}
        >
          <View style={styles.settingsRowLeft}>
            <View style={styles.settingsIconWrap}>
              <Lock size={18} color="#374151" />
            </View>
            <Text style={styles.settingsRowText}>Change Password</Text>
          </View>
          {showChangePassword ? (
            <ChevronUp size={18} color="#6B7280" />
          ) : (
            <ChevronDown size={18} color="#6B7280" />
          )}
        </TouchableOpacity>

        {showChangePassword && (
          <View style={styles.passwordForm}>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#9CA3AF"
              value={passwordForm.newPassword}
              onChangeText={text => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.passwordFieldGap} />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              value={passwordForm.confirmPassword}
              onChangeText={text => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
              secureTextEntry
              autoCapitalize="none"
            />
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.confirmPasswordButton, passwordLoading && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={passwordLoading}
            >
              <Text style={styles.confirmPasswordButtonText}>
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.settingsRow, styles.deleteRow]}
          onPress={handleDeleteAccount}
          disabled={deleteLoading}
        >
          <View style={styles.settingsRowLeft}>
            <View style={[styles.settingsIconWrap, styles.deleteIconWrap]}>
              <Trash2 size={18} color="#EF4444" />
            </View>
            <Text style={styles.deleteRowText}>
              {deleteLoading ? 'Deleting...' : 'Delete Account'}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: {
    width: 100,
    height: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencySymbol: {
    fontSize: 20,
    color: '#F59E0B',
    fontWeight: 'bold',
    paddingLeft: 16,
  },
  inputWithCurrency: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 36,
    marginBottom: 28,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  passwordForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  passwordFieldGap: {
    height: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 10,
    marginBottom: 4,
  },
  confirmPasswordButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  confirmPasswordButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteRow: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  deleteIconWrap: {
    backgroundColor: '#FEE2E2',
  },
  deleteRowText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
});
