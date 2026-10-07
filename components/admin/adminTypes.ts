export interface AdminProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  district: string | null;
  role: 'admin' | 'user';
  is_verified: boolean;
  is_geoverified: boolean;
  is_banned: boolean;
  verification_status?: string | null;
  bio?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AdminVerificationRequest {
  id: string;
  user_id: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user?: Partial<AdminProfile>;
}

export interface AdminReport {
  id: string;
  reporter_id: string;
  target_type: 'user' | 'question' | 'answer' | 'request' | 'service' | 'borrow_item' | 'urgent_alert';
  target_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    city?: string | null;
    district?: string | null;
  };
}

export interface AdminService {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  price_type: string | null;
  is_verified: boolean;
  available_now: boolean;
  city: string | null;
  district: string | null;
  created_at: string;
  provider?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    phone?: string | null;
  };
}

export interface AdminBorrowItem {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: 'available' | 'borrowed' | 'unavailable';
  deposit_amount: number | null;
  image_url: string | null;
  city: string | null;
  district: string | null;
  created_at: string;
  owner?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface AdminUrgentAlert {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  alert_type: string | null;
  severity: string | null;
  status: 'active' | 'resolved';
  city: string | null;
  district: string | null;
  created_at: string;
  resolved_at: string | null;
  user?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    city?: string | null;
    district?: string | null;
  };
}

export interface AdminQuestion {
  id: string;
  author_id: string;
  title: string;
  body: string | null;
  city: string | null;
  district: string | null;
  status?: string | null;
  created_at: string;
  author?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface AdminRequest {
  id: string;
  requester_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  city: string | null;
  district: string | null;
  created_at: string;
  requester?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface AdminActivityLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata?: any;
  created_at: string;
  actor?: {
    id: string;
    display_name: string | null;
    username: string | null;
  };
}

export interface AdminStats {
  users: number;
  admins: number;
  verifiedUsers: number;
  geoverifiedUsers: number;
  bannedUsers: number;
  pendingVerifications: number;
  pendingReports: number;
  services: number;
  borrowItems: number;
  urgentAlerts: number;
  questions: number;
  requests: number;
}
