import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/**
 * PublicLayout component
 * Wraps the public marketing site pages with Navbar and Footer.
 * Must NOT be used for authenticated application routes or sign-in/sign-up forms.
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="of-public-layout">
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
