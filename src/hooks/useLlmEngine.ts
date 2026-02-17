import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDebugLogger } from '../components/DebugConsole';

export function useLlmEngine() {
    const { success, error, info } = useDebugLogger();

    const [llmEngineType, setLlmEngineType] = useState<'builtin' | 'custom'>('builtin');
    const [llmFormProvider, setLlmFormProvider] = useState('local');
    const [llmFormEndpoint, setLlmFormEndpoint] = useState('');
    const [llmFormApiKey, setLlmFormApiKey] = useState('');
    const [llmFormModel, setLlmFormModel] = useState('');
    const [localModelReady, setLocalModelReady] = useState<boolean | null>(null);
    const [pullingModel, setPullingModel] = useState(false);

    const checkModelStatus = useCallback(async () => {
        try {
            const ready = await invoke<boolean>('is_local_model_ready');
            setLocalModelReady(ready);
        } catch (e) {
            setLocalModelReady(false);
        }
    }, []);

    const loadLlmConfig = useCallback(async () => {
        try {
            const config = await invoke<any>('get_llm_config');
            if (config) {
                setLlmEngineType(config.provider_type === 'Local' ? 'builtin' : 'custom');
                setLlmFormProvider(config.provider_type === 'OpenAI' ? 'openai' : config.provider_type === 'Anthropic' ? 'anthropic' : 'local');
                setLlmFormEndpoint(config.endpoint);
                setLlmFormApiKey(config.api_key || '');
                setLlmFormModel(config.model);
                
                if (config.provider_type === 'Local') {
                    checkModelStatus();
                }
            }
        } catch (e) {
            console.error("Failed to load LLM config", e);
        }
    }, [checkModelStatus]);

    const handleSaveLlmConfig = useCallback(async () => {
        try {
            let providerType = 'Local';
            if (llmEngineType === 'custom') {
                providerType = llmFormProvider === 'openai' ? 'OpenAI' : 'Anthropic';
            }

            await invoke('save_llm_config', {
                endpoint: llmFormEndpoint,
                model: llmFormModel,
                apiKey: llmFormApiKey,
                providerType: providerType
            });
            success('settings', 'AI Configuration saved successfully');
            checkModelStatus();
        } catch (e) {
            error('settings', `Failed to save configuration: ${e}`);
        }
    }, [llmEngineType, llmFormProvider, llmFormEndpoint, llmFormModel, llmFormApiKey, success, error, checkModelStatus]);

    const handlePullModel = useCallback(async () => {
        setPullingModel(true);
        info('ai', `Starting download of ${llmFormModel}...`);
        try {
            await invoke('pull_local_model', { modelName: llmFormModel });
            success('ai', 'Model downloaded successfully');
            setLocalModelReady(true);
        } catch (e) {
            error('ai', `Failed to download model: ${e}`);
        } finally {
            setPullingModel(false);
        }
    }, [llmFormModel, info, success, error]);

    const handleProviderChange = useCallback((provider: string) => {
        setLlmFormProvider(provider);
        if (provider === 'openai') {
            setLlmFormEndpoint('https://api.openai.com/v1/chat/completions');
            setLlmFormModel('gpt-4');
        } else if (provider === 'anthropic') {
            setLlmFormEndpoint('https://api.anthropic.com/v1/messages');
            setLlmFormModel('claude-3-opus-20240229');
        } else {
            setLlmFormEndpoint('http://localhost:11434/api/generate');
            setLlmFormModel('llama3:8b');
        }
    }, []);

    return {
        llmEngineType, setLlmEngineType,
        llmFormProvider, setLlmFormProvider,
        llmFormEndpoint, setLlmFormEndpoint,
        llmFormApiKey, setLlmFormApiKey,
        llmFormModel, setLlmFormModel,
        localModelReady,
        pullingModel,
        loadLlmConfig,
        handleSaveLlmConfig,
        handlePullModel,
        handleProviderChange,
        checkModelStatus
    };
}
