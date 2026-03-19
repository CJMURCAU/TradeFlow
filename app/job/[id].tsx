import { useState, useEffect, useRef, useCallback } from 'react';
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
import { supabase, Job, Client, Part, TimeEntry, BusinessDetails } from '@/lib/supabase';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Mail,
  Plus,
  Trash2,
  MapPin,
  Navigation,
} from 'lucide-react-native';

export default function JobDetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<(Job & { client?: Client }) | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const currentTimeEntryRef = useRef<TimeEntry | null>(null);
  const isTimerRunningRef = useRef(false);
  const accumulatedTimeRef = useRef(0);
  const [description, setDescription] = useState('');
  const [newPart, setNewPart] = useState({ name: '', cost: '', quantity: '1' });
  const [showAddPart, setShowAddPart] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
    fetchBusinessDetails();
  }, [id]);

  const fetchBusinessDetails = async () => {
    const { data } = await supabase
      .from('business_details')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setBusiness(data);
      setHourlyRate(data.default_hourly_rate ?? 0);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isTimerRunningRef.current && currentTimeEntryRef.current) {
        const start = new Date(currentTimeEntryRef.current.start_time).getTime();
        const now = Date.now();
        setElapsedTime(accumulatedTimeRef.current + Math.floor((now - start) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobDetails = async () => {
    const [jobResponse, partsResponse, timeEntriesResponse] = await Promise.all([
      supabase.from('jobs').select('*, client:clients(*)').eq('id', id).maybeSingle(),
      supabase.from('parts').select('*').eq('job_id', id),
      supabase.from('time_entries').select('*').eq('job_id', id).order('start_time', { ascending: false }),
    ]);

    if (jobResponse.data) {
      const jobWithClient = {
        ...jobResponse.data,
        client: Array.isArray(jobResponse.data.client)
          ? jobResponse.data.client[0]
          : jobResponse.data.client,
      };
      setJob(jobWithClient);
      setDescription(jobWithClient.description);
    }

    if (partsResponse.data) {
      setParts(partsResponse.data);
    }

    if (timeEntriesResponse.data) {
      setTimeEntries(timeEntriesResponse.data);
      const running = timeEntriesResponse.data.find(entry => entry.is_running);
      const completedEntries = timeEntriesResponse.data.filter(entry => !entry.is_running && entry.end_time);
      const completedSeconds = completedEntries.reduce((total, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = new Date(entry.end_time!).getTime();
        return total + Math.floor((end - start) / 1000);
      }, 0);
      accumulatedTimeRef.current = completedSeconds;
      if (running) {
        currentTimeEntryRef.current = running;
        isTimerRunningRef.current = true;
        setCurrentTimeEntry(running);
        setIsTimerRunning(true);
        const start = new Date(running.start_time).getTime();
        const now = Date.now();
        setElapsedTime(completedSeconds + Math.floor((now - start) / 1000));
      } else {
        currentTimeEntryRef.current = null;
        isTimerRunningRef.current = false;
        setElapsedTime(completedSeconds);
      }
    }
  };

  const startTimer = async () => {
    if (!job || job.status === 'completed') return;

    const [timeEntryResult] = await Promise.all([
      supabase
        .from('time_entries')
        .insert({
          job_id: id,
          start_time: new Date().toISOString(),
          is_running: true,
        })
        .select()
        .single(),
      supabase.from('jobs').update({ status: 'active' }).eq('id', id as string),
    ]);

    const { data } = timeEntryResult;

    if (data) {
      currentTimeEntryRef.current = data;
      isTimerRunningRef.current = true;
      setCurrentTimeEntry(data);
      setIsTimerRunning(true);
      setJob(prev => prev ? { ...prev, status: 'active' } : prev);
      fetchJobDetails();
    }
  };

  const pauseTimer = async () => {
    if (!currentTimeEntry) return;

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: new Date().toISOString(),
        is_running: false,
      })
      .eq('id', currentTimeEntry.id);

    if (!error) {
      isTimerRunningRef.current = false;
      currentTimeEntryRef.current = null;
      setIsTimerRunning(false);
      setCurrentTimeEntry(null);
      fetchJobDetails();
    }
  };

  const stopTimer = async () => {
    if (!currentTimeEntry) return;

    Alert.alert(
      'Stop Timer',
      'Are you sure you want to stop the timer? This will end the current time entry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            await pauseTimer();
          },
        },
      ]
    );
  };

  const addPart = async () => {
    if (!newPart.name.trim()) {
      Alert.alert('Error', 'Please enter a part name');
      return;
    }

    const { error } = await supabase.from('parts').insert({
      job_id: id,
      name: newPart.name,
      cost: parseFloat(newPart.cost) || 0,
      quantity: parseInt(newPart.quantity) || 1,
    });

    if (!error) {
      setNewPart({ name: '', cost: '', quantity: '1' });
      setShowAddPart(false);
      fetchJobDetails();
    }
  };

  const deletePart = async (partId: string) => {
    const { error } = await supabase.from('parts').delete().eq('id', partId);
    if (!error) {
      fetchJobDetails();
    }
  };

  const saveDescriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    if (saveDescriptionDebounceRef.current) {
      clearTimeout(saveDescriptionDebounceRef.current);
    }
    saveDescriptionDebounceRef.current = setTimeout(async () => {
      if (!job) return;
      await supabase.from('jobs').update({ description: text }).eq('id', job.id as string);
    }, 800);
  }, [job]);

  const updateJobStatus = async (status: 'pending' | 'active' | 'completed') => {
    if (!job) return;

    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', job.id);

    if (!error) {
      fetchJobDetails();
    }
  };

  const sendJobCardViaService = async () => {
    if (!job) return;

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-job-card`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        const detail = result.details?.message || result.details?.name || JSON.stringify(result.details) || '';
        const message = result.error + (detail ? `\n\n${detail}` : '');
        Alert.alert('Failed to Send', message || 'Something went wrong. Please try again.');
        return;
      }

      await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', job.id);
      setJob(prev => prev ? { ...prev, status: 'completed' } : prev);
      Alert.alert('Email Sent', `Job card emailed to ${result.sentTo}`);
      fetchJobDetails();
    } catch {
      Alert.alert('Error', 'Could not connect to email service. Please try again.');
    }
  };

  const openDirections = () => {
    if (job?.client?.address) {
      const encodedAddress = encodeURIComponent(job.client.address);
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalTime = () => {
    return timeEntries.reduce((total, entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
      return total + (end - start);
    }, 0) / 1000;
  };

  const getTotalPartsCost = () => {
    return parts.reduce((total, part) => total + (part.cost * part.quantity), 0);
  };

  const getLabourCost = () => {
    const hours = getTotalTime() / 3600;
    return hours * hourlyRate;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  if (!job) {
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
        <View style={styles.headerContent}>
          <Text style={styles.title}>Job #{job.job_card_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
              {job.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          {job.purchase_order_number && (
            <Text style={styles.poNumber}>PO: {job.purchase_order_number}</Text>
          )}
          {job.client && <Text style={styles.clientName}>{job.client.name}</Text>}
          {job.client?.address && (
            <TouchableOpacity style={styles.addressButton} onPress={openDirections}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.addressText}>{job.client.address}</Text>
              <Navigation size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusButtons}>
            {(['pending', 'active', 'completed'] as const).map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  job.status === status && { backgroundColor: getStatusColor(status) },
                ]}
                onPress={() => updateJobStatus(status)}>
                <Text
                  style={[
                    styles.statusButtonText,
                    job.status === status && styles.statusButtonTextActive,
                  ]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timer</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timerDisplay}>
              {formatTime(elapsedTime)}
            </Text>
            {job.status === 'completed' && (
              <Text style={styles.timerCompletedNote}>Job completed — timer disabled</Text>
            )}
            <View style={styles.timerButtons}>
              {!isTimerRunning ? (
                <TouchableOpacity
                  style={[styles.timerButton, job.status === 'completed' && styles.timerButtonDisabled]}
                  onPress={startTimer}
                  disabled={job.status === 'completed'}>
                  <Play size={24} color="#FFFFFF" />
                  <Text style={styles.timerButtonText}>Start</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.timerButton} onPress={pauseTimer}>
                    <Pause size={24} color="#FFFFFF" />
                    <Text style={styles.timerButtonText}>Pause</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.timerButton, styles.timerButtonStop]} onPress={stopTimer}>
                    <Square size={24} color="#FFFFFF" />
                    <Text style={styles.timerButtonText}>Stop</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Description</Text>
          </View>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Enter job description..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={handleDescriptionChange}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Parts</Text>
            <TouchableOpacity onPress={() => setShowAddPart(!showAddPart)}>
              <Plus size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>

          {showAddPart && (
            <View style={styles.addPartForm}>
              <TextInput
                style={styles.input}
                placeholder="Part name"
                placeholderTextColor="#94A3B8"
                value={newPart.name}
                onChangeText={text => setNewPart(prev => ({ ...prev, name: text }))}
              />
              <View style={styles.partRow}>
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  placeholder="Cost"
                  placeholderTextColor="#94A3B8"
                  value={newPart.cost}
                  onChangeText={text => setNewPart(prev => ({ ...prev, cost: text }))}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  placeholder="Qty"
                  placeholderTextColor="#94A3B8"
                  value={newPart.quantity}
                  onChangeText={text => setNewPart(prev => ({ ...prev, quantity: text }))}
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity style={styles.addButton} onPress={addPart}>
                <Text style={styles.addButtonText}>Add Part</Text>
              </TouchableOpacity>
            </View>
          )}

          {parts.map(part => (
            <View key={part.id} style={styles.partCard}>
              <View style={styles.partInfo}>
                <Text style={styles.partName}>{part.name}</Text>
                <Text style={styles.partDetails}>
                  ${part.cost.toFixed(2)} x {part.quantity} = ${(part.cost * part.quantity).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deletePart(part.id)}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Time:</Text>
              <Text style={styles.summaryValue}>{formatTime(Math.floor(getTotalTime()))}</Text>
            </View>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Labour Cost:</Text>
                {hourlyRate > 0 && (
                  <Text style={styles.summarySubLabel}>${hourlyRate.toFixed(2)}/hr</Text>
                )}
              </View>
              <Text style={styles.summaryValue}>
                {hourlyRate > 0 ? `$${getLabourCost().toFixed(2)}` : '—'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Parts Cost:</Text>
              <Text style={styles.summaryValue}>${getTotalPartsCost().toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total:</Text>
              <Text style={styles.summaryTotalValue}>
                ${(getLabourCost() + getTotalPartsCost()).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.emailButton,
              job.email_sent && styles.emailButtonSent,
              isSendingEmail && styles.emailButtonDisabled,
            ]}
            onPress={sendJobCardViaService}
            disabled={isSendingEmail}>
            <Mail size={20} color="#FFFFFF" />
            <Text style={styles.emailButtonText}>
              {isSendingEmail ? 'Sending...' : job.email_sent ? 'Resend Job Card' : 'Send Job Card'}
            </Text>
          </TouchableOpacity>
        </View>
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
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingText: {
    color: '#111827',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  section: {
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  poNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 8,
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  timerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 20,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  timerButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerButtonStop: {
    backgroundColor: '#EF4444',
  },
  timerButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  timerCompletedNote: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 12,
  },
  timerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  descriptionInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addPartForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  partRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputSmall: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  partCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  partDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  summarySubLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F59E0B',
  },
  emailButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emailButtonSent: {
    backgroundColor: '#10B981',
  },
  emailButtonDisabled: {
    opacity: 0.6,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
