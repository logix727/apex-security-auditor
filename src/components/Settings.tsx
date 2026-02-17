import React, { useState } from 'react';
import { Settings as SettingsIcon, Bot, Database, Activity, RefreshCw, Trash2, Globe, Shield, Play, Square } from 'lucide-react';

interface SettingsProps {
  llmEngineType: 'builtin' | 'custom';
  setLlmEngineType: (type: 'builtin' | 'custom') => void;
  llmFormProvider: string;
  setLlmFormProvider: (provider: string) => void;
  llmFormEndpoint: string;
  setLlmFormEndpoint: (endpoint: string) => void;
  llmFormModel: string;
  setLlmFormModel: (model: string) => void;
  llmFormKey: string;
  setLlmFormKey: (key: string) => void;
  localModelReady: boolean | null;
  pullingModel: boolean;
  handlePullModel: () => void;
  handleSaveLlmConfig: () => void;
  handleResetDb: () => void;
  handleProviderChange: (provider: string) => void;
  proxyPort: number;
  setProxyPort: (port: number) => void;
  proxyRunning: boolean;
  handleToggleProxy: () => void;
}

export const Settings: React.FC<SettingsProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'data'>('ai');

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Settings Sidebar */}
      <div style={{ width: '220px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', padding: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SettingsIcon size={20} /> Settings
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button 
                onClick={() => setActiveTab('general')}
                style={{ 
                    padding: '10px', borderRadius: '6px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                    background: activeTab === 'general' ? 'var(--bg-primary)' : 'transparent',
                    color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', fontWeight: activeTab === 'general' ? 'bold' : 'normal'
                }}
            >
                <Globe size={16} /> General
            </button>
            <button 
                onClick={() => setActiveTab('ai')}
                style={{ 
                    padding: '10px', borderRadius: '6px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                    background: activeTab === 'ai' ? 'var(--bg-primary)' : 'transparent',
                    color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', fontWeight: activeTab === 'ai' ? 'bold' : 'normal'
                }}
            >
                <Bot size={16} /> AI Engine
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                style={{ 
                    padding: '10px', borderRadius: '6px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                    background: activeTab === 'data' ? 'var(--bg-primary)' : 'transparent',
                    color: activeTab === 'data' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', fontWeight: activeTab === 'data' ? 'bold' : 'normal'
                }}
            >
                <Database size={16} /> Data & Storage
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '40px', maxWidth: '800px' }}>
          {activeTab === 'ai' && (
              <div>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Artificial Intelligence</h3>
                  
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <button 
                                onClick={() => {
                                    props.setLlmEngineType('builtin');
                                    props.handleProviderChange('local');
                                }}
                                style={{ 
                                    flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                    background: props.llmEngineType === 'builtin' ? 'var(--accent-color)' : 'transparent',
                                    color: props.llmEngineType === 'builtin' ? 'white' : 'var(--text-secondary)',
                                    border: 'none', transition: 'all 0.2s'
                                }}
                            >Built-in (Zero-Config)</button>
                            <button 
                                onClick={() => props.setLlmEngineType('custom')}
                                style={{ 
                                    flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                    background: props.llmEngineType === 'custom' ? 'var(--accent-color)' : 'transparent',
                                    color: props.llmEngineType === 'custom' ? 'white' : 'var(--text-secondary)',
                                    border: 'none', transition: 'all 0.2s'
                                }}
                            >Custom API</button>
                        </div>

                        {props.llmEngineType === 'builtin' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Activity size={24} color="var(--status-safe)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>Local Intelligence Engine</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            Powered by Ollama (Llama 3.1 8B). All data remains on your device.
                                        </div>
                                        <div style={{ fontSize: '12px', marginTop: '8px', color: props.localModelReady === true ? 'var(--status-safe)' : 'var(--status-warning)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: props.localModelReady === true ? 'var(--status-safe)' : 'var(--status-warning)' }}></div>
                                            {props.localModelReady === null ? 'Checking status...' : props.localModelReady ? 'Engine Ready' : 'Model Missing'}
                                        </div>
                                    </div>
                                    {props.localModelReady === false && (
                                        <button 
                                            onClick={props.handlePullModel}
                                            disabled={props.pullingModel}
                                            style={{
                                                padding: '8px 16px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            {props.pullingModel ? (
                                                <>Downloading... <RefreshCw className="spin" size={14}/></>
                                            ) : (
                                                <>Initialize (4.7GB)</>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={props.handleSaveLlmConfig}
                                    style={{
                                        alignSelf: 'flex-end', padding: '10px 20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                                    }}
                                >Revert to Defaults</button>
                            </div>
                        ) : (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                                <div>
                                    <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>Provider Preset</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {[
                                            { id: 'openai', name: 'OpenAI' },
                                            { id: 'openrouter', name: 'OpenRouter' },
                                            { id: 'anthropic', name: 'Anthropic' },
                                            { id: 'llama-cloud', name: 'LlamaCloud' },
                                            { id: 'local', name: 'Custom Local' }
                                        ].map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => props.handleProviderChange(p.id)}
                                                style={{
                                                    padding: '8px 16px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                                                    background: props.llmFormProvider === p.id || (p.id === 'openrouter' && props.llmFormEndpoint.includes('openrouter')) ? 'var(--accent-color)' : 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: 'white'
                                                }}
                                            >{p.name}</button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>Endpoint URL</label>
                                        <input 
                                            type="text"
                                            value={props.llmFormEndpoint}
                                            onChange={(e) => props.setLlmFormEndpoint(e.target.value)}
                                            placeholder="https://api.openai.com/v1"
                                            style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>Model ID</label>
                                        <input 
                                            type="text"
                                            value={props.llmFormModel}
                                            onChange={(e) => props.setLlmFormModel(e.target.value)}
                                            placeholder="gpt-4-turbo"
                                            style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold'}}>API Key</label>
                                    <input 
                                        type="password"
                                        value={props.llmFormKey}
                                        onChange={(e) => props.setLlmFormKey(e.target.value)}
                                        placeholder="sk-..."
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '13px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={props.handleSaveLlmConfig}
                                        style={{
                                            padding: '10px 24px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >Save Configuration</button>
                                </div>
                            </div>
                        )}
                  </div>
              </div>
          )}

          {activeTab === 'data' && (
              <div>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>Data Management</h3>
                  
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div>
                                <div style={{ fontWeight: 'bold', color: 'var(--status-critical)', marginBottom: '4px' }}>Reset Database</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Permanently delete all assets and scan history. This action cannot be undone.</div>
                            </div>
                            <button 
                                onClick={props.handleResetDb}
                                style={{
                                    padding: '10px 20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-critical)', borderRadius: '6px', color: 'var(--status-critical)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Trash2 size={16} /> Clear All Data
                            </button>
                        </div>
                  </div>
              </div>
          )}
          
          {activeTab === 'general' && (
              <div>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '30px' }}>General Settings</h3>
                  
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                          <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Shield size={20} color="var(--accent-color)" />
                          </div>
                          <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Proxy Interception Service</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Capture and analyze live HTTP traffic.</div>
                          </div>
                          <button 
                            onClick={props.handleToggleProxy}
                            style={{
                                padding: '8px 16px', 
                                background: props.proxyRunning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                border: `1px solid ${props.proxyRunning ? 'var(--status-critical)' : 'var(--status-safe)'}`,
                                borderRadius: '8px', 
                                color: props.proxyRunning ? 'var(--status-critical)' : 'var(--status-safe)', 
                                fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', 
                                display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'all 0.2s'
                            }}
                          >
                              {props.proxyRunning ? <><Square size={14} /> Stop Proxy</> : <><Play size={14} /> Start Proxy</>}
                          </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                          <div>
                              <label style={{display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em'}}>Listening Port</label>
                              <input 
                                  type="number"
                                  value={props.proxyPort}
                                  onChange={(e) => props.setProxyPort(parseInt(e.target.value))}
                                  style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
                              />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', padding: '12px 0' }}>
                                  <input type="checkbox" checked={true} readOnly style={{ accentColor: 'var(--accent-color)' }} />
                                  <span>Auto-capture to Workbench</span>
                              </label>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
