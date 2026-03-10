import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { supabase, Client } from '@/lib/supabase';
import { Plus, Search, Trash2, MapPin, Phone, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TabBar from '@/components/TabBar';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client =>
        client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone.includes(searchQuery)
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (data) {
      setClients(data);
      setFilteredClients(data);
    }
  };

  const deleteClient = async (id: string, name: string) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${name}? This will also delete all associated jobs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clients')
              .delete()
              .eq('id', id);

            if (!error) {
              fetchClients();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Clients</Text>
          <Image
            source={require('@/assets/images/tradepro_emblem.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <TabBar />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </Text>
          </View>
        ) : (
          filteredClients.map(client => (
            <View key={client.id} style={styles.clientCard}>
              <TouchableOpacity
                style={styles.clientContent}
                onPress={() => router.push(`/client/${client.id}`)}>
                <Text style={styles.clientName}>{client.company_name || client.name}</Text>
                {client.name ? <Text style={styles.clientContact}>{client.name}</Text> : null}
                {client.phone && (
                  <View style={styles.clientInfo}>
                    <Phone size={16} color="#6B7280" />
                    <Text style={styles.clientInfoText}>{client.phone}</Text>
                  </View>
                )}
                {client.email && (
                  <View style={styles.clientInfo}>
                    <Mail size={16} color="#6B7280" />
                    <Text style={styles.clientInfoText}>{client.email}</Text>
                  </View>
                )}
                {client.address && (
                  <View style={styles.clientInfo}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.clientInfoText}>{client.address}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteClient(client.id, client.company_name || client.name)}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/newclient')}>
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
    marginBottom: 14,
  },
  logoImage: {
    width: 100,
    height: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
  },
  clientCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clientContent: {
    flex: 1,
    padding: 16,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  clientContact: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  clientInfoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
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
