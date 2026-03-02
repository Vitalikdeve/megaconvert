import { useMemo } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { canAccess, getRole } from './permissions.js';

export const useAdminPermissions = () => {
  const { adminUser } = useAdminAuth();
  const role = useMemo(() => getRole(adminUser?.role), [adminUser?.role]);

  const can = (module, action = 'read') => canAccess(role, module, action);

  return { role, can };
};

