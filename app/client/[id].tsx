import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { supabase, Client, Job } from '@/lib/supabase';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Save, Phone, Mail, MapPin, Briefcase } from 'lucide-react-native';

export default function ClientDetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    if (id) {
      fetchClientDetails();
      fetchClientJobs();
    }
  }, [id]);

  const fetchClientDetails = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setClient(data);
      setFormData({
        company_name: data.company_name,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
      });
    }
  };

  const fetchClientJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    if (data) {
      setJobs(data);
    }
  };

  const saveClient = async () => {
    if (!formData.company_name.trim()) {
      Alert.alert('Error', 'Please enter a company name');
      return;
    }

    const { error } = await supabase
      .from('clients')
      .update({
        company_name: formData.company_name,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', 'Failed to update client');
    } else {
      Alert.alert('Success', 'Client updated successfully');
      setIsEditing(false);
      fetchClientDetails();
    }
  };

  const openPhone = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const openEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const openMaps = () => {
    if (client?.address) {
      const encodedAddress = encodeURIComponent(client.address);
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
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
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{client.company_name || client.name}</Text>
        {!isEditing ? (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
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
              <Text style={styles.label}>Contact</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter contact name"
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
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

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsEditing(false);
                setFormData({
                  company_name: client.company_name,
                  name: client.name,
                  phone: client.phone,
                  email: client.email,
                  address: client.address,
                });
              }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              {client.phone && (
                <TouchableOpacity style={styles.infoCard} onPress={openPhone}>
                  <Phone size={20} color="#F59E0B" />
                  <Text style={styles.infoText}>{client.phone}</Text>
                </TouchableOpacity>
              )}
              {client.email && (
                <TouchableOpacity style={styles.infoCard} onPress={openEmail}>
                  <Mail size={20} color="#F59E0B" />
                  <Text style={styles.infoText}>{client.email}</Text>
                </TouchableOpacity>
              )}
              {client.address && (
                <TouchableOpacity style={styles.infoCard} onPress={openMaps}>
                  <MapPin size={20} color="#F59E0B" />
                  <Text style={styles.infoText}>{client.address}</Text>
                </TouchableOpacity>
              )}
            </View>

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
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(job.status) + '20' },
                        ]}>
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(job.status) },
                          ]}>
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
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  editButton: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
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
  infoText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  noJobsText: {
    color: '#6B7280',
    fontSize: 14,
  },
  jobCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  jobPO: {
    fontSize: 12,
    color: '#6B7280',
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
  cancelButton: {
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
