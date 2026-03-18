import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoSecureStoreAdapter = Platform.OS !== 'web' ? {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
} : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Client = {
  id: string;
  company_name: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
};

export type Job = {
  id: string;
  client_id: string;
  title: string;
  purchase_order_number: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  scheduled_time: string | null;
  job_card_number: number;
  email_sent: boolean;
  created_at: string;
};

export type Part = {
  id: string;
  job_id: string;
  name: string;
  cost: number;
  quantity: number;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  job_id: string;
  start_time: string;
  end_time: string | null;
  is_running: boolean;
  created_at: string;
};

export type BusinessDetails = {
  id: string;
  company_name: string;
  tradesman_name: string;
  job_email: string;
  default_hourly_rate: number;
  job_card_number_start: number;
  created_at: string;
};
