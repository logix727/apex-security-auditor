import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

export interface KeyboardShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}

/**
 * Predefined keyboard shortcuts for the application
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { key: 'g a', description: 'Go to Assets view', action: () => {}, preventDefault: true },
      { key: 'g w', description: 'Go to Workbench view', action: () => {}, preventDefault: true },
      { key: 'g d', description: 'Go to Dashboard view', action: () => {}, preventDefault: true },
      { key: 'g s', description: 'Go to Settings view', action: () => {}, preventDefault: true },
      { key: 'Escape', description: 'Close modal/panel or deselect all', action: () => {}, preventDefault: false },
    ]
  },
  {
    name: 'Selection',
    shortcuts: [
      { key: 'a', ctrl: true, description: 'Select all assets', action: () => {}, preventDefault: true },
      { key: 'd', ctrl: true, description: 'Deselect all assets', action: () => {}, preventDefault: true },
      { key: 'ArrowUp', shift: true, description: 'Extend selection up', action: () => {}, preventDefault: false },
      { key: 'ArrowDown', shift: true, description: 'Extend selection down', action: () => {}, preventDefault: false },
    ]
  },
  {
    name: 'Actions',
    shortcuts: [
      { key: 'Enter', description: 'Open selected asset in Inspector', action: () => {}, preventDefault: false },
      { key: 'e', ctrl: true, description: 'Export selected assets', action: () => {}, preventDefault: true },
      { key: 'Delete', description: 'Delete selected assets', action: () => {}, preventDefault: false },
      { key: 'r', ctrl: true, description: 'Rescan selected assets', action: () => {}, preventDefault: true },
      { key: 'w', ctrl: true, description: 'Add to Workbench', action: () => {}, preventDefault: true },
    ]
  },
  {
    name: 'Filter & Search',
    shortcuts: [
      { key: 'f', ctrl: true, description: 'Focus search/filter input', action: () => {}, preventDefault: true },
      { key: '/', description: 'Focus search input', action: () => {}, preventDefault: true },
      { key: '1', description: 'Filter: Show All', action: () => {}, preventDefault: false },
      { key: '2', description: 'Filter: Critical only', action: () => {}, preventDefault: false },
      { key: '3', description: 'Filter: PII only', action: () => {}, preventDefault: false },
      { key: '4', description: 'Filter: Secrets only', action: () => {}, preventDefault: false },
      { key: '5', description: 'Filter: Shadow API only', action: () => {}, preventDefault: false },
      { key: 'Escape', description: 'Clear search/filter', action: () => {}, preventDefault: false },
    ]
  },
  {
    name: 'Import',
    shortcuts: [
      { key: 'i', ctrl: true, description: 'Open Import dialog', action: () => {}, preventDefault: true },
    ]
  },
  {
    name: 'Utility',
    shortcuts: [
      { key: '?', description: 'Show keyboard shortcuts help', action: () => {}, preventDefault: true },
      { key: 'F1', description: 'Show keyboard shortcuts help', action: () => {}, preventDefault: true },
    ]
  }
];

/**
 * Hook to register and manage keyboard shortcuts
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) => {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields (except for specific cases)
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;

    // Allow specific shortcuts even in input fields
    const allowedInInput = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const isAllowedInInput = allowedInInput.includes(event.key);

    if (isInputField && !isAllowedInInput) {
      // Check if it's a global shortcut (with Ctrl/Cmd)
      const isGlobalShortcut = event.ctrlKey || event.metaKey;
      if (!isGlobalShortcut) {
        return;
      }
    }

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.key === shortcut.key;
      
      if (!keyMatch) continue;

      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

      if (ctrlMatch && shiftMatch && altMatch && metaMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        return;
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
};

/**
 * Hook to handle sequential keypresses (like vim keybindings: g then a)
 */
export const useSequentialKeys = (
  sequences: Record<string, () => void>,
  timeout: number = 1000
) => {
  const lastKeyTime = useRef<number>(0);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      
      // Check if we're in a sequence
      if (pendingKey.current) {
        const sequence = pendingKey.current + event.key.toLowerCase();
        
        if (sequences[sequence]) {
          sequences[sequence]();
          pendingKey.current = null;
          lastKeyTime.current = 0;
          event.preventDefault();
          return;
        }
        
        // Check if the key could start a new sequence
        if (sequences[event.key.toLowerCase()]) {
          pendingKey.current = event.key.toLowerCase();
          lastKeyTime.current = now;
          return;
        }
        
        // Sequence timed out or invalid key, reset
        pendingKey.current = null;
        lastKeyTime.current = 0;
      }
      
      // Check if this key starts a sequence
      if (sequences[event.key.toLowerCase()]) {
        // Check for timeout
        if (now - lastKeyTime.current > timeout) {
          pendingKey.current = event.key.toLowerCase();
          lastKeyTime.current = now;
        } else {
          pendingKey.current = event.key.toLowerCase();
          lastKeyTime.current = now;
        }
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sequences, timeout]);
};

/**
 * Hook to manage focus trap within a container
 */
export const useFocusTrap = (containerRef: React.RefObject<HTMLElement>, enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleTabKey);
  }, [containerRef, enabled]);
};

export default useKeyboardShortcuts;
