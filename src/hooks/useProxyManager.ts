import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../components/debug/DebugConsole';

export function useProxyManager() {
    const { success, error } = useDebugLogger();
    const [proxyRunning, setProxyRunning] = useState(false);
    const [proxyPort, setProxyPort] = useState(8080);

    const handleToggleProxy = useCallback(async () => {
        try {
            if (proxyRunning) {
                await invoke('stop_proxy_service');
                setProxyRunning(false);
                success('proxy', 'Proxy service stopped');
            } else {
                await invoke('start_proxy_service');
                setProxyRunning(true);
                success('proxy', `Proxy service started on port ${proxyPort}`);
            }
        } catch (e) {
            error('proxy', `Failed to toggle proxy: ${e}`);
            setProxyRunning(false);
        }
    }, [proxyPort, proxyRunning, success, error]);

    return {
        proxyRunning,
        setProxyRunning,
        proxyPort,
        setProxyPort,
        handleToggleProxy
    };
}
