import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { supabase, Job, Client, Part, TimeEntry, BusinessDetails, Employee, JobAssignment } from '@/lib/supabase';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useRole } from '@/lib/roleContext';
import { ArrowLeft, Play, Pause, Square, Mail, Plus, Trash2, MapPin, Navigation, UserCheck, Users, CircleCheck as CheckCircle, ChevronDown } from 'lucide-react-native';

export default function JobDetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role, employeeRecord } = useRole();

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
  const [partError, setPartError] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [stopTimerModal, setStopTimerModal] = useState(false);
  const [markCompleteModal, setMarkCompleteModal] = useState(false);

  // Owner: employee assignment
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<(JobAssignment & { employee?: Employee })[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  // Employee: mark-as-complete
  const [myAssignment, setMyAssignment] = useState<JobAssignment | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [markedCompleteSuccess, setMarkedCompleteSuccess] = useState(false);

  useEffect(() => {
    if (id) fetchJobDetails();
    fetchBusinessDetails();
  }, [id]);

  useEffect(() => {
    if (role === 'owner' && id) fetchAssignments();
    if (role === 'employee' && id) fetchEmployeeData();
  }, [role, employeeRecord, id]);

  const fetchBusinessDetails = async () => {
    const { data } = await supabase
      .from('business_details')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) { setBusiness(data); setHourlyRate(data.default_hourly_rate ?? 0); }
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
        client: Array.isArray(jobResponse.data.client) ? jobResponse.data.client[0] : jobResponse.data.client,
      };
      setJob(jobWithClient);
      setDescription(jobWithClient.description);
    }

    if (partsResponse.data) setParts(partsResponse.data);

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

  const fetchAssignments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [empRes, assignRes] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('job_assignments').select('*').eq('job_id', id as string),
    ]);

    if (empRes.data) setEmployees(empRes.data);

    if (assignRes.data) {
      const empMap = new Map((empRes.data || []).map((e: Employee) => [e.id, e]));
      const enriched = assignRes.data.map(a => ({ ...a, employee: empMap.get(a.employee_id) }));
      setAssignments(enriched);
    }
  };

  const fetchEmployeeData = async () => {
    let empId = employeeRecord?.id ?? null;

    if (!empId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_user_id', user.id)
        .maybeSingle();
      empId = emp?.id ?? null;
    }

    if (!empId) return;

    const { data } = await supabase.from('job_assignments')
      .select('*')
      .eq('job_id', id as string)
      .eq('employee_id', empId)
      .maybeSingle();

    if (data) setMyAssignment(data);
  };

  const handleAssignEmployee = async (employee: Employee) => {
    setAssignLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAssignLoading(false); return; }

    await supabase.from('job_assignments').upsert({
      job_id: id as string,
      employee_id: employee.id,
      assigned_by: user.id,
    });

    setShowAssignDropdown(false);
    setAssignLoading(false);
    fetchAssignments();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await supabase.from('job_assignments').delete().eq('id', assignmentId);
    fetchAssignments();
  };

  const handleMarkComplete = async () => {
    if (!myAssignment || !employeeRecord || !job) return;
    setMarkingComplete(true);
    setMarkCompleteModal(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingComplete(false); return; }

    await supabase.from('job_assignments')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', myAssignment.id);

    const { data: emp } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employeeRecord.id)
      .maybeSingle();

    if (emp) {
      await supabase.from('employee_notifications').insert({
        recipient_user_id: emp.user_id,
        message: `${employeeRecord.name} has completed job #${job.job_card_number}: ${job.title}`,
        job_id: id as string,
      });
    }

    setMarkingComplete(false);
    setMarkedCompleteSuccess(true);
    fetchEmployeeData();
  };

  const startTimer = async () => {
    if (!job || job.status === 'completed') return;

    const timeEntryPayload: Record<string, unknown> = {
      job_id: id,
      start_time: new Date().toISOString(),
      is_running: true,
    };
    if (role === 'employee' && employeeRecord) {
      timeEntryPayload.employee_id = employeeRecord.id;
    }

    const [timeEntryResult] = await Promise.all([
      supabase.from('time_entries').insert(timeEntryPayload).select().single(),
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
    const { error } = await supabase.from('time_entries')
      .update({ end_time: new Date().toISOString(), is_running: false })
      .eq('id', currentTimeEntry.id);

    if (!error) {
      isTimerRunningRef.current = false;
      currentTimeEntryRef.current = null;
      setIsTimerRunning(false);
      setCurrentTimeEntry(null);
      fetchJobDetails();
    }
  };

  const stopTimer = () => setStopTimerModal(true);

  const addPart = async () => {
    setPartError('');
    if (!newPart.name.trim()) { setPartError('Please enter a part name'); return; }
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
    if (!error) fetchJobDetails();
  };

  const addEmployeePart = async () => {
    setPartError('');
    if (!newPart.name.trim()) { setPartError('Please enter an item name'); return; }
    if (!employeeRecord) return;
    const { error } = await supabase.from('parts').insert({
      job_id: id,
      name: newPart.name,
      cost: parseFloat(newPart.cost) || 0,
      quantity: parseInt(newPart.quantity) || 1,
      employee_id: employeeRecord.id,
    });
    if (!error) {
      setNewPart({ name: '', cost: '', quantity: '1' });
      setShowAddPart(false);
      fetchJobDetails();
    }
  };

  const saveDescriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    if (saveDescriptionDebounceRef.current) clearTimeout(saveDescriptionDebounceRef.current);
    saveDescriptionDebounceRef.current = setTimeout(async () => {
      if (!job) return;
      await supabase.from('jobs').update({ description: text }).eq('id', job.id as string);
    }, 800);
  }, [job]);

  const updateJobStatus = async (status: 'pending' | 'active' | 'completed') => {
    if (!job) return;
    const { error } = await supabase.from('jobs').update({ status }).eq('id', job.id);
    if (!error) fetchJobDetails();
  };

  const sendJobCardViaService = async () => {
    if (!job) return;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    setIsSendingEmail(true);
    setEmailStatus(null);
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
        setEmailStatus({ type: 'error', message: result.error + (detail ? `\n\n${detail}` : '') || 'Something went wrong.' });
        return;
      }
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      setJob(prev => prev ? { ...prev, status: 'completed' } : prev);
      setEmailStatus({ type: 'success', message: `Job card emailed to ${result.sentTo}` });
      fetchJobDetails();
    } catch {
      setEmailStatus({ type: 'error', message: 'Could not connect to email service. Please try again.' });
    } finally {
      setIsSendingEmail(false);
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

  const getTotalTime = () => timeEntries.reduce((total, entry) => {
    const start = new Date(entry.start_time).getTime();
    const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
    return total + (end - start);
  }, 0) / 1000;

  const getTotalPartsCost = () => parts.reduce((total, part) => total + (part.cost * part.quantity), 0);

  const getLabourCost = () => {
    if (employees.length === 0) {
      return (getTotalTime() / 3600) * hourlyRate;
    }
    const empRateMap = new Map(employees.map(e => [e.id, e.hourly_rate]));
    return timeEntries.reduce((total, entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
      const hours = (end - start) / 3600000;
      const empRate = entry.employee_id != null ? empRateMap.get(entry.employee_id) : undefined;
      const rate = empRate != null ? empRate : hourlyRate;
      return total + hours * rate;
    }, 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const unassignedActiveEmployees = employees.filter(
    e => !assignments.find(a => a.employee_id === e.id)
  );

  if (!job) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  const isEmployee = role === 'employee';

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
        {/* Job Info */}
        <View style={styles.section}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          {job.purchase_order_number && <Text style={styles.poNumber}>PO: {job.purchase_order_number}</Text>}
          {job.client && <Text style={styles.clientName}>{job.client.name}</Text>}
          {job.client?.address && (
            <TouchableOpacity style={styles.addressButton} onPress={openDirections}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.addressText}>{job.client.address}</Text>
              <Navigation size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status — owner only */}
        {!isEmployee && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusButtons}>
              {(['pending', 'active', 'completed'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.statusButton, job.status === status && { backgroundColor: getStatusColor(status) }]}
                  onPress={() => updateJobStatus(status)}>
                  <Text style={[styles.statusButtonText, job.status === status && styles.statusButtonTextActive]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Timer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timer</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timerDisplay}>{formatTime(elapsedTime)}</Text>
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

        {/* Description */}
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
            editable={!isEmployee}
          />
        </View>

        {/* Parts — owner only */}
        {!isEmployee && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Parts</Text>
              <TouchableOpacity onPress={() => { setShowAddPart(!showAddPart); setPartError(''); }}>
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
                {partError ? <Text style={styles.errorText}>{partError}</Text> : null}
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
        )}

        {/* Cost Summary — owner only */}
        {!isEmployee && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Time:</Text>
                <Text style={styles.summaryValue}>{formatTime(Math.floor(getTotalTime()))}</Text>
              </View>

              {/* Per-employee labour breakdown */}
              {(() => {
                const empRateMap = new Map(employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate }]));
                const perEmployee = new Map<string, { name: string; seconds: number; rate: number }>();

                timeEntries.forEach(entry => {
                  const start = new Date(entry.start_time).getTime();
                  const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
                  const secs = Math.floor((end - start) / 1000);
                  const key = entry.employee_id ?? '__owner__';
                  const empInfo = entry.employee_id != null ? empRateMap.get(entry.employee_id) : undefined;
                  const name = empInfo?.name ?? 'Owner';
                  const rate = empInfo?.rate != null ? empInfo.rate : hourlyRate;
                  const existing = perEmployee.get(key);
                  if (existing) {
                    existing.seconds += secs;
                  } else {
                    perEmployee.set(key, { name, seconds: secs, rate });
                  }
                });

                const rows = Array.from(perEmployee.values());
                if (rows.length <= 1) {
                  return (
                    <View style={styles.summaryRow}>
                      <View>
                        <Text style={styles.summaryLabel}>Labour Cost:</Text>
                        {hourlyRate > 0 && <Text style={styles.summarySubLabel}>${hourlyRate.toFixed(2)}/hr</Text>}
                      </View>
                      <Text style={styles.summaryValue}>{hourlyRate > 0 ? `$${getLabourCost().toFixed(2)}` : '—'}</Text>
                    </View>
                  );
                }

                return (
                  <>
                    <Text style={styles.summaryBreakdownHeading}>Labour Cost:</Text>
                    {rows.map(row => (
                      <View key={row.name} style={styles.summaryBreakdownRow}>
                        <View>
                          <Text style={styles.summaryBreakdownName}>{row.name}</Text>
                          <Text style={styles.summarySubLabel}>
                            {formatTime(row.seconds)} @ ${row.rate.toFixed(2)}/hr
                          </Text>
                        </View>
                        <Text style={styles.summaryValue}>
                          ${((row.seconds / 3600) * row.rate).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.summaryBreakdownTotalRow}>
                      <Text style={styles.summaryLabel}>Labour Total:</Text>
                      <Text style={styles.summaryValue}>${getLabourCost().toFixed(2)}</Text>
                    </View>
                  </>
                );
              })()}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Parts Cost:</Text>
                <Text style={styles.summaryValue}>${getTotalPartsCost().toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total:</Text>
                <Text style={styles.summaryTotalValue}>${(getLabourCost() + getTotalPartsCost()).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Hours Worked + Costs + Mark Complete — employee only */}
        {isEmployee && (
          <>
            {/* Hours worked summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hours Worked</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Time:</Text>
                  <Text style={styles.summaryValue}>{formatTime(Math.floor(getTotalTime()))}</Text>
                </View>
              </View>
            </View>

            {/* Costs submitted by this employee */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Costs</Text>
                {employeeRecord && (
                  <TouchableOpacity onPress={() => { setShowAddPart(!showAddPart); setPartError(''); }}>
                    <Plus size={20} color="#F59E0B" />
                  </TouchableOpacity>
                )}
              </View>

              {showAddPart && employeeRecord && (
                <View style={styles.addPartForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Item name"
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
                  {partError ? <Text style={styles.errorText}>{partError}</Text> : null}
                  <TouchableOpacity style={styles.addButton} onPress={addEmployeePart}>
                    <Text style={styles.addButtonText}>Add Cost</Text>
                  </TouchableOpacity>
                </View>
              )}

              {employeeRecord
                ? parts.filter(p => p.employee_id === employeeRecord.id).map(part => (
                    <View key={part.id} style={styles.partCard}>
                      <View style={styles.partInfo}>
                        <Text style={styles.partName}>{part.name}</Text>
                        <Text style={styles.partDetails}>
                          {`$${part.cost.toFixed(2)} x ${part.quantity} = $${(part.cost * part.quantity).toFixed(2)}`}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => deletePart(part.id)}>
                        <Trash2 size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                : parts.filter(p => p.employee_id == null).length === 0 && (
                    <Text style={styles.emptyText}>No costs submitted yet.</Text>
                  )
              }
            </View>

            {myAssignment && (
              <View style={styles.section}>
                {myAssignment.completed || markedCompleteSuccess ? (
                  <View style={styles.alreadyCompletedBanner}>
                    <CheckCircle size={20} color="#10B981" />
                    <Text style={styles.alreadyCompletedText}>You marked this job as complete</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.markCompleteButton, markingComplete && styles.buttonDisabled]}
                    onPress={() => setMarkCompleteModal(true)}
                    disabled={markingComplete}>
                    {markingComplete
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <>
                          <CheckCircle size={20} color="#FFFFFF" />
                          <Text style={styles.markCompleteButtonText}>Mark as Complete</Text>
                        </>}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* Assign Employees — owner only */}
        {!isEmployee && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Users size={18} color="#111827" />
                <Text style={styles.sectionTitle}>Assign to Employee</Text>
              </View>
            </View>

            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={[styles.dropdownTrigger, employees.length === 0 && styles.dropdownTriggerDisabled]}
                onPress={() => employees.length > 0 && setShowAssignDropdown(v => !v)}
                activeOpacity={employees.length > 0 ? 0.7 : 1}>
                <UserCheck size={16} color={employees.length > 0 ? '#6B7280' : '#D1D5DB'} />
                <Text style={[styles.dropdownTriggerText, employees.length === 0 && styles.dropdownTriggerTextDisabled]}>
                  {employees.length === 0
                    ? 'No active employees'
                    : unassignedActiveEmployees.length === 0
                      ? 'All employees assigned'
                      : 'Assign an employee...'}
                </Text>
                {employees.length > 0 && unassignedActiveEmployees.length > 0 && (
                  <ChevronDown size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>

              {showAssignDropdown && unassignedActiveEmployees.length > 0 && (
                <View style={styles.dropdownMenu}>
                  {assignLoading && (
                    <View style={styles.dropdownLoadingRow}>
                      <ActivityIndicator size="small" color="#F59E0B" />
                    </View>
                  )}
                  {unassignedActiveEmployees.map((emp, idx) => (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.dropdownItem,
                        idx < unassignedActiveEmployees.length - 1 && styles.dropdownItemBorder,
                      ]}
                      onPress={() => handleAssignEmployee(emp)}
                      disabled={assignLoading}>
                      <View style={styles.dropdownItemAvatar}>
                        <Text style={styles.dropdownItemAvatarText}>
                          {emp.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.dropdownItemInfo}>
                        <Text style={styles.dropdownItemName}>{emp.name}</Text>
                        {emp.email ? <Text style={styles.dropdownItemEmail}>{emp.email}</Text> : null}
                      </View>
                      <UserCheck size={16} color="#F59E0B" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {assignments.length > 0 && (
              <View style={styles.assignmentsList}>
                {assignments.map(a => (
                  <View key={a.id} style={styles.assignmentRow}>
                    <View style={styles.assignmentAvatar}>
                      <Text style={styles.assignmentAvatarText}>
                        {(a.employee?.name ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.assignmentInfo}>
                      <Text style={styles.assignmentName}>{a.employee?.name ?? 'Unknown'}</Text>
                      <Text style={styles.assignmentEmail}>{a.employee?.email ?? ''}</Text>
                    </View>
                    <View style={styles.assignmentRight}>
                      {a.completed && (
                        <View style={styles.completedBadge}>
                          <CheckCircle size={14} color="#10B981" />
                          <Text style={styles.completedBadgeText}>Done</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveAssignment(a.id)}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Send Job Card — owner only */}
        {!isEmployee && (
          <View style={styles.section}>
            {emailStatus && (
              <View style={[styles.emailStatusBanner, emailStatus.type === 'success' ? styles.emailStatusSuccess : styles.emailStatusError]}>
                <Text style={[styles.emailStatusText, emailStatus.type === 'success' ? styles.emailStatusTextSuccess : styles.emailStatusTextError]}>
                  {emailStatus.message}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.emailButton, job.email_sent && styles.emailButtonSent, isSendingEmail && styles.emailButtonDisabled]}
              onPress={sendJobCardViaService}
              disabled={isSendingEmail}>
              {isSendingEmail
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Mail size={20} color="#FFFFFF" />}
              <Text style={styles.emailButtonText}>
                {isSendingEmail ? 'Sending...' : job.email_sent ? 'Resend Job Card' : 'Send Job Card'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Stop Timer Confirmation Modal */}
      <Modal
        visible={stopTimerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setStopTimerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Stop Timer</Text>
            <Text style={styles.modalMessage}>Are you sure you want to stop the timer?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setStopTimerModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmDanger}
                onPress={() => { setStopTimerModal(false); pauseTimer(); }}>
                <Text style={styles.modalConfirmText}>Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark Complete Confirmation Modal */}
      <Modal
        visible={markCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setMarkCompleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mark as Complete</Text>
            <Text style={styles.modalMessage}>
              This will notify your employer that you've finished this job. Are you sure?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setMarkCompleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmGreen} onPress={handleMarkComplete}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { marginRight: 16 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 40 },
  loadingText: { color: '#111827', fontSize: 16, textAlign: 'center', marginTop: 100 },
  section: { marginBottom: 24 },
  jobTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  poNumber: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  clientName: { fontSize: 16, color: '#F59E0B', fontWeight: '600', marginBottom: 8 },
  addressButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 8,
  },
  addressText: { flex: 1, fontSize: 14, color: '#374151' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusButtons: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  statusButtonText: { color: '#6B7280', fontWeight: '600' },
  statusButtonTextActive: { color: '#FFFFFF' },
  timerContainer: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  timerDisplay: { fontSize: 48, fontWeight: 'bold', color: '#F59E0B', marginBottom: 20 },
  timerButtons: { flexDirection: 'row', gap: 12 },
  timerButton: {
    backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  timerButtonStop: { backgroundColor: '#EF4444' },
  timerButtonDisabled: { backgroundColor: '#D1D5DB' },
  timerCompletedNote: { fontSize: 13, color: '#10B981', fontWeight: '600', marginBottom: 12 },
  timerButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  descriptionInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB',
    minHeight: 100, textAlignVertical: 'top',
  },
  addPartForm: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12,
    fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12,
  },
  partRow: { flexDirection: 'row', gap: 12 },
  inputSmall: { flex: 1 },
  errorText: { fontSize: 13, color: '#EF4444', marginBottom: 10 },
  addButton: { backgroundColor: '#F59E0B', padding: 12, borderRadius: 8, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontWeight: '600' },
  partCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  partInfo: { flex: 1 },
  partName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  partDetails: { fontSize: 14, color: '#6B7280' },
  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 15, color: '#6B7280' },
  summarySubLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  summaryValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  summaryDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  summaryTotalLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  summaryTotalValue: { fontSize: 20, fontWeight: '800', color: '#F59E0B' },
  summaryBreakdownHeading: { fontSize: 15, color: '#6B7280', marginBottom: 6 },
  summaryBreakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#E5E7EB',
  },
  summaryBreakdownName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  summaryBreakdownTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 2,
  },
  // Dropdown
  dropdownWrapper: { marginBottom: 12 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownTriggerDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  dropdownTriggerText: { fontSize: 15, color: '#6B7280', flex: 1 },
  dropdownTriggerTextDisabled: { color: '#D1D5DB' },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  dropdownLoadingRow: { padding: 14, alignItems: 'center' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemAvatarText: { fontSize: 15, fontWeight: '700', color: '#D97706' },
  dropdownItemInfo: { flex: 1 },
  dropdownItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  dropdownItemEmail: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  // Assignments list
  assignmentsList: { marginTop: 8 },
  noAssignmentsText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assignmentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assignmentAvatarText: { fontSize: 16, fontWeight: '700', color: '#D97706' },
  assignmentInfo: { flex: 1 },
  assignmentName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  assignmentEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  assignmentRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  completedBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  removeButton: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  markCompleteButton: {
    backgroundColor: '#10B981', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  markCompleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  alreadyCompletedBanner: {
    backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  alreadyCompletedText: { fontSize: 15, fontWeight: '600', color: '#059669' },
  buttonDisabled: { opacity: 0.6 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  emailStatusBanner: {
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  emailStatusSuccess: { backgroundColor: '#D1FAE5' },
  emailStatusError: { backgroundColor: '#FEE2E2' },
  emailStatusText: { fontSize: 14, fontWeight: '500' },
  emailStatusTextSuccess: { color: '#059669' },
  emailStatusTextError: { color: '#DC2626' },
  emailButton: {
    backgroundColor: '#F59E0B', padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  emailButtonSent: { backgroundColor: '#10B981' },
  emailButtonDisabled: { opacity: 0.6 },
  emailButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  // Modals
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
  modalConfirmGreen: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#10B981', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
