'use client';

import { useState, useEffect } from "react";
import DevControls from './DevControls';
import { MockDataProvider } from '../lib/MockDataContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <MockDataProvider>
      <div className="min-h-screen flex flex-col bg-spotify-dark text-white">
        <main className="flex-grow pb-24">
          {children}
        </main>
        
        {/* Developer controls for toggling mock data in development */}
        <DevControls />
      </div>
    </MockDataProvider>
  );
}