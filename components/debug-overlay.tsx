'use client';

import { useEffect, useState } from 'react';

export function DebugOverlay() {
  const [logs, setLogs] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Intercept console.log
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      if (message.includes('[Auth]') || message.includes('[Debug]')) {
        setLogs(prev => [...prev.slice(-10), `LOG: ${message}`]);
      }
      originalLog(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      if (message.includes('[Auth]') || message.includes('[Debug]')) {
        setLogs(prev => [...prev.slice(-10), `ERROR: ${message}`]);
      }
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
      >
        Show Debug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 text-white p-4 overflow-auto font-mono text-xs">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Debug Logs</h3>
        <button
          onClick={() => setVisible(false)}
          className="bg-red-600 px-3 py-1 rounded"
        >
          Hide
        </button>
      </div>
      <div className="space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-400">Waiting for logs...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={log.startsWith('ERROR') ? 'text-red-400' : 'text-green-400'}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
