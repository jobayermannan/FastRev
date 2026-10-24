import { baseApi, toQuery } from './baseApi';
import type {
  ApiResponse, Appointment, AppointmentStatus, Doctor, PaginatedResponse, Patient, RiskLevel, RiskProfile, User,
} from './types';

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

export const api = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<ApiResponse<{ user: User; token: string }>, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),

    getPatients: build.query<PaginatedResponse<Patient>, { page?: number; limit?: number; search?: string }>({
      query: ({ page = 1, limit = 20, search }) => `/patients${toQuery({ page, limit, search, sortBy: 'name' })}`,
      providesTags: ['Patient'],
    }),
    getRiskProfile: build.query<ApiResponse<RiskProfile>, string>({
      query: (id) => `/patients/${id}/risk-profile`,
      providesTags: (_result, _error, id) => [{ type: 'RiskProfile', id }],
    }),
    createPatient: build.mutation<ApiResponse<Patient>, { body: PatientInput; idempotencyKey: string }>({
      query: ({ body, idempotencyKey }) => ({
        url: '/patients', method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: ['Patient'],
    }),
    updatePatient: build.mutation<ApiResponse<Patient>, { id: string; body: Partial<PatientInput> }>({
      query: ({ id, body }) => ({ url: `/patients/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => ['Patient', 'Appointment', { type: 'RiskProfile', id }],
    }),
    deletePatient: build.mutation<unknown, string>({
      query: (id) => ({ url: `/patients/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Patient'],
    }),

    getDoctors: build.query<PaginatedResponse<Doctor>, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 50 }) => `/doctors${toQuery({ page, limit })}`,
      providesTags: ['Doctor'],
    }),
    createDoctor: build.mutation<ApiResponse<Doctor>, { email: string; password: string; specialty: string }>({
      query: (body) => ({ url: '/doctors', method: 'POST', body }),
      invalidatesTags: ['Doctor'],
    }),
    updateDoctor: build.mutation<ApiResponse<Doctor>, { id: string; specialty: string }>({
      query: ({ id, specialty }) => ({ url: `/doctors/${id}`, method: 'PATCH', body: { specialty } }),
      invalidatesTags: ['Doctor', 'Appointment'],
    }),
    deleteDoctor: build.mutation<unknown, string>({
      query: (id) => ({ url: `/doctors/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Doctor'],
    }),

    getAppointments: build.query<PaginatedResponse<Appointment>, AppointmentQuery>({
      query: ({ page = 1, limit = 20, ...filters }) => `/appointments${toQuery({ page, limit, ...filters })}`,
      providesTags: ['Appointment'],
    }),
    createAppointment: build.mutation<ApiResponse<Appointment>, { body: AppointmentInput; idempotencyKey: string }>({
      query: ({ body, idempotencyKey }) => ({
        url: '/appointments', method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey },
      }),
      invalidatesTags: (_result, _error, { body }) => ['Appointment', 'Patient', { type: 'RiskProfile', id: body.patientId }],
    }),
    updateAppointmentStatus: build.mutation<ApiResponse<Appointment>, { id: string; status: AppointmentStatus; patientId: string }>({
      query: ({ id, status }) => ({ url: `/appointments/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_result, _error, { patientId }) => ['Appointment', 'Patient', { type: 'RiskProfile', id: patientId }],
    }),
    retryPrediction: build.mutation<ApiResponse<Appointment>, string>({
      query: (id) => ({ url: `/appointments/${id}/prediction/retry`, method: 'POST' }),
      invalidatesTags: ['Appointment', 'RiskProfile'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetPatientsQuery, useGetRiskProfileQuery, useCreatePatientMutation, useUpdatePatientMutation, useDeletePatientMutation,
  useGetDoctorsQuery, useCreateDoctorMutation, useUpdateDoctorMutation, useDeleteDoctorMutation,
  useGetAppointmentsQuery, useCreateAppointmentMutation, useUpdateAppointmentStatusMutation, useRetryPredictionMutation,
} = api;
