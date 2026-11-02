'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, toQuery } from '@/lib/api/client';
import type {
  ApiResponse, Appointment, AppointmentInput, AppointmentQuery, AppointmentStatus, Doctor, PaginatedResponse,
  Patient, PatientInput, RiskProfile, User,
} from '@/lib/api/types';

/** Query keys grouped by domain, so a mutation can invalidate everything it affects. */
export const queryKeys = {
  patients: ['patients'] as const,
  patientList: (params: object) => ['patients', 'list', params] as const,
  patient: (id: string) => ['patients', 'detail', id] as const,
  riskProfile: (id: string) => ['patients', 'risk-profile', id] as const,
  doctors: ['doctors'] as const,
  doctorList: (params: object) => ['doctors', 'list', params] as const,
  appointments: ['appointments'] as const,
  appointmentList: (params: object) => ['appointments', 'list', params] as const,
};

// ---------- Auth ----------

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiRequest<ApiResponse<{ user: User; token: string }>>('/auth/login', { method: 'POST', body }),
  });
}

// ---------- Patients ----------

export interface PatientListParams { page?: number; limit?: number; search?: string }

export function usePatients({ page = 1, limit = 20, search }: PatientListParams = {}) {
  const params = { page, limit, search: search || undefined, sortBy: 'name' };
  return useQuery({
    queryKey: queryKeys.patientList(params),
    queryFn: () => apiRequest<PaginatedResponse<Patient>>(`/patients${toQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** One patient by id, for when a list page may not contain them. */
export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patient(id ?? ''),
    queryFn: () => apiRequest<ApiResponse<Patient>>(`/patients/${id}`),
    enabled: Boolean(id),
  });
}

export function useRiskProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.riskProfile(id),
    queryFn: () => apiRequest<ApiResponse<RiskProfile>>(`/patients/${id}/risk-profile`),
    enabled: Boolean(id),
  });
}

export function useCreatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: PatientInput; idempotencyKey: string }) =>
      apiRequest<ApiResponse<Patient>>('/patients', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.patients }),
  });
}

export function useUpdatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PatientInput> }) =>
      apiRequest<ApiResponse<Patient>>(`/patients/${id}`, { method: 'PATCH', body }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.patients }),
      client.invalidateQueries({ queryKey: queryKeys.appointments }),
    ]),
  });
}

export function useDeletePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/patients/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.patients }),
  });
}

// ---------- Doctors ----------

export function useDoctors({ page = 1, limit = 50 }: { page?: number; limit?: number } = {}) {
  const params = { page, limit };
  return useQuery({
    queryKey: queryKeys.doctorList(params),
    queryFn: () => apiRequest<PaginatedResponse<Doctor>>(`/doctors${toQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateDoctor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; specialty: string }) =>
      apiRequest<ApiResponse<Doctor>>('/doctors', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.doctors }),
  });
}

export function useUpdateDoctor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, specialty }: { id: string; specialty: string }) =>
      apiRequest<ApiResponse<Doctor>>(`/doctors/${id}`, { method: 'PATCH', body: { specialty } }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.doctors }),
      client.invalidateQueries({ queryKey: queryKeys.appointments }),
    ]),
  });
}

export function useDeleteDoctor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/doctors/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.doctors }),
  });
}

// ---------- Appointments ----------

export function useAppointments(query: AppointmentQuery, options: { refetchInterval?: number } = {}) {
  const params = { page: 1, limit: 20, ...query };
  return useQuery({
    queryKey: queryKeys.appointmentList(params),
    queryFn: () => apiRequest<PaginatedResponse<Appointment>>(`/appointments${toQuery(params)}`),
    placeholderData: keepPreviousData,
    // Polling picks up scores the background worker refreshes after an attendance outcome.
    refetchInterval: options.refetchInterval,
  });
}

/** Booking, status changes and re-scores all change appointments, patient history and risk profiles. */
function useInvalidateScheduling() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.appointments }),
    client.invalidateQueries({ queryKey: queryKeys.patients }),
  ]);
}

export function useCreateAppointment() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: AppointmentInput; idempotencyKey: string }) =>
      apiRequest<ApiResponse<Appointment>>('/appointments', {
        method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateAppointmentStatus() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      apiRequest<ApiResponse<Appointment>>(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useRetryPrediction() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<ApiResponse<Appointment>>(`/appointments/${id}/prediction/retry`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
