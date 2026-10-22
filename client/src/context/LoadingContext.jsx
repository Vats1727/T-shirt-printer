import React, { createContext, useCallback, useContext, useState } from 'react';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [loading, setLoading] = useState(false);

  const show = useCallback(() => setLoading(true), []);
  const hide = useCallback(() => setLoading(false), []);

  return (
    <LoadingContext.Provider value={{ loading, show, hide }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

export default LoadingContext;
