import React, { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Toaster } from 'sonner';
import ForgotPasswordModal from './ForgotPasswordModal.jsx';
import LoginModal from './LoginModal.jsx';
import RegisterModal from './RegisterModal.jsx';

const AuthModalContext = createContext(null);

function AuthModalViewport({ activeModal, apiBase, closeAuthModal, setActiveModal }) {
  if (!activeModal) {
    return null;
  }

  const modalProps = {
    apiBase,
    onClose: closeAuthModal,
    onSwitch: setActiveModal,
  };

  if (activeModal === 'register') {
    return <RegisterModal {...modalProps} />;
  }

  if (activeModal === 'forgot-password') {
    return <ForgotPasswordModal {...modalProps} />;
  }

  return <LoginModal {...modalProps} />;
}

export default function AuthModalProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null);
  const apiBase = String(import.meta.env.VITE_API_BASE || '/api').trim() || '/api';

  const openAuthModal = (modalName = 'login') => {
    setActiveModal(modalName);
  };

  const closeAuthModal = () => {
    setActiveModal(null);
  };

  useEffect(() => {
    if (!activeModal || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeModal]);

  useEffect(() => {
    if (!activeModal || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAuthModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  return (
    <AuthModalContext.Provider
      value={{
        activeModal,
        openAuthModal,
        closeAuthModal,
        setActiveModal,
      }}
    >
      {children}
      <Toaster
        theme="dark"
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(8, 8, 8, 0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 30px 80px -36px rgba(0,0,0,0.85)',
          },
        }}
      />
      {typeof document !== 'undefined'
        ? createPortal(
          <AnimatePresence mode="wait">
            <AuthModalViewport
              activeModal={activeModal}
              apiBase={apiBase}
              closeAuthModal={closeAuthModal}
              setActiveModal={setActiveModal}
            />
          </AnimatePresence>,
          document.body,
        )
        : null}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error('useAuthModal must be used inside AuthModalProvider.');
  }

  return context;
}
