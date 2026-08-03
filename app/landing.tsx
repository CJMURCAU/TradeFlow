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
import { Calendar, Clock, Briefcase, Users, Mail, MapPin, Camera, Play, Package, CircleCheck as CheckCircle, ArrowRight, Menu, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import PhoneFrame from '@/components/PhoneFrame';
import {
  DashboardMock,
  CalendarMock,
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
      title: 'See Your Week at a Glance',
      description:
        'The dashboard shows hours worked this week, active jobs, completed jobs, and pending jobs — all on one screen. No digging through menus to know where things stand.',
      mock: <DashboardMock />,
      icon: Clock,
    },
    {
      title: 'Your Jobs, Laid Out Clearly',
      description:
        'A month-by-month calendar with colour-coded dots so you know what is pending, active, and done at a look. Tap any day to see every job scheduled that day.',
      mock: <CalendarMock />,
      icon: Calendar,
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
          <View style={styles.heroBtns}>
            <TouchableOpacity style={styles.heroPrimaryBtn} onPress={() => goToLogin('signup')}>
              <Text style={styles.heroPrimaryBtnText}>Get Started</Text>
              <ArrowRight size={18} color={NAVY} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroSecondaryBtn} onPress={() => goToLogin('signin')}>
              <Text style={styles.heroSecondaryBtnText}>Sign In</Text>
            </TouchableOpacity>
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
  signUpBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: AMBER,
  },
  signUpBtnText: { fontSize: 14, fontWeight: '700', color: NAVY },
  menuBtn: { padding: 6 },
  mobileMenu: { paddingTop: 12, gap: 8 },
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
  heroBtns: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AMBER,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
  },
  heroPrimaryBtnText: { fontSize: 16, fontWeight: '700', color: NAVY },
  heroSecondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AMBER,
  },
  heroSecondaryBtnText: { fontSize: 16, fontWeight: '600', color: AMBER },

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
