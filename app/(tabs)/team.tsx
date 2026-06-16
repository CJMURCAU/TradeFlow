import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import TradeFlowEmblem from '@/components/TradeFlowEmblem';
import { supabase, Employee, Job, Client, JobAssignment } from '@/lib/supabase';
import { getStatusColor } from '@/lib/status';
import { ChevronLeft, ChevronRight, Users, Building2, ChevronDown, ChevronUp, Calendar } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import TabBar from '@/components/TabBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EMPLOYEE_COLORS = [
  { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8', dot: '#3B82F6' }, // blue
  { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', dot: '#10B981' }, // green
  { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', dot: '#EF4444' }, // red
  { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', dot: '#F59E0B' }, // amber
  { bg: '#CFFAFE', border: '#67E8F9', text: '#155E75', dot: '#06B6D4' }, // cyan
  { bg: '#FCE7F3', border: '#F9A8D4', text: '#9D174D', dot: '#EC4899' }, // pink
  { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', dot: '#6B7280' }, // gray fallback
];

type EnrichedAssignment = JobAssignment & {
  job: Job & { client?: Client };
  employee: Employee;
};

type EmployeeWithAssignments = Employee & {
  assignments: EnrichedAssignment[];
  colorIndex: number;
};

function getWeekDays(weekOffset: number): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(today.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatWeekRange(days: Date[]) {
  const start = days[0];
  const end = days[6];
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithAssignments[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedStatusSections, setExpandedStatusSections] = useState<Set<string>>(new Set());
  const weekDays = getWeekDays(weekOffset);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [empRes, assignRes] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', user.id).eq('status', 'active').order('name'),
      supabase
        .from('job_assignments')
        .select('*, job:jobs(*, client:clients(*))')
        .eq('assigned_by', user.id),
    ]);

    const rawEmployees: Employee[] = empRes.data || [];
    const rawAssignments: any[] = assignRes.data || [];

    const result: EmployeeWithAssignments[] = rawEmployees.map((emp, idx) => {
      const assignments: EnrichedAssignment[] = rawAssignments
        .filter(a => a.employee_id === emp.id && a.job)
        .map(a => ({
          ...a,
          job: {
            ...a.job,
            client: Array.isArray(a.job.client) ? a.job.client[0] : a.job.client,
          },
          employee: emp,
        }));
      return { ...emp, assignments, colorIndex: idx % EMPLOYEE_COLORS.length };
    });

    setEmployees(result);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const toggleEmployee = (id: string) => {
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStatusSection = (key: string) => {
    setExpandedStatusSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getJobsForDay = (emp: EmployeeWithAssignments, day: Date) => {
    return emp.assignments.filter(a => {
      if (!a.job.scheduled_time) return false;
      return isSameDay(new Date(a.job.scheduled_time), day);
    });
  };

  const getWeekAssignments = (emp: EmployeeWithAssignments) => {
    return emp.assignments.filter(a => {
      if (!a.job.scheduled_time) return false;
      const d = new Date(a.job.scheduled_time);
      return d >= weekDays[0] && d <= new Date(weekDays[6].getTime() + 86399999);
    });
  };


  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = (d: Date) => isSameDay(d, today);

  // All assignments for week across all employees (for the shared grid)
  const allWeekAssignments = employees.flatMap(emp =>
    getWeekAssignments(emp).map(a => ({ ...a, colorIndex: emp.colorIndex }))
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Team</Text>
            <TradeFlowEmblem size={44} />
          </View>
        </View>
        <TabBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  if (employees.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Team</Text>
            <TradeFlowEmblem size={44} />
          </View>
        </View>
        <TabBar />
        <View style={styles.emptyContainer}>
          <Users size={52} color="#D1D5DB" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No active employees</Text>
          <Text style={styles.emptySubtitle}>Add and activate employees in the Business tab to see their schedules here.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/business' as any)}>
            <Building2 size={16} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Go to Business</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Team</Text>
          <TradeFlowEmblem size={44} />
        </View>
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

        {/* Week navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekOffset(w => w - 1)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Previous week">
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <View style={styles.weekNavCenter}>
            <Text style={styles.weekRangeText}>{formatWeekRange(weekDays)}</Text>
            {weekOffset !== 0 && (
              <TouchableOpacity onPress={() => setWeekOffset(0)} activeOpacity={0.7}>
                <Text style={styles.todayLink}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekOffset(w => w + 1)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Next week">
            <ChevronRight size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Color legend */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legendContainer}>
          {employees.map(emp => {
            const color = EMPLOYEE_COLORS[emp.colorIndex];
            return (
              <View key={emp.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color.dot }]} />
                <Text style={styles.legendName} numberOfLines={1}>{emp.name.split(' ')[0]}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Week grid */}
        <View style={styles.weekGrid}>
          {/* Day header row */}
          <View style={styles.dayHeaderRow}>
            {weekDays.map((d, i) => (
              <View key={i} style={[styles.dayHeaderCell, isToday(d) && styles.dayHeaderCellToday]}>
                <Text style={[styles.dayLabel, isToday(d) && styles.dayLabelToday]}>{DAY_LABELS[i]}</Text>
                <Text style={[styles.dayNumber, isToday(d) && styles.dayNumberToday]}>{d.getDate()}</Text>
              </View>
            ))}
          </View>

          {/* Job chips row */}
          <View style={styles.dayJobsRow}>
            {weekDays.map((day, di) => {
              const dayJobs = allWeekAssignments.filter(a => {
                if (!a.job.scheduled_time) return false;
                return isSameDay(new Date(a.job.scheduled_time), day);
              });
              return (
                <View key={di} style={[styles.dayCell, isToday(day) && styles.dayCellToday]}>
                  {dayJobs.length === 0 ? (
                    <View style={styles.emptyCellDash} />
                  ) : (
                    dayJobs.map((a, ci) => {
                      const color = EMPLOYEE_COLORS[a.colorIndex];
                      return (
                        <TouchableOpacity
                          key={`${a.id}-${ci}`}
                          style={[styles.jobChip, { backgroundColor: color.bg, borderColor: color.border }]}
                          onPress={() => router.push(`/job/${a.job.id}` as any)}
                          activeOpacity={0.75}>
                          <View style={[styles.jobChipDot, { backgroundColor: color.dot }]} />
                          <Text style={[styles.jobChipText, { color: color.text }]} numberOfLines={2}>
                            {a.job.client?.company_name || a.job.client?.name || a.job.title}
                          </Text>
                          {a.job.scheduled_time && (
                            <Text style={[styles.jobChipTime, { color: color.text }]}>{formatTime(a.job.scheduled_time)}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Employee cards */}
        <Text style={styles.sectionHeading}>Employees</Text>

        {employees.map(emp => {
          const color = EMPLOYEE_COLORS[emp.colorIndex];
          const isExpanded = expandedEmployees.has(emp.id);
          const weekCount = getWeekAssignments(emp).length;
          const totalActive = emp.assignments.filter(a => a.job.status === 'active').length;
          const totalPending = emp.assignments.filter(a => a.job.status === 'pending').length;

          const grouped: Record<string, EnrichedAssignment[]> = {
            active: emp.assignments.filter(a => a.job.status === 'active'),
            pending: emp.assignments.filter(a => a.job.status === 'pending'),
            completed: emp.assignments.filter(a => a.job.status === 'completed'),
          };

          return (
            <View key={emp.id} style={styles.empCard}>
              <TouchableOpacity
                style={styles.empCardHeader}
                onPress={() => toggleEmployee(emp.id)}
                activeOpacity={0.75}>
                <View style={[styles.empAvatar, { backgroundColor: color.bg, borderColor: color.border }]}>
                  <Text style={[styles.empAvatarText, { color: color.text }]}>
                    {emp.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{emp.name}</Text>
                  <View style={styles.empStats}>
                    {totalActive > 0 && (
                      <View style={[styles.empStatBadge, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={[styles.empStatText, { color: '#1D4ED8' }]}>{totalActive} active</Text>
                      </View>
                    )}
                    {totalPending > 0 && (
                      <View style={[styles.empStatBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.empStatText, { color: '#92400E' }]}>{totalPending} pending</Text>
                      </View>
                    )}
                    {weekCount > 0 && (
                      <View style={[styles.empStatBadge, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={[styles.empStatText, { color: '#374151' }]}>{weekCount} this week</Text>
                      </View>
                    )}
                    {emp.assignments.length === 0 && (
                      <Text style={styles.noJobsText}>No jobs assigned</Text>
                    )}
                  </View>
                </View>
                {isExpanded ? (
                  <ChevronUp size={18} color="#9CA3AF" />
                ) : (
                  <ChevronDown size={18} color="#9CA3AF" />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.empCardBody}>
                  {emp.assignments.length === 0 ? (
                    <Text style={styles.noAssignmentsText}>No jobs assigned to this employee yet.</Text>
                  ) : (
                    (['active', 'pending', 'completed'] as const).map(status => {
                      const statusJobs = grouped[status];
                      if (statusJobs.length === 0) return null;
                      const sectionKey = `${emp.id}-${status}`;
                      const isSectionOpen = !expandedStatusSections.has(sectionKey);
                      const statusColor = getStatusColor(status);

                      return (
                        <View key={status} style={styles.statusSection}>
                          <TouchableOpacity
                            style={styles.statusSectionHeader}
                            onPress={() => toggleStatusSection(sectionKey)}
                            activeOpacity={0.7}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={styles.statusSectionTitle}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                            <View style={[styles.statusCountBadge, { backgroundColor: statusColor + '20' }]}>
                              <Text style={[styles.statusCountText, { color: statusColor }]}>{statusJobs.length}</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            {isSectionOpen ? (
                              <ChevronUp size={14} color="#9CA3AF" />
                            ) : (
                              <ChevronDown size={14} color="#9CA3AF" />
                            )}
                          </TouchableOpacity>

                          {isSectionOpen && statusJobs.map(a => (
                            <TouchableOpacity
                              key={a.id}
                              style={styles.jobRow}
                              onPress={() => router.push(`/job/${a.job.id}` as any)}
                              activeOpacity={0.75}>
                              <View style={[styles.jobRowAccent, { backgroundColor: statusColor }]} />
                              <View style={styles.jobRowContent}>
                                <View style={styles.jobRowTop}>
                                  <Text style={styles.jobRowClient} numberOfLines={1}>
                                    {a.job.client?.company_name || a.job.client?.name || '—'}
                                  </Text>
                                  <View style={[styles.miniStatusBadge, { backgroundColor: statusColor + '20' }]}>
                                    <Text style={[styles.miniStatusText, { color: statusColor }]}>
                                      {status.toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.jobRowTitle} numberOfLines={1}>{a.job.title}</Text>
                                <View style={styles.jobRowMeta}>
                                  <Calendar size={12} color="#9CA3AF" />
                                  <Text style={styles.jobRowDate}>{formatDate(a.job.scheduled_time)}</Text>
                                  <Text style={styles.jobRowNumber}>#{a.job.job_card_number}</Text>
                                </View>
                                {a.completed && (
                                  <View style={styles.completedBadge}>
                                    <Text style={styles.completedBadgeText}>Marked done by employee</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const COL_WIDTH = Math.floor((SCREEN_WIDTH - 32) / 7);

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
  },
  logoImage: { width: 44, height: 44 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 24 },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  weekNavBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  weekNavCenter: { flex: 1, alignItems: 'center', gap: 2 },
  weekRangeText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  todayLink: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },

  // Legend
  legendScroll: { maxHeight: 36 },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 12, color: '#374151', fontWeight: '600', maxWidth: 64 },

  // Week grid
  weekGrid: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  dayHeaderRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dayHeaderCell: { width: COL_WIDTH, alignItems: 'center', paddingVertical: 8, gap: 2 },
  dayHeaderCellToday: { backgroundColor: '#EFF6FF' },
  dayLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  dayLabelToday: { color: '#3B82F6' },
  dayNumber: { fontSize: 14, fontWeight: '700', color: '#374151' },
  dayNumberToday: { color: '#3B82F6' },
  dayJobsRow: { flexDirection: 'row', minHeight: 80, alignItems: 'flex-start' },
  dayCell: {
    width: COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
    padding: 3,
    gap: 3,
    minHeight: 80,
    alignItems: 'stretch',
  },
  dayCellToday: { backgroundColor: '#F0F9FF' },
  emptyCellDash: { flex: 1 },
  jobChip: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  jobChipDot: { width: 6, height: 6, borderRadius: 3 },
  jobChipText: { fontSize: 9, fontWeight: '600', lineHeight: 13 },
  jobChipTime: { fontSize: 8, fontWeight: '500', opacity: 0.8 },

  // Section heading
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  // Employee card
  empCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  empCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  empAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: { fontSize: 17, fontWeight: '700' },
  empInfo: { flex: 1, gap: 5 },
  empName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  empStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  empStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  empStatText: { fontSize: 11, fontWeight: '600' },
  noJobsText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  empCardBody: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingBottom: 4,
  },
  noAssignmentsText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },

  // Status sections
  statusSection: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  statusSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 7,
    backgroundColor: '#FAFAFA',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusSectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151' },
  statusCountBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusCountText: { fontSize: 11, fontWeight: '700' },

  // Job rows
  jobRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  jobRowAccent: { width: 3 },
  jobRowContent: { flex: 1, padding: 12, gap: 3 },
  jobRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  jobRowClient: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  miniStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  miniStatusText: { fontSize: 9, fontWeight: '700' },
  jobRowTitle: { fontSize: 13, color: '#6B7280' },
  jobRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  jobRowDate: { fontSize: 11, color: '#9CA3AF', flex: 1 },
  jobRowNumber: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  completedBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
  },
  completedBadgeText: { fontSize: 10, fontWeight: '600', color: '#065F46' },
});
