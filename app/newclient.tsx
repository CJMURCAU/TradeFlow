import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { useRequireOwner } from '@/lib/useRequireOwner';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import { ArrowLeft, Save } from 'lucide-react-native';

export default function NewClientPage() {
  useRequireOwner();
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createClient = async () => {
    setError('');
    if (!formData.company_name.trim()) {
      setError('Please enter a company name');
      return;
    }
    if (formData.email.trim() && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isValidPhone(formData.phone)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be signed in to create a client');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        company_name: formData.company_name,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      })
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      setError('Failed to create client. Please try again.');
    } else if (data) {
      router.replace(`/client/${data.id}`);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>New Client</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Company Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter company name"
            placeholderTextColor="#9CA3AF"
            value={formData.company_name}
            onChangeText={text => setFormData(prev => ({ ...prev, company_name: text }))}
            textContentType="organizationName"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Contact</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter contact name"
            placeholderTextColor="#9CA3AF"
            value={formData.name}
            onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
            textContentType="name"
            autoComplete="name"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor="#9CA3AF"
            value={formData.phone}
            onChangeText={text => setFormData(prev => ({ ...prev, phone: text }))}
            textContentType="telephoneNumber"
            autoComplete="tel"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#9CA3AF"
            value={formData.email}
            onChangeText={text => setFormData(prev => ({ ...prev, email: text }))}
            textContentType="emailAddress"
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter address"
            placeholderTextColor="#9CA3AF"
            value={formData.address}
            onChangeText={text => setFormData(prev => ({ ...prev, address: text }))}
            multiline
            numberOfLines={3}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={createClient}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <>
                <Save size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Client</Text>
              </>}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
