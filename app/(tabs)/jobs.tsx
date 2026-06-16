import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { supabase, Job, Client, EmployeeNotification } from '@/lib/supabase';
import { Trash2, Calendar, Search, Bell, X, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getLocalJobs } from '@/lib/localDb';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import TabBar from '@/components/TabBar';
import { useRole } from '@/lib/roleContext';

type JobStatus = 'all' | 'pending' | 'active' | 'completed';

export default function JobsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { role, employeeRecord } = useRole();
  const { isOnline } = useNetworkStatus();

  const [jobs, setJobs] = useState<(Job & { client?: Client })[]>([]);
  const [filterStatus, setFilterStatus] = useState<JobStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications (owner only)
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isEmployee = role === 'employee';

  useEffect(() => {
    if (isEmployee || !role) return;
    fetchNotifications();
    setupRealtimeNotifications();
  }, [role]);

  const fetchJobs = useCallback(async () => {
    if (!isOnline) {
      const allLocal = getLocalJobs();
      if (isEmployee && employeeRecord && !employeeRecord.calendar_access) {
        // For restricted employees offline, show all cached jobs they have access to
        // (job_assignments are also cached — filter happens server-side normally)
        setJobs(allLocal);
      } else {
        setJobs(allLocal);
      }
      return;
    }

    if (isEmployee && employeeRecord) {
      if (employeeRecord.calendar_access) {
        const { data } = await supabase
          .from('jobs')
          .select('*, client:clients(*)')
          .order('created_at', { ascending: false });

        if (data) {
          setJobs(data.map(job => ({
            ...job,
            client: Array.isArray(job.client) ? job.client[0] : job.client,
          })));
        }
      } else {
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id')
          .eq('employee_id', employeeRecord.id);

        const jobIds = (assignments || []).map((a: { job_id: string }) => a.job_id);
        if (jobIds.length === 0) { setJobs([]); return; }

        const { data } = await supabase
          .from('jobs')
          .select('*, client:clients(*)')
          .in('id', jobIds)
          .order('created_at', { ascending: false });

        if (data) {
          setJobs(data.map(job => ({
            ...job,
            client: Array.isArray(job.client) ? job.client[0] : job.client,
          })));
        }
      }
    } else {
      const { data } = await supabase
        .from('jobs')
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false });

      if (data) {
        setJobs(data.map(job => ({
          ...job,
          client: Array.isArray(job.client) ? job.client[0] : job.client,
        })));
      }
    }
  }, [isEmployee, employeeRecord, isOnline]);

  useEffect(() => {
    if (params.filter) setFilterStatus(params.filter as JobStatus);
    fetchJobs();
  }, [params.filter, role, employeeRecord]);

  useFocusEffect(useCallback(() => {
    fetchJobs();
  }, [fetchJobs]));

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('employee_notifications')
      .select('*')
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data);
  };

  const setupRealtimeNotifications = () => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel('employee-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'employee_notifications',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as EmployeeNotification, ...prev]);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('employee_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    if (unread.length === 0) return;
    await supabase.from('employee_notifications').update({ read: true }).in('id', unread);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteJob = async (id: string, title: string) => {
    Alert.alert(
      'Delete Job',
      `Are you sure you want to delete "${title}"? This will also delete all associated parts and time entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('jobs').delete().eq('id', id);
            if (!error) fetchJobs();
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredJobs = jobs.filter(job => {
    const statusMatch = filterStatus === 'all' || job.status === filterStatus;
    if (!statusMatch) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const poMatch = job.purchase_order_number?.toLowerCase().includes(q);
    const jobCardMatch = job.job_card_number?.toString().toLowerCase().includes(q);
    const clientMatch = job.client?.name?.toLowerCase().includes(q) ||
      job.client?.company_name?.toLowerCase().includes(q);
    return poMatch || jobCardMatch || clientMatch;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{isEmployee ? 'My Jobs' : 'Jobs'}</Text>
          <View style={styles.headerRight}>
            {!isEmployee && (
              <TouchableOpacity
                style={styles.notifButton}
                onPress={() => setShowNotifications(!showNotifications)}>
                <Bell size={22} color="#374151" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <Image
              source={require('@/assets/images/tradepro_emblem.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Notification panel */}
        {showNotifications && !isEmployee && (
          <View style={styles.notifPanel}>
            <View style={styles.notifPanelHeader}>
              <Text style={styles.notifPanelTitle}>Notifications</Text>
              <View style={styles.notifPanelActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllRead}>
                    <Text style={styles.markAllReadText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)}>
                  <X size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
            {notifications.length === 0 && (
              <Text style={styles.noNotifText}>No notifications yet.</Text>
            )}
            {notifications.slice(0, 10).map(notif => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifItem, notif.read && styles.notifItemRead]}
                onPress={() => {
                  markNotificationRead(notif.id);
                  if (notif.job_id) {
                    setShowNotifications(false);
                    router.push(`/job/${notif.job_id}`);
                  }
                }}>
                <View style={styles.notifItemLeft}>
                  <CheckCircle size={16} color={notif.read ? '#9CA3AF' : '#10B981'} />
                  <Text style={[styles.notifMessage, notif.read && styles.notifMessageRead]}>
                    {notif.message}
                  </Text>
                </View>
                {!notif.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.filterContainer}>
          {(['all', 'pending', 'active', 'completed'] as JobStatus[]).map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
              onPress={() => setFilterStatus(status)}>
              <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchContainer}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by PO, job card or client..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {filteredJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {isEmployee
                ? 'No jobs assigned to you yet.'
                : `No ${filterStatus !== 'all' ? filterStatus : ''} jobs found`}
            </Text>
          </View>
        ) : (
          filteredJobs.map(job => (
            <View key={job.id} style={styles.jobCard}>
              <TouchableOpacity
                style={styles.jobContent}
                onPress={() => router.push(`/job/${job.id}`)}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobNumber}>#{job.job_card_number}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
                        {job.status.toUpperCase()}
                      </Text>
                    </View>
                    {job.status === 'completed' && job.email_sent && (
                      <View style={styles.sentBadge}>
                        <Text style={styles.sentBadgeText}>SENT</Text>
                      </View>
                    )}
                  </View>
                </View>
                {job.client && (
                  <Text style={styles.jobClient}>
                    {job.client.company_name || job.client.name}
                  </Text>
                )}
                <Text style={styles.jobTitle}>{job.title}</Text>
                {job.purchase_order_number && (
                  <Text style={styles.jobPO}>PO: {job.purchase_order_number}</Text>
                )}
                <View style={styles.jobFooter}>
                  <View style={styles.jobDate}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.jobDateText}>{formatDate(job.scheduled_time)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {!isEmployee && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteJob(job.id, job.title)}>
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoImage: { width: 44, height: 44 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  notifButton: { position: 'relative', padding: 4 },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  notifPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  notifPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  notifPanelTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  notifPanelActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllReadText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  noNotifText: { fontSize: 14, color: '#9CA3AF', padding: 16, textAlign: 'center' },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FEFCE8',
  },
  notifItemRead: { backgroundColor: '#FFFFFF' },
  notifItemLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  notifMessage: { fontSize: 13, color: '#111827', lineHeight: 18, flex: 1, fontWeight: '500' },
  notifMessageRead: { color: '#6B7280', fontWeight: '400' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginLeft: 8, marginTop: 3 },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButton: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#F59E0B' },
  filterText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  content: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { fontSize: 16, color: '#6B7280' },
  jobCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 12,
    overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: '#E5E7EB',
  },
  jobContent: { flex: 1, padding: 16 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#10B981' + '20' },
  sentBadgeText: { fontSize: 10, fontWeight: '700', color: '#10B981' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  jobNumber: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' },
  jobTitle: { fontSize: 14, fontWeight: '400', color: '#6B7280', marginBottom: 4 },
  jobPO: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  jobClient: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  jobFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jobDate: { flexDirection: 'row', alignItems: 'center' },
  jobDateText: { fontSize: 12, color: '#6B7280', marginLeft: 6 },
  deleteButton: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#F9FAFB' },
});
