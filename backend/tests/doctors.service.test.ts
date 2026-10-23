import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, tx } = vi.hoisted(() => {
  const tx = {
    user: { create: vi.fn(), delete: vi.fn() },
    doctor: { create: vi.fn(), delete: vi.fn() },
  };
  return { tx, mockPrisma: { $transaction: vi.fn() } };
});

vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));

import { createDoctor, deleteDoctor } from '../src/modules/doctors/doctors.service';

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.$transaction.mockImplementation((fn) => fn(tx));
});

describe('doctor account management', () => {
  it('creates a doctor user and profile in one transaction', async () => {
    tx.user.create.mockResolvedValue({ id: 'user-1' });
    tx.doctor.create.mockResolvedValue({ id: 'doctor-1', userId: 'user-1', specialty: 'General' });

    const doctor = await createDoctor({
      email: 'doctor@test.example', password: 'valid-password', specialty: 'General',
    });

    expect(doctor.id).toBe('doctor-1');
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'doctor', email: 'doctor@test.example' }),
    });
    expect(tx.doctor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { userId: 'user-1', specialty: 'General' },
    }));
  });

  it('removes the profile and linked account together', async () => {
    tx.doctor.delete.mockResolvedValue({ userId: 'user-1' });

    await deleteDoctor('doctor-1');

    expect(tx.doctor.delete).toHaveBeenCalledWith({ where: { id: 'doctor-1' } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });
});
