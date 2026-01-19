
export type ClientStatus = 'active' | 'expiring' | 'expired' | 'pending';

export interface Client {
  id?: string; // Optional for new creations
  created_at?: string;
  name: string;
  phone: string;
  email: string;
  start_date: string; // DB column: start_date
  end_date: string;   // DB column: end_date
  plan_type: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Custom'; // DB: plan_type
  amount: number;
  status: ClientStatus;
  avatar_url?: string;
  notes?: string;
  service_type?: string; // New field
  ai_enabled?: boolean; // AI Module
  ai_mode?: 'standard' | 'strict' | 'friendly'; // AI Module
}

export interface ServiceType {
  id: string;
  name: string;
}

export interface ScheduleItem {
  id?: string;
  client_id: string;
  date: string; // ISO Date string
  type: 'workout' | 'diet' | 'checkin' | 'general';
  message: string;
  attachment_url?: string;
  attachment_name?: string;
  status: 'pending' | 'sent';
}

export interface Stats {
  totalClients: number;
  activeClients: number;
  expiringSoon: number;
  monthlyRevenue: number;
}

export interface FeedbackQuestion {
  id: string;
  text: string;
  order: number;
  category?: string; // New field
}

export interface FeedbackSubmission {
  id: string;
  client_id: string; // Foreign key
  created_at: string;
  answers: { question: string; answer: string }[];
  status: 'pending' | 'reviewed';

  // Joined fields (optional, for display)
  clients?: {
    name: string;
    avatar_url: string;
    phone: string;
  }
}