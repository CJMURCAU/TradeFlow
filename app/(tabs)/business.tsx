import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase, BusinessDetails, Employee } from '@/lib/supabase';
import {
  Save,
  Lock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Mail,
  Users,
  Plus,
  Send,
  ToggleLeft,
  ToggleRight,
  UserX,
  Pencil,
  X,
  LogOut,
} from 'lucide-react-native';
import TabBar from '@/components/TabBar';

export default function BusinessPage() {
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    tradesman_name: '',
    job_email: '',
    default_hourly_rate: '',
    job_card_number_start: '1000',
  });

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: '', confirmEmail: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Employee | null>(null);
  const [deleteAccountStep, setDeleteAccountStep] = useState<0 | 1 | 2>(0);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Employees section
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', hourly_rate: '' });
  const [addEmployeeError, setAddEmployeeError] = useState('');
  const [addEmployeeLoading, setAddEmployeeLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', hourly_rate: '' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchBusinessDetails();
    fetchEmployees();
  }, []);

  const fetchBusinessDetails = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('business_details')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setBusinessDetails(data);
      setFormData({
        company_name: data.company_name,
        tradesman_name: data.tradesman_name,
        job_email: data.job_email,
        default_hourly_rate: data.default_hourly_rate > 0 ? data.default_hourly_rate.toString() : '',
        job_card_number_start: (data.job_card_number_start ?? 1000).toString(),
      });
    }
  };

  const fetchEmployees = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setEmployees(data);
  }, []);

  const saveBusinessDetails = async () => {
    setSaveStatus(null);
    const newStartNumber = parseInt(formData.job_card_number_start, 10);
    if (isNaN(newStartNumber) || newStartNumber < 1) {
      setSaveStatus({ type: 'error', message: 'Job card starting number must be a positive whole number.' });
      return;
    }

    setSaveLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveLoading(false); setSaveStatus({ type: 'error', message: 'Not signed in.' }); return; }

    const startNumberChanged = newStartNumber !== (businessDetails?.job_card_number_start ?? 1000);

    const payload = {
      company_name: formData.company_name,
      tradesman_name: formData.tradesman_name,
      job_email: formData.job_email,
      default_hourly_rate: parseFloat(formData.default_hourly_rate) || 0,
      job_card_number_start: newStartNumber,
    };

    let saveError;
    if (businessDetails) {
      const { error } = await supabase.from('business_details').update(payload).eq('user_id', user.id);
      saveError = error;
    } else {
      const { error } = await supabase.from('business_details').insert({ ...payload, user_id: user.id });
      saveError = error;
    }

    if (saveError) {
      setSaveLoading(false);
      setSaveStatus({ type: 'error', message: 'Failed to save business details. Please try again.' });
      return;
    }

    if (startNumberChanged && businessDetails) {
      const { error: renumberError } = await supabase.rpc('renumber_jobs_from', { start_number: newStartNumber });
      if (renumberError) {
        setSaveLoading(false);
        setSaveStatus({ type: 'error', message: 'Settings saved but job cards could not be renumbered.' });
        fetchBusinessDetails();
        return;
      }
    }

    setSaveLoading(false);
    setSaveStatus({ type: 'success', message: 'Business details saved successfully.' });
    fetchBusinessDetails();
  };

  const handleAddEmployee = async () => {
    setAddEmployeeError('');
    const name = newEmployee.name.trim();
    const email = newEmployee.email.trim().toLowerCase();

    if (!name) { setAddEmployeeError('Please enter the employee name.'); return; }
    if (!email) { setAddEmployeeError('Please enter the employee email.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setAddEmployeeError('Please enter a valid email address.'); return; }

    const rateStr = newEmployee.hourly_rate.trim();
    const hourly_rate = rateStr === '' ? null : parseFloat(rateStr);
    if (rateStr !== '' && (isNaN(hourly_rate!) || hourly_rate! < 0)) {
      setAddEmployeeError('Please enter a valid hourly rate.');
      return;
    }

    setAddEmployeeLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddEmployeeLoading(false); return; }

    const { error } = await supabase.from('employees').insert({
      user_id: user.id,
      name,
      email,
      hourly_rate,
      status: 'pending',
    });

    setAddEmployeeLoading(false);

    if (error) {
      setAddEmployeeError('Failed to add employee. Please try again.');
      return;
    }

    setNewEmployee({ name: '', email: '', hourly_rate: '' });
    setShowAddEmployee(false);
    fetchEmployees();
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp.id);
    setEditForm({
      name: emp.name,
      email: emp.email,
      hourly_rate: emp.hourly_rate != null ? emp.hourly_rate.toString() : '',
    });
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setEditForm({ name: '', email: '', hourly_rate: '' });
    setEditError('');
  };

  const handleSaveEmployee = async (emp: Employee) => {
    setEditError('');
    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();

    if (!name) { setEditError('Please enter a name.'); return; }
    if (!email) { setEditError('Please enter an email.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setEditError('Please enter a valid email address.'); return; }

    const rateStr = editForm.hourly_rate.trim();
    const hourly_rate = rateStr === '' ? null : parseFloat(rateStr);
    if (rateStr !== '' && (isNaN(hourly_rate!) || hourly_rate! < 0)) {
      setEditError('Please enter a valid hourly rate.');
      return;
    }

    setEditLoading(true);
    const { error } = await supabase
      .from('employees')
      .update({ name, email, hourly_rate })
      .eq('id', emp.id);
    setEditLoading(false);

    if (error) {
      setEditError('Failed to save changes. Please try again.');
      return;
    }

    handleCancelEdit();
    fetchEmployees();
  };

  const handleSendInvite = async (employee: Employee) => {
    setSendingInvite(employee.id);
    setInviteStatus(null);
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const { data: { session } } = await supabase.auth.getSession();

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-employee-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employee.id,
          appUrl: typeof window !== 'undefined' ? window.location.origin : '',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setInviteStatus({ type: 'error', message: result.error || 'Something went wrong.' });
      } else {
        setInviteStatus({ type: 'success', message: `Invitation emailed to ${result.sentTo}` });
      }
    } catch {
      setInviteStatus({ type: 'error', message: 'Could not connect to email service.' });
    } finally {
      setSendingInvite(null);
    }
  };

  const handleToggleCalendarAccess = async (employee: Employee) => {
    await supabase
      .from('employees')
      .update({ calendar_access: !employee.calendar_access })
      .eq('id', employee.id);
    fetchEmployees();
  };

  const handleRemoveEmployee = (employee: Employee) => {
    setRemoveTarget(employee);
  };

  const confirmRemoveEmployee = async () => {
    if (!removeTarget) return;
    await supabase.from('employees').delete().eq('id', removeTarget.id);
    setRemoveTarget(null);
    fetchEmployees();
  };

  const handleChangeEmail = async () => {
    setEmailError('');
    setEmailSuccess('');

    if (!emailForm.newEmail.trim() || !emailForm.confirmEmail.trim()) {
      setEmailError('Please fill in both fields.');
      return;
    }
    if (emailForm.newEmail.trim() !== emailForm.confirmEmail.trim()) {
      setEmailError('Email addresses do not match.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.newEmail.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: emailForm.newEmail.trim() });
    setEmailLoading(false);

    if (error) {
      setEmailError(error.message);
    } else {
      setEmailForm({ newEmail: '', confirmEmail: '' });
      setEmailSuccess('A confirmation link has been sent to your new email address. Click the link to complete the change.');
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
      setPasswordSuccess('Password updated successfully.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteAccount = () => setDeleteAccountStep(1);

  const executeDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteAccountStep(0);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleteLoading(false); return; }

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
    await supabase.auth.admin.deleteUser(userId);
    await supabase.auth.signOut();
    setDeleteLoading(false);
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#10B981' : '#F59E0B';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Business Details</Text>
        <Image
          source={require('@/assets/images/tradepro_emblem.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <TabBar />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Business Details Form */}
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
          <Text style={styles.label}>Job Card Starting Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1000"
            placeholderTextColor="#9CA3AF"
            value={formData.job_card_number_start}
            onChangeText={text => setFormData(prev => ({ ...prev, job_card_number_start: text.replace(/[^0-9]/g, '') }))}
            keyboardType="number-pad"
          />
          <Text style={styles.fieldHint}>Existing job cards will be renumbered from this value when saved</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Job Card Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#9CA3AF"
            value={formData.job_email}
            onChangeText={text => setFormData(prev => ({ ...prev, job_email: text }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.fieldHint}>Completed job cards will be sent to this address</Text>
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

        {saveStatus && (
          <View style={[styles.statusBanner, saveStatus.type === 'success' ? styles.statusBannerSuccess : styles.statusBannerError]}>
            <Text style={[styles.statusBannerText, saveStatus.type === 'success' ? styles.statusBannerTextSuccess : styles.statusBannerTextError]}>
              {saveStatus.message}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveButton, saveLoading && styles.buttonDisabled]}
          onPress={saveBusinessDetails}
          disabled={saveLoading}>
          {saveLoading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Save size={20} color="#FFFFFF" />}
          <Text style={styles.saveButtonText}>{saveLoading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {/* Employees Section */}
        <View style={styles.divider} />
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Users size={20} color="#111827" />
            <Text style={styles.sectionHeading}>Employees</Text>
          </View>
          <TouchableOpacity
            style={styles.addEmployeeButton}
            onPress={() => { setShowAddEmployee(!showAddEmployee); setAddEmployeeError(''); }}>
            <Plus size={18} color="#F59E0B" />
            <Text style={styles.addEmployeeButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {showAddEmployee && (
          <View style={styles.addEmployeeForm}>
            <TextInput
              style={styles.input}
              placeholder="Employee name"
              placeholderTextColor="#9CA3AF"
              value={newEmployee.name}
              onChangeText={text => setNewEmployee(prev => ({ ...prev, name: text }))}
            />
            <View style={styles.inputGap} />
            <TextInput
              style={styles.input}
              placeholder="Employee email"
              placeholderTextColor="#9CA3AF"
              value={newEmployee.email}
              onChangeText={text => setNewEmployee(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.inputGap} />
            <View style={styles.currencyInput}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.inputWithCurrency}
                placeholder="Hourly rate (optional)"
                placeholderTextColor="#9CA3AF"
                value={newEmployee.hourly_rate}
                onChangeText={text => setNewEmployee(prev => ({ ...prev, hourly_rate: text }))}
                keyboardType="decimal-pad"
              />
              <Text style={styles.currencyUnit}>/hr</Text>
            </View>
            {addEmployeeError ? <Text style={styles.errorText}>{addEmployeeError}</Text> : null}
            <TouchableOpacity
              style={[styles.confirmPasswordButton, addEmployeeLoading && styles.buttonDisabled]}
              onPress={handleAddEmployee}
              disabled={addEmployeeLoading}>
              {addEmployeeLoading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.confirmPasswordButtonText}>Add Employee</Text>}
            </TouchableOpacity>
          </View>
        )}

        {inviteStatus && (
          <View style={[styles.statusBanner, inviteStatus.type === 'success' ? styles.statusBannerSuccess : styles.statusBannerError]}>
            <Text style={[styles.statusBannerText, inviteStatus.type === 'success' ? styles.statusBannerTextSuccess : styles.statusBannerTextError]}>
              {inviteStatus.message}
            </Text>
          </View>
        )}

        {employees.length === 0 && !showAddEmployee && (
          <Text style={styles.noEmployeesText}>No employees added yet. Tap Add to invite someone.</Text>
        )}

        {employees.map(emp => (
          <View key={emp.id} style={styles.employeeCard}>
            <View style={styles.employeeCardTop}>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{emp.name}</Text>
                <Text style={styles.employeeEmail}>{emp.email}</Text>
                {emp.hourly_rate != null && (
                  <Text style={styles.employeeRate}>${emp.hourly_rate.toFixed(2)}/hr</Text>
                )}
              </View>
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(emp.status) + '20' }]}>
                <Text style={[styles.statusPillText, { color: getStatusColor(emp.status) }]}>
                  {emp.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {editingEmployee === emp.id ? (
              <View style={styles.editEmployeeForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Employee name"
                  placeholderTextColor="#9CA3AF"
                  value={editForm.name}
                  onChangeText={text => setEditForm(prev => ({ ...prev, name: text }))}
                />
                <View style={styles.inputGap} />
                <TextInput
                  style={styles.input}
                  placeholder="Employee email"
                  placeholderTextColor="#9CA3AF"
                  value={editForm.email}
                  onChangeText={text => setEditForm(prev => ({ ...prev, email: text }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.inputGap} />
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.inputWithCurrency}
                    placeholder="Hourly rate (optional)"
                    placeholderTextColor="#9CA3AF"
                    value={editForm.hourly_rate}
                    onChangeText={text => setEditForm(prev => ({ ...prev, hourly_rate: text }))}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.currencyUnit}>/hr</Text>
                </View>
                {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
                <View style={styles.editFormActions}>
                  <TouchableOpacity
                    style={styles.cancelEditButton}
                    onPress={handleCancelEdit}>
                    <X size={16} color="#6B7280" />
                    <Text style={styles.cancelEditButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveEditButton, editLoading && styles.buttonDisabled]}
                    onPress={() => handleSaveEmployee(emp)}
                    disabled={editLoading}>
                    {editLoading
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <>
                          <Save size={15} color="#FFFFFF" />
                          <Text style={styles.saveEditButtonText}>Save</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.employeeActions}>
                <TouchableOpacity
                  style={styles.employeeAction}
                  onPress={() => handleToggleCalendarAccess(emp)}>
                  {emp.calendar_access
                    ? <ToggleRight size={20} color="#10B981" />
                    : <ToggleLeft size={20} color="#9CA3AF" />}
                  <Text style={[styles.employeeActionText, emp.calendar_access && { color: '#10B981' }]}>
                    Full Calendar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.employeeAction}
                  onPress={() => handleEditEmployee(emp)}>
                  <Pencil size={16} color="#3B82F6" />
                  <Text style={[styles.employeeActionText, { color: '#3B82F6' }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.employeeAction}
                  onPress={() => handleSendInvite(emp)}
                  disabled={sendingInvite === emp.id}>
                  {sendingInvite === emp.id
                    ? <ActivityIndicator size="small" color="#F59E0B" />
                    : <Send size={18} color="#F59E0B" />}
                  <Text style={[styles.employeeActionText, { color: '#F59E0B' }]}>
                    {emp.status === 'active' ? 'Resend' : 'Send Invite'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.employeeAction}
                  onPress={() => handleRemoveEmployee(emp)}>
                  <UserX size={18} color="#EF4444" />
                  <Text style={[styles.employeeActionText, { color: '#EF4444' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Account Settings */}
        <View style={styles.divider} />
        <Text style={styles.sectionHeading}>Account Settings</Text>
        {passwordSuccess ? (
          <View style={[styles.statusBanner, styles.statusBannerSuccess]}>
            <Text style={[styles.statusBannerText, styles.statusBannerTextSuccess]}>{passwordSuccess}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => {
            setShowChangeEmail(!showChangeEmail);
            setEmailError('');
            setEmailSuccess('');
            setEmailForm({ newEmail: '', confirmEmail: '' });
          }}>
          <View style={styles.settingsRowLeft}>
            <View style={styles.settingsIconWrap}>
              <Mail size={18} color="#374151" />
            </View>
            <Text style={styles.settingsRowText}>Change Email</Text>
          </View>
          {showChangeEmail ? <ChevronUp size={18} color="#6B7280" /> : <ChevronDown size={18} color="#6B7280" />}
        </TouchableOpacity>

        {showChangeEmail && (
          <View style={styles.passwordForm}>
            <TextInput
              style={styles.input}
              placeholder="New email address"
              placeholderTextColor="#9CA3AF"
              value={emailForm.newEmail}
              onChangeText={text => setEmailForm(prev => ({ ...prev, newEmail: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.passwordFieldGap} />
            <TextInput
              style={styles.input}
              placeholder="Confirm new email address"
              placeholderTextColor="#9CA3AF"
              value={emailForm.confirmEmail}
              onChangeText={text => setEmailForm(prev => ({ ...prev, confirmEmail: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            {emailSuccess ? <Text style={styles.successText}>{emailSuccess}</Text> : null}
            <TouchableOpacity
              style={[styles.confirmPasswordButton, emailLoading && styles.buttonDisabled]}
              onPress={handleChangeEmail}
              disabled={emailLoading}>
              <Text style={styles.confirmPasswordButtonText}>
                {emailLoading ? 'Updating...' : 'Update Email'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => {
            setShowChangePassword(!showChangePassword);
            setPasswordError('');
            setPasswordForm({ newPassword: '', confirmPassword: '' });
          }}>
          <View style={styles.settingsRowLeft}>
            <View style={styles.settingsIconWrap}>
              <Lock size={18} color="#374151" />
            </View>
            <Text style={styles.settingsRowText}>Change Password</Text>
          </View>
          {showChangePassword ? <ChevronUp size={18} color="#6B7280" /> : <ChevronDown size={18} color="#6B7280" />}
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
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity
              style={[styles.confirmPasswordButton, passwordLoading && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={passwordLoading}>
              <Text style={styles.confirmPasswordButtonText}>
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.settingsRow, styles.logoutRow]}
          onPress={handleLogout}>
          <View style={styles.settingsRowLeft}>
            <View style={[styles.settingsIconWrap, styles.logoutIconWrap]}>
              <LogOut size={18} color="#F59E0B" />
            </View>
            <Text style={styles.logoutRowText}>Log Out</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsRow, styles.deleteRow]}
          onPress={handleDeleteAccount}
          disabled={deleteLoading}>
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
      </KeyboardAvoidingView>

      {/* Remove Employee Modal */}
      <Modal
        visible={removeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Remove Employee</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove {removeTarget?.name}? They will no longer have access to the app.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRemoveTarget(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmDanger} onPress={confirmRemoveEmployee}>
                <Text style={styles.modalConfirmText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 1 */}
      <Modal
        visible={deleteAccountStep === 1}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAccountStep(0)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your account? All your data including jobs, clients, and business details will be permanently deleted.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteAccountStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmDanger} onPress={() => setDeleteAccountStep(2)}>
                <Text style={styles.modalConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 2 */}
      <Modal
        visible={deleteAccountStep === 2}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAccountStep(0)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Final Confirmation</Text>
            <Text style={styles.modalMessage}>
              This action cannot be undone. Your account and all associated data will be permanently removed.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteAccountStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmDanger} onPress={executeDeleteAccount}>
                <Text style={styles.modalConfirmText}>Delete Everything</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  logoImage: { width: 100, height: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  content: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 40 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldHint: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencySymbol: { fontSize: 20, color: '#F59E0B', fontWeight: 'bold', paddingLeft: 16 },
  inputWithCurrency: { flex: 1, padding: 16, fontSize: 16, color: '#111827' },
  currencyUnit: { fontSize: 14, color: '#9CA3AF', paddingRight: 14 },
  saveButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 36, marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addEmployeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  addEmployeeButtonText: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  addEmployeeForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputGap: { height: 12 },
  noEmployeesText: { fontSize: 14, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' },
  employeeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  employeeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  employeeEmail: { fontSize: 13, color: '#6B7280' },
  employeeRate: { fontSize: 13, color: '#10B981', fontWeight: '600', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  employeeActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  employeeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  employeeActionText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
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
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowText: { fontSize: 16, fontWeight: '500', color: '#111827' },
  passwordForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  passwordFieldGap: { height: 12 },
  errorText: { fontSize: 14, color: '#EF4444', marginTop: 10, marginBottom: 4 },
  successText: { fontSize: 13, color: '#059669', marginTop: 10, marginBottom: 4, lineHeight: 18 },
  confirmPasswordButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  confirmPasswordButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.6 },
  logoutRow: { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' },
  logoutIconWrap: { backgroundColor: '#FEF3C7' },
  logoutRowText: { fontSize: 16, fontWeight: '500', color: '#D97706' },
  deleteRow: { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  deleteIconWrap: { backgroundColor: '#FEE2E2' },
  deleteRowText: { fontSize: 16, fontWeight: '500', color: '#EF4444' },
  editEmployeeForm: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    gap: 0,
  },
  editFormActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  cancelEditButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  saveEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  saveEditButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  statusBanner: { borderRadius: 10, padding: 12, marginBottom: 12 },
  statusBannerSuccess: { backgroundColor: '#D1FAE5' },
  statusBannerError: { backgroundColor: '#FEE2E2' },
  statusBannerText: { fontSize: 14, fontWeight: '500' },
  statusBannerTextSuccess: { color: '#059669' },
  statusBannerTextError: { color: '#DC2626' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 },
  modalMessage: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalConfirmDanger: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
