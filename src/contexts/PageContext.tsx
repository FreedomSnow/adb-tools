import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PageState {
  path: string[];
  params?: Record<string, any>;
  lastPath?: string;
}

interface PageContextType {
  pageStates: Record<string, PageState>;
  setPageState: (tabKey: string, state: PageState) => void;
  getPageState: (tabKey: string) => PageState;
  navigateToPage: (tabKey: string, path: string[]) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export const PageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pageStates, setPageStates] = useState<Record<string, PageState>>({});
  const navigate = useNavigate();
  const location = useLocation();

  // 监听路由变化，更新页面状态
  React.useEffect(() => {
    const path = location.pathname.split('/').filter(Boolean);
    if (path.length > 0) {
      const tabKey = path[0];
      const currentState = pageStates[tabKey] || { path: [] };
      const newPath = path.slice(1);
      
      // 只有当路径真正改变时才更新状态
      if (JSON.stringify(currentState.path) !== JSON.stringify(newPath)) {
        setPageState(tabKey, {
          path: newPath,
          lastPath: newPath.join('/')
        });
      }
    }
  }, [location.pathname]);

  const setPageState = (tabKey: string, state: PageState) => {
    setPageStates(prev => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        ...state
      }
    }));
  };

  const getPageState = (tabKey: string): PageState => {
    return pageStates[tabKey] || { path: [] };
  };

  const navigateToPage = (tabKey: string, path: string[]) => {
    setPageState(tabKey, {
      path,
      lastPath: path.join('/')
    });
    navigate(`/${tabKey}/${path.join('/')}`);
  };

  return (
    <PageContext.Provider value={{ pageStates, setPageState, getPageState, navigateToPage }}>
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