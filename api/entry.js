process.env.MEGACONVERT_SERVERLESS = process.env.MEGACONVERT_SERVERLESS || '1';

const app = require('./src/index');

const normalizePath = (rawPath) => {
  const value = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  const cleaned = value
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .trim();
  return cleaned ? `/${cleaned}` : '/';
};

module.exports = (req, res) => {
  const parsed = new URL(String(req.url || '/'), 'http://localhost');
  const routedPath = normalizePath(parsed.searchParams.get('path'));
  parsed.searchParams.delete('path');
  const query = parsed.searchParams.toString();
  req.url = query ? `${routedPath}?${query}` : routedPath;
  return app(req, res);
};
