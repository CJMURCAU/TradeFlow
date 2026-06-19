import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { supabase, Client, ClientContact, Job } from '@/lib/supabase';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Save, Phone, Mail, MapPin, Plus, Trash2, User } from 'lucide-react-native';

type ContactDraft = {
  id?: string;
  name: string;
  phone: string;
  email: string;
};

export default function ClientDetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [extraContacts, setExtraContacts] = useState<ClientContact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [editCompanyName, setEditCompanyName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editContacts, setEditContacts] = useState<ContactDraft[]>([]);

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchExtraContacts();
      fetchClientJobs();
    }
  }, [id]);

  const fetchClientDetails = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) setClient(data);
  };

  const fetchExtraContacts = async () => {
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id as string)
      .order('created_at', { ascending: true });
    if (data) setExtraContacts(data);
  };

  const fetchClientJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });
    if (data) setJobs(data);
  };

  const startEditing = () => {
    if (!client) return;
    setEditCompanyName(client.company_name);
    setEditAddress(client.address ?? '');
    const primary: ContactDraft = { id: '__primary__', name: client.name ?? '', phone: client.phone ?? '', email: client.email ?? '' };
    const extras: ContactDraft[] = extraContacts.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email }));
    setEditContacts([primary, ...extras]);
    setSaveError('');
    setIsEditing(true);
  };

  const addEditContact = () => {
    setEditContacts(prev => [...prev, { name: '', phone: '', email: '' }]);
  };

  const removeEditContact = (index: number) => {
    setEditContacts(prev => prev.filter((_, i) => i !== index));
  };

  const updateEditContact = (index: number, field: keyof ContactDraft, value: string) => {
    setEditContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const saveClient = async () => {
    if (!editCompanyName.trim()) {
      setSaveError('Please enter a company name');
      return;
    }

    const primary = editContacts[0] ?? { name: '', phone: '', email: '' };

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        company_name: editCompanyName,
        name: primary.name,
        phone: primary.phone,
        email: primary.email,
        address: editAddress,
      })
      .eq('id', id as string);

    if (updateError) {
      setSaveError('Failed to update client. Please try again.');
      return;
    }

    await supabase.from('client_contacts').delete().eq('client_id', id as string);

    const extras = editContacts.slice(1).filter(c => c.name.trim() || c.phone.trim() || c.email.trim());
    if (extras.length > 0) {
      await supabase.from('client_contacts').insert(
        extras.map(c => ({ client_id: id as string, name: c.name, phone: c.phone, email: c.email }))
      );
    }

    setIsEditing(false);
    setSaveError('');
    fetchClientDetails();
    fetchExtraContacts();
  };

  const openPhone = (phone: string) => Linking.openURL(`tel:${phone}`);
  const openEmail = (email: string) => Linking.openURL(`mailto:${email}`);
  const openMaps = () => {
    if (client?.address) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(client.address)}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  if (!client) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  const allContacts = [
    { name: client.name, phone: client.phone, email: client.email, label: 'Primary Contact' },
    ...extraContacts.map((c, i) => ({ name: c.name, phone: c.phone, email: c.email, label: `Contact ${i + 2}` })),
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{client.company_name || client.name}</Text>
        {!isEditing ? (
          <TouchableOpacity onPress={startEditing}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={saveClient}>
            <Save size={24} color="#F59E0B" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {isEditing ? (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter company name"
                placeholderTextColor="#9CA3AF"
                value={editCompanyName}
                onChangeText={setEditCompanyName}
              />
            </View>

            <View style={styles.contactsHeader}>
              <Text style={styles.label}>Contacts</Text>
              <TouchableOpacity style={styles.addContactButton} onPress={addEditContact}>
                <Plus size={16} color="#F59E0B" />
                <Text style={styles.addContactText}>Add</Text>
              </TouchableOpacity>
            </View>

            {editContacts.map((contact, index) => (
              <View key={index} style={styles.contactCard}>
                <View style={styles.contactCardHeader}>
                  <Text style={styles.contactCardTitle}>
                    {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                  </Text>
                  {index > 0 && (
                    <TouchableOpacity onPress={() => removeEditContact(index)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Contact name"
                  placeholderTextColor="#9CA3AF"
                  value={contact.name}
                  onChangeText={val => updateEditContact(index, 'name', val)}
                />
                <TextInput
                  style={[styles.input, styles.inputSpaced]}
                  placeholder="Phone number"
                  placeholderTextColor="#9CA3AF"
                  value={contact.phone}
                  onChangeText={val => updateEditContact(index, 'phone', val)}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, styles.inputSpaced]}
                  placeholder="email@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={contact.email}
                  onChangeText={val => updateEditContact(index, 'email', val)}
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
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
                numberOfLines={3}
              />
            </View>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

            <TouchableOpacity style={styles.cancelButton} onPress={() => { setIsEditing(false); setSaveError(''); }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contacts</Text>
              {allContacts.map((contact, index) => {
                const hasAny = contact.name || contact.phone || contact.email;
                if (!hasAny) return null;
                return (
                  <View key={index} style={styles.contactBlock}>
                    <View style={styles.contactBlockHeader}>
                      <User size={14} color="#9CA3AF" />
                      <Text style={styles.contactBlockLabel}>{contact.label}</Text>
                    </View>
                    {contact.name ? <Text style={styles.contactName}>{contact.name}</Text> : null}
                    {contact.phone ? (
                      <TouchableOpacity style={styles.infoRow} onPress={() => openPhone(contact.phone!)}>
                        <Phone size={16} color="#F59E0B" />
                        <Text style={styles.infoText}>{contact.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {contact.email ? (
                      <TouchableOpacity style={styles.infoRow} onPress={() => openEmail(contact.email!)}>
                        <Mail size={16} color="#F59E0B" />
                        <Text style={styles.infoText}>{contact.email}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {client.address ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Address</Text>
                <TouchableOpacity style={styles.infoCard} onPress={openMaps}>
                  <MapPin size={20} color="#F59E0B" />
                  <Text style={styles.infoText}>{client.address}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jobs ({jobs.length})</Text>
              {jobs.length === 0 ? (
                <Text style={styles.noJobsText}>No jobs for this client</Text>
              ) : (
                jobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobCard}
                    onPress={() => router.push(`/job/${job.id}`)}>
                    <View style={styles.jobHeader}>
                      <Text style={styles.jobNumber}>#{job.job_card_number}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
                          {job.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    {job.purchase_order_number && (
                      <Text style={styles.jobPO}>PO: {job.purchase_order_number}</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
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
    justifyContent: 'space-between',
  },
  backButton: { marginRight: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', flex: 1 },
  editButton: { color: '#F59E0B', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 40 },
  loadingText: { color: '#6B7280', fontSize: 16, textAlign: 'center', marginTop: 100 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 14 },
  contactBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  contactBlockLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  contactName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: { fontSize: 15, color: '#111827', flex: 1 },
  noJobsText: { color: '#6B7280', fontSize: 14 },
  jobCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobNumber: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' },
  jobTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  jobPO: { fontSize: 12, color: '#6B7280' },
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
  cancelButton: {
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: { color: '#111827', fontSize: 16, fontWeight: '600' },
});
