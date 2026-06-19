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
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { supabase, Job, Client, Part, TimeEntry, BusinessDetails, Employee, JobAssignment } from '@/lib/supabase';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useRole } from '@/lib/roleContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  getLocalJob,
  getLocalParts,
  getLocalTimeEntries,
  getLocalBusinessDetails,
  updateLocalJob,
  insertLocalTimeEntry,
  updateLocalTimeEntry,
  insertLocalPart,
  deleteLocalPart,
  enqueue,
} from '@/lib/localDb';
import { ArrowLeft, Play, Pause, Square, Mail, Plus, Trash2, MapPin, Navigation, UserCheck, Users, CircleCheck as CheckCircle, ChevronDown, Pencil, X, Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react-native';

const EDIT_CAL_WIDTH = Dimensions.get('window').width - 32;

export default function JobDetailPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role, employeeRecord } = useRole();
  const { isOnline } = useNetworkStatus();

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

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    client_id: '',
    title: '',
    purchase_order_number: '',
    date: '',
    hour: '09',
    minute: '00',
  });
  const [editClients, setEditClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editCalendarIndex, setEditCalendarIndex] = useState(0);
  const editCalFlatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) fetchJobDetails();
    fetchBusinessDetails();
    fetchEditClients();
  }, [id]);

  useEffect(() => {
    if (role === 'owner' && id) fetchAssignments();
    if (role === 'employee' && id) fetchEmployeeData();
    // Re-scope timer state now that role/employee identity is known
    if (role && timeEntries.length > 0) applyTimerState(timeEntries);
  }, [role, employeeRecord, id]);

  const fetchBusinessDetails = async () => {
    let data: BusinessDetails | null = null;
    if (isOnline) {
      const res = await supabase.from('business_details').select('*').limit(1).maybeSingle();
      data = res.data;
    } else {
      data = getLocalBusinessDetails();
    }
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
    if (isOnline) {
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
        applyTimerState(timeEntriesResponse.data);
      }
    } else {
      const localJob = getLocalJob(id as string);
      if (localJob) { setJob(localJob); setDescription(localJob.description ?? ''); }

      const localParts = getLocalParts(id as string);
      setParts(localParts);

      const localEntries = getLocalTimeEntries(id as string);
      setTimeEntries(localEntries);
      applyTimerState(localEntries);
    }
  };

  const applyTimerState = useCallback((entries: TimeEntry[]) => {
    // Determine which entries belong to the current viewer:
    // - owner/employer: entries with no employee_id (their own)
    // - employee: entries matching their employee record id
    const myEntries = role === 'employee' && employeeRecord
      ? entries.filter(e => e.employee_id === employeeRecord.id)
      : entries.filter(e => !e.employee_id);

    const running = myEntries.find(entry => entry.is_running);
    const completedEntries = myEntries.filter(entry => !entry.is_running && entry.end_time);
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
      setCurrentTimeEntry(null);
      setIsTimerRunning(false);
      setElapsedTime(completedSeconds);
    }
  }, [role, employeeRecord]);

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
    if (!myAssignment || !job) return;
    setMarkingComplete(true);
    setMarkCompleteModal(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingComplete(false); return; }

    // Stop any running timer before marking complete
    if (currentTimeEntry) {
      await supabase.from('time_entries')
        .update({ end_time: new Date().toISOString(), is_running: false })
        .eq('id', currentTimeEntry.id);
      isTimerRunningRef.current = false;
      currentTimeEntryRef.current = null;
      setIsTimerRunning(false);
      setCurrentTimeEntry(null);
    }

    await supabase.from('job_assignments')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', myAssignment.id);

    const empId = employeeRecord?.id ?? myAssignment.employee_id;
    const { data: emp } = await supabase
      .from('employees')
      .select('user_id, name')
      .eq('id', empId)
      .maybeSingle();

    if (emp) {
      await supabase.from('employee_notifications').insert({
        recipient_user_id: emp.user_id,
        message: `${emp.name} has completed job #${job.job_card_number}: ${job.title}`,
        job_id: id as string,
      });
    }

    setMarkingComplete(false);
    setMarkedCompleteSuccess(true);
    fetchEmployeeData();
  };

  const startTimer = async () => {
    if (!job || job.status === 'completed') return;

    const now = new Date().toISOString();
    const tempId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const employeeId = (role === 'employee' && employeeRecord) ? employeeRecord.id : null;

    const localEntry: TimeEntry = {
      id: tempId,
      job_id: id as string,
      employee_id: employeeId,
      start_time: now,
      end_time: null,
      is_running: true,
      created_at: now,
    };

    // Optimistic update
    insertLocalTimeEntry(localEntry);
    updateLocalJob(id as string, { status: 'active' });
    currentTimeEntryRef.current = localEntry;
    isTimerRunningRef.current = true;
    setCurrentTimeEntry(localEntry);
    setIsTimerRunning(true);
    setJob(prev => prev ? { ...prev, status: 'active' } : prev);
    setTimeEntries(prev => [localEntry, ...prev]);

    const payload: Record<string, unknown> = {
      job_id: id,
      start_time: now,
      is_running: true,
    };
    if (employeeId) payload.employee_id = employeeId;

    if (isOnline) {
      const [timeEntryResult] = await Promise.all([
        supabase.from('time_entries').insert(payload).select().single(),
        supabase.from('jobs').update({ status: 'active' }).eq('id', id as string),
      ]);
      const { data } = timeEntryResult;
      if (data) {
        // Replace temp entry with the real server record
        insertLocalTimeEntry({ ...localEntry, id: data.id });
        currentTimeEntryRef.current = data;
        setCurrentTimeEntry(data);
        setTimeEntries(prev => prev.map(e => e.id === tempId ? data : e));
      }
    } else {
      enqueue({ table_name: 'time_entries', operation: 'insert', payload: { ...payload, id: tempId } });
      enqueue({ table_name: 'jobs', operation: 'update', payload: { id: id as string, status: 'active' } });
    }
  };

  const pauseTimer = async () => {
    if (!currentTimeEntry) return;
    const endTime = new Date().toISOString();

    // Optimistic update
    updateLocalTimeEntry(currentTimeEntry.id, { end_time: endTime, is_running: false });
    isTimerRunningRef.current = false;
    currentTimeEntryRef.current = null;
    setIsTimerRunning(false);
    setCurrentTimeEntry(null);
    setTimeEntries(prev => prev.map(e =>
      e.id === currentTimeEntry.id ? { ...e, end_time: endTime, is_running: false } : e
    ));

    if (isOnline) {
      await supabase.from('time_entries')
        .update({ end_time: endTime, is_running: false })
        .eq('id', currentTimeEntry.id);
      fetchJobDetails();
    } else {
      enqueue({
        table_name: 'time_entries',
        operation: 'update',
        payload: { id: currentTimeEntry.id, end_time: endTime, is_running: false },
      });
    }
  };

  const stopTimer = () => setStopTimerModal(true);

  const addPart = async () => {
    setPartError('');
    if (!newPart.name.trim()) { setPartError('Please enter a part name'); return; }
    const now = new Date().toISOString();
    const tempId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const payload = {
      job_id: id as string,
      name: newPart.name,
      cost: parseFloat(newPart.cost) || 0,
      quantity: parseInt(newPart.quantity) || 1,
    };
    const localPart: Part = { id: tempId, ...payload, employee_id: null, created_at: now };

    insertLocalPart(localPart);
    setParts(prev => [...prev, localPart]);
    setNewPart({ name: '', cost: '', quantity: '1' });
    setShowAddPart(false);

    if (isOnline) {
      const { data } = await supabase.from('parts').insert(payload).select().single();
      if (data) {
        insertLocalPart({ ...localPart, id: data.id });
        setParts(prev => prev.map(p => p.id === tempId ? data : p));
      }
    } else {
      enqueue({ table_name: 'parts', operation: 'insert', payload: { ...payload, id: tempId } });
    }
  };

  const deletePart = async (partId: string) => {
    deleteLocalPart(partId);
    setParts(prev => prev.filter(p => p.id !== partId));
    if (isOnline) {
      await supabase.from('parts').delete().eq('id', partId);
    } else {
      enqueue({ table_name: 'parts', operation: 'delete', payload: { id: partId } });
    }
  };

  const addEmployeePart = async () => {
    setPartError('');
    if (!newPart.name.trim()) { setPartError('Please enter an item name'); return; }
    if (!employeeRecord) return;
    const now = new Date().toISOString();
    const tempId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const payload = {
      job_id: id as string,
      name: newPart.name,
      cost: parseFloat(newPart.cost) || 0,
      quantity: parseInt(newPart.quantity) || 1,
      employee_id: employeeRecord.id,
    };
    const localPart: Part = { id: tempId, ...payload, created_at: now };

    insertLocalPart(localPart);
    setParts(prev => [...prev, localPart]);
    setNewPart({ name: '', cost: '', quantity: '1' });
    setShowAddPart(false);

    if (isOnline) {
      const { data } = await supabase.from('parts').insert(payload).select().single();
      if (data) {
        insertLocalPart({ ...localPart, id: data.id });
        setParts(prev => prev.map(p => p.id === tempId ? data : p));
      }
    } else {
      enqueue({ table_name: 'parts', operation: 'insert', payload: { ...payload, id: tempId } });
    }
  };

  const saveDescriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    if (saveDescriptionDebounceRef.current) clearTimeout(saveDescriptionDebounceRef.current);
    saveDescriptionDebounceRef.current = setTimeout(async () => {
      if (!job) return;
      updateLocalJob(job.id, { description: text });
      if (isOnlineRef.current) {
        await supabase.from('jobs').update({ description: text }).eq('id', job.id as string);
      } else {
        enqueue({ table_name: 'jobs', operation: 'update', payload: { id: job.id, description: text } });
      }
    }, 800);
  }, [job]);

  const updateJobStatus = async (status: 'pending' | 'active' | 'completed') => {
    if (!job) return;
    updateLocalJob(job.id, { status });
    setJob(prev => prev ? { ...prev, status } : prev);
    if (isOnline) {
      await supabase.from('jobs').update({ status }).eq('id', job.id);
      fetchJobDetails();
    } else {
      enqueue({ table_name: 'jobs', operation: 'update', payload: { id: job.id, status } });
    }
  };

  const sendJobCardViaService = async () => {
    if (!job) return;
    if (!isOnline) {
      setEmailStatus({ type: 'error', message: 'Internet connection required to send job card.' });
      return;
    }
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

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date}, ${time}`;
  };

  const formatSessionDuration = (startIso: string, endIso: string) => {
    const secs = Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const getMyTimeLog = () => {
    const mine = role === 'employee' && employeeRecord
      ? timeEntries.filter(e => e.employee_id === employeeRecord.id)
      : timeEntries.filter(e => !e.employee_id);
    return [...mine].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  // Set of employee IDs whose assignments are marked completed
  const completedAssignmentEmployeeIds = new Set(
    assignments.filter(a => a.completed).map(a => a.employee_id)
  );

  // Owner's own time (no employee_id) — running entry ticks live
  const getOwnerLabourSeconds = () =>
    timeEntries
      .filter(e => e.employee_id == null)
      .reduce((total, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
        return total + (end - start) / 1000;
      }, 0);

  // Employee labour rows — only count employees whose assignment is completed,
  // and only count entries that have a real end_time (no live ticking)
  const getEmployeeLabourRows = (): { id: string; name: string; seconds: number; rate: number }[] => {
    const empRateMap = new Map(employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate ?? hourlyRate }]));
    const rowMap = new Map<string, { id: string; name: string; seconds: number; rate: number }>();
    timeEntries
      .filter(e => e.employee_id != null && completedAssignmentEmployeeIds.has(e.employee_id!) && e.end_time != null)
      .forEach(entry => {
        const empId = entry.employee_id!;
        const empInfo = empRateMap.get(empId) ?? { name: 'Employee', rate: hourlyRate };
        const start = new Date(entry.start_time).getTime();
        const end = new Date(entry.end_time!).getTime();
        const secs = (end - start) / 1000;
        const existing = rowMap.get(empId);
        if (existing) {
          existing.seconds += secs;
        } else {
          rowMap.set(empId, { id: empId, name: empInfo.name, seconds: secs, rate: empInfo.rate });
        }
      });
    return Array.from(rowMap.values());
  };

  const getLabourCost = () => {
    const ownerCost = (getOwnerLabourSeconds() / 3600) * hourlyRate;
    const empCost = getEmployeeLabourRows().reduce((sum, row) => sum + (row.seconds / 3600) * row.rate, 0);
    return ownerCost + empCost;
  };

  // Owner total time = owner entries + completed employee entries (no live ticking for employees)
  const getTotalTime = () => {
    const ownerMs = timeEntries
      .filter(e => e.employee_id == null)
      .reduce((total, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
        return total + (end - start);
      }, 0);
    const empMs = timeEntries
      .filter(e => e.employee_id != null && completedAssignmentEmployeeIds.has(e.employee_id!) && e.end_time != null)
      .reduce((total, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = new Date(entry.end_time!).getTime();
        return total + (end - start);
      }, 0);
    return (ownerMs + empMs) / 1000;
  };

  // Employee's own completed time (for their "Hours Worked" section)
  const getMyLabourSeconds = () =>
    timeEntries
      .filter(e => employeeRecord ? e.employee_id === employeeRecord.id : false)
      .reduce((total, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
        return total + (end - start) / 1000;
      }, 0);

  // Parts cost: owner-added parts only for owner summary; employee parts only when assignment completed
  const getTotalPartsCost = () =>
    parts
      .filter(p => p.employee_id == null || completedAssignmentEmployeeIds.has(p.employee_id))
      .reduce((total, part) => total + (part.cost * part.quantity), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const fetchEditClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name', { ascending: true });
    if (data) setEditClients(data);
  };

  const startEdit = () => {
    if (!job) return;
    const st = job.scheduled_time ? new Date(job.scheduled_time) : new Date();
    const date = `${st.getFullYear()}-${String(st.getMonth() + 1).padStart(2, '0')}-${String(st.getDate()).padStart(2, '0')}`;
    const hour = String(st.getHours()).padStart(2, '0');
    const rawMin = st.getMinutes();
    const snappedMin = [0, 15, 30, 45].reduce((prev, cur) =>
      Math.abs(cur - rawMin) < Math.abs(prev - rawMin) ? cur : prev, 0);
    const minute = String(snappedMin).padStart(2, '0');
    setEditForm({
      client_id: job.client_id ?? '',
      title: job.title,
      purchase_order_number: job.purchase_order_number ?? '',
      date,
      hour,
      minute,
    });
    setClientSearch('');
    setEditCalendarIndex(0);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setShowEditDatePicker(false);
  };

  const saveEdit = async () => {
    if (!job || !editForm.title.trim() || !editForm.client_id) return;
    setSaveLoading(true);
    const scheduledDateTime = `${editForm.date}T${editForm.hour}:${editForm.minute}:00`;
    const { error } = await supabase.from('jobs').update({
      client_id: editForm.client_id,
      title: editForm.title,
      purchase_order_number: editForm.purchase_order_number,
      scheduled_time: new Date(scheduledDateTime).toISOString(),
    }).eq('id', job.id);
    setSaveLoading(false);
    if (!error) {
      setIsEditing(false);
      fetchJobDetails();
    }
  };

  const getEditMonthForIndex = (index: number) => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + index);
    return base;
  };

  const onEditCalScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / EDIT_CAL_WIDTH);
    if (newIndex !== editCalendarIndex) setEditCalendarIndex(newIndex);
  };

  const navigateEditCalMonth = (direction: 'prev' | 'next') => {
    const newIndex = editCalendarIndex + (direction === 'next' ? 1 : -1);
    if (newIndex < 0) return;
    setEditCalendarIndex(newIndex);
    editCalFlatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
  };

  const renderEditCalMonth = ({ index }: { index: number }) => {
    const monthDate = getEditMonthForIndex(index);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const days: Date[] = [];
    const cur = new Date(startDate);
    while (days.length < 42) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return (
      <View style={{ width: EDIT_CAL_WIDTH, padding: 8 }}>
        <View style={styles.editCalGridHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={styles.editCalGridHeaderDay}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.editCalGridWeek}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = day.toDateString() === new Date().toDateString();
              const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const isSelected = editForm.date === dayStr;
              return (
                <TouchableOpacity
                  key={di}
                  disabled={!isCurrentMonth}
                  style={[
                    styles.editCalGridDay,
                    isToday && !isSelected && styles.editCalGridDayToday,
                    isSelected && styles.editCalGridDaySelected,
                    !isCurrentMonth && styles.editCalGridDayDisabled,
                  ]}
                  onPress={() => {
                    setEditForm(prev => ({ ...prev, date: dayStr }));
                    setShowEditDatePicker(false);
                  }}>
                  <Text style={[
                    styles.editCalGridDayNum,
                    !isCurrentMonth && styles.editCalGridDayNumOther,
                    isToday && !isSelected && styles.editCalGridDayNumToday,
                    isSelected && styles.editCalGridDayNumSelected,
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
        {/* Edit bar — owner only */}
        {!isEmployee && (
          <View style={styles.editBar}>
            {isEditing ? (
              <View style={styles.editBarActions}>
                <TouchableOpacity style={styles.cancelEditButton} onPress={cancelEdit}>
                  <X size={16} color="#6B7280" />
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveEditButton, saveLoading && styles.saveEditButtonDisabled]}
                  onPress={saveEdit}
                  disabled={saveLoading}>
                  {saveLoading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <>
                        <Check size={16} color="#FFFFFF" />
                        <Text style={styles.saveEditText}>Save</Text>
                      </>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.editButton} onPress={startEdit}>
                <Pencil size={15} color="#F59E0B" />
                <Text style={styles.editButtonText}>Edit Job</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Job Info — view or edit */}
        {isEditing ? (
          <View style={styles.section}>
            <Text style={styles.editSectionHeading}>Edit Job Details</Text>

            {/* Client picker */}
            <Text style={styles.editLabel}>Client *</Text>
            <View style={styles.editClientDropdownWrapper}>
              <View style={styles.editClientSearchBox}>
                <TextInput
                  style={styles.editClientSearchInput}
                  placeholder="Search clients..."
                  placeholderTextColor="#9CA3AF"
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <ScrollView style={styles.editClientDropdown} nestedScrollEnabled>
                {editClients
                  .filter(c => {
                    if (!clientSearch.trim()) return true;
                    const q = clientSearch.toLowerCase();
                    return c.company_name?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q);
                  })
                  .map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.editClientOption,
                        editForm.client_id === c.id && styles.editClientOptionActive,
                      ]}
                      onPress={() => setEditForm(prev => ({ ...prev, client_id: c.id }))}>
                      <Text style={[
                        styles.editClientOptionName,
                        editForm.client_id === c.id && styles.editClientOptionNameActive,
                      ]}>
                        {c.company_name || c.name}
                      </Text>
                      {c.name && c.company_name && (
                        <Text style={styles.editClientOptionDetail}>{c.name}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>

            {/* Title */}
            <Text style={styles.editLabel}>Job Title *</Text>
            <TextInput
              style={styles.editInput}
              placeholder="Job title"
              placeholderTextColor="#9CA3AF"
              value={editForm.title}
              onChangeText={text => setEditForm(prev => ({ ...prev, title: text }))}
            />

            {/* PO Number */}
            <Text style={styles.editLabel}>Purchase Order Number</Text>
            <TextInput
              style={styles.editInput}
              placeholder="PO number"
              placeholderTextColor="#9CA3AF"
              value={editForm.purchase_order_number}
              onChangeText={text => setEditForm(prev => ({ ...prev, purchase_order_number: text }))}
            />

            {/* Date */}
            <Text style={styles.editLabel}>Date</Text>
            <TouchableOpacity style={styles.editDateButton} onPress={() => setShowEditDatePicker(true)}>
              <CalendarIcon size={18} color="#F59E0B" />
              <Text style={styles.editDateButtonText}>
                {editForm.date
                  ? new Date(editForm.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select date'}
              </Text>
            </TouchableOpacity>

            {/* Time */}
            <Text style={styles.editLabel}>Time</Text>
            <View style={styles.editTimeDisplay}>
              <Text style={styles.editTimeDisplayText}>{editForm.hour}:{editForm.minute}</Text>
            </View>
            <Text style={styles.editTimeSubLabel}>Hour</Text>
            <View style={styles.editTimeGrid}>
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.editTimeCell, editForm.hour === h && styles.editTimeCellActive]}
                  onPress={() => setEditForm(prev => ({ ...prev, hour: h }))}>
                  <Text style={[styles.editTimeCellText, editForm.hour === h && styles.editTimeCellTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.editTimeSubLabel, { marginTop: 12 }]}>Minute</Text>
            <View style={styles.editMinuteRow}>
              {['00', '15', '30', '45'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.editMinuteCell, editForm.minute === m && styles.editTimeCellActive]}
                  onPress={() => setEditForm(prev => ({ ...prev, minute: m }))}>
                  <Text style={[styles.editTimeCellText, editForm.minute === m && styles.editTimeCellTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.purchase_order_number && <Text style={styles.poNumber}>PO: {job.purchase_order_number}</Text>}
            {job.client?.company_name && (
              <Text style={styles.clientCompany}>{job.client.company_name}</Text>
            )}
            {job.client?.name && (
              <Text style={styles.clientName}>{job.client.name}</Text>
            )}
            {job.client?.phone && (
              <Text style={styles.clientPhone}>{job.client.phone}</Text>
            )}
            {job.client?.address && (
              <TouchableOpacity style={styles.addressButton} onPress={openDirections}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.addressText}>{job.client.address}</Text>
                <Navigation size={16} color="#F59E0B" />
              </TouchableOpacity>
            )}
          </View>
        )}

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
                  style={[styles.timerButton, (job.status === 'completed' || (isEmployee && (myAssignment?.completed || markedCompleteSuccess))) && styles.timerButtonDisabled]}
                  onPress={startTimer}
                  disabled={job.status === 'completed' || (isEmployee && (myAssignment?.completed || markedCompleteSuccess))}>
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

            {/* Time Log */}
            {getMyTimeLog().length > 0 && (
              <>
                <View style={styles.timeLogDivider} />
                <Text style={styles.timeLogHeading}>Time Log</Text>
                {getMyTimeLog().map((entry, idx) => (
                  <View key={entry.id} style={styles.timeLogRow}>
                    <View style={styles.timeLogIndexCol}>
                      <Text style={styles.timeLogIndex}>{idx + 1}</Text>
                    </View>
                    <View style={styles.timeLogDetails}>
                      <View style={styles.timeLogLine}>
                        <Text style={styles.timeLogLabel}>Started</Text>
                        <Text style={styles.timeLogValue}>{formatTimestamp(entry.start_time)}</Text>
                      </View>
                      {entry.end_time ? (
                        <View style={styles.timeLogLine}>
                          <Text style={styles.timeLogLabel}>Stopped</Text>
                          <Text style={styles.timeLogValue}>
                            {formatTimestamp(entry.end_time)}
                            <Text style={styles.timeLogDuration}> ({formatSessionDuration(entry.start_time, entry.end_time)})</Text>
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.timeLogLine}>
                          <Text style={styles.timeLogLabel}>Status</Text>
                          <Text style={styles.timeLogRunning}>In progress...</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
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
              <Text style={styles.sectionTitle}>Costs</Text>
              <TouchableOpacity onPress={() => { setShowAddPart(!showAddPart); setPartError(''); }}>
                <Plus size={20} color="#F59E0B" />
              </TouchableOpacity>
            </View>

            {showAddPart && (
              <View style={styles.addPartForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Cost name"
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

            {parts.filter(p => p.employee_id == null).map(part => (
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

              {/* Labour breakdown — always show owner line + one line per employee */}
              <Text style={styles.summaryBreakdownHeading}>Labour Cost:</Text>
              {(() => {
                const ownerName = business?.tradesman_name || 'Owner';
                const ownerSecs = getOwnerLabourSeconds();
                const ownerCost = (ownerSecs / 3600) * hourlyRate;
                const empRows = getEmployeeLabourRows();
                const labourTotal = getLabourCost();
                return (
                  <>
                    <View style={styles.summaryBreakdownRow}>
                      <View>
                        <Text style={styles.summaryBreakdownName}>{ownerName}</Text>
                        <Text style={styles.summarySubLabel}>
                          {formatTime(Math.floor(ownerSecs))} @ {hourlyRate > 0 ? `$${hourlyRate.toFixed(2)}/hr` : 'no rate set'}
                        </Text>
                      </View>
                      <Text style={styles.summaryValue}>
                        {hourlyRate > 0 ? `$${ownerCost.toFixed(2)}` : '—'}
                      </Text>
                    </View>
                    {empRows.map(row => (
                      <View key={row.id} style={styles.summaryBreakdownRow}>
                        <View>
                          <Text style={styles.summaryBreakdownName}>{row.name}</Text>
                          <Text style={styles.summarySubLabel}>
                            {formatTime(Math.floor(row.seconds))} @ ${row.rate.toFixed(2)}/hr
                          </Text>
                        </View>
                        <Text style={styles.summaryValue}>
                          ${((row.seconds / 3600) * row.rate).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.summaryBreakdownTotalRow}>
                      <Text style={styles.summaryLabel}>Labour Total:</Text>
                      <Text style={styles.summaryValue}>${labourTotal.toFixed(2)}</Text>
                    </View>
                  </>
                );
              })()}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Costs:</Text>
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
                  <Text style={styles.summaryValue}>{formatTime(Math.floor(getMyLabourSeconds()))}</Text>
                </View>
              </View>
            </View>

            {/* Costs submitted by this employee */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Costs</Text>
                <TouchableOpacity onPress={() => { setShowAddPart(!showAddPart); setPartError(''); }}>
                  <Plus size={20} color="#F59E0B" />
                </TouchableOpacity>
              </View>

              {showAddPart && (
                <View style={styles.addPartForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Cost name"
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

              {parts.filter(p => employeeRecord ? p.employee_id === employeeRecord.id : p.employee_id != null).length === 0
                ? <Text style={styles.emptyText}>No costs submitted yet.</Text>
                : parts.filter(p => employeeRecord ? p.employee_id === employeeRecord.id : p.employee_id != null).map(part => (
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

      {/* Edit Date Picker Modal */}
      <Modal
        visible={showEditDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditDatePicker(false)}>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowEditDatePicker(false)}>
                <Text style={styles.editModalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.editCalNavRow}>
              <TouchableOpacity
                onPress={() => navigateEditCalMonth('prev')}
                style={[styles.editCalNavButton, editCalendarIndex === 0 && styles.editCalNavButtonDisabled]}
                disabled={editCalendarIndex === 0}>
                <ChevronLeft size={22} color={editCalendarIndex === 0 ? '#D1D5DB' : '#F59E0B'} />
              </TouchableOpacity>
              <Text style={styles.editCalNavTitle}>
                {getEditMonthForIndex(editCalendarIndex).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => navigateEditCalMonth('next')} style={styles.editCalNavButton}>
                <ChevronRight size={22} color="#F59E0B" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={editCalFlatListRef}
              data={Array.from({ length: 24 }, (_, i) => i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.toString()}
              renderItem={renderEditCalMonth}
              getItemLayout={(_, index) => ({ length: EDIT_CAL_WIDTH, offset: EDIT_CAL_WIDTH * index, index })}
              initialScrollIndex={0}
              onMomentumScrollEnd={onEditCalScrollEnd}
              style={styles.editCalFlatList}
            />
          </View>
        </View>
      </Modal>

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
  poNumber: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  clientCompany: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  clientName: { fontSize: 15, color: '#374151', fontWeight: '500', marginBottom: 2 },
  clientPhone: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
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
  timeLogDivider: { width: '100%', height: 1, backgroundColor: '#E5E7EB', marginTop: 20, marginBottom: 14 },
  timeLogHeading: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 10 },
  timeLogRow: { flexDirection: 'row', width: '100%', marginBottom: 10, alignItems: 'flex-start' },
  timeLogIndexCol: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 1,
  },
  timeLogIndex: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  timeLogDetails: { flex: 1 },
  timeLogLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 3 },
  timeLogLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', width: 54 },
  timeLogValue: { fontSize: 13, color: '#374151', flex: 1, flexWrap: 'wrap' },
  timeLogDuration: { fontSize: 12, color: '#9CA3AF' },
  timeLogRunning: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
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
  // Edit bar
  editBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  editBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  cancelEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  cancelEditText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  saveEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  saveEditButtonDisabled: { opacity: 0.6 },
  saveEditText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  // Edit form
  editSectionHeading: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  editLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  editInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editClientDropdownWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  editClientSearchBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  editClientSearchInput: { fontSize: 14, color: '#111827' },
  editClientDropdown: { maxHeight: 160, backgroundColor: '#F9FAFB' },
  editClientOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editClientOptionActive: { backgroundColor: '#F59E0B' },
  editClientOptionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  editClientOptionNameActive: { color: '#FFFFFF' },
  editClientOptionDetail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  editDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editDateButtonText: { fontSize: 15, color: '#111827', flex: 1 },
  editTimeDisplay: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  editTimeDisplayText: { fontSize: 26, fontWeight: '700', color: '#F59E0B', letterSpacing: 2 },
  editTimeSubLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  editTimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  editTimeCell: {
    width: '22%',
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editTimeCellActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  editTimeCellText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  editTimeCellTextActive: { color: '#FFFFFF', fontWeight: '700' },
  editMinuteRow: { flexDirection: 'row', gap: 8 },
  editMinuteCell: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Edit calendar modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '60%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  editModalDone: { color: '#F59E0B', fontSize: 16, fontWeight: '600' },
  editCalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editCalNavButton: { padding: 8 },
  editCalNavButtonDisabled: { opacity: 0.4 },
  editCalNavTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  editCalFlatList: { flexGrow: 0, flexShrink: 1, maxHeight: 320 },
  editCalGridHeader: { flexDirection: 'row', marginBottom: 6 },
  editCalGridHeaderDay: { flex: 1, textAlign: 'center', color: '#6B7280', fontSize: 12, fontWeight: '700' },
  editCalGridWeek: { flexDirection: 'row', marginBottom: 4 },
  editCalGridDay: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  editCalGridDayToday: { borderWidth: 2, borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  editCalGridDaySelected: { backgroundColor: '#F59E0B' },
  editCalGridDayDisabled: { backgroundColor: 'transparent' },
  editCalGridDayNum: { color: '#111827', fontSize: 13, fontWeight: '600' },
  editCalGridDayNumOther: { color: '#E5E7EB' },
  editCalGridDayNumToday: { color: '#F59E0B', fontWeight: '800' },
  editCalGridDayNumSelected: { color: '#FFFFFF', fontWeight: '800' },
});
