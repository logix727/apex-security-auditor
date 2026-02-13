import { useState, useEffect, useRef, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ChevronUp, ChevronDown, Trash2, Filter, Terminal } from 'lucide-react';

// Log entry interface matching the requirement
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  source: string;
  message: string;
  details?: any;
}

// Props for the DebugConsole component
interface DebugConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 500;

// Log level filter options
type LogLevelFilter = 'all' | 'info' | 'warn' | 'error' | 'success';

// Generate unique ID for log entries
const generateLogId = (): string => {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Format timestamp for display
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Debug Console Component
export function DebugConsole({ isOpen, onToggle }: DebugConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Add a new log entry
  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      id: generateLogId(),
      timestamp: new Date(),
    };

    setLogs((prevLogs) => {
      // Auto-trim old entries if exceeding max
      const updatedLogs = [...prevLogs, newEntry];
      if (updatedLogs.length > MAX_LOG_ENTRIES) {
        return updatedLogs.slice(-MAX_LOG_ENTRIES);
      }
      return updatedLogs;
    });
  }, []);

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Filter logs based on selected level
  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter((log) => log.level === filter);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Listen for debug-log events from Tauri backend
  useEffect(() => {
    const setupListener = async () => {
      try {
        unlistenRef.current = await listen<LogEntry>('debug-log', (event) => {
          const payload = event.payload;
          addLog({
            level: payload.level,
            source: payload.source,
            message: payload.message,
            details: payload.details,
          });
        });
      } catch (error) {
        console.error('Failed to set up debug-log listener:', error);
      }
    };

    setupListener();

    // Capture frontend console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    let isInternalLog = false;
    const safeStringify = (obj: any) => {
      try {
        const cache = new Set();
        return JSON.stringify(obj, (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      } catch (err) {
        return String(obj);
      }
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      if (isInternalLog) return;
      isInternalLog = true;
      addLog({
        level: 'info',
        source: 'ui',
        message: args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' '),
      });
      isInternalLog = false;
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      if (isInternalLog) return;
      isInternalLog = true;
      addLog({
        level: 'warn',
        source: 'ui',
        message: args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' '),
      });
      isInternalLog = false;
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      if (isInternalLog) return;
      isInternalLog = true;
      addLog({
        level: 'error',
        source: 'ui',
        message: args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' '),
      });
      isInternalLog = false;
    };

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }, [addLog]);

  // Get color for log level
  const getLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'info':
        return '#ffffff';
      case 'warn':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      case 'success':
        return '#10b981';
      default:
        return '#ffffff';
    }
  };

  // Get badge style for log level
  const getLevelBadgeClass = (level: LogEntry['level']): string => {
    switch (level) {
      case 'info':
        return 'debug-level-info';
      case 'warn':
        return 'debug-level-warn';
      case 'error':
        return 'debug-level-error';
      case 'success':
        return 'debug-level-success';
      default:
        return '';
    }
  };

  return (
    <div className={`debug-console-wrapper ${isOpen ? 'open' : ''}`}>
      {/* Console Header/Toggle Bar */}
      <div className="debug-console-header" onClick={onToggle}>
        <div className="debug-console-header-left">
          <Terminal size={14} />
          <span className="debug-console-title">Debug Console</span>
          <span className="debug-console-count">{logs.length} entries</span>
        </div>
        <div className="debug-console-header-right" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <>
              {/* Filter Dropdown */}
              <div className="debug-filter-group">
                <Filter size={12} />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as LogLevelFilter)}
                  className="debug-filter-select"
                >
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="success">Success</option>
                </select>
              </div>

              {/* Auto-scroll toggle */}
              <button
                className={`debug-btn ${autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll(!autoScroll)}
                title="Auto-scroll"
              >
                Auto
              </button>

              {/* Clear button */}
              <button
                className="debug-btn debug-btn-danger"
                onClick={clearLogs}
                title="Clear logs"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </>
          )}
        </div>
        <div className="debug-toggle-icon">
          {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {/* Console Body */}
      {isOpen && (
        <div className="debug-console-body" style={{ overflow: 'hidden' }}>
          <div className="debug-console-logs" ref={logContainerRef}>
            {filteredLogs.length === 0 ? (
              <div className="debug-console-empty">
                No logs to display. Events will appear here in real-time.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="debug-log-entry">
                  <span className="debug-log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  <span className={`debug-log-level ${getLevelBadgeClass(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="debug-log-source">[{log.source}]</span>
                  <span className="debug-log-message" style={{ color: getLevelColor(log.level) }}>
                    {log.message}
                  </span>
                  {log.details && (
                    <span className="debug-log-details" title={JSON.stringify(log.details, null, 2)}>
                      📋
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export a hook for programmatic logging from other components
export function useDebugLogger() {
  const log = useCallback((
    level: LogEntry['level'],
    source: string,
    message: string,
    details?: any
  ) => {
    // Emit to Tauri backend which will broadcast to all listeners
    import('@tauri-apps/api/event').then(({ emit }) => {
      emit('debug-log', {
        id: generateLogId(),
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        details,
      });
    });
  }, []);

  return {
    info: (source: string, message: string, details?: any) => log('info', source, message, details),
    warn: (source: string, message: string, details?: any) => log('warn', source, message, details),
    error: (source: string, message: string, details?: any) => log('error', source, message, details),
    success: (source: string, message: string, details?: any) => log('success', source, message, details),
  };
}

export default DebugConsole;
