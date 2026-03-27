import { AnimatePresence, motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';

const MotionDiv = motion.div;

const isImageAvatar = (value) =>
  /^(https?:\/\/|data:image\/)/i.test(String(value || '').trim());

const getAvatarLabel = (value, fallbackName) => {
  const rawValue = String(value || '').trim();
  if (!rawValue || isImageAvatar(rawValue)) {
    return String(fallbackName || '?').trim().slice(0, 1).toUpperCase() || '?';
  }

  return rawValue.slice(0, 2).toUpperCase();
};

export default function IncomingCallModal({
  callerAvatar,
  callerName,
  isOpen,
  onAccept,
  onDecline,
}) {
  const avatarValue = String(callerAvatar || '').trim();

  return (
    <AnimatePresence>
      {isOpen ? (
        <MotionDiv
          animate={{ opacity: 1 }}
          className="incoming-call-modal"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <MotionDiv
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-panel incoming-call-modal__card"
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="incoming-call-modal__halo" />

            {isImageAvatar(avatarValue) ? (
              <img
                alt={`${callerName} avatar`}
                className="incoming-call-modal__avatar incoming-call-modal__avatar--image"
                src={avatarValue}
              />
            ) : (
              <div className="incoming-call-modal__avatar">
                {getAvatarLabel(avatarValue, callerName)}
              </div>
            )}

            <div className="incoming-call-modal__copy">
              <p className="incoming-call-modal__eyebrow">
                <Video size={16} />
                Incoming video call
              </p>
              <h2>{callerName}</h2>
              <p>Telegram-style full-screen calling overlay powered by WebRTC.</p>
            </div>

            <div className="incoming-call-modal__actions">
              <button
                className="glass-button incoming-call-modal__button incoming-call-modal__button--accept"
                onClick={onAccept}
                type="button"
              >
                <Phone size={18} />
                Accept
              </button>

              <button
                className="glass-button incoming-call-modal__button incoming-call-modal__button--decline"
                onClick={onDecline}
                type="button"
              >
                <PhoneOff size={18} />
                Decline
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      ) : null}
    </AnimatePresence>
  );
}
