import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Modal,
 PanResponder } from 'react-native';
import TradeFlowEmblem from '@/components/TradeFlowEmblem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, Job, Client } from '@/lib/supabase';
import { getStatusColor } from '@/lib/status';
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2 } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import TabBar from '@/components/TabBar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const COMPACT_CELL_HEIGHT = 38;
const DAY_HEADER_HEIGHT = 24;
const WEEKS = 6;
const COMPACT_GRID_HEIGHT = DAY_HEADER_HEIGHT + WEEKS * (COMPACT_CELL_HEIGHT + 4);


export default function CalendarPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [jobs, setJobs] = useState<(Job & { client?: Client })[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(12);
  const [deleteTarget, setDeleteTarget] = useState<(Job & { client?: Client }) | null>(null);

  const [topContentHeight, setTopContentHeight] = useState(0);
  const SHEET_PEEK = topContentHeight > 0
    ? Math.max(winHeight - topContentHeight - insets.bottom, 90)
    : 110;
  const SHEET_OPEN = Math.round(winHeight * 0.75);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(110)).current;

  const fabPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fabOffset = useRef({ x: 0, y: 0 });
  const fabDragDistance = useRef(0);

  const navigateToNewJob = useCallback(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    router.push(`/newjob?date=${y}-${m}-${d}`);
  }, [selectedDate, router]);

  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fabDragDistance.current = 0;
        fabPos.setOffset({ x: fabOffset.current.x, y: fabOffset.current.y });
        fabPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        fabDragDistance.current = Math.max(fabDragDistance.current, Math.abs(gs.dx), Math.abs(gs.dy));
        fabPos.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: (_, gs) => {
        fabPos.flattenOffset();
        fabOffset.current = {
          x: fabOffset.current.x + gs.dx,
          y: fabOffset.current.y + gs.dy,
        };
        if (fabDragDistance.current < 6) {
          navigateToNewJob();
        }
      },
    })
  ).current;


  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: 12, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const deleteJob = async (jobId: string) => {
    await supabase.from('parts').delete().eq('job_id', jobId);
    await supabase.from('time_entries').delete().eq('job_id', jobId);
    await supabase.from('jobs').delete().eq('id', jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const confirmDeleteJob = (job: Job & { client?: Client }) => {
    setDeleteTarget(job);
  };

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
    const itemWidth = winWidth || SCREEN_WIDTH;
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      setDisplayMonth(getMonthForIndex(newIndex));
    }
  }, [currentIndex, getMonthForIndex, winWidth]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== null && newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        setCurrentIndex(newIndex);
        setDisplayMonth(getMonthForIndex(newIndex));
      }
    }
  }).current;

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const newIndex = currentIndex + (direction === 'next' ? 1 : -1);
    setCurrentIndex(newIndex);
    flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    setDisplayMonth(getMonthForIndex(newIndex));
  }, [currentIndex, getMonthForIndex]);

  useEffect(() => {
    if (!sheetOpen && topContentHeight > 0) {
      sheetAnim.setValue(SHEET_PEEK);
    }
  }, [SHEET_PEEK, sheetOpen, topContentHeight]);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    Animated.spring(sheetAnim, {
      toValue: SHEET_OPEN,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [sheetAnim, SHEET_OPEN]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    Animated.spring(sheetAnim, {
      toValue: SHEET_PEEK,
      useNativeDriver: false,
      bounciness: 2,
      speed: 16,
    }).start();
  }, [sheetAnim, SHEET_PEEK]);

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
                  onPress={() => {
                    setSelectedDate(new Date(day));
                    openSheet();
                  }}>
                  <Text style={[
                    styles.monthDayNumber,
                    !isCurrentMonth && styles.monthDayNumberOther,
                    isToday && !isSelected && styles.monthDayNumberToday,
                    isSelected && styles.monthDayNumberSelected,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {(() => {
                    const total = dayJobs.length;
                    const useSmall = total > 3;
                    const dotSize = useSmall ? 6 : 8;
                    const visible = dayJobs.slice(0, 6);
                    const overflow = total > 6 ? total - 6 : 0;
                    return (
                      <View style={[styles.monthDayDots, useSmall && styles.monthDayDotsWrap]}>
                        {visible.map((job, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.monthDayDot,
                              { backgroundColor: getStatusColor(job.status), width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                            ]}
                          />
                        ))}
                        {overflow > 0 && (
                          <Text style={styles.dotOverflow}>+{overflow}</Text>
                        )}
                      </View>
                    );
                  })()}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [getMonthForIndex, getJobsForDate, selectedDate, openSheet]);


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
      <View
        onLayout={(e) => setTopContentHeight(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.appName}>TradeFlow</Text>
          <TradeFlowEmblem size={44} />
        </View>

        <TabBar />

        <View style={styles.monthNavRow}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Previous month">
            <ChevronLeft size={22} color="#F59E0B" />
          </TouchableOpacity>
          <Text style={styles.monthNavTitle}>{displayMonthTitle}</Text>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Next month">
            <ChevronRight size={22} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        <View>
          <View style={[styles.calendarContainer, { height: Math.min(COMPACT_GRID_HEIGHT, winHeight * 0.45) }]}>
            <FlatList
              ref={flatListRef}
              data={months}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.toString()}
              renderItem={renderCompactMonth}
              getItemLayout={(_, index) => ({
                length: winWidth,
                offset: winWidth * index,
                index,
              })}
              onMomentumScrollEnd={onScrollEnd}
              onScrollEndDrag={onScrollEnd}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              initialScrollIndex={12}
              style={{ flex: 1 }}
            />
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
      </View>

      <Animated.View style={[styles.sheet, { height: sheetAnim, bottom: insets.bottom }]}>
        <TouchableOpacity
          style={styles.sheetHandle}
          onPress={sheetOpen ? closeSheet : openSheet}
          activeOpacity={0.7}>
          <View style={styles.sheetHandleBar} />
          <View style={styles.sheetHandleRow}>
            <Text style={styles.dayTitle}>{formattedSelectedDate}</Text>
            {selectedDayJobs.length > 0 && (
              <View style={styles.sheetJobCount}>
                <Text style={styles.sheetJobCountText}>{selectedDayJobs.length}</Text>
              </View>
            )}
            {sheetOpen
              ? <ChevronDown size={16} color="#9CA3AF" />
              : <ChevronUp size={16} color="#9CA3AF" />}
          </View>
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.dayScroll}
          contentContainerStyle={styles.dayScrollContent}>
          {selectedDayJobs.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>No jobs scheduled</Text>
              <TouchableOpacity
                style={styles.addJobButton}
                onPress={() => {
                  const y = selectedDate.getFullYear();
                  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const d = String(selectedDate.getDate()).padStart(2, '0');
                  router.push(`/newjob?date=${y}-${m}-${d}`);
                }}>
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
                  {job.client && (
                    <Text style={styles.jobCardClient}>
                      {job.client.company_name || job.client.name}
                    </Text>
                  )}
                  <Text style={styles.jobCardTitle}>{job.title}</Text>
                </View>
                <View style={styles.jobCardRight}>
                  <View style={[styles.jobCardBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
                    <Text style={[styles.jobCardStatus, { color: getStatusColor(job.status) }]}>
                      {(job.status ?? 'pending').toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteJob(job)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[styles.fab, { transform: fabPos.getTranslateTransform() }]}
        {...fabPanResponder.panHandlers}>
        <Plus size={28} color="#FFFFFF" />
      </Animated.View>

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalBox}>
            <Text style={styles.deleteModalTitle}>Delete Job</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete "{deleteTarget?.title}"? This cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancel}
                onPress={() => setDeleteTarget(null)}>
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirm}
                onPress={() => {
                  if (deleteTarget) deleteJob(deleteTarget.id);
                  setDeleteTarget(null);
                }}>
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    position: 'relative',
  },
  header: {
    paddingTop: 0,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  logoImage: {
    width: 44,
    height: 44,
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
    height: 10,
    alignItems: 'center',
  },
  monthDayDotsWrap: {
    flexWrap: 'wrap',
    width: 26,
    height: 18,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  monthDayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 1,
    marginBottom: 1,
  },
  dotOverflow: {
    fontSize: 7,
    color: '#D1D5DB',
    lineHeight: 8,
    marginLeft: 1,
    alignSelf: 'flex-end',
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
    overflow: 'hidden',
  },
  sheetHandle: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetJobCount: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetJobCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dayTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  dayScroll: {
    flex: 1,
  },
  dayScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
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
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 2,
  },
  jobCardClient: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  jobCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 12,
  },
  jobCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
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
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  deleteModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
