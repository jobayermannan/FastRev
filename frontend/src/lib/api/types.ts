export type Role = 'admin' | 'doctor' | 'patient';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

export interface Patient {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  dateOfBirth: string;
  priorNoShowCount: number;
  completedAppointmentCount: number;
  totalAppointmentCount: number;
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  specialty: string;
  user: { email: string };
}

export type RiskLevel = 'low' | 'high' | 'unknown' | 'new_patient';

export interface Prediction {
  noShowProbability: number | null;
  riskLevel: RiskLevel;
  /** Explainability codes from the AI service; null until the service provides them. */
  reasonCodes?: string[] | null;
  modelVersion: string;
}

export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  createdAt: string;
  patient: { id: string; name: string };
  doctor: { id: string; specialty: string; user: { email: string } };
  prediction: Prediction | null;
  needsOutcome: boolean;
}

export interface RiskProfile {
  patient: Patient;
  attendance: {
    isNewPatient: boolean;
    totalAppointments: number;
    completed: number;
    noShows: number;
    noShowRate: number | null;
    cancelled: number;
    awaitingOutcome: number;
  };
  upcomingAppointments: {
    id: string;
    scheduledAt: string;
    status: AppointmentStatus;
    prediction: Prediction | null;
  }[];
}

export interface AppointmentQuery {
  page?: number;
  limit?: number;
  /** One status, or several joined with commas. */
  status?: AppointmentStatus | `${AppointmentStatus},${string}`;
  riskLevel?: RiskLevel;
  needsOutcome?: boolean;
  from?: string;
  to?: string;
  order?: 'asc' | 'desc';
}

export interface PatientInput {
  name: string;
  phone: string;
  dateOfBirth: string;
}

export interface AppointmentInput {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  durationMinutes: number;
}
