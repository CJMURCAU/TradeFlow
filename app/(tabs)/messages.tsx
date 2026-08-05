import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase, supabaseUrl, supabaseAnonKey, VisitorConversation, VisitorMessage } from '@/lib/supabase';
import { ArrowLeft, Send, Mail, MessageCircle } from 'lucide-react-native';
import TabBar from '@/components/TabBar';
import { useCallback } from 'react';

type ConversationWithPreview = VisitorConversation & {
  latest_message: string;
  latest_sender: 'visitor' | 'owner';
  unread_count: number;
};

export default function MessagesPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithPreview | null>(null);
  const [messages, setMessages] = useState<VisitorMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fetchConversations = async () => {
    const { data, error: fetchError } = await supabase
      .from('visitor_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (fetchError || !data) {
      setLoading(false);
      return;
    }

    const conversationsWithPreviews: ConversationWithPreview[] = [];

    for (const conv of data) {
      const { data: msgs } = await supabase
        .from('visitor_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false });

      const latest = msgs && msgs.length > 0 ? msgs[0] : null;
      const unread = msgs ? msgs.filter((m: VisitorMessage) => m.sender === 'visitor' && !m.read_by_owner).length : 0;

      conversationsWithPreviews.push({
        ...conv,
        latest_message: latest?.body || '',
        latest_sender: latest?.sender || 'visitor',
        unread_count: unread,
      });
    }

    setConversations(conversationsWithPreviews);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const openConversation = async (conv: ConversationWithPreview) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    setError(null);

    const { data: msgs } = await supabase
      .from('visitor_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    if (msgs) {
      setMessages(msgs);
    }

    const { error: updateError } = await supabase
      .from('visitor_messages')
      .update({ read_by_owner: true })
      .eq('conversation_id', conv.id)
      .eq('sender', 'visitor')
      .eq('read_by_owner', false);

    if (!updateError) {
      setConversations(prev =>
        prev.map(c => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
      );
    }

    setLoadingMessages(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 200);
  };

  const sendReply = async () => {
    if (!selectedConversation || !replyText.trim()) return;

    setSending(true);
    setError(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token || supabaseAnonKey;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-owner-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          replyText: replyText.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send reply');
      }

      setReplyText('');

      const { data: msgs } = await supabase
        .from('visitor_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (msgs) {
        setMessages(msgs);
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    setSelectedConversation(null);
    setMessages([]);
    setReplyText('');
    setError(null);
    fetchConversations();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
        <TabBar />
      </View>
    );
  }

  if (selectedConversation) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <ArrowLeft size={20} color="#111827" />
              <Text style={styles.backBtnText}>Messages</Text>
            </TouchableOpacity>
            <Image
              source={require('@/assets/images/itt_emblem.webp')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.conversationHeaderInfo}>
            <Text style={styles.conversationName}>{selectedConversation.visitor_name}</Text>
            {selectedConversation.visitor_email && (
              <View style={styles.emailRow}>
                <Mail size={14} color="#6B7280" />
                <Text style={styles.conversationEmail}>{selectedConversation.visitor_email}</Text>
              </View>
            )}
          </View>
        </View>

        <TabBar />

        {loadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F59E0B" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}>
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>No messages in this conversation</Text>
            ) : (
              messages.map((msg) => {
                const isOwner = msg.sender === 'owner';
                return (
                  <View
                    key={msg.id}
                    style={[styles.messageBubble, isOwner ? styles.ownerBubble : styles.visitorBubble]}>
                    <Text style={styles.messageBody}>{msg.body}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.replyBar}>
          <TextInput
            style={styles.replyInput}
            placeholder="Type your reply..."
            placeholderTextColor="#9CA3AF"
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!replyText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendReply}
            disabled={!replyText.trim() || sending}>
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Messages</Text>
          <Image
            source={require('@/assets/images/itt_emblem.webp')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, isDesktop && styles.contentContainerDesktop]}>
        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MessageCircle size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyStateTitle}>No messages yet</Text>
            <Text style={styles.emptyStateText}>
              When visitors send you a question through your Contact Us page,
              their conversations will appear here.
            </Text>
          </View>
        ) : (
          conversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              style={styles.conversationCard}
              onPress={() => openConversation(conv)}>
              <View style={styles.conversationAvatar}>
                <Text style={styles.conversationAvatarText}>
                  {conv.visitor_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.conversationContent}>
                <View style={styles.conversationTopRow}>
                  <Text style={styles.conversationCardName}>{conv.visitor_name}</Text>
                  <Text style={styles.conversationTime}>
                    {new Date(conv.last_message_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <Text
                  style={styles.conversationPreview}
                  numberOfLines={1}>
                  {conv.latest_sender === 'owner' ? 'You: ' : ''}
                  {conv.latest_message}
                </Text>
                {conv.visitor_email && (
                  <View style={styles.emailRow}>
                    <Mail size={12} color="#9CA3AF" />
                    <Text style={styles.conversationEmailSmall}>{conv.visitor_email}</Text>
                  </View>
                )}
              </View>
              {conv.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{conv.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: '#6B7280' },

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
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  logoImage: { width: 120, height: 50 },

  conversationHeaderInfo: { marginTop: 8 },
  conversationName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  conversationEmail: { fontSize: 13, color: '#6B7280' },
  conversationEmailSmall: { fontSize: 12, color: '#9CA3AF' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText: { fontSize: 16, color: '#111827', fontWeight: '600' },

  content: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 120 },
  contentContainerDesktop: { alignItems: 'center' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#6B7280', marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conversationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  conversationAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  conversationContent: { flex: 1 },
  conversationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationCardName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  conversationTime: { fontSize: 12, color: '#9CA3AF' },
  conversationPreview: { fontSize: 14, color: '#6B7280' },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },

  messageList: { flex: 1, padding: 20 },
  messageListContent: { paddingBottom: 20, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },

  messageBubble: {
    borderRadius: 12,
    padding: 14,
    maxWidth: '80%',
  },
  ownerBubble: {
    backgroundColor: '#F59E0B',
    alignSelf: 'flex-end',
  },
  visitorBubble: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  messageBody: { fontSize: 15, color: '#111827', lineHeight: 20 },
  messageTime: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingVertical: 8 },

  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
