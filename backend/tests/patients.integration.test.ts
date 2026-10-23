import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../src/common/prisma';

let app: ReturnType<typeof import('../src/app').createApp>;
let adminToken: string;
let doctorToken: string;
let adminId: string;
let doctorId: string;
const runId = randomUUID();

function generateToken(role: string, userId: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

async function createUser(role: string, email: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'hashed',
      role,
    },
  });
}

const describeWithTestDatabase = process.env.FASTREV_TEST_DATABASE_URL ? describe : describe.skip;

describeWithTestDatabase('Patients API', () => {
  beforeAll(async () => {
    await prisma.$connect();

    const { createApp } = await import('../src/app');
    app = createApp();

    const admin = await createUser('admin', `admin-${runId}@test.example`);
    adminId = admin.id;
    const doctor = await createUser('doctor', `doctor-${runId}@test.example`);
    doctorId = doctor.id;
    adminToken = generateToken('admin', admin.id);
    doctorToken = generateToken('doctor', doctor.id);
  });

  afterAll(async () => {
    if (adminId) {
      await prisma.patient.deleteMany({ where: { enrolledByAdminId: adminId } });
      await prisma.user.deleteMany({ where: { id: { in: [adminId, doctorId].filter(Boolean) } } });
    }
    await prisma.$disconnect();
  });

  it('GET /api/v1/patients returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/patients returns 200 for doctor', async () => {
    const res = await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/v1/patients supports search', async () => {
    await prisma.patient.create({
      data: {
        name: `Alice Walker ${runId}`,
        phone: '555-0101',
        dateOfBirth: new Date('1990-01-01'),
        enrolledByAdminId: adminId,
      },
    });

    const res = await request(app)
      .get('/api/v1/patients')
      .query({ search: `Alice Walker ${runId}` })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe(`Alice Walker ${runId}`);
  });

  it('POST /api/v1/patients creates patient for admin', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bob Smith',
        phone: '555-0102',
        dateOfBirth: '1992-05-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Bob Smith');
  });

  it('PATCH /api/v1/patients/:id updates patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        name: 'Carol Day',
        phone: '555-0103',
        dateOfBirth: new Date('1988-03-10'),
        enrolledByAdminId: adminId,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/patients/${patient.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Carol Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Carol Updated');
  });

  it('DELETE /api/v1/patients/:id deletes patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        name: 'Dave End',
        phone: '555-0104',
        dateOfBirth: new Date('1995-07-20'),
        enrolledByAdminId: adminId,
      },
    });

    const res = await request(app)
      .delete(`/api/v1/patients/${patient.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await prisma.patient.findUnique({ where: { id: patient.id } });
    expect(check).toBeNull();
  });

  it('rejects PATCH from doctor role', async () => {
    const patient = await prisma.patient.create({
      data: {
        name: 'Eve Lock',
        phone: '555-0105',
        dateOfBirth: new Date('1993-11-30'),
        enrolledByAdminId: adminId,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/patients/${patient.id}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ name: 'Eve Hacked' });

    expect(res.status).toBe(403);
  });
});
