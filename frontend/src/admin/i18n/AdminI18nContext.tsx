import React, { createContext, useContext, useMemo } from 'react';

type AdminDictionary = Record<string, string>;

type AdminI18nValue = {
  lang: string;
  t: AdminDictionary;
};

const AdminI18nContext = createContext<AdminI18nValue>({
  lang: 'en',
  t: {}
});

export const AdminI18nProvider = ({
  lang = 'en',
  t,
  children
}: {
  lang?: string;
  t: AdminDictionary;
  children: React.ReactNode;
}) => {
  const value = useMemo(() => ({ lang, t: t || {} }), [lang, t]);
  return (
    <AdminI18nContext.Provider value={value}>
      {children}
    </AdminI18nContext.Provider>
  );
};

export const useAdminI18n = () => useContext(AdminI18nContext);
