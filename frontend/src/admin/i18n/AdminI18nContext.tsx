import React, { createContext, useContext, useMemo } from 'react';
const AdminI18nContext = createContext({
  lang: 'en',
  t: {}
});

export const AdminI18nProvider = ({
  lang = 'en',
  t,
  children
}) => {
  const value = useMemo(() => ({ lang, t: t || {} }), [lang, t]);
  return (
    <AdminI18nContext.Provider value={value}>
      {children}
    </AdminI18nContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminI18n = () => useContext(AdminI18nContext);
