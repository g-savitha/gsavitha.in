import { useState, useEffect, useRef } from 'react';
import { PaintBucket } from 'lucide-react';
import { THEMES, type ThemeName } from '../utils/themes';
import ErrorBoundary from './ErrorBoundary';

const themes = THEMES;

function ThemePickerInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeName | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize theme from localStorage if the user has previously selected one
    const saved = localStorage.getItem('theme-color');
    if (saved && saved in themes) {
      setActiveTheme(saved as ThemeName);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  /**
   * Sets the theme and updates CSS variables and localStorage.
   */
  const setTheme = (name: ThemeName) => {
    const theme = themes[name];
    document.documentElement.style.setProperty('--theme-color', theme.primary);
    document.documentElement.style.setProperty('--theme-color-hover', theme.hover);
    localStorage.setItem('theme-color', name);
    setActiveTheme(name);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-7 h-7 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full cursor-pointer hover-lift transition-colors ${
          activeTheme ? 'text-primary hover:text-primary-hover' : 'text-zinc-200 hover:text-primary'
        }`}
        aria-label="Theme picker"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <PaintBucket size={20} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="absolute top-10 left-0 z-50 py-3 px-2 bg-[rgb(30,30,33)] border border-zinc-800 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-label="Theme options"
        >
          <ul className="flex flex-col gap-3 items-center list-none p-0 m-0">
            {(Object.entries(themes) as [ThemeName, (typeof themes)['blue']][]).map(
              ([name, theme]) => (
                <li key={name} role="none">
                  <button
                    onClick={() => setTheme(name)}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 shadow-inner block cursor-pointer ${activeTheme === name ? 'ring-2 ring-white ring-offset-2 ring-offset-[rgb(30,30,33)]' : 'border border-white/5'}`}
                    style={{ backgroundColor: theme.primary }}
                    aria-label={`Select ${name} theme`}
                    role="menuitem"
                  />
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ThemePicker() {
  return (
    <ErrorBoundary>
      <ThemePickerInner />
    </ErrorBoundary>
  );
}
