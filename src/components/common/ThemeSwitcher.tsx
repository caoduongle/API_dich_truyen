import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun, BookOpen, Palette, Check } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { ThemeMode } from '../../types/theme';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';
import { Button } from '../ui/Button';

interface ThemeSwitcherProps {
  onOpenCustomModal?: () => void;
}

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'dark',
    label: 'Tối',
    sublabel: 'Mực & Chu Sa',
    icon: Moon,
  },
  {
    id: 'light',
    label: 'Sáng',
    sublabel: 'Giấy Ngà',
    icon: Sun,
  },
  {
    id: 'sepia',
    label: 'Sepia',
    sublabel: 'Giấy Cũ',
    icon: BookOpen,
  },
  {
    id: 'custom',
    label: 'Tùy chỉnh',
    sublabel: 'Bảng màu riêng',
    icon: Palette,
  },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ onOpenCustomModal }) => {
  const { theme, setTheme } = useThemeContext();
  const [isOpen, setIsOpen] = useState(false);

  const { triggerRef, menuRef, coords } = useDropdownPosition<HTMLButtonElement>({
    isOpen,
    onClose: () => setIsOpen(false),
    offsetY: 4,
  });

  const activeOption = THEME_OPTIONS.find((opt) => opt.id === theme) || THEME_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  const handleSelectTheme = (mode: ThemeMode) => {
    if (mode === 'custom') {
      setTheme('custom');
      setIsOpen(false);
      onOpenCustomModal?.();
    } else {
      setTheme(mode);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs"
        aria-label="Chuyển chế độ màu đọc và biên tập"
        title="Chế độ màu đọc & biên tập"
      >
        <ActiveIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span className="hidden sm:inline font-medium">{activeOption.label}</span>
      </Button>

      {/* Popover Menu: Render via Portal to document.body to escape sticky header stacking context */}
      {isOpen && coords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
            }}
            className="w-44 rounded-[2px] bg-parchment border border-parchment-2 shadow-lg z-40 py-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100 divide-y divide-parchment-2"
          >
            <div className="py-0.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.id;

                return (
                  <button
                    key={option.id}
                    role="menuitem"
                    onClick={() => handleSelectTheme(option.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-parchment-2 text-text-main font-bold'
                        : 'text-text-muted hover:bg-parchment-2/50 hover:text-text-main font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-polish' : 'text-text-muted'}`} />
                      <div>
                        <div className="leading-tight">{option.label}</div>
                        <div className="text-[10px] text-text-muted font-normal">{option.sublabel}</div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-polish shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
