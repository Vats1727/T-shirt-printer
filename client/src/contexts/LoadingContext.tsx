import React, { createContext, useCallback, useContext, useState } from 'react';

type LoadingContextType = {
  loading: boolean;
  show: () => void;
  hide: () => void;
};

const LoadingContext = createContext<LoadingContextType | null>(null);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const show = useCallback(() => setLoading(true), []);
  const hide = useCallback(() => setLoading(false), []);

  return (
    <LoadingContext.Provider value={{ loading, show, hide }}>
      {children}
    </LoadingContext.Provider>
  );
};

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

export default LoadingContext;
