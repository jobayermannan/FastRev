import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    patient: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));

import { createApp } from '../src/app';

const app = createApp();
const tokenFor = (role: string, expiresIn: number = 3600) =>
  jwt.sign({ userId: 'test-user', role }, process.env.JWT_SECRET!, { expiresIn });

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.patient.findMany.mockResolvedValue([]);
  mockPrisma.patient.count.mockResolvedValue(0);
});

describe('public registration and login', () => {
  it.each(['admin', 'doctor'])('rejects self-assigned %s role', async (role) => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'user@test.example', password: 'valid-password', role,
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('registers only a patient, even when role is omitted', async () => {
    mockPrisma.user.create.mockImplementation(async ({ data }) => ({
      id: 'new-user', email: data.email, role: data.role, createdAt: new Date(),
    }));

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'user@test.example', password: 'valid-password',
    });

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'patient' }),
    }));
    expect(res.body.data.user.role).toBe('patient');
    expect(jwt.verify(res.body.data.token, process.env.JWT_SECRET!)).toMatchObject({ role: 'patient' });
  });

  it('authenticates valid credentials and rejects an invalid password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user', email: 'user@test.example', role: 'patient',
      passwordHash: await bcrypt.hash('correct-password', 12),
    });

    const valid = await request(app).post('/api/v1/auth/login').send({
      email: 'user@test.example', password: 'correct-password',
    });
    const invalid = await request(app).post('/api/v1/auth/login').send({
      email: 'user@test.example', password: 'wrong-password',
    });

    expect(valid.status).toBe(200);
    expect(valid.body.data.user.role).toBe('patient');
    expect(valid.body.data.user).not.toHaveProperty('passwordHash');
    expect(invalid.status).toBe(401);
  });
});

describe('patient role boundaries', () => {
  it('requires a valid token', async () => {
    expect((await request(app).get('/api/v1/patients')).status).toBe(401);
    expect((await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${tokenFor('admin', -1)}`)).status).toBe(401);
  });

  it('allows doctors to read but only admins to write', async () => {
    expect((await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${tokenFor('doctor')}`)).status).toBe(200);
    expect((await request(app).post('/api/v1/patients').set('Authorization', `Bearer ${tokenFor('doctor')}`).send({})).status).toBe(403);
    expect((await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${tokenFor('patient')}`)).status).toBe(403);
    expect((await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${tokenFor('admin')}`)).status).toBe(200);
  });
});

describe('HTTP error responses', () => {
  it('returns 404 for an unknown route and 400 for malformed JSON', async () => {
    const missing = await request(app).get('/api/v1/does-not-exist');
    const malformed = await request(app).post('/api/v1/auth/login')
      .set('Content-Type', 'application/json').send('{"email":');

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('404');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('400');
  });

  it('maps a duplicate user to 409', async () => {
    mockPrisma.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'duplicate', { code: 'P2002', clientVersion: '5.22.0' },
    ));

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'user@test.example', password: 'valid-password',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('409');
  });

  it('maps a missing patient and a referenced patient to 404 and 409', async () => {
    mockPrisma.patient.findUnique.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'missing', { code: 'P2025', clientVersion: '5.22.0' },
    ));
    mockPrisma.patient.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'referenced', { code: 'P2003', clientVersion: '5.22.0' },
    ));

    const missing = await request(app).get('/api/v1/patients/missing')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    const conflict = await request(app).delete('/api/v1/patients/referenced')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);

    expect(missing.status).toBe(404);
    expect(conflict.status).toBe(409);
  });
});
