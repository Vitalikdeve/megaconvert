const asBool = (value, fallback = false) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return Boolean(fallback);
  return ['1', 'true', 'yes', 'on'].includes(v);
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: String(process.env.DATABASE_URL || '').trim(),
  redisUrl: String(process.env.REDIS_URL || '').trim(),
  isProd: asBool(process.env.NODE_ENV === 'production', false)
};
