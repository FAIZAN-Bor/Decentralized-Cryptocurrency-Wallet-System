import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState({});

  const navigateTo = (page, data = {}) => {
    setCurrentPage(page);
    setPageData(data);
  };

  return (
    <NavigationContext.Provider value={{ currentPage, setCurrentPage, pageData, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
