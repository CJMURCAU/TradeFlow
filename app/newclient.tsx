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
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react-native';

type ContactDraft = {
  name: string;
  phone: string;
  email: string;
};

export default function NewClientPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [contacts, setContacts] = useState<ContactDraft[]>([{ name: '', phone: '', email: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const addContact = () => {
    setContacts(prev => [...prev, { name: '', phone: '', email: '' }]);
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof ContactDraft, value: string) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const createClient = async () => {
    setError('');
    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be signed in to create a client');
      setLoading(false);
      return;
    }

    const primary = contacts[0] ?? { name: '', phone: '', email: '' };

    const { data, error: insertError } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        company_name: companyName,
        name: primary.name,
        phone: primary.phone,
        email: primary.email,
        address,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError('Failed to create client. Please try again.');
      setLoading(false);
      return;
    }

    const extras = contacts.slice(1).filter(c => c.name.trim() || c.phone.trim() || c.email.trim());
    if (extras.length > 0) {
      await supabase.from('client_contacts').insert(
        extras.map(c => ({ client_id: data.id, name: c.name, phone: c.phone, email: c.email }))
      );
    }

    setLoading(false);
    router.replace(`/client/${data.id}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
            value={companyName}
            onChangeText={setCompanyName}
          />
        </View>

        <View style={styles.contactsHeader}>
          <Text style={styles.label}>Contacts</Text>
          <TouchableOpacity style={styles.addContactButton} onPress={addContact}>
            <Plus size={16} color="#F59E0B" />
            <Text style={styles.addContactText}>Add</Text>
          </TouchableOpacity>
        </View>

        {contacts.map((contact, index) => (
          <View key={index} style={styles.contactCard}>
            <View style={styles.contactCardHeader}>
              <Text style={styles.contactCardTitle}>
                {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
              </Text>
              {index > 0 && (
                <TouchableOpacity onPress={() => removeContact(index)}>
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              placeholderTextColor="#9CA3AF"
              value={contact.name}
              onChangeText={val => updateContact(index, 'name', val)}
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="Phone number"
              placeholderTextColor="#9CA3AF"
              value={contact.phone}
              onChangeText={val => updateContact(index, 'phone', val)}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="email@example.com"
              placeholderTextColor="#9CA3AF"
              value={contact.email}
              onChangeText={val => updateContact(index, 'email', val)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        ))}

        <View style={[styles.formGroup, { marginTop: 8 }]}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter address"
            placeholderTextColor="#9CA3AF"
            value={address}
            onChangeText={setAddress}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { marginRight: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
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
  inputSpaced: { marginTop: 10 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  contactsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  addContactText: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  contactCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactCardTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  errorText: { fontSize: 14, color: '#EF4444', marginBottom: 12 },
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
  buttonDisabled: { opacity: 0.6 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
