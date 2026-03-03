const log = (level, payload) => {
  const row = {
    level,
    ts: new Date().toISOString(),
    ...payload
  };
  console.log(JSON.stringify(row));
};

module.exports = {
  info: (payload) => log('info', payload),
  warn: (payload) => log('warn', payload),
  error: (payload) => log('error', payload)
};
