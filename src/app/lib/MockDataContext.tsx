'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MockDataContextType {
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
  toggleMockData: () => void;
}

// Create the context with a default value
const MockDataContext = createContext<MockDataContextType>({
  useMockData: true,
  setUseMockData: () => {},
  toggleMockData: () => {},
});

// Custom hook to use the mock data context
export const useMockData = () => useContext(MockDataContext);

// Provider component that wraps the app
export function MockDataProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage if available, default to true
  const [useMockData, setUseMockData] = useState<boolean>(true);
  
  // Load the initial value from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedValue = localStorage.getItem('ytplayer-use-mock-data');
        // If value exists in localStorage, use it; otherwise stick with default (true)
        if (storedValue !== null) {
          setUseMockData(storedValue === 'true');
        }
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
    }
  }, []);
  
  // Update localStorage whenever the mock data state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ytplayer-use-mock-data', String(useMockData));
        
        // Dispatch a custom event that API routes can listen for
        const event = new CustomEvent('mock-data-changed', { 
          detail: { useMockData } 
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }
    }
  }, [useMockData]);
  
  // Function to toggle the mock data state
  const toggleMockData = () => {
    setUseMockData(prevState => !prevState);
  };
  
  // Create the context value object
  const contextValue: MockDataContextType = {
    useMockData,
    setUseMockData,
    toggleMockData,
  };
  
  return (
    <MockDataContext.Provider value={contextValue}>
      {children}
    </MockDataContext.Provider>
  );
}