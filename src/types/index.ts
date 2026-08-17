export interface Church {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  mobile: string | null;
  role: 'super_admin' | 'church_admin';
  church_id: string | null;
  full_name: string | null;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  church?: Church;
}

export interface Member {
  id: string;
  church_id: string;
  family_number: string;
  member_name: string;
  address: string;
  email: string;
  mobile: string;
  date_of_birth: string | null;
  wedding_date: string | null;
  created_at: string;
  church?: Church;
}

export interface Subscription {
  id: string;
  member_id: string;
  church_id: string;
  year: number;
  month: number;
  sandha: number;
  kattida_nidhi: number;
  aalaya_paraamarippu: number;
  narseidhi_thiruppani: number;
  yezhaiyar_nidhi: number;
  pengal_thiruppani: number;
  aangal_thiruppani: number;
  ilainyar_thiruppani: number;
  siruvar_thiruppani: number;
  girama_nidhi: number;
  kalvi_nidhi: number;
  created_at: string;
}

export type Page =
  | 'dashboard'
  | 'members'
  | 'member-detail'
  | 'churches'
  | 'admins'
  | 'account-approvals'
  | 'activity-logs'
  | 'circulars'
  | 'harvest-festival'
  | 'reports';

export interface HarvestFestivalItem {
  id: string;
  church_id: string;
  item_name: string;
  purchased_person: string;
  amount: number;
  status: 'paid' | 'due';
  settled_amount: number;
  created_at: string;
  church?: Church;
}

export interface Circular {
  id: string;
  title: string;
  content: string | null;
  voice_url: string | null;
  image_url: string | null;
  document_url: string | null;
  target_type: 'all' | 'specific';
  created_by: string;
  created_at: string;
  circular_churches?: { church_id: string; read_at: string | null }[];
}

export interface NavState {
  page: Page;
  memberId?: string;
  familyNumber?: string;
}

export const SUBSCRIPTION_FIELDS: { key: keyof Omit<Subscription, 'id' | 'member_id' | 'church_id' | 'year' | 'month' | 'created_at'>; label: string }[] = [
  { key: 'sandha', label: 'Sandha' },
  { key: 'kattida_nidhi', label: 'Kattida Nidhi' },
  { key: 'aalaya_paraamarippu', label: 'Aalaya Paraamarippu' },
  { key: 'narseidhi_thiruppani', label: 'Narseidhi Thiruppani' },
  { key: 'yezhaiyar_nidhi', label: 'Yezhaiyar Nidhi' },
  { key: 'pengal_thiruppani', label: 'Pengal Thiruppani' },
  { key: 'aangal_thiruppani', label: 'Aangal Thiruppani' },
  { key: 'ilainyar_thiruppani', label: 'Ilainyar Thiruppani' },
  { key: 'siruvar_thiruppani', label: 'Siruvar Thiruppani' },
  { key: 'girama_nidhi', label: 'Girama Nidhi' },
  { key: 'kalvi_nidhi', label: 'Kalvi Nidhi' },
];

export interface BuildingConstructionFund {
  id: string;
  member_id: string;
  church_id: string;
  year: number;
  month: number;
  amount: number;
  created_at: string;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const TAMIL_MONTHS = [
  'Thai', 'Maasi', 'Panguni', 'Chithirai', 'Vaikasi', 'Aani',
  'Aadi', 'Aavani', 'Purattasi', 'Aippasi', 'Karthigai', 'Margazhi'
];
