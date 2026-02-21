import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';

export default function NewClientPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const createClient = async () => {
    if (!formData.company_name.trim()) {
      Alert.alert('Error', 'Please enter a company name');
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_name: formData.company_name,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Failed to create client');
    } else if (data) {
      Alert.alert('Success', 'Client created successfully', [
        { text: 'OK', onPress: () => router.push(`/client/${data.id}`) },
      ]);
    }
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

        <TouchableOpacity style={styles.createButton} onPress={createClient}>
          <Save size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Client</Text>
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
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
