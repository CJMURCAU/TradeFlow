import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

export type Client = {
  id: string;
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
  created_at: string;
};
