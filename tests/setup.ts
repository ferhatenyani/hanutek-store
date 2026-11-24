// Test environment — set before any server module reads env().
Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "pglite:memory",
  JWT_SECRET: "test-secret-0123456789-0123456789-0123456789",
  RATE_LIMIT_DISABLED: "1",
  MAIL_DRIVER: "console",
  STORAGE_DRIVER: "local",
});
