import React, { useEffect, useMemo } from 'react';
import { Command } from 'cmdk';
import {
  ArrowLeft,
  Clipboard,
  Download,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { LAST_TOOL_KEY, OCR_SESSION_KEY, readStoredJson } from '../lib/osMemory.js';

export default function CommandPalette({
  open,
  onOpenChange,
  items,
  activeTool,
  installAvailable,
  onSelect,
}) {
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open]);

  const currentItem = useMemo(
    () => items.find((item) => item.path === location.pathname || item.aliases?.includes(location.pathname)) || null,
    [items, location.pathname],
  );

  const lastTool = readStoredJson(LAST_TOOL_KEY, null);
  const lastOcrSession = readStoredJson(OCR_SESSION_KEY, null);

  const sections = useMemo(() => {
    const nextSections = [];

    if (installAvailable) {
      nextSections.push({
        heading: '✨ Система',
        items: [
          {
            id: 'install-os',
            label: 'Установить MegaConvert OS на устройство',
            caption: 'Install offline-ready app shell',
            icon: Download,
            action: 'install-os',
          },
        ],
      });
    }

    if (lastOcrSession?.extractedText || lastOcrSession?.previewUrl || lastOcrSession?.sourceMeta?.name) {
      const quickItems = [
        {
          id: 'resume-smart-ocr',
          path: '/tools/smart-ocr',
          label: 'Возобновить Smart OCR',
          caption: lastOcrSession?.sourceMeta?.name
            ? `Последняя сессия: ${lastOcrSession.sourceMeta.name}`
            : 'Открыть сохраненную OCR-сессию',
          icon: RotateCcw,
        },
        {
          id: 'ocr-paste',
          path: '/tools/smart-ocr',
          label: 'Вставить из буфера обмена',
          caption: 'Clipboard → Smart OCR',
          icon: Clipboard,
          action: 'ocr-paste',
        },
      ];

      if (lastTool?.path && lastTool.path !== '/tools/smart-ocr') {
        quickItems.push({
          id: 'open-last-tool',
          path: lastTool.path,
          label: 'Открыть последний инструмент',
          caption: lastTool.label || lastTool.path,
          icon: History,
        });
      }

      nextSections.push({
        heading: '⚡ Быстрые действия',
        items: quickItems,
      });
    }

    if (location.pathname !== '/') {
      nextSections.push({
        heading: 'Текущий инструмент',
        items: [
          {
            id: 'return-home',
            path: '/',
            label: 'Вернуться на Главную (Zen Portal)',
            caption: 'Back to MegaConvert',
            icon: ArrowLeft,
          },
        ],
      });
    }

    const groupedItems = items.reduce((accumulator, item) => {
      const groupKey = item.group || 'Навигация';
      if (!accumulator[groupKey]) {
        accumulator[groupKey] = [];
      }
      accumulator[groupKey].push(item);
      return accumulator;
    }, {});

    Object.entries(groupedItems).forEach(([groupName, groupItems]) => {
      nextSections.push({
        heading: groupName,
        items: groupItems,
      });
    });

    return nextSections;
  }, [installAvailable, items, lastOcrSession, lastTool, location.pathname]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="MegaConvert command menu"
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
      contentClassName="fixed left-1/2 top-[14vh] z-[60] w-[min(720px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#090909]/85 shadow-[0_0_80px_-20px_rgba(120,119,198,0.3)] backdrop-blur-3xl outline-none"
      className="overflow-hidden"
    >
      {location.pathname !== '/' && currentItem ? (
        <div className="border-b border-white/[0.08] px-5 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/52">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            MegaConvert
            <span className="text-white/28">➔</span>
            {currentItem.label}
          </div>
        </div>
      ) : null}

      <div className="border-b border-white/[0.08] px-5 py-4">
        <Command.Input
          autoFocus
          placeholder="Jump anywhere..."
          className="h-12 w-full bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto px-3 py-3">
        <Command.Empty className="px-3 py-10 text-center text-sm text-white/40">
          Ничего не найдено.
        </Command.Empty>

        {sections.map(({ heading, items: groupItems }) => (
          <Command.Group
            key={heading}
            heading={heading}
            className="mb-3 overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-2 text-white/70"
          >
            <div className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.32em] text-white/28">
              {heading}
            </div>

            {groupItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeTool && item.id !== 'return-home';

              return (
                <Command.Item
                  key={item.id}
                  value={`${heading} ${item.label}`}
                  keywords={[item.label, heading]}
                  onSelect={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-[20px] px-3 py-3 text-sm text-white/72 outline-none transition-colors',
                    'data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white',
                    isActive ? 'bg-white/[0.06] text-white' : '',
                  ].join(' ')}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/82">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium tracking-tight">{item.label}</div>
                    {item.caption ? (
                      <div className="truncate text-xs text-white/36">
                        {item.caption}
                      </div>
                    ) : null}
                  </div>

                  {isActive ? (
                    <div className="rounded-full border border-indigo-300/20 bg-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70">
                      Active
                    </div>
                  ) : null}
                </Command.Item>
              );
            })}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
