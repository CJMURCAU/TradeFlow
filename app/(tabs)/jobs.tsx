import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase, Job, Client } from '@/lib/supabase';
import { Trash2, Calendar } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type JobStatus = 'all' | 'pending' | 'active' | 'completed';

export default function JobsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [jobs, setJobs] = useState<(Job & { client?: Client })[]>([]);
  const [filterStatus, setFilterStatus] = useState<JobStatus>('all');

  useEffect(() => {
    if (params.filter) {
      setFilterStatus(params.filter as JobStatus);
    }
    fetchJobs();
  }, [params.filter]);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });

    if (data) {
      const jobsWithClient = data.map(job => ({
        ...job,
        client: Array.isArray(job.client) ? job.client[0] : job.client,
      }));
      setJobs(jobsWithClient);
    }
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
            const { error } = await supabase
              .from('jobs')
              .delete()
              .eq('id', id);

            if (!error) {
              fetchJobs();
            }
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredJobs = filterStatus === 'all'
    ? jobs
    : jobs.filter(job => job.status === filterStatus);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
        <View style={styles.filterContainer}>
          {(['all', 'pending', 'active', 'completed'] as JobStatus[]).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setFilterStatus(status)}>
              <Text
                style={[
                  styles.filterText,
                  filterStatus === status && styles.filterTextActive,
                ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {filteredJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No {filterStatus !== 'all' ? filterStatus : ''} jobs found
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
                {job.client && (
                  <Text style={styles.jobClient}>{job.client.name}</Text>
                )}
                <View style={styles.jobFooter}>
                  <View style={styles.jobDate}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.jobDateText}>
                      {formatDate(job.scheduled_time)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteJob(job.id, job.title)}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
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
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#F59E0B',
  },
  filterText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
  },
  jobCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobContent: {
    flex: 1,
    padding: 16,
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
    marginBottom: 4,
  },
  jobClient: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobDateText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
});
