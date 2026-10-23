import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from './common/prisma';
import { logger } from './common/logger';

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email && !password) return;
  if (!email || !password) {
    throw new Error('Both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
  }

  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }).parse({ email, password });

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) {
    if (existing.role !== 'admin') throw new Error('Bootstrap email belongs to a non-admin user');
    logger.info('Bootstrap admin already exists');
    return;
  }

  await prisma.user.create({
    data: {
      email: parsed.email,
      passwordHash: await bcrypt.hash(parsed.password, 12),
      role: 'admin',
    },
  });
  logger.info('Bootstrap admin created');
}

main()
  .catch((err) => {
    logger.error({ errorName: err instanceof Error ? err.name : 'Unknown' }, 'Admin bootstrap failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
