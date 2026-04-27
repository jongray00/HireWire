"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const session = localStorage.getItem('sally_sales_session');

    if (session) {
      try {
        const sessionData = JSON.parse(session);
        if (sessionData.isLoggedIn && sessionData.credentials) {
          // Logged in, redirect to dashboard
          navigate('/dashboard');
          return;
        }
      } catch (e) {
        // Invalid session, clear it
        localStorage.removeItem('sally_sales_session');
      }
    }

    // Not logged in, redirect to login
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
