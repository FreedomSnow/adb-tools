import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageState {
  path: string[];
  params?: Record<string, any>;
}

interface PageContextType {
  pageStates: Record<string, PageState>;
  setPageState: (tabKey: string, state: PageState) => void;
  getPageState: (tabKey: string) => PageState;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export const PageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pageStates, setPageStates] = useState<Record<string, PageState>>({});

  const setPageState = (tabKey: string, state: PageState) => {
    setPageStates(prev => ({
      ...prev,
      [tabKey]: state
    }));
  };

  const getPageState = (tabKey: string): PageState => {
    return pageStates[tabKey] || { path: [] };
  };

  return (
    <PageContext.Provider value={{ pageStates, setPageState, getPageState }}>
      {children}
    </PageContext.Provider>
  );
};

export const usePage = () => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
}; 