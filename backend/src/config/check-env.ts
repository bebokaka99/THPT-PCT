import { env, validateApplicationEnvironment } from './env.js';

validateApplicationEnvironment();

console.log(
  JSON.stringify({
    status: 'ok',
    appEnv: env.appEnv,
    nodeEnv: env.nodeEnv,
    databaseConfig: env.database.url ? 'DATABASE_URL' : 'PG* variables',
    corsOriginCount: env.security.corsOrigins.length,
    jwtVerificationKeyCount: env.jwt.verificationSecrets.length,
  }),
);
