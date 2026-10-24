// Database-backed tests require an explicit, dedicated local test database.
const testDatabaseUrl = process.env.FASTREV_TEST_DATABASE_URL;

if (testDatabaseUrl) {
  const url = new URL(testDatabaseUrl);
  const localHosts = ['localhost', '127.0.0.1', 'mysql'];
  if (
    url.protocol !== 'mysql:' ||
    !localHosts.includes(url.hostname) ||
    url.pathname !== '/fastrev_test' ||
    url.username !== 'fastrev_test'
  ) {
    throw new Error('FASTREV_TEST_DATABASE_URL must target the local fastrev_test database as fastrev_test');
  }
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';
process.env.DATABASE_URL = testDatabaseUrl || 'mysql://fastrev_test@localhost:3306/fastrev_test';
process.env.AI_SERVICE_URL = 'http://localhost:8000';
process.env.REDIS_URL = 'redis://localhost:6379';
