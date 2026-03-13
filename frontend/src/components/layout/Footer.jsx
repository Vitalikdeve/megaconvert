import React from 'react';
import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy', to: '/privacy' },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.05] bg-[#030303]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-white/42 sm:flex-row">
        <div className="text-center sm:text-left">
          © 2026 MegaConvert
        </div>

        <nav className="flex items-center gap-5">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="transition-colors duration-300 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
