import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockPost } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: { findUnique: vi.fn() },
    prediction: { upsert: vi.fn() },
  },
  mockPost: vi.fn(),
}));

vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));
vi.mock('axios', () => ({ default: { post: mockPost } }));

import { scoreAppointment } from '../src/modules/predictions/predictions.service';

function appointmentWith(patient: { priorNoShowCount: number; completedAppointmentCount: number },
  prediction: object | null = null) {
  return {
    id: 'appointment-1', scheduledAt: new Date('2030-01-20T10:00:00Z'),
    createdAt: new Date('2030-01-10T10:00:00Z'),
    patient: { dateOfBirth: new Date('1990-01-01T00:00:00Z'), totalAppointmentCount: 9, ...patient },
    doctor: { specialty: 'General' },
    prediction,
  };
}

const aiResponse = {
  appointment_id: 'appointment-1', no_show_probability: 0.7, risk_level: 'high', model_version: 'xgboost-v1',
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.appointment.findUnique.mockResolvedValue(appointmentWith({ priorNoShowCount: 2, completedAppointmentCount: 1 }));
  mockPrisma.prediction.upsert.mockImplementation(async ({ create }) => create);
});

describe('prediction persistence', () => {
  it('stores a validated AI response and sends only visits with an outcome as history', async () => {
    mockPost.mockResolvedValue({ data: aiResponse });

    const result = await scoreAppointment('appointment-1');

    expect(result.needsRetry).toBe(false);
    expect(result.prediction).toMatchObject({ noShowProbability: 0.7, riskLevel: 'high' });
    // 2 no-shows + 1 completed visit; the 9 bookings ever made would overstate the history.
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('/predict/no-show-risk'),
      expect.objectContaining({ prior_no_show_count: 2, total_appointment_count: 3 }),
      expect.objectContaining({ timeout: 3000 }));
  });

  it('saves unknown risk without a fake probability when AI is unavailable', async () => {
    mockPost.mockRejectedValue(new Error('timeout'));

    const result = await scoreAppointment('appointment-1');

    expect(result.needsRetry).toBe(true);
    expect(result.prediction).toMatchObject({ noShowProbability: null, riskLevel: 'unknown' });
    expect(mockPrisma.prediction.upsert).toHaveBeenCalledTimes(1);
  });

  it('keeps an existing real score when AI is unavailable', async () => {
    const existing = { riskLevel: 'high', noShowProbability: 0.26, modelVersion: 'xgboost-v1' };
    mockPrisma.appointment.findUnique.mockResolvedValue(
      appointmentWith({ priorNoShowCount: 2, completedAppointmentCount: 1 }, existing));
    mockPost.mockRejectedValue(new Error('timeout'));

    const result = await scoreAppointment('appointment-1');

    expect(result.needsRetry).toBe(true);
    expect(result.prediction).toEqual(existing);
    expect(mockPrisma.prediction.upsert).not.toHaveBeenCalled();
  });

  it('labels a patient with no recorded outcome as new without calling the AI', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(appointmentWith({ priorNoShowCount: 0, completedAppointmentCount: 0 }));

    const result = await scoreAppointment('appointment-1');

    expect(result.needsRetry).toBe(false);
    expect(result.prediction).toMatchObject({ riskLevel: 'new_patient', noShowProbability: null });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
