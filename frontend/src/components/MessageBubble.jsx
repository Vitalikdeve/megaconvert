import { FileIcon } from 'lucide-react';

const formatTime = (isoDate) => {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatFileSize = (size) => {
  if (!size) {
    return 'File';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export default function MessageBubble({ isOwn, message }) {
  return (
    <div className={`message-row ${isOwn ? 'me' : 'other'}`}>
      <div className={`message-bubble ${isOwn ? 'me' : 'other'}`}>
        <div className="message-bubble__meta">
          <span>{isOwn ? 'You' : message.senderName}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>

        {message.text ? <p className="message-bubble__text">{message.text}</p> : null}

        {message.attachments.length > 0 ? (
          <div className="message-bubble__attachments">
            {message.attachments.map((attachment) => (
              <span className="attachment-pill" key={attachment.id}>
                <FileIcon size={14} />
                {attachment.name}
                <small>{formatFileSize(attachment.size)}</small>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
