import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase, NoteItem } from '@/lib/supabase';
import { Type, Hash, SquareCheck as CheckSquare, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import TabBar from '@/components/TabBar';

type ItemType = 'text' | 'numbered' | 'checkbox';

export default function NotesPage() {
  const [items, setItems] = useState<NoteItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchItems();
    }, [userId])
  );

  useEffect(() => {
    if (userId) fetchItems();
  }, [userId]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('note_items')
      .select('*')
      .order('position', { ascending: true });
    if (data) setItems(data as NoteItem[]);
  };

  const addItem = async (type: ItemType) => {
    if (!userId) return;

    const maxPosition = items.length > 0
      ? Math.max(...items.map(i => i.position))
      : -1;

    const { data, error } = await supabase
      .from('note_items')
      .insert({
        user_id: userId,
        type,
        content: '',
        checked: false,
        position: maxPosition + 1,
      })
      .select()
      .single();

    if (!error && data) {
      setItems(prev => [...prev, data as NoteItem]);
      setTimeout(() => {
        inputRefs.current[data.id]?.focus();
      }, 100);
    }
  };

  const updateContent = (id: string, content: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, content } : item));

    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      supabase
        .from('note_items')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', id);
    }, 500);
  };

  const toggleChecked = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const checked = !item.checked;
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i));
    await supabase
      .from('note_items')
      .update({ checked, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setLongPressId(null);
    await supabase.from('note_items').delete().eq('id', id);
  };

  const handleKeyPress = (id: string, key: string) => {
    if (key === 'Backspace') {
      const item = items.find(i => i.id === id);
      if (item && item.content === '') {
        const idx = items.findIndex(i => i.id === id);
        const prevItem = items[idx - 1];
        deleteItem(id);
        if (prevItem) {
          setTimeout(() => {
            inputRefs.current[prevItem.id]?.focus();
          }, 50);
        }
      }
    }
  };

  const getNumberedIndex = (item: NoteItem): number => {
    const numbered = items.filter(i => i.type === 'numbered');
    return numbered.findIndex(i => i.id === item.id) + 1;
  };

  const renderItem = (item: NoteItem) => {
    const isLongPressed = longPressId === item.id;

    return (
      <View key={item.id} style={styles.itemRow}>
        {item.type === 'checkbox' && (
          <TouchableOpacity
            style={[styles.checkbox, item.checked && styles.checkboxChecked]}
            onPress={() => toggleChecked(item.id)}
            activeOpacity={0.7}>
            {item.checked && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )}

        {item.type === 'numbered' && (
          <Text style={styles.numberPrefix}>{getNumberedIndex(item)}.</Text>
        )}

        <TouchableOpacity
          style={styles.inputWrapper}
          onLongPress={() => setLongPressId(isLongPressed ? null : item.id)}
          activeOpacity={1}>
          <TextInput
            ref={ref => { inputRefs.current[item.id] = ref; }}
            style={[
              styles.itemInput,
              item.type === 'checkbox' && item.checked && styles.strikethrough,
            ]}
            value={item.content}
            onChangeText={text => updateContent(item.id, text)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(item.id, nativeEvent.key)}
            multiline
            placeholder={
              item.type === 'text' ? 'Add text...' :
              item.type === 'numbered' ? 'Add item...' :
              'Add task...'
            }
            placeholderTextColor="#9CA3AF"
            selectionColor="#F59E0B"
          />
        </TouchableOpacity>

        {isLongPressed && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteItem(item.id)}
            activeOpacity={0.7}>
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notes</Text>
        <Image
          source={require('@/assets/images/tradepro_emblem.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {items.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your notepad is empty</Text>
              <Text style={styles.emptySubtitle}>Use the toolbar below to add text, numbered items, or checkboxes.</Text>
            </View>
          )}
          {items.map(renderItem)}
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => addItem('text')}
            activeOpacity={0.7}>
            <Type size={18} color="#374151" />
            <Text style={styles.toolbarLabel}>Text</Text>
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => addItem('numbered')}
            activeOpacity={0.7}>
            <Hash size={18} color="#374151" />
            <Text style={styles.toolbarLabel}>Numbered</Text>
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => addItem('checkbox')}
            activeOpacity={0.7}>
            <CheckSquare size={18} color="#374151" />
            <Text style={styles.toolbarLabel}>Checkbox</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  logo: {
    width: 44,
    height: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  numberPrefix: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
    paddingTop: 10,
    flexShrink: 0,
    minWidth: 24,
  },
  itemInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 8,
    lineHeight: 22,
    minHeight: 40,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  deleteButton: {
    paddingTop: 12,
    paddingLeft: 4,
    flexShrink: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toolbarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  toolbarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
});
