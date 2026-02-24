import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { supabase, Job, Client } from '@/lib/supabase';
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TabBar from '@/components/TabBar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const COMPACT_CELL_HEIGHT = 38;
const DAY_HEADER_HEIGHT = 24;
const WEEKS = 6;
const COMPACT_GRID_HEIGHT = DAY_HEADER_HEIGHT + WEEKS * (COMPACT_CELL_HEIGHT + 4);

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
const MODAL_HEADER_HEIGHT = 56;
const MODAL_NAV_HEIGHT = 52;
const MODAL_DAY_HEADER = 32;
const MODAL_HANDLE_HEIGHT = 48;
const MODAL_PADDING_V = 16;
const AVAILABLE_HEIGHT =
  SCREEN_HEIGHT - STATUS_BAR_HEIGHT - MODAL_HEADER_HEIGHT - MODAL_NAV_HEIGHT - MODAL_DAY_HEADER - MODAL_HANDLE_HEIGHT - MODAL_PADDING_V;
const EXPANDED_CELL_HEIGHT = Math.floor(AVAILABLE_HEIGHT / WEEKS) - 4;

const CHIP_HEIGHT = 16;
const CHIP_MARGIN = 2;
const DAY_NUM_HEIGHT = 20;
const MAX_CHIPS = Math.max(1, Math.floor((EXPANDED_CELL_HEIGHT - DAY_NUM_HEIGHT - 4) / (CHIP_HEIGHT + CHIP_MARGIN)));

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [jobs, setJobs] = useState<(Job & { client?: Client })[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const modalFlatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(12);
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: 12, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchJobs = async () => {
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .order('scheduled_time', { ascending: true });

    if (jobsData) {
      const seen = new Set<string>();
      const unique = jobsData.filter(job => {
        if (seen.has(job.id)) return false;
        seen.add(job.id);
        return true;
      });
      setJobs(unique.map(job => ({
        ...job,
        client: Array.isArray(job.client) ? job.client[0] : job.client,
      })));
    }
  };

  const jobsByDate = useMemo(() => {
    const map: Record<string, (Job & { client?: Client })[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_time) continue;
      const d = new Date(job.scheduled_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [jobs]);

  const getJobsForDate = useCallback((date: Date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return jobsByDate[key] ?? [];
  }, [jobsByDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'active': return '#3B82F6';
      case 'completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getMonthForIndex = useCallback((index: number) => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + (index - 12));
    return base;
  }, []);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      const newMonth = getMonthForIndex(newIndex);
      setDisplayMonth(newMonth);
    }
  }, [currentIndex, getMonthForIndex]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const newIndex = currentIndex + (direction === 'next' ? 1 : -1);
    setCurrentIndex(newIndex);
    flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    modalFlatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    setDisplayMonth(getMonthForIndex(newIndex));
  }, [currentIndex, getMonthForIndex]);

  const openExpanded = useCallback(() => {
    setExpanded(true);
    slideAnim.setValue(SCREEN_HEIGHT);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeExpanded = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setExpanded(false);
    });
  }, [slideAnim]);

  const renderCompactMonth = useCallback(({ index }: { index: number }) => {
    const monthDate = getMonthForIndex(index);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 12 }}>
        <View style={styles.monthHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={styles.monthHeaderDay}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.monthWeek}>
            {week.map((day, di) => {
              const dayJobs = getJobsForDate(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = day.toDateString() === new Date().toDateString();
              const isSelected = day.toDateString() === selectedDate.toDateString();

              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.monthDay,
                    { height: COMPACT_CELL_HEIGHT },
                    isToday && !isSelected && styles.monthDayToday,
                    isSelected && styles.monthDaySelected,
                  ]}
                  onPress={() => setSelectedDate(new Date(day))}>
                  <Text style={[
                    styles.monthDayNumber,
                    !isCurrentMonth && styles.monthDayNumberOther,
                    isToday && !isSelected && styles.monthDayNumberToday,
                    isSelected && styles.monthDayNumberSelected,
                  ]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.monthDayDots}>
                    {dayJobs.slice(0, 3).map((job, idx) => (
                      <View
                        key={idx}
                        style={[styles.monthDayDot, { backgroundColor: getStatusColor(job.status) }]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [getMonthForIndex, getJobsForDate, selectedDate]);

  const renderExpandedMonth = useCallback(({ index }: { index: number }) => {
    const monthDate = getMonthForIndex(index);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 8 }}>
        <View style={styles.monthHeaderModal}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={styles.monthHeaderDayModal}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.monthWeek}>
            {week.map((day, di) => {
              const dayJobs = getJobsForDate(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = day.toDateString() === new Date().toDateString();
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const visibleJobs = dayJobs.slice(0, MAX_CHIPS);
              const overflow = dayJobs.length - MAX_CHIPS;

              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.expandedDay,
                    { height: EXPANDED_CELL_HEIGHT },
                    isToday && !isSelected && styles.expandedDayToday,
                    isSelected && styles.expandedDaySelected,
                  ]}
                  onPress={() => {
                    setSelectedDate(new Date(day));
                    closeExpanded();
                  }}>
                  <Text style={[
                    styles.expandedDayNumber,
                    !isCurrentMonth && styles.monthDayNumberOther,
                    isToday && !isSelected && styles.monthDayNumberToday,
                    isSelected && styles.monthDayNumberSelected,
                  ]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.chipContainer}>
                    {visibleJobs.map((job, idx) => (
                      <View
                        key={idx}
                        style={[styles.chip, { backgroundColor: getStatusColor(job.status) }]}>
                        <Text style={styles.chipClient} numberOfLines={1}>
                          {job.client?.name ?? job.title}
                        </Text>
                        {job.scheduled_time && (
                          <Text style={styles.chipTime} numberOfLines={1}>
                            {formatTime(job.scheduled_time)}
                          </Text>
                        )}
                      </View>
                    ))}
                    {overflow > 0 && (
                      <Text style={styles.chipOverflow}>+{overflow} more</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [getMonthForIndex, getJobsForDate, selectedDate, closeExpanded]);

  const selectedDayJobs = getJobsForDate(selectedDate);

  const formattedSelectedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const displayMonthTitle = displayMonth.toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const months = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TradePro</Text>
      </View>

      <TabBar />

      <View style={styles.monthNavRow}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <ChevronLeft size={22} color="#F59E0B" />
        </TouchableOpacity>
        <Text style={styles.monthNavTitle}>{displayMonthTitle}</Text>
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <ChevronRight size={22} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      <View>
        <View style={[styles.calendarContainer, { height: COMPACT_GRID_HEIGHT }]}>
          <FlatList
            ref={flatListRef}
            data={months}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.toString()}
            renderItem={renderCompactMonth}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={onScrollEnd}
            initialScrollIndex={12}
            style={{ flex: 1 }}
          />
        </View>

        <TouchableOpacity style={styles.dragHandle} onPress={openExpanded} activeOpacity={0.7}>
          <View style={styles.dragHandleBar} />
          <View style={styles.dragHandleHintRow}>
            <ChevronDown size={14} color="#9CA3AF" />
            <Text style={styles.dragHandleHint}>Tap to expand</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.statusKey}>
        <View style={styles.statusKeyItem}>
          <View style={[styles.statusKeyDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.statusKeyLabel}>Pending</Text>
        </View>
        <View style={styles.statusKeyItem}>
          <View style={[styles.statusKeyDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.statusKeyLabel}>Active</Text>
        </View>
        <View style={styles.statusKeyItem}>
          <View style={[styles.statusKeyDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.statusKeyLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.daySection}>
        <Text style={styles.dayTitle}>{formattedSelectedDate}</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
          {selectedDayJobs.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>No jobs scheduled</Text>
              <TouchableOpacity
                style={styles.addJobButton}
                onPress={() => router.push('/newjob')}>
                <Text style={styles.addJobButtonText}>+ Schedule a Job</Text>
              </TouchableOpacity>
            </View>
          ) : (
            selectedDayJobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { borderLeftColor: getStatusColor(job.status) }]}
                onPress={() => router.push(`/job/${job.id}`)}>
                <View style={styles.jobCardLeft}>
                  <Text style={styles.jobCardTime}>
                    {job.scheduled_time ? formatTime(job.scheduled_time) : 'No time'}
                  </Text>
                  <Text style={styles.jobCardTitle}>{job.title}</Text>
                  {job.client && <Text style={styles.jobCardClient}>{job.client.name}</Text>}
                </View>
                <View style={[styles.jobCardBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
                  <Text style={[styles.jobCardStatus, { color: getStatusColor(job.status) }]}>
                    {job.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/newjob')}>
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={expanded}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeExpanded}>
        <Animated.View style={[styles.modalOverlay, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>TradePro</Text>
          </View>

          <View style={styles.modalNavRow}>
            <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
              <ChevronLeft size={22} color="#F59E0B" />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>{displayMonthTitle}</Text>
            <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
              <ChevronRight size={22} color="#F59E0B" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={modalFlatListRef}
            data={months}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `modal-${item}`}
            renderItem={renderExpandedMonth}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={onScrollEnd}
            initialScrollIndex={currentIndex}
            style={{ flex: 1 }}
          />

          <TouchableOpacity style={styles.modalHandle} onPress={closeExpanded} activeOpacity={0.7}>
            <View style={styles.dragHandleBar} />
            <View style={styles.dragHandleHintRow}>
              <ChevronUp size={14} color="#9CA3AF" />
              <Text style={styles.dragHandleHint}>Tap to collapse</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
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
    padding: 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  navButton: {
    padding: 8,
  },
  monthNavTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  calendarContainer: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  monthHeader: {
    flexDirection: 'row',
    marginBottom: 4,
    height: DAY_HEADER_HEIGHT,
    alignItems: 'center',
  },
  monthHeaderModal: {
    flexDirection: 'row',
    marginBottom: 4,
    height: MODAL_DAY_HEADER,
    alignItems: 'center',
  },
  monthHeaderDay: {
    flex: 1,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
  },
  monthHeaderDayModal: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  monthWeek: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  monthDay: {
    flex: 1,
    margin: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  monthDayToday: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  monthDaySelected: {
    backgroundColor: '#F59E0B',
  },
  monthDayNumber: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  monthDayNumberOther: {
    color: '#D1D5DB',
  },
  monthDayNumberToday: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  monthDayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthDayDots: {
    flexDirection: 'row',
    marginTop: 3,
    height: 6,
    alignItems: 'center',
  },
  monthDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  expandedDay: {
    flex: 1,
    margin: 1,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 2,
    paddingTop: 3,
    paddingBottom: 2,
    overflow: 'hidden',
  },
  expandedDayToday: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  expandedDaySelected: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  expandedDayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: DAY_NUM_HEIGHT,
    height: DAY_NUM_HEIGHT,
  },
  chipContainer: {
    flex: 1,
    gap: CHIP_MARGIN,
  },
  chip: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    height: CHIP_HEIGHT,
    justifyContent: 'center',
  },
  chipClient: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
  chipTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 7,
    lineHeight: 8,
  },
  chipOverflow: {
    fontSize: 7,
    color: '#6B7280',
    fontWeight: '600',
    paddingLeft: 2,
  },
  dragHandle: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 4,
  },
  dragHandleHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dragHandleHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  statusKey: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  statusKeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusKeyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusKeyLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  daySection: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  dayScroll: {
    flex: 1,
  },
  dayScrollContent: {
    paddingBottom: 100,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyDayText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginBottom: 12,
  },
  addJobButton: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addJobButtonText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 14,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobCardLeft: {
    flex: 1,
  },
  jobCardTime: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  jobCardTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  jobCardClient: {
    color: '#6B7280',
    fontSize: 13,
  },
  jobCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  jobCardStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: STATUS_BAR_HEIGHT,
  },
  modalHeader: {
    height: MODAL_HEADER_HEIGHT,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: MODAL_NAV_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
});
