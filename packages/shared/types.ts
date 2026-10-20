export type UserRole = 'CLIENT' | 'ADMIN' | 'PARTNER';

export type SubscriptionTier = 'NONE' | 'SILVER' | 'GOLD' | 'CONCIERGE_UNLIMITED';

export type ServiceCategory = 'HOME_MAINTENANCE' | 'MEDICAL_TRANSPORT' | 'ERRANDS' | 'EMERGENCY';

export type TaskStatus =
  | 'PENDING_OPS_REVIEW'
  | 'DISPATCHED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'VERIFICATION_SUBMITTED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED';

export type EscrowStatus = 'HOLD_IN_ESCROW' | 'RELEASED_TO_PARTNER' | 'REFUNDED_TO_CLIENT';

export type VerificationStage = 'ARRIVAL_CHECKIN' | 'TASK_COMPLETION';

export type VerificationReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED_OUT_OF_BOUNDS';

export type WhatsAppStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface User {
  id: string;
  role: UserRole;
  email: string;
  phone: string;
  full_name: string;
  auth_provider_id?: string;
  created_at: string;
}

export interface ClientProfile {
  user_id: string;
  country_residence: string;
  currency: string;
  subscription_tier: SubscriptionTier;
  user?: User;
}

export interface ParentProfile {
  id: string;
  client_id: string;
  parent_name: string;
  primary_phone: string;
  whatsapp_phone?: string;
  locality: string;
  full_address: string;
  coordinates_lat: number;
  coordinates_lng: number;
  medical_notes?: string | null;
}

export interface PartnerProfile {
  user_id: string;
  service_category: ServiceCategory;
  operating_region: string;
  kyc_verified: boolean;
  is_active: boolean;
  wallet_balance: number;
  rating?: number;
  total_reviews?: number;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_location_updated_at?: string | null;
  full_name?: string;
  email?: string;
  phone?: string;
  user?: User;
}

export interface Task {
  id: string;
  tracking_code: string;
  client_id: string;
  parent_id: string;
  assigned_partner_id?: string | null;
  category: ServiceCategory | string;
  title: string;
  instructions: string;
  status: TaskStatus;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
  
  // Populated relations
  client?: {
    id: string;
    full_name: string;
    email: string;
    country_residence: string;
  };
  parent?: ParentProfile;
  assigned_partner?: {
    id: string;
    full_name: string;
    phone: string;
    service_category: string;
    operating_region: string;
    kyc_verified: boolean;
  } | null;
  escrow?: EscrowTransaction | null;
  verification_logs?: VerificationLog[];
  whatsapp_logs?: WhatsAppLog[];
  review?: TaskReview | null;
}

export interface ParentVital {
  id: string;
  parent_id: string;
  recorded_by: string;
  blood_pressure_sys?: number | null;
  blood_pressure_dia?: number | null;
  blood_sugar?: number | null;
  blood_sugar_type?: 'FASTING' | 'POST_PRANDIAL' | 'RANDOM' | 'NONE';
  pulse?: number | null;
  spo2?: number | null;
  weight_kg?: number | null;
  notes?: string | null;
  recorded_at: string;
}

export interface ParentMedication {
  id: string;
  parent_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  time_of_day: string;
  stock_remaining: number;
  low_stock_threshold: number;
  instructions?: string | null;
  is_active: boolean | number;
  created_at: string;
}

export interface MedicalVaultDocument {
  id: string;
  parent_id: string;
  title: string;
  category: 'PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'SCAN' | 'OTHER';
  file_url: string;
  doctor_name?: string | null;
  hospital_name?: string | null;
  document_date?: string | null;
  notes?: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface EmergencyEvent {
  id: string;
  parent_id: string;
  parent_name?: string;
  parent_phone?: string;
  parent_address?: string;
  client_id?: string;
  triggered_by_user_id: string;
  status: 'ACTIVE' | 'DISPATCHED' | 'RESOLVED';
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  ambulance_dispatched: boolean | number;
  assigned_partner_id?: string | null;
  assigned_partner_name?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  triggered_at: string;
  resolved_at?: string | null;
}

export interface TaskReview {
  id: string;
  task_id: string;
  client_id: string;
  partner_id: string;
  rating: number;
  tags: string[];
  feedback_text?: string | null;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  client_id: string;
  invited_name: string;
  invited_email: string;
  relationship: string;
  status: 'INVITED' | 'ACTIVE';
  created_at: string;
}

export interface PartnerLocationUpdate {
  partner_id: string;
  task_id?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface EscrowTransaction {
  id: string;
  task_id: string;
  amount: number;
  currency: string;
  payment_gateway_ref: string;
  status: EscrowStatus;
  escrow_locked_at: string;
  released_at?: string | null;
}

export interface VerificationLog {
  id: string;
  task_id: string;
  partner_id: string;
  stage: VerificationStage;
  selfie_image_url: string;
  latitude: number;
  longitude: number;
  distance_from_target_meters: number;
  geofence_passed?: boolean;
  timestamp: string;
  reviewed_by_admin?: string | null;
  review_status: VerificationReviewStatus;
  reviewer_name?: string | null;
}

export interface WhatsAppLog {
  id: string;
  task_id: string;
  recipient_phone: string;
  template_name: string;
  status: WhatsAppStatus;
  sent_at: string;
  message_preview?: string;
}

export type WebSocketEventType =
  | 'CONNECTED'
  | 'PONG'
  | 'TASK_CREATED'
  | 'TASK_DISPATCHED'
  | 'TASK_ACCEPTED'
  | 'TASK_IN_PROGRESS'
  | 'TASK_UPDATED'
  | 'PARTNER_ACCEPTED'
  | 'PARTNER_CHECKED_IN'
  | 'VERIFICATION_SUBMITTED'
  | 'VERIFICATION_REJECTED'
  | 'ESCROW_RELEASED'
  | 'WHATSAPP_STATUS_UPDATED'
  | 'PARTNER_AVAILABILITY_CHANGED'
  | 'SECURITY_SETTINGS_UPDATED'
  | 'EMERGENCY_FREEZE_TOGGLED'
  | 'EMERGENCY_SOS_TRIGGERED'
  | 'EMERGENCY_SOS_RESOLVED'
  | 'PARTNER_LOCATION_UPDATE'
  | 'VITALS_RECORDED'
  | 'MEDICATION_UPDATED'
  | 'TASK_REVIEW_SUBMITTED'
  | 'DATABASE_PURGED';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
  actor_id?: string;
}

export interface SecuritySettings {
  escrow_release_pin?: string;
  geofence_tolerance_meters?: string;
  emergency_escrow_freeze?: string;
  [key: string]: string | undefined;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  ip_address?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details_json: string;
  created_at: string;
}


