import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase, BusinessDetails } from '@/lib/supabase';
import { Save } from 'lucide-react-native';

export default function BusinessPage() {
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    tradesman_name: '',
    job_email: '',
    default_hourly_rate: '',
  });

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Business Details</Text>
      </View>

      <ScrollView style={styles.content}>
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
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
});
