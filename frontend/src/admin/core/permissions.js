const MATRIX = {
  super_admin: { '*': ['*'] },
  admin: {
    dashboard: ['read'],
    operations: ['read', 'control'],
    users: ['read', 'edit'],
    jobs: ['read', 'edit', 'cancel', 'replay'],
    files: ['read'],
    ai: ['read', 'configure'],
    content: ['read', 'edit'],
    analytics: ['read'],
    team: ['read', 'edit'],
    logs: ['read']
  },
  support: {
    dashboard: ['read'],
    users: ['read'],
    jobs: ['read'],
    files: ['read'],
    analytics: ['read']
  },
  analyst: {
    dashboard: ['read'],
    analytics: ['read'],
    logs: ['read'],
    jobs: ['read'],
    users: ['read']
  }
};

export const getRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'support') return 'support';
  if (normalized === 'analyst') return 'analyst';
  return 'super_admin';
};

export const canAccess = (role, module, action = 'read') => {
  const map = MATRIX[role] || MATRIX.support;
  if (map['*']?.includes('*')) return true;
  const allowed = map[module] || [];
  return allowed.includes(action);
};

export const buildPermissionList = (role) => {
  const map = MATRIX[role] || {};
  const items = [];
  Object.entries(map).forEach(([module, actions]) => {
    if (module === '*') return;
    actions.forEach((action) => items.push(`${module}.${action}`));
  });
  return items;
};

