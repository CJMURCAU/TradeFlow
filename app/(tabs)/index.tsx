import { useState, useEffect, useRef, useCallback } from 'react';
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
  PanResponder,
  Animated,
} from 'react-native';
import { supabase, Job, Client } from '@/lib/supabase';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TabBar from '@/components/TabBar';

const SCREEN_WIDTH = Dimensions.get('window').width;

const COMPACT_CELL_HEIGHT = 38;
const EXPANDED_CELL_HEIGHT = 52;
const DAY_HEADER_HEIGHT = 24;
const WEEKS = 6;
const COMPACT_GRID_HEIGHT = DAY_HEADER_HEIGHT + WEEKS * (COMPACT_CELL_HEIGHT + 4);
const EXPANDED_GRID_HEIGHT = DAY_HEADER_HEIGHT + WEEKS * (EXPANDED_CELL_HEIGHT + 4);

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [jobs, setJobs] = useState<(Job & { client?: Client })[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(12);
  const [expanded, setExpanded] = useState(false);

  const calendarHeight = useRef(new Animated.Value(COMPACT_GRID_HEIGHT)).current;
  const dragStartY = useRef(0);
  const dragStartExpanded = useRef(false);
  const expandedRef = useRef(false);

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
      setJobs(jobsData.map(job => ({
        ...job,
        client: Array.isArray(job.client) ? job.client[0] : job.client,
      })));
    }
  };

  const getJobsForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return jobs.filter(job => {
      if (!job.scheduled_time) return false;
      const jobDate = new Date(job.scheduled_time);
      return jobDate >= dayStart && jobDate < dayEnd;
    });
  };

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
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getMonthForIndex = (index: number) => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + (index - 12));
    return base;
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      const newMonth = getMonthForIndex(newIndex);
      setDisplayMonth(newMonth);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newIndex = currentIndex + (direction === 'next' ? 1 : -1);
    setCurrentIndex(newIndex);
    flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    setDisplayMonth(getMonthForIndex(newIndex));
  };

  const expandCalendar = useCallback(() => {
    expandedRef.current = true;
    setExpanded(true);
    Animated.spring(calendarHeight, {
      toValue: EXPANDED_GRID_HEIGHT,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  }, [calendarHeight]);

  const collapseCalendar = useCallback(() => {
    expandedRef.current = false;
    setExpanded(false);
    Animated.spring(calendarHeight, {
      toValue: COMPACT_GRID_HEIGHT,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  }, [calendarHeight]);

  const dragHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: (_, g) => {
        dragStartY.current = g.y0;
        dragStartExpanded.current = expandedRef.current;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 20 && !dragStartExpanded.current) {
          expandedRef.current = true;
          setExpanded(true);
          Animated.spring(calendarHeight, {
            toValue: EXPANDED_GRID_HEIGHT,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }).start();
        } else if (g.dy < -20 && dragStartExpanded.current) {
          expandedRef.current = false;
          setExpanded(false);
          Animated.spring(calendarHeight, {
            toValue: COMPACT_GRID_HEIGHT,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const renderMonth = ({ index }: { index: number }) => {
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
  };

  const selectedDayJobs = getJobsForDate(selectedDate);

  const formattedSelectedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const displayMonthTitle = displayMonth.toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const months = Array.from({ length: 25 }, (_, i) => i);

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
        <Animated.View style={[styles.calendarContainer, { height: calendarHeight }]}>
          <FlatList
            ref={flatListRef}
            data={months}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.toString()}
            renderItem={renderMonth}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={onScrollEnd}
            scrollEnabled={true}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <View
          {...dragHandlePanResponder.panHandlers}
          style={styles.dragHandle}>
          <TouchableOpacity
            onPress={() => (expanded ? collapseCalendar() : expandCalendar())}
            activeOpacity={0.7}
            style={styles.dragHandleInner}>
            <View style={styles.dragHandleBar} />
            <Text style={styles.dragHandleHint}>
              {expanded ? 'Swipe up to collapse' : 'Swipe down to expand'}
            </Text>
          </TouchableOpacity>
        </View>
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
  monthHeaderDay: {
    flex: 1,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
  },
  monthWeek: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  monthDay: {
    flex: 1,
    height: COMPACT_CELL_HEIGHT,
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
    marginTop: 2,
    height: 5,
    alignItems: 'center',
  },
  monthDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  dragHandle: {
    backgroundColor: '#FFFFFF',
  },
  dragHandleInner: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 3,
  },
  dragHandleHint: {
    fontSize: 10,
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
});
