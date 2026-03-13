import React from 'react';
import Footer from './Footer.jsx';
import Header from './Header.jsx';

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#030303] text-white">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
