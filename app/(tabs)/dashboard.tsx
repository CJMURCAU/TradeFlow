import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { supabase, Job, TimeEntry } from '@/lib/supabase';
import { Clock, Briefcase, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TabBar from '@/components/TabBar';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    hoursThisWeek: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [jobsResponse, timeEntriesResponse] = await Promise.all([
      supabase.from('jobs').select('*'),
      supabase.from('time_entries').select('*'),
    ]);

    if (jobsResponse.data) {
      const active = jobsResponse.data.filter(j => j.status === 'active').length;
      const completed = jobsResponse.data.filter(j => j.status === 'completed').length;
      const pending = jobsResponse.data.filter(j => j.status === 'pending').length;

      setStats(prev => ({
        ...prev,
        activeJobs: active,
        completedJobs: completed,
        pendingJobs: pending,
      }));
    }

    if (timeEntriesResponse.data) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const weekEntries = timeEntriesResponse.data.filter(entry => {
        const entryDate = new Date(entry.start_time);
        return entryDate >= startOfWeek;
      });

      const totalMinutes = weekEntries.reduce((total, entry) => {
        const start = new Date(entry.start_time);
        const end = entry.end_time ? new Date(entry.end_time) : new Date();
        const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return total + minutes;
      }, 0);

      setStats(prev => ({
        ...prev,
        hoursThisWeek: Math.round((totalMinutes / 60) * 10) / 10,
      }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <Image
          source={require('@/assets/images/tradepro_emblem.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Clock size={32} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.hoursThisWeek}</Text>
            <Text style={styles.statLabel}>Hours This Week</Text>
          </View>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push({ pathname: '/jobs', params: { filter: 'active' } })}>
            <View style={styles.statIconContainer}>
              <Briefcase size={32} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats.activeJobs}</Text>
            <Text style={styles.statLabel}>Active Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push({ pathname: '/jobs', params: { filter: 'completed' } })}>
            <View style={styles.statIconContainer}>
              <CheckCircle size={32} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{stats.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed Jobs</Text>
          </TouchableOpacity>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <AlertCircle size={32} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.pendingJobs}</Text>
            <Text style={styles.statLabel}>Pending Jobs</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/newjob')}>
            <Text style={styles.actionButtonText}>Create New Job</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/newclient')}>
            <Text style={styles.actionButtonText}>Add New Client</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/clients')}>
            <Text style={styles.actionButtonText}>View All Clients</Text>
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
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  pageTitle: {
    fontSize: 22,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    width: '50%',
    padding: 8,
  },
  statIconContainer: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
