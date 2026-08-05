import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Clock, Briefcase, Users, User, Mail, MapPin, Camera, Play, Package, CircleCheck as CheckCircle, ArrowRight, Menu, X, MessageCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import PhoneFrame from '@/components/PhoneFrame';
import {
  MainCalendarMock,
  DashboardMock,
  JobDetailMock,
  ClientsMock,
  TeamMock,
  JobCardEmailMock,
} from '@/components/ScreenMockups';

const NAVY = '#1B2B4B';
const NAVY_DARK = '#0F1E38';
const NAVY_LIGHT = '#243859';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FCD34D';
const WHITE = '#FFFFFF';
const LIGHT_TEXT = '#CBD5E1';
const MUTED_TEXT = '#94A3B8';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';
const IS_MOBILE_WEB = IS_WEB && SCREEN_WIDTH < 768;

export default function LandingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthed(!!session);
    });
  }, []);

  const goToLogin = (mode?: 'signin' | 'signup') => {
    setMobileMenuOpen(false);
    if (isAuthed) {
      router.replace('/(tabs)');
    } else {
      router.push(`/login${mode ? `?mode=${mode}` : ''}`);
    }
  };

  const features = [
    {
      title: 'Your Schedule, Front and Centre',
      description:
        'The main screen shows a month-by-month calendar with colour-coded dots so you can see what is pending, active, and done at a look. Today\'s jobs appear right below the calendar — tap any day to see every job scheduled.',
      mock: <MainCalendarMock />,
      icon: Calendar,
    },
    {
      title: 'See Your Week at a Glance',
      description:
        'The dashboard shows hours worked this week, active jobs, completed jobs, and pending jobs — all on one screen. No digging through menus to know where things stand.',
      mock: <DashboardMock />,
      icon: Clock,
    },
    {
      title: 'One Job, Everything Tracked',
      description:
        'Start a timer when you arrive on site. Take photos of the work. Add materials and services from your saved catalogue. The cost summary calculates labour and parts into a total — automatically.',
      mock: <JobDetailMock />,
      icon: Briefcase,
    },
    {
      title: 'Keep Every Client in One Place',
      description:
        'Company name, contact person, phone, email, and address — all searchable, all on one screen. One tap to call. One tap to get directions to the site.',
      mock: <ClientsMock />,
      icon: Users,
    },
    {
      title: 'Bring Your Crew Along',
      description:
        'Add employees, send them an email invite, and assign jobs from your phone. See everyone\'s week in a shared colour-coded schedule. Employees mark jobs done from their own phone.',
      mock: <TeamMock />,
      icon: Users,
    },
    {
      title: 'Finish the Job, Send the Card',
      description:
        'When a job is done, email a professional job card straight to your inbox with one tap. It includes time tracked, materials used, photos, and a full cost breakdown.',
      mock: <JobCardEmailMock />,
      icon: Mail,
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerInner}>
          <View style={styles.logoRow}>
            <Image
              source={require('@/assets/images/tradepro_emblem.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerLogoText}>Innovative Trade Tracker</Text>
          </View>

          {IS_MOBILE_WEB ? (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={24} color={WHITE} /> : <Menu size={24} color={WHITE} />}
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtns}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => router.push('/contact')}>
                <MessageCircle size={16} color={LIGHT_TEXT} />
                <Text style={styles.contactBtnText}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signInBtn} onPress={() => goToLogin('signin')}>
                <Text style={styles.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signUpBtn} onPress={() => goToLogin('signup')}>
                <Text style={styles.signUpBtnText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {IS_MOBILE_WEB && mobileMenuOpen && (
          <View style={styles.mobileMenu}>
            <TouchableOpacity style={styles.mobileMenuContactBtn} onPress={() => router.push('/contact')}>
              <MessageCircle size={18} color={AMBER} />
              <Text style={styles.mobileMenuContactText}>Contact Us</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileMenuBtn} onPress={() => goToLogin('signin')}>
              <Text style={styles.mobileMenuBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mobileMenuBtn, styles.mobileMenuBtnPrimary]}
              onPress={() => goToLogin('signup')}>
              <Text style={styles.mobileMenuBtnPrimaryText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroHeadline}>
            Run your jobs{'\n'}from your pocket
          </Text>
          <Text style={styles.heroSubtext}>
            Innovative Trade Tracker keeps job management simple. Schedule jobs,
            track your time, manage clients, and email finished job cards —
            all from your phone.
          </Text>
          {/* App preview video */}
          <View style={styles.heroVideoWrap}>
            <View style={styles.heroVideoInner}>
              <View style={styles.heroVideoPlayBtn}>
                <Play size={40} color={WHITE} fill={WHITE} />
              </View>
              <Text style={styles.heroVideoLabel}>App preview — coming soon</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.heroContactBtn} onPress={() => router.push('/contact')}>
            <MessageCircle size={18} color={AMBER} />
            <Text style={styles.heroContactBtnText}>Contact Us — ask a question</Text>
          </TouchableOpacity>
        </View>

        {/* Who It's For */}
        <View style={styles.whoSection}>
          <Text style={styles.whoEyebrow}>Who It's For</Text>
          <Text style={styles.whoTitle}>Built for Individuals and small companies</Text>
          <Text style={styles.whoSubtext}>
            TradeFlow keeps things simple whether you work alone or lead a small crew. No enterprise complexity — just the tools you actually need.
          </Text>

          <View style={styles.whoCards}>
            {/* Individual card — white */}
            <View style={[styles.whoCard, styles.whoCardLight]}>
              <View style={styles.whoCardHeader}>
                <View style={[styles.whoCardIcon, styles.whoCardIconLight]}>
                  <User size={22} color={AMBER} />
                </View>
                <View>
                  <Text style={[styles.whoCardEyebrow, { color: AMBER }]}>INDIVIDUAL</Text>
                  <Text style={[styles.whoCardName, { color: '#111827' }]}>Just You</Text>
                </View>
              </View>
              <Text style={[styles.whoCardDesc, { color: '#4B5563' }]}>
                Working as an independent tradesperson? Innovative Trade Tracker handles the admin so you can spend more time on the tools. Simple to set up, simple to use every day.
              </Text>
              {[
                'Manage jobs with an easy-to-use, intuitive calendar',
                'Track time, parts, and billing against each job',
                'Keep client history and contact details organised in one place',
                'Capture job site photos and store them directly in the app',
                'Work offline when out of reception — syncs automatically when back online',
              ].map((item, i) => (
                <View key={i} style={styles.whoCardItem}>
                  <CheckCircle size={16} color={AMBER} />
                  <Text style={[styles.whoCardItemText, { color: '#374151' }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Small Company card — dark */}
            <View style={[styles.whoCard, styles.whoCardDark]}>
              <View style={styles.whoCardHeader}>
                <View style={[styles.whoCardIcon, styles.whoCardIconDark]}>
                  <Users size={22} color={AMBER} />
                </View>
                <View>
                  <Text style={[styles.whoCardEyebrow, { color: AMBER }]}>SMALL COMPANY</Text>
                  <Text style={[styles.whoCardName, { color: WHITE }]}>Your Small Team</Text>
                </View>
              </View>
              <Text style={[styles.whoCardDesc, { color: LIGHT_TEXT }]}>
                Managing a small team? Assign jobs, track schedules, and keep your crew coordinated — all from one simple app that your team will actually want to use.
              </Text>
              {[
                'Assign jobs to team members',
                "Track everyone's schedule in one view",
                'Oversee job progress across the crew',
                'Manage shared inventory and parts',
                'Simple enough for the whole team to use',
              ].map((item, i) => (
                <View key={i} style={styles.whoCardItem}>
                  <CheckCircle size={16} color={AMBER} />
                  <Text style={[styles.whoCardItemText, { color: LIGHT_TEXT }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Feature Intro */}
        <View style={styles.featureIntro}>
          <Text style={styles.featureIntroTitle}>Everything you need.{'\n'}Nothing you don't.</Text>
          <Text style={styles.featureIntroSubtext}>
            Every feature in Innovative Trade Tracker exists for one reason: to
            help a tradesperson get the job done without paperwork getting in
            the way. Here is what it does.
          </Text>
        </View>

        {/* Feature Blocks */}
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const isReversed = index % 2 === 1 && !IS_MOBILE_WEB;
          return (
            <View
              key={index}
              style={[
                styles.featureBlock,
                { backgroundColor: index % 2 === 0 ? NAVY_DARK : NAVY },
              ]}>
              <View
                style={[
                  styles.featureContent,
                  isReversed && styles.featureContentReversed,
                ]}>
                <View style={styles.featureTextSide}>
                  <View style={styles.featureIconRow}>
                    <View style={styles.featureIconBox}>
                      <Icon size={24} color={AMBER} />
                    </View>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
                <View style={styles.featurePhoneSide}>
                  <PhoneFrame width={IS_MOBILE_WEB ? 240 : 280} height={IS_MOBILE_WEB ? 480 : 560}>
                    {feature.mock}
                  </PhoneFrame>
                </View>
              </View>
            </View>
          );
        })}

        {/* Video Section */}
        <View style={styles.videoSection}>
          <Text style={styles.videoSectionTitle}>
            Watch how it works
          </Text>
          <Text style={styles.videoSectionSubtext}>
            Straight from the person who built it. Two short videos showing you
            exactly how Innovative Trade Tracker works — from setting up your
            business to managing jobs day to day.
          </Text>

          <View style={styles.videoGrid}>
            <View style={styles.videoCard}>
              <View style={styles.videoFrame}>
                <View style={styles.videoPlayBtn}>
                  <Play size={32} color={WHITE} fill={WHITE} />
                </View>
                <Text style={styles.videoComingSoon}>Video coming soon</Text>
              </View>
              <Text style={styles.videoTitle}>Getting Started</Text>
              <Text style={styles.videoDesc}>
                Set up your business, add your first client, and create your
                first job in under five minutes.
              </Text>
            </View>

            <View style={styles.videoCard}>
              <View style={styles.videoFrame}>
                <View style={styles.videoPlayBtn}>
                  <Play size={32} color={WHITE} fill={WHITE} />
                </View>
                <Text style={styles.videoComingSoon}>Video coming soon</Text>
              </View>
              <Text style={styles.videoTitle}>Managing Jobs Day to Day</Text>
              <Text style={styles.videoDesc}>
                Track time, add materials, take photos, assign jobs to your
                team, and send finished job cards by email.
              </Text>
            </View>
          </View>
        </View>

        {/* Personal Voice */}
        <View style={styles.personalSection}>
          <Text style={styles.personalText}>
            "I built Innovative Trade Tracker because most job management apps
            are too complicated for what a tradesperson actually needs. This
            one keeps it simple: schedule the job, track your time, record your
            materials, send the card. That's it."
          </Text>
          <View style={styles.personalSignature}>
            <View style={styles.personalAvatar}>
              <Users size={20} color={AMBER} />
            </View>
            <Text style={styles.personalName}>The Maker of Innovative Trade Tracker</Text>
          </View>
        </View>

        {/* Final CTA */}
        <View style={styles.finalCta}>
          <Text style={styles.finalCtaTitle}>
            Start managing your jobs today
          </Text>
          <Text style={styles.finalCtaSubtext}>
            It takes two minutes to set up. No credit card. No trial that runs
            out. Just sign up and get to work.
          </Text>
          <TouchableOpacity style={styles.finalCtaBtn} onPress={() => goToLogin('signup')}>
            <Text style={styles.finalCtaBtnText}>Create Your Account</Text>
            <ArrowRight size={20} color={NAVY} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Image
              source={require('@/assets/images/tradepro_emblem.png')}
              style={styles.footerLogo}
              resizeMode="contain"
            />
            <Text style={styles.footerName}>Innovative Trade Tracker</Text>
          </View>
          <Text style={styles.footerCopy}>
            © {new Date().getFullYear()} Innovative Trade Tracker. Built for tradespeople.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },

  header: {
    backgroundColor: NAVY_DARK,
    borderBottomWidth: 1,
    borderBottomColor: NAVY_LIGHT,
    paddingBottom: 12,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 36, height: 36 },
  headerLogoText: { fontSize: 16, fontWeight: 'bold', color: WHITE },
  headerBtns: { flexDirection: 'row', gap: 10 },
  signInBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: AMBER,
  },
  signInBtnText: { fontSize: 14, fontWeight: '600', color: AMBER },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: NAVY_LIGHT,
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: LIGHT_TEXT },
  signUpBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: AMBER,
  },
  signUpBtnText: { fontSize: 14, fontWeight: '700', color: NAVY },
  menuBtn: { padding: 6 },
  mobileMenu: { paddingTop: 12, gap: 8 },
  mobileMenuContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: AMBER,
  },
  mobileMenuContactText: { fontSize: 15, fontWeight: '600', color: AMBER },
  mobileMenuBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: AMBER,
    alignItems: 'center',
  },
  mobileMenuBtnText: { fontSize: 15, fontWeight: '600', color: AMBER },
  mobileMenuBtnPrimary: { backgroundColor: AMBER, borderColor: AMBER },
  mobileMenuBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: NAVY },

  scrollView: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 60,
    backgroundColor: NAVY,
  },
  heroHeadline: {
    fontSize: IS_MOBILE_WEB ? 32 : 44,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    lineHeight: IS_MOBILE_WEB ? 40 : 54,
    marginBottom: 20,
    maxWidth: 700,
  },
  heroSubtext: {
    fontSize: IS_MOBILE_WEB ? 15 : 18,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 600,
    marginBottom: 32,
  },
  heroVideoWrap: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: NAVY_LIGHT,
    marginBottom: 24,
  },
  heroVideoInner: {
    aspectRatio: 16 / 9,
    backgroundColor: NAVY_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  heroVideoPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVideoLabel: {
    fontSize: 14,
    color: MUTED_TEXT,
    fontWeight: '500',
  },
  heroContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AMBER + '60',
  },
  heroContactBtnText: { fontSize: 15, fontWeight: '600', color: AMBER },

  whoSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    backgroundColor: NAVY,
    alignItems: 'center',
  },
  whoEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: AMBER,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'center',
  },
  whoTitle: {
    fontSize: IS_MOBILE_WEB ? 24 : 32,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    lineHeight: IS_MOBILE_WEB ? 32 : 42,
    marginBottom: 14,
    maxWidth: 620,
  },
  whoSubtext: {
    fontSize: IS_MOBILE_WEB ? 14 : 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 580,
    marginBottom: 40,
  },
  whoCards: {
    flexDirection: IS_MOBILE_WEB ? 'column' : 'row',
    gap: 20,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  whoCard: {
    flex: 1,
    borderRadius: 20,
    padding: 28,
    gap: 0,
  },
  whoCardLight: {
    backgroundColor: WHITE,
  },
  whoCardDark: {
    backgroundColor: '#1C1C1E',
  },
  whoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  whoCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoCardIconLight: {
    backgroundColor: '#FEF3C7',
  },
  whoCardIconDark: {
    backgroundColor: '#3B2A00',
  },
  whoCardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  whoCardName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  whoCardDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  whoCardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  whoCardItemText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  featureIntro: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 50,
    backgroundColor: NAVY_DARK,
  },
  featureIntroTitle: {
    fontSize: IS_MOBILE_WEB ? 24 : 32,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    lineHeight: IS_MOBILE_WEB ? 32 : 42,
    marginBottom: 14,
    maxWidth: 600,
  },
  featureIntroSubtext: {
    fontSize: IS_MOBILE_WEB ? 14 : 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 550,
  },

  featureBlock: {
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  featureContentReversed: {
    flexDirection: 'row-reverse',
  },
  featureTextSide: { flex: 1, maxWidth: 420 },
  featurePhoneSide: { alignItems: 'center', flex: 1 },
  featureIconRow: { marginBottom: 16 },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AMBER + '40',
  },
  featureTitle: {
    fontSize: IS_MOBILE_WEB ? 22 : 28,
    fontWeight: 'bold',
    color: WHITE,
    marginBottom: 12,
    lineHeight: IS_MOBILE_WEB ? 30 : 36,
  },
  featureDescription: {
    fontSize: IS_MOBILE_WEB ? 14 : 16,
    color: LIGHT_TEXT,
    lineHeight: 24,
  },

  videoSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    backgroundColor: NAVY_DARK,
    alignItems: 'center',
  },
  videoSectionTitle: {
    fontSize: IS_MOBILE_WEB ? 24 : 32,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  videoSectionSubtext: {
    fontSize: IS_MOBILE_WEB ? 14 : 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 550,
    marginBottom: 36,
  },
  videoGrid: {
    flexDirection: IS_MOBILE_WEB ? 'column' : 'row',
    gap: 24,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  videoCard: { flex: 1 },
  videoFrame: {
    aspectRatio: 16 / 10,
    borderRadius: 16,
    backgroundColor: NAVY,
    borderWidth: 2,
    borderColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  videoPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  videoComingSoon: { fontSize: 13, color: MUTED_TEXT, fontWeight: '500' },
  videoTitle: { fontSize: 18, fontWeight: 'bold', color: WHITE, marginBottom: 6 },
  videoDesc: { fontSize: 14, color: LIGHT_TEXT, lineHeight: 22 },

  personalSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    backgroundColor: NAVY,
    alignItems: 'center',
  },
  personalText: {
    fontSize: IS_MOBILE_WEB ? 18 : 22,
    color: WHITE,
    textAlign: 'center',
    lineHeight: IS_MOBILE_WEB ? 28 : 34,
    maxWidth: 650,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  personalSignature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AMBER + '60',
  },
  personalName: { fontSize: 14, color: AMBER, fontWeight: '600' },

  finalCta: {
    paddingHorizontal: 24,
    paddingVertical: 70,
    backgroundColor: NAVY_DARK,
    alignItems: 'center',
  },
  finalCtaTitle: {
    fontSize: IS_MOBILE_WEB ? 26 : 34,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  finalCtaSubtext: {
    fontSize: IS_MOBILE_WEB ? 14 : 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 500,
    marginBottom: 32,
  },
  finalCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AMBER,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 14,
  },
  finalCtaBtnText: { fontSize: 18, fontWeight: '700', color: NAVY },

  footer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: NAVY_DARK,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: NAVY_LIGHT,
  },
  footerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  footerLogo: { width: 28, height: 28 },
  footerName: { fontSize: 14, fontWeight: '600', color: WHITE },
  footerCopy: { fontSize: 12, color: MUTED_TEXT },
});
