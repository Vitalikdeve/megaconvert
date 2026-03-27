import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { useRef } from 'react';

export default function MessageInput({
  attachments,
  disabled,
  onAttachmentsChange,
  onRemoveAttachment,
  onSend,
  onValueChange,
  value,
}) {
  const fileInputRef = useRef(null);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="composer">
      {attachments.length > 0 ? (
        <div className="composer__attachments">
          {attachments.map((file, index) => (
            <span className="composer__attachment" key={`${file.name}-${file.lastModified}-${index}`}>
              {file.name}
              <button
                aria-label={`Remove ${file.name}`}
                className="icon-button"
                onClick={() => onRemoveAttachment(index)}
                type="button"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="composer__row">
        <button
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          className="composer__input"
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message or drop a quick attachment note..."
          rows={1}
          value={value}
        />

        <button
          className="glass-button glass-button--primary"
          disabled={disabled}
          onClick={onSend}
          type="button"
        >
          <SendHorizontal size={18} />
          Send
        </button>
      </div>

      <input
        hidden
        multiple
        onChange={(event) => onAttachmentsChange(Array.from(event.target.files ?? []))}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
