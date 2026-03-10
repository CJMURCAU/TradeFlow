import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { supabase, Client } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Save, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAL_WIDTH = SCREEN_WIDTH - 32;

export default function NewJobPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const calendarFlatListRef = useRef<FlatList>(null);
  const [calendarIndex, setCalendarIndex] = useState(0);
  const [newClientData, setNewClientData] = useState({
    company_name: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    purchase_order_number: '',
    description: '',
    hour: '09',
    minute: '00',
    date: '',
  });

  useEffect(() => {
    fetchClients();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setFormData(prev => ({ ...prev, date: `${year}-${month}-${day}` }));
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setClients(data);
    }
  };

  const createClient = async () => {
    if (!newClientData.company_name.trim()) {
      Alert.alert('Error', 'Please enter a company name');
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_name: newClientData.company_name,
        name: newClientData.name,
        phone: newClientData.phone,
        email: newClientData.email,
        address: newClientData.address,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Failed to create client');
    } else if (data) {
      setClients([...clients, data]);
      setFormData(prev => ({ ...prev, client_id: data.id }));
      setNewClientData({ company_name: '', name: '', phone: '', email: '', address: '' });
      setShowNewClientForm(false);
      Alert.alert('Success', 'Client created successfully');
    }
  };

  const createJob = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a job title');
      return;
    }

    if (!formData.client_id) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    const scheduledDateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;

    const jobData = {
      client_id: formData.client_id,
      title: formData.title,
      purchase_order_number: formData.purchase_order_number,
      description: formData.description,
      status: 'pending',
      scheduled_time: new Date(scheduledDateTime).toISOString(),
    };

    const { data, error } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Failed to create job');
    } else if (data) {
      Alert.alert('Success', 'Job created successfully', [
        { text: 'OK', onPress: () => router.push(`/job/${data.id}`) },
      ]);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const CALENDAR_MONTHS = 24;

  const getMonthForCalendarIndex = (index: number) => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + index);
    return base;
  };

  const calendarMonthTitle = getMonthForCalendarIndex(calendarIndex).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const onCalendarScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / CAL_WIDTH);
    if (newIndex !== calendarIndex) {
      setCalendarIndex(newIndex);
    }
  };

  const navigateCalendarMonth = (direction: 'prev' | 'next') => {
    const newIndex = calendarIndex + (direction === 'next' ? 1 : -1);
    if (newIndex < 0) return;
    setCalendarIndex(newIndex);
    calendarFlatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
  };

  const renderCalendarMonth = ({ index }: { index: number }) => {
    const monthDate = getMonthForCalendarIndex(index);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const cur = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return (
      <View style={{ width: CAL_WIDTH, padding: 8 }}>
        <View style={styles.calGridHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={styles.calGridHeaderDay}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.calGridWeek}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === month;
              const isPast = day < todayStart;
              const isToday = day.toDateString() === new Date().toDateString();
              const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const isSelected = formData.date === dayStr;

              return (
                <TouchableOpacity
                  key={di}
                  disabled={isPast || !isCurrentMonth}
                  style={[
                    styles.calGridDay,
                    isToday && !isSelected && styles.calGridDayToday,
                    isSelected && styles.calGridDaySelected,
                    (isPast || !isCurrentMonth) && styles.calGridDayDisabled,
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, date: dayStr }));
                    setShowDatePicker(false);
                  }}>
                  <Text style={[
                    styles.calGridDayNum,
                    !isCurrentMonth && styles.calGridDayNumOther,
                    isToday && !isSelected && styles.calGridDayNumToday,
                    isSelected && styles.calGridDayNumSelected,
                    isPast && styles.calGridDayNumPast,
                  ]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>New Job</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Client *</Text>
            <TouchableOpacity
              style={styles.addClientButton}
              onPress={() => setShowNewClientForm(!showNewClientForm)}>
              <Plus size={16} color="#F59E0B" />
              <Text style={styles.addClientText}>New Client</Text>
            </TouchableOpacity>
          </View>

          {showNewClientForm && (
            <View style={styles.newClientForm}>
              <Text style={styles.newClientTitle}>Add New Client</Text>
              <TextInput
                style={styles.input}
                placeholder="Company Name *"
                placeholderTextColor="#9CA3AF"
                value={newClientData.company_name}
                onChangeText={text => setNewClientData(prev => ({ ...prev, company_name: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact"
                placeholderTextColor="#9CA3AF"
                value={newClientData.name}
                onChangeText={text => setNewClientData(prev => ({ ...prev, name: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#9CA3AF"
                value={newClientData.phone}
                onChangeText={text => setNewClientData(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={newClientData.email}
                onChangeText={text => setNewClientData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Address"
                placeholderTextColor="#9CA3AF"
                value={newClientData.address}
                onChangeText={text => setNewClientData(prev => ({ ...prev, address: text }))}
                multiline
                numberOfLines={2}
              />
              <View style={styles.clientFormButtons}>
                <TouchableOpacity
                  style={styles.cancelClientButton}
                  onPress={() => {
                    setShowNewClientForm(false);
                    setNewClientData({ company_name: '', name: '', phone: '', email: '', address: '' });
                  }}>
                  <Text style={styles.cancelClientText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveClientButton} onPress={createClient}>
                  <Text style={styles.saveClientText}>Save Client</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!showNewClientForm && (
            <View style={styles.clientDropdownWrapper}>
              <View style={styles.clientSearchBox}>
                <TextInput
                  style={styles.clientSearchInput}
                  placeholder="Search clients..."
                  placeholderTextColor="#9CA3AF"
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            <ScrollView style={styles.clientDropdown} nestedScrollEnabled>
              {clients.length === 0 ? (
                <View style={styles.noClientsBox}>
                  <Text style={styles.noClientsText}>No clients yet. Add one above!</Text>
                </View>
              ) : (
                clients
                  .filter(client => {
                    if (!clientSearch.trim()) return true;
                    const q = clientSearch.toLowerCase();
                    return (
                      client.company_name?.toLowerCase().includes(q) ||
                      client.name?.toLowerCase().includes(q)
                    );
                  })
                  .map(client => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientOption,
                      formData.client_id === client.id && styles.clientOptionActive,
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, client_id: client.id }))}>
                    <View style={styles.clientOptionContent}>
                      <Text
                        style={[
                          styles.clientOptionName,
                          formData.client_id === client.id && styles.clientOptionNameActive,
                        ]}>
                        {client.company_name || client.name}
                      </Text>
                      {client.name && client.company_name ? (
                        <Text style={styles.clientOptionDetail}>{client.name}</Text>
                      ) : null}
                      {client.phone && (
                        <Text style={styles.clientOptionDetail}>{client.phone}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Job Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter job title"
            placeholderTextColor="#9CA3AF"
            value={formData.title}
            onChangeText={text => setFormData(prev => ({ ...prev, title: text }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Purchase Order Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter PO number"
            placeholderTextColor="#9CA3AF"
            value={formData.purchase_order_number}
            onChangeText={text => setFormData(prev => ({ ...prev, purchase_order_number: text }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter job description"
            placeholderTextColor="#9CA3AF"
            value={formData.description}
            onChangeText={text => setFormData(prev => ({ ...prev, description: text }))}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}>
            <CalendarIcon size={20} color="#F59E0B" />
            <Text style={styles.dateButtonText}>
              {formData.date ? new Date(formData.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }) : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Time</Text>
          <View style={styles.timeSelectedDisplay}>
            <Text style={styles.timeSelectedText}>{formData.hour}:{formData.minute}</Text>
          </View>
          <Text style={styles.timeLabel}>Hour</Text>
          <View style={styles.timeGrid}>
            {hours.map(hour => (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.timeGridCell,
                  formData.hour === hour && styles.timeGridCellActive,
                ]}
                onPress={() => setFormData(prev => ({ ...prev, hour }))}>
                <Text style={[
                  styles.timeGridCellText,
                  formData.hour === hour && styles.timeGridCellTextActive,
                ]}>
                  {hour}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.timeLabel, { marginTop: 16 }]}>Minute</Text>
          <View style={styles.minuteRow}>
            {minutes.map(minute => (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.minuteCell,
                  formData.minute === minute && styles.timeGridCellActive,
                ]}
                onPress={() => setFormData(prev => ({ ...prev, minute }))}>
                <Text style={[
                  styles.timeGridCellText,
                  formData.minute === minute && styles.timeGridCellTextActive,
                ]}>
                  {minute}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={createJob}>
          <Save size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Job</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calNavRow}>
              <TouchableOpacity
                onPress={() => navigateCalendarMonth('prev')}
                style={[styles.calNavButton, calendarIndex === 0 && styles.calNavButtonDisabled]}
                disabled={calendarIndex === 0}>
                <ChevronLeft size={22} color={calendarIndex === 0 ? '#D1D5DB' : '#F59E0B'} />
              </TouchableOpacity>
              <Text style={styles.calNavTitle}>{calendarMonthTitle}</Text>
              <TouchableOpacity onPress={() => navigateCalendarMonth('next')} style={styles.calNavButton}>
                <ChevronRight size={22} color="#F59E0B" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={calendarFlatListRef}
              data={Array.from({ length: CALENDAR_MONTHS }, (_, i) => i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.toString()}
              renderItem={renderCalendarMonth}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH - 32,
                offset: (SCREEN_WIDTH - 32) * index,
                index,
              })}
              initialScrollIndex={0}
              onMomentumScrollEnd={onCalendarScrollEnd}
              style={styles.calFlatList}
            />
          </View>
        </View>
      </Modal>
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  addClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addClientText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  newClientForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  newClientTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  clientFormButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelClientButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelClientText: {
    color: '#111827',
    fontWeight: '600',
  },
  saveClientButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
  },
  saveClientText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clientDropdownWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  clientSearchBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  clientSearchInput: {
    fontSize: 14,
    color: '#111827',
  },
  clientDropdown: {
    backgroundColor: '#F9FAFB',
    maxHeight: 200,
  },
  noClientsBox: {
    padding: 20,
    alignItems: 'center',
  },
  noClientsText: {
    color: '#6B7280',
    fontSize: 14,
  },
  clientOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  clientOptionActive: {
    backgroundColor: '#F59E0B',
  },
  clientOptionContent: {
    gap: 4,
  },
  clientOptionName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  clientOptionNameActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  clientOptionDetail: {
    color: '#6B7280',
    fontSize: 14,
  },
  timeSelectedDisplay: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  timeSelectedText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 2,
  },
  timeLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeGridCell: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeGridCellActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  timeGridCellText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  timeGridCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  minuteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  minuteCell: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateButtonText: {
    color: '#111827',
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalClose: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '600',
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calNavButton: {
    padding: 8,
  },
  calNavButtonDisabled: {
    opacity: 0.4,
  },
  calNavTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  calFlatList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  calGridHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calGridHeaderDay: {
    flex: 1,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  calGridWeek: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calGridDay: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  calGridDayToday: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  calGridDaySelected: {
    backgroundColor: '#F59E0B',
  },
  calGridDayDisabled: {
    backgroundColor: 'transparent',
  },
  calGridDayNum: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  calGridDayNumOther: {
    color: '#E5E7EB',
  },
  calGridDayNumToday: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  calGridDayNumSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calGridDayNumPast: {
    color: '#D1D5DB',
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
    marginBottom: 32,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
