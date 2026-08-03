import { View, Text, StyleSheet } from 'react-native';
import {
  Clock,
  Briefcase,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Users,
  Plus,
  Play,
  Image as ImageIcon,
  Package,
  Wrench,
  Building2,
  User,
} from 'lucide-react-native';

const NAVY = '#1B2B4B';
const AMBER = '#F59E0B';
const BLUE = '#3B82F6';
const GREEN = '#10B981';
const GRAY = '#6B7280';
const LIGHT_GRAY = '#F9FAFB';
const BORDER = '#E5E7EB';

function StatusBar() {
  return (
    <View style={mockStyles.statusBar}>
      <Text style={mockStyles.statusText}>9:41</Text>
      <View style={{ width: 12 }} />
    </View>
  );
}

function TabBarMock({ active }: { active: string }) {
  const tabs = [
    { name: 'Calendar', icon: Calendar },
    { name: 'Dashboard', icon: Building2 },
    { name: 'Clients', icon: Users },
    { name: 'Jobs', icon: Briefcase },
    { name: 'Team', icon: Users },
  ];
  return (
    <View style={mockStyles.tabBar}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.name === active;
        return (
          <View key={tab.name} style={mockStyles.tabItem}>
            <Icon size={16} color={isActive ? AMBER : GRAY} strokeWidth={2} />
          </View>
        );
      })}
    </View>
  );
}

function HeaderMock({ title, showLogo = true }: { title: string; showLogo?: boolean }) {
  return (
    <View style={mockStyles.header}>
      <Text style={mockStyles.headerTitle}>{title}</Text>
      {showLogo && <View style={mockStyles.logoBox} />}
    </View>
  );
}

export function DashboardMock() {
  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <HeaderMock title="Dashboard" />
      <View style={mockStyles.body}>
        <View style={mockStyles.statsGrid}>
          <View style={mockStyles.statCard}>
            <View style={mockStyles.statIconBox}>
              <Clock size={20} color={AMBER} />
            </View>
            <Text style={mockStyles.statValue}>32</Text>
            <Text style={mockStyles.statLabel}>Hours This Week</Text>
          </View>
          <View style={mockStyles.statCard}>
            <View style={[mockStyles.statIconBox, { backgroundColor: '#DBEAFE' }]}>
              <Briefcase size={20} color={BLUE} />
            </View>
            <Text style={mockStyles.statValue}>5</Text>
            <Text style={mockStyles.statLabel}>Active Jobs</Text>
          </View>
          <View style={mockStyles.statCard}>
            <View style={[mockStyles.statIconBox, { backgroundColor: '#D1FAE5' }]}>
              <CheckCircle size={20} color={GREEN} />
            </View>
            <Text style={mockStyles.statValue}>12</Text>
            <Text style={mockStyles.statLabel}>Completed Jobs</Text>
          </View>
          <View style={mockStyles.statCard}>
            <View style={[mockStyles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
              <AlertCircle size={20} color={AMBER} />
            </View>
            <Text style={mockStyles.statValue}>3</Text>
            <Text style={mockStyles.statLabel}>Pending Jobs</Text>
          </View>
        </View>
        <Text style={mockStyles.sectionTitle}>Quick Actions</Text>
        <View style={mockStyles.actionBtn}>
          <Text style={mockStyles.actionBtnText}>Create New Job</Text>
        </View>
        <View style={mockStyles.actionBtn}>
          <Text style={mockStyles.actionBtnText}>Add New Client</Text>
        </View>
      </View>
      <TabBarMock active="Dashboard" />
    </View>
  );
}

export function MainCalendarMock() {
  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  // August 2026 starts on Saturday (col index 6)
  const aug2026: (number | null)[] = [
    null, null, null, null, null, null, 1,
    2, 3, 4, 5, 6, 7, 8,
    9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28, 29,
    30, 31, null, null, null, null, null,
  ];
  const topTabs = [
    { name: 'Calendar', icon: Calendar },
    { name: 'Dashboard', icon: Building2 },
    { name: 'Clients', icon: Users },
    { name: 'Jobs', icon: Briefcase },
    { name: 'Team', icon: Users },
    { name: 'Biz', icon: Building2 },
  ];

  return (
    <View style={mockStyles.screen}>
      {/* Header */}
      <View style={mockStyles.mainHeader}>
        <Text style={mockStyles.mainHeaderTitle}>Innovative Trade Tracker</Text>
        <View style={mockStyles.mainHeaderLogo} />
      </View>

      {/* Top tab bar matching real app */}
      <View style={mockStyles.topTabBar}>
        {topTabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.name === 'Calendar';
          return (
            <View key={tab.name} style={mockStyles.topTabItem}>
              <Icon size={10} color={active ? AMBER : GRAY} strokeWidth={2} />
              <Text style={[mockStyles.topTabLabel, active && mockStyles.topTabLabelActive]}>
                {tab.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Calendar */}
      <View style={mockStyles.calBody}>
        <View style={mockStyles.calNav}>
          <ChevronLeft size={11} color={AMBER} />
          <Text style={mockStyles.calMonth}>August 2026</Text>
          <ChevronRight size={11} color={AMBER} />
        </View>
        <View style={mockStyles.calGrid}>
          {dayHeaders.map((d, i) => (
            <Text key={i} style={mockStyles.calDayHeader}>{d}</Text>
          ))}
          {aug2026.map((dayNum, i) => {
            const isToday = dayNum === 3;
            return (
              <View key={i} style={[mockStyles.calCell, isToday && mockStyles.calCellToday]}>
                <Text style={[
                  mockStyles.calCellNum,
                  isToday && mockStyles.calCellNumToday,
                  !dayNum && mockStyles.calCellFaded,
                ]}>
                  {dayNum ?? ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={mockStyles.statusKey}>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: AMBER }]} />
            <Text style={mockStyles.statusKeyLabel}>Pending</Text>
          </View>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: BLUE }]} />
            <Text style={mockStyles.statusKeyLabel}>Active</Text>
          </View>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: GREEN }]} />
            <Text style={mockStyles.statusKeyLabel}>Completed</Text>
          </View>
        </View>

        {/* Day panel */}
        <View style={mockStyles.dayPanel}>
          <View style={mockStyles.dayPanelHeader}>
            <Text style={mockStyles.dayPanelTitle}>Monday, August 3</Text>
            <ChevronRight size={12} color={GRAY} style={{ transform: [{ rotate: '-90deg' }] }} />
          </View>
          <Text style={mockStyles.noJobsText}>No jobs scheduled</Text>
          <View style={mockStyles.scheduleBtn}>
            <Text style={mockStyles.scheduleBtnText}>+ Schedule a Job</Text>
          </View>
        </View>
      </View>

      {/* Floating + button */}
      <View style={mockStyles.mainFab}>
        <Plus size={14} color="#FFF" />
      </View>
    </View>
  );
}

export function CalendarMock() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = Array.from({ length: 35 }, (_, i) => i - 2);
  const dotsByDay: Record<number, string[]> = {
    3: [AMBER],
    7: [BLUE, AMBER],
    12: [GREEN],
    15: [BLUE],
    18: [AMBER, GREEN, BLUE],
    22: [GREEN],
    25: [AMBER],
    28: [BLUE],
  };

  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <HeaderMock title="Innovative Trade Tracker" />
      <View style={mockStyles.body}>
        <View style={mockStyles.calNav}>
          <ChevronLeft size={16} color={AMBER} />
          <Text style={mockStyles.calMonth}>August 2026</Text>
          <ChevronRight size={16} color={AMBER} />
        </View>
        <View style={mockStyles.calGrid}>
          {days.map((d, i) => (
            <Text key={i} style={mockStyles.calDayHeader}>{d}</Text>
          ))}
          {dates.map((dayNum, i) => {
            const isToday = dayNum === 3;
            const dots = dotsByDay[dayNum] || [];
            return (
              <View
                key={i}
                style={[
                  mockStyles.calCell,
                  isToday && mockStyles.calCellToday,
                ]}>
                <Text style={[mockStyles.calCellNum, isToday && mockStyles.calCellNumToday]}>
                  {dayNum > 0 ? dayNum : ''}
                </Text>
                <View style={mockStyles.calDots}>
                  {dots.map((c, di) => (
                    <View key={di} style={[mockStyles.calDot, { backgroundColor: c }]} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        <View style={mockStyles.statusKey}>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: AMBER }]} />
            <Text style={mockStyles.statusKeyLabel}>Pending</Text>
          </View>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: BLUE }]} />
            <Text style={mockStyles.statusKeyLabel}>Active</Text>
          </View>
          <View style={mockStyles.statusKeyItem}>
            <View style={[mockStyles.statusKeyDot, { backgroundColor: GREEN }]} />
            <Text style={mockStyles.statusKeyLabel}>Completed</Text>
          </View>
        </View>
      </View>
      <TabBarMock active="Calendar" />
    </View>
  );
}

export function JobDetailMock() {
  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <View style={mockStyles.header}>
        <View style={mockStyles.backArrow}><ChevronLeft size={18} color="#111827" /></View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={mockStyles.headerTitle}>Job #1003</Text>
          <View style={mockStyles.statusBadge}>
            <Text style={mockStyles.statusBadgeText}>ACTIVE</Text>
          </View>
        </View>
      </View>
      <View style={mockStyles.body}>
        <Text style={mockStyles.jobTitle}>Kitchen Renovation</Text>
        <Text style={mockStyles.jobClient}>Smith Residence Ltd</Text>
        <View style={mockStyles.addressRow}>
          <MapPin size={12} color={GRAY} />
          <Text style={mockStyles.addressText}>123 Oak Street, Springfield</Text>
        </View>

        <Text style={mockStyles.sectionTitleSmall}>Timer</Text>
        <View style={mockStyles.timerBox}>
          <Text style={mockStyles.timerDisplay}>02:15:30</Text>
          <View style={mockStyles.timerBtns}>
            <View style={mockStyles.timerBtn}>
              <Play size={14} color="#FFF" />
              <Text style={mockStyles.timerBtnText}>Start</Text>
            </View>
          </View>
        </View>

        <Text style={mockStyles.sectionTitleSmall}>Photos</Text>
        <View style={mockStyles.photoRow}>
          <View style={mockStyles.photoBox}><ImageIcon size={16} color="#D1D5DB" /></View>
          <View style={mockStyles.photoBox}><ImageIcon size={16} color="#D1D5DB" /></View>
          <View style={mockStyles.photoBox}><ImageIcon size={16} color="#D1D5DB" /></View>
        </View>

        <Text style={mockStyles.sectionTitleSmall}>Inventory</Text>
        <View style={mockStyles.inventoryRow}>
          <View style={[mockStyles.invBadge, { backgroundColor: BLUE }]}>
            <Package size={8} color="#FFF" />
          </View>
          <Text style={mockStyles.invName}>Cabinet Hinges</Text>
          <Text style={mockStyles.invDetail}>$4.50 x 8 = $36.00</Text>
        </View>
        <View style={mockStyles.inventoryRow}>
          <View style={[mockStyles.invBadge, { backgroundColor: AMBER }]}>
            <Wrench size={8} color="#FFF" />
          </View>
          <Text style={mockStyles.invName}>Labour Service</Text>
          <Text style={mockStyles.invDetail}>$85.00 x 1 = $85.00</Text>
        </View>

        <Text style={mockStyles.sectionTitleSmall}>Cost Summary</Text>
        <View style={mockStyles.costBox}>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Total Time:</Text>
            <Text style={mockStyles.costValue}>02:15:30</Text>
          </View>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Labour:</Text>
            <Text style={mockStyles.costValue}>$191.25</Text>
          </View>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Materials:</Text>
            <Text style={mockStyles.costValue}>$121.00</Text>
          </View>
          <View style={mockStyles.costTotalRow}>
            <Text style={mockStyles.costTotalLabel}>Total:</Text>
            <Text style={mockStyles.costTotalValue}>$312.25</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ClientsMock() {
  const clients = [
    { name: 'Smith Residence Ltd', contact: 'John Smith', phone: '0401 234 567' },
    { name: 'ABC Plumbing Co', contact: 'Sarah Lee', phone: '0412 345 678' },
    { name: 'Johnson Builders', contact: 'Mike Johnson', phone: '0423 456 789' },
    { name: 'Greenfield Estates', contact: 'Emma Wilson', phone: '0434 567 890' },
  ];

  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <HeaderMock title="Clients" />
      <View style={mockStyles.body}>
        <View style={mockStyles.searchBox}>
          <Text style={mockStyles.searchPlaceholder}>Search clients...</Text>
        </View>
        {clients.map((c, i) => (
          <View key={i} style={mockStyles.clientCard}>
            <Text style={mockStyles.clientName}>{c.name}</Text>
            <Text style={mockStyles.clientContact}>{c.contact}</Text>
            <View style={mockStyles.clientInfoRow}>
              <Phone size={10} color={GRAY} />
              <Text style={mockStyles.clientInfoText}>{c.phone}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={mockStyles.fab}>
        <Plus size={20} color="#FFF" />
      </View>
      <TabBarMock active="Clients" />
    </View>
  );
}

export function TeamMock() {
  const employees = [
    { name: 'James', color: BLUE, active: 2, pending: 1 },
    { name: 'Sarah', color: GREEN, active: 1, pending: 0 },
    { name: 'Mike', color: AMBER, active: 3, pending: 2 },
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayNums = [3, 4, 5, 6, 7, 8, 9];

  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <HeaderMock title="Team" />
      <View style={mockStyles.body}>
        <View style={mockStyles.weekNav}>
          <ChevronLeft size={14} color="#374151" />
          <Text style={mockStyles.weekRange}>Aug 3 – 9, 2026</Text>
          <ChevronRight size={14} color="#374151" />
        </View>
        <View style={mockStyles.legendRow}>
          {employees.map((e, i) => (
            <View key={i} style={mockStyles.legendItem}>
              <View style={[mockStyles.legendDot, { backgroundColor: e.color }]} />
              <Text style={mockStyles.legendName}>{e.name}</Text>
            </View>
          ))}
        </View>
        <View style={mockStyles.weekGrid}>
          {days.map((d, i) => (
            <View key={i} style={mockStyles.weekDayCol}>
              <Text style={mockStyles.weekDayLabel}>{d}</Text>
              <Text style={mockStyles.weekDayNum}>{dayNums[i]}</Text>
              {i === 1 && <View style={[mockStyles.weekJobChip, { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}>
                <View style={[mockStyles.weekJobDot, { backgroundColor: BLUE }]} />
                <Text style={mockStyles.weekJobText}>Smith</Text>
              </View>}
              {i === 3 && <View style={[mockStyles.weekJobChip, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' }]}>
                <View style={[mockStyles.weekJobDot, { backgroundColor: GREEN }]} />
                <Text style={mockStyles.weekJobText}>ABC Plumb</Text>
              </View>}
              {i === 4 && <View style={[mockStyles.weekJobChip, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                <View style={[mockStyles.weekJobDot, { backgroundColor: AMBER }]} />
                <Text style={mockStyles.weekJobText}>Johnson</Text>
              </View>}
            </View>
          ))}
        </View>
        <Text style={mockStyles.sectionTitleSmall}>Employees</Text>
        {employees.map((e, i) => (
          <View key={i} style={mockStyles.empCard}>
            <View style={[mockStyles.empAvatar, { backgroundColor: e.color + '20', borderColor: e.color + '60' }]}>
              <Text style={[mockStyles.empAvatarText, { color: e.color }]}>{e.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mockStyles.empName}>{e.name}</Text>
              <View style={mockStyles.empStats}>
                {e.active > 0 && <View style={mockStyles.empBadge}><Text style={mockStyles.empBadgeText}>{e.active} active</Text></View>}
                {e.pending > 0 && <View style={mockStyles.empBadge}><Text style={mockStyles.empBadgeText}>{e.pending} pending</Text></View>}
              </View>
            </View>
          </View>
        ))}
      </View>
      <TabBarMock active="Team" />
    </View>
  );
}

export function JobCardEmailMock() {
  return (
    <View style={mockStyles.screen}>
      <StatusBar />
      <View style={mockStyles.header}>
        <View style={mockStyles.backArrow}><ChevronLeft size={18} color="#111827" /></View>
        <Text style={mockStyles.headerTitle}>Job #1003</Text>
        <View style={[mockStyles.statusBadge, { backgroundColor: GREEN + '20' }]}>
          <Text style={[mockStyles.statusBadgeText, { color: GREEN }]}>COMPLETED</Text>
        </View>
      </View>
      <View style={mockStyles.body}>
        <Text style={mockStyles.jobTitle}>Kitchen Renovation</Text>
        <Text style={mockStyles.jobClient}>Smith Residence Ltd</Text>

        <View style={mockStyles.emailCard}>
          <View style={mockStyles.emailHeader}>
            <Mail size={20} color={AMBER} />
            <Text style={mockStyles.emailTitle}>Job Card Ready</Text>
          </View>
          <Text style={mockStyles.emailBody}>
            Your completed job card is ready to send. It includes time, materials, and cost summary.
          </Text>
          <View style={mockStyles.emailSendBtn}>
            <Mail size={14} color="#FFF" />
            <Text style={mockStyles.emailSendBtnText}>Email Job Card</Text>
          </View>
        </View>

        <Text style={mockStyles.sectionTitleSmall}>Cost Summary</Text>
        <View style={mockStyles.costBox}>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Total Time:</Text>
            <Text style={mockStyles.costValue}>04:30:00</Text>
          </View>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Labour:</Text>
            <Text style={mockStyles.costValue}>$382.50</Text>
          </View>
          <View style={mockStyles.costRow}>
            <Text style={mockStyles.costLabel}>Materials:</Text>
            <Text style={mockStyles.costValue}>$121.00</Text>
          </View>
          <View style={mockStyles.costTotalRow}>
            <Text style={mockStyles.costTotalLabel}>Total:</Text>
            <Text style={mockStyles.costTotalValue}>$503.50</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const mockStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  statusBar: { height: 28, justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '600', color: '#111827' },
  header: {
    paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row',
    alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  logoBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: NAVY },
  body: { flex: 1, padding: 12, overflow: 'hidden' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  statCard: { width: '50%', padding: 4 },
  statIconBox: {
    backgroundColor: LIGHT_GRAY, padding: 10, borderRadius: 10,
    alignItems: 'center', marginBottom: 6, borderWidth: 1, borderColor: BORDER,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  statLabel: { fontSize: 9, color: GRAY, textAlign: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#111827', marginTop: 12, marginBottom: 6 },
  sectionTitleSmall: { fontSize: 11, fontWeight: 'bold', color: '#111827', marginTop: 10, marginBottom: 4 },

  actionBtn: {
    backgroundColor: AMBER, padding: 10, borderRadius: 8,
    alignItems: 'center', marginBottom: 6,
  },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: '#FFF' },

  calNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 6 },
  calMonth: { fontSize: 12, fontWeight: '700', color: '#111827' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayHeader: { width: '14.28%', textAlign: 'center', fontSize: 8, fontWeight: '600', color: GRAY, marginBottom: 2 },
  calCell: {
    width: '14.28%', height: 34, alignItems: 'center', borderRadius: 6,
    backgroundColor: LIGHT_GRAY, margin: 1,
  },
  calCellToday: { borderWidth: 1.5, borderColor: AMBER, backgroundColor: '#FFFBEB' },
  calCellNum: { fontSize: 9, fontWeight: '600', color: '#111827', marginTop: 2 },
  calCellNumToday: { color: AMBER, fontWeight: '800' },
  calDots: { flexDirection: 'row', marginTop: 2, gap: 2 },
  calDot: { width: 4, height: 4, borderRadius: 2 },

  statusKey: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 6, marginTop: 4 },
  statusKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusKeyDot: { width: 6, height: 6, borderRadius: 3 },
  statusKeyLabel: { fontSize: 8, color: '#4B5563', fontWeight: '500' },

  todayJobsTitle: { fontSize: 11, fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 4 },
  todayJobCard: { backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: BORDER },
  todayJobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayJobLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  todayJobDot: { width: 8, height: 8, borderRadius: 4 },
  todayJobName: { fontSize: 10, fontWeight: '700', color: '#111827' },
  todayJobClient: { fontSize: 8, color: GRAY, marginTop: 1 },
  todayJobTime: { fontSize: 9, fontWeight: '600', color: AMBER },
  todayJobAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  todayJobAddr: { fontSize: 8, color: GRAY },

  jobTitle: { fontSize: 13, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  jobClient: { fontSize: 11, color: GRAY, marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  addressText: { fontSize: 9, color: GRAY },

  timerBox: { backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  timerDisplay: { fontSize: 22, fontWeight: 'bold', color: NAVY, marginBottom: 6 },
  timerBtns: { flexDirection: 'row', gap: 6 },
  timerBtn: { flexDirection: 'row', backgroundColor: AMBER, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4, alignItems: 'center' },
  timerBtnText: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  photoRow: { flexDirection: 'row', gap: 6 },
  photoBox: { width: 52, height: 52, borderRadius: 8, backgroundColor: LIGHT_GRAY, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },

  inventoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  invBadge: { width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  invName: { fontSize: 10, fontWeight: '600', color: '#111827', flex: 1 },
  invDetail: { fontSize: 9, color: GRAY },

  costBox: { backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  costLabel: { fontSize: 10, color: GRAY },
  costValue: { fontSize: 10, fontWeight: '600', color: '#111827' },
  costTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4, paddingTop: 4 },
  costTotalLabel: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  costTotalValue: { fontSize: 11, fontWeight: 'bold', color: AMBER },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: LIGHT_GRAY,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  searchPlaceholder: { fontSize: 10, color: '#9CA3AF' },

  clientCard: { backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: BORDER },
  clientName: { fontSize: 11, fontWeight: 'bold', color: '#111827', marginBottom: 1 },
  clientContact: { fontSize: 9, color: GRAY, marginBottom: 3 },
  clientInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clientInfoText: { fontSize: 9, color: GRAY },

  fab: { position: 'absolute', right: 14, bottom: 60, width: 36, height: 36, borderRadius: 18, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },

  weekNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 4 },
  weekRange: { fontSize: 10, fontWeight: '700', color: '#111827' },
  legendRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendName: { fontSize: 8, color: '#374151', fontWeight: '600' },
  weekGrid: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  weekDayCol: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F3F4F6', paddingVertical: 4, minHeight: 50 },
  weekDayLabel: { fontSize: 7, fontWeight: '600', color: GRAY },
  weekDayNum: { fontSize: 10, fontWeight: '700', color: '#374151' },
  weekJobChip: { marginTop: 3, borderRadius: 4, borderWidth: 1, paddingHorizontal: 3, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 2 },
  weekJobDot: { width: 4, height: 4, borderRadius: 2 },
  weekJobText: { fontSize: 6, fontWeight: '600' },

  empCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, marginBottom: 4 },
  empAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { fontSize: 12, fontWeight: '700' },
  empName: { fontSize: 11, fontWeight: '700', color: '#111827' },
  empStats: { flexDirection: 'row', gap: 4, marginTop: 2 },
  empBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  empBadgeText: { fontSize: 7, fontWeight: '600', color: '#374151' },

  emailCard: { backgroundColor: LIGHT_GRAY, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  emailHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  emailTitle: { fontSize: 12, fontWeight: 'bold', color: '#111827' },
  emailBody: { fontSize: 10, color: GRAY, lineHeight: 14, marginBottom: 8 },
  emailSendBtn: { flexDirection: 'row', backgroundColor: AMBER, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 4, alignItems: 'center', alignSelf: 'flex-start' },
  emailSendBtnText: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  tabBar: {
    flexDirection: 'row', height: 40, borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'space-around',
  },
  tabItem: { alignItems: 'center', paddingVertical: 4 },
  backArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { backgroundColor: BLUE + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeText: { fontSize: 8, fontWeight: '700', color: BLUE },

  // MainCalendarMock – matches real app screenshot
  mainHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  mainHeaderTitle: { fontSize: 11, fontWeight: '700', color: '#111827' },
  mainHeaderLogo: { width: 20, height: 20, borderRadius: 4, backgroundColor: NAVY },
  topTabBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#FFF',
  },
  topTabItem: { alignItems: 'center', gap: 1 },
  topTabLabel: { fontSize: 7, fontWeight: '500', color: GRAY },
  topTabLabelActive: { color: AMBER, fontWeight: '700' },
  calBody: { flex: 1, padding: 8, overflow: 'hidden' },
  calCellFaded: { color: '#D1D5DB' },
  dayPanel: { marginTop: 6, backgroundColor: LIGHT_GRAY, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: BORDER },
  dayPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayPanelTitle: { fontSize: 10, fontWeight: '700', color: '#111827' },
  noJobsText: { fontSize: 9, color: GRAY, marginTop: 4, marginBottom: 6 },
  scheduleBtn: { alignSelf: 'flex-start', backgroundColor: AMBER, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  scheduleBtnText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  mainFab: {
    position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16,
    backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
});
