import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Send, ArrowLeft, Mail, MessageCircle } from 'lucide-react-native';

const NAVY = '#1B2B4B';
const NAVY_DARK = '#0F1E38';
const NAVY_LIGHT = '#243859';
const AMBER = '#F59E0B';
const WHITE = '#FFFFFF';
const LIGHT_TEXT = '#CBD5E1';
const MUTED_TEXT = '#94A3B8';

type ConversationMessage = {
  message_id: string | null;
  sender: string;
  body: string;
  message_created_at: string | null;
};

export default function ContactPage() {
  const params = useLocalSearchParams<{ conversation?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [slug, setSlug] = useState<string | null>(params.conversation || null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [conversationInfo, setConversationInfo] = useState<{ name: string; email: string | null } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (slug) {
      loadConversation(slug);
    } else {
      setLoading(false);
    }
  }, [slug]);

  const loadConversation = async (s: string) => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('get_visitor_conversation_by_slug', { p_slug: s });

    if (rpcError || !data || data.length === 0) {
      setError('Conversation not found. Please start a new one below.');
      setSlug(null);
      setShowForm(true);
      setLoading(false);
      return;
    }

    const first = data[0];
    setConversationInfo({ name: first.visitor_name, email: first.visitor_email });
    setVisitorName(first.visitor_name);
    setVisitorEmail(first.visitor_email || '');

    const validMessages = data.filter((m: ConversationMessage) => m.message_id !== null);
    setMessages(validMessages);
    setShowForm(false);
    setLoading(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  };

  const sendMessage = async () => {
    setError(null);
    if (!visitorName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-visitor-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim() || null,
          message: message.trim(),
          slug: slug,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send message');
      }

      const result = await response.json();
      if (result.slug && !slug) {
        setSlug(result.slug);
        const newUrl = `/contact?conversation=${result.slug}`;
        window.history?.replaceState?.({}, '', newUrl);
      }

      setMessage('');

      if (slug || result.slug) {
        await loadConversation(result.slug || slug!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = () => {
    setSlug(null);
    setMessages([]);
    setConversationInfo(null);
    setVisitorName('');
    setVisitorEmail('');
    setMessage('');
    setError(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push('/landing')}>
            <ArrowLeft size={20} color={WHITE} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <Image
              source={require('@/assets/images/tradepro_emblem.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerLogoText}>Contact Us</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {messages.length > 0 && (
            <View style={styles.threadContainer}>
              <Text style={styles.threadTitle}>
                Conversation with {conversationInfo?.name || 'visitor'}
              </Text>
              {messages.map((msg) => {
                const isVisitor = msg.sender === 'visitor';
                return (
                  <View
                    key={msg.message_id}
                    style={[styles.messageBubble, isVisitor ? styles.visitorBubble : styles.ownerBubble]}>
                    <Text style={[styles.messageSender, isVisitor ? styles.visitorSender : styles.ownerSender]}>
                      {isVisitor ? 'You' : 'Innovative Trade Tracker'}
                    </Text>
                    <Text style={styles.messageBody}>{msg.body}</Text>
                    <Text style={styles.messageTime}>
                      {msg.message_created_at
                        ? new Date(msg.message_created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {showForm && messages.length === 0 && (
            <View style={styles.introSection}>
              <View style={styles.introIconBox}>
                <MessageCircle size={32} color={AMBER} />
              </View>
              <Text style={styles.introTitle}>Have a question?</Text>
              <Text style={styles.introText}>
                Send us a message and we will get back to you as quickly as possible.
                You can check back here later for our response, or leave your email
                below and we will reply there too.
              </Text>
            </View>
          )}

          {messages.length > 0 && (
            <View style={styles.replyInfoBox}>
              <Text style={styles.replyInfoText}>
                Your question will be answered as quickly as possible. Check back here
                later for a response{conversationInfo?.email ? ' — we will also email you when we reply' : ''}.
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.formSection}>
            {showForm && (
              <>
                <Text style={styles.fieldLabel}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={MUTED_TEXT}
                  value={visitorName}
                  onChangeText={setVisitorName}
                />

                <Text style={styles.fieldLabel}>Your Email (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email for a reply"
                  placeholderTextColor={MUTED_TEXT}
                  value={visitorEmail}
                  onChangeText={setVisitorEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </>
            )}

            <Text style={styles.fieldLabel}>
              {messages.length > 0 ? 'Your Reply' : 'Your Message'}
            </Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder="Type your message here..."
              placeholderTextColor={MUTED_TEXT}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={sending}>
              {sending ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <>
                  <Text style={styles.sendBtnText}>Send Message</Text>
                  <Send size={18} color={NAVY} />
                </>
              )}
            </TouchableOpacity>

            {messages.length > 0 && (
              <TouchableOpacity style={styles.newConversationBtn} onPress={startNewConversation}>
                <Text style={styles.newConversationText}>Start a new conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: LIGHT_TEXT },

  header: {
    backgroundColor: NAVY_DARK,
    borderBottomWidth: 1,
    borderBottomColor: NAVY_LIGHT,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText: { fontSize: 14, color: WHITE, fontWeight: '600' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28 },
  headerLogoText: { fontSize: 16, fontWeight: 'bold', color: WHITE },
  headerSpacer: { width: 60 },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },

  introSection: { alignItems: 'center', marginBottom: 32, paddingTop: 20 },
  introIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AMBER + '40',
    marginBottom: 16,
  },
  introTitle: { fontSize: 24, fontWeight: 'bold', color: WHITE, marginBottom: 10 },
  introText: {
    fontSize: 15,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 480,
  },

  threadContainer: { marginBottom: 20, gap: 12 },
  threadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AMBER,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  messageBubble: {
    borderRadius: 12,
    padding: 14,
    maxWidth: '85%',
  },
  visitorBubble: {
    backgroundColor: NAVY_LIGHT,
    alignSelf: 'flex-start',
  },
  ownerBubble: {
    backgroundColor: AMBER + '20',
    borderWidth: 1,
    borderColor: AMBER + '60',
    alignSelf: 'flex-end',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  visitorSender: { color: AMBER },
  ownerSender: { color: AMBER },
  messageBody: { fontSize: 14, color: WHITE, lineHeight: 20 },
  messageTime: { fontSize: 11, color: MUTED_TEXT, marginTop: 6 },

  replyInfoBox: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: AMBER + '30',
  },
  replyInfoText: { fontSize: 13, color: LIGHT_TEXT, lineHeight: 20 },

  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },

  formSection: { gap: 10, marginBottom: 24 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AMBER,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: WHITE,
    borderWidth: 1,
    borderColor: NAVY_LIGHT,
  },
  messageInput: {
    minHeight: 100,
    maxHeight: 200,
  },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: NAVY },

  newConversationBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  newConversationText: {
    fontSize: 14,
    color: AMBER,
    fontWeight: '500',
  },
});
