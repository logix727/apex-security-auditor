import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
    ListOrdered, 
    Play, 
    Plus, 
    Trash2, 
    Zap,
    BrainCircuit,
    Wand2,
    RotateCcw
} from 'lucide-react';
import { RequestSequence, VariableCapture } from '../../types';
import { useDebugLogger } from '../DebugConsole';
import ReactMarkdown from 'react-markdown';

export const SequenceEditor: React.FC = () => {
    const [sequences, setSequences] = useState<RequestSequence[]>([]);
    const [selectedSequence, setSelectedSequence] = useState<RequestSequence | null>(null);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
    const [context, setContext] = useState<Record<string, string>>({});
    const [isExecuting, setIsExecuting] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState<'context' | 'ai'>('context');
    const [aiNarrative, setAiNarrative] = useState<string | null>(null);
    const [aiRemediation, setAiRemediation] = useState<string | null>(null);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const { info, success, error } = useDebugLogger();

    useEffect(() => {
        loadSequences();
    }, []);

    const loadSequences = async () => {
        try {
            const list = await invoke<RequestSequence[]>('list_sequences');
            setSequences(list);
        } catch (e) {
            error(`Failed to load sequences: ${e}`, 'Sequences');
        }
    };

    const loadSequenceDetails = async (id: string) => {
        try {
            const detailed = await invoke<RequestSequence>('get_sequence', { id });
            setSelectedSequence(detailed);
            setActiveStepIndex(null);
            setAiNarrative(null);
            setAiRemediation(null);
        } catch (e) {
            error(`Failed to load sequence details: ${e}`, 'Sequences');
        }
    };

    const handleGenerateNarrative = async () => {
        if (!selectedSequence) return;
        setIsGeneratingAi(true);
        info('Generating AI exploit narrative...', 'AI');
        try {
            const result = await invoke<{ analysis: string, provider: string }>('generate_exploit_narrative', { sequence: selectedSequence });
            setAiNarrative(result.analysis);
            success('Exploit narrative generated.', 'AI');
        } catch (e) {
            error(`Failed to generate narrative: ${e}`, 'AI');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleGenerateRemediation = async () => {
        if (!selectedSequence) return;
        setIsGeneratingAi(true);
        info('Generating AI remediation guide...', 'AI');
        try {
            const result = await invoke<{ analysis: string, provider: string }>('generate_remediation_diff', { sequence: selectedSequence });
            setAiRemediation(result.analysis);
            success('Remediation guide generated.', 'AI');
        } catch (e) {
            error(`Failed to generate remediation: ${e}`, 'AI');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleExecuteStep = async (index: number) => {
        if (!selectedSequence) return;
        const step = selectedSequence.steps[index];
        setIsExecuting(true);
        info(`Executing Step ${index + 1}: ${step.method} ${step.url}`, 'Sequences');

        try {
            const result = await invoke<any>('execute_sequence_step', {
                step,
                context
            });
            
            setContext(result.updated_context);
            success(`Step ${index + 1} completed! Status: ${result.status_code}`, 'Sequences');
            
            const newSteps = [...selectedSequence.steps];
            newSteps[index] = { ...step, status_code: result.status_code, response_body: result.response_body };
            setSelectedSequence({ ...selectedSequence, steps: newSteps });

        } catch (e) {
            error(`Step ${index + 1} failed: ${e}`, 'Sequences');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleAddVariable = (stepIndex: number) => {
        if (!selectedSequence) return;
        const newSteps = [...selectedSequence.steps];
        const step = { ...newSteps[stepIndex] };
        step.captures = [...step.captures, { name: 'new_var', source: 'json:path.to.key' }];
        newSteps[stepIndex] = step;
        setSelectedSequence({ ...selectedSequence, steps: newSteps });
    };

    const handleUpdateVariable = (stepIndex: number, varIndex: number, field: keyof VariableCapture, value: string) => {
        if (!selectedSequence) return;
        const newSteps = [...selectedSequence.steps];
        const step = { ...newSteps[stepIndex] };
        const captures = [...step.captures];
        captures[varIndex] = { ...captures[varIndex], [field]: value } as VariableCapture;
        step.captures = captures;
        newSteps[stepIndex] = step;
        setSelectedSequence({ ...selectedSequence, steps: newSteps });
    };


    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Sidebar: Sequence List */}
            <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Sequences</h3>
                    <button className="btn btn-sm btn-outline"><Plus size={14} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {sequences.map(seq => (
                        <div 
                            key={seq.id}
                            onClick={() => loadSequenceDetails(seq.id)}
                            style={{ 
                                padding: '12px 20px', 
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)',
                                backgroundColor: selectedSequence?.id === seq.id ? 'var(--bg-tertiary)' : 'transparent',
                                borderLeft: selectedSequence?.id === seq.id ? '4px solid var(--accent-color)' : '4px solid transparent'
                            }}
                        >
                            <div style={{ fontWeight: '500', fontSize: '14px' }}>{seq.flow_name || 'Unnamed Flow'}</div>
                            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>{seq.created_at}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedSequence ? (
                    <>
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedSequence.flow_name}</h2>
                                <span style={{ fontSize: '12px', opacity: 0.5 }}>ID: {selectedSequence.id}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-outline" onClick={() => { setAiNarrative(null); setAiRemediation(null); setContext({}); }}><RotateCcw size={16} /> Reset</button>
                                <button className="btn btn-primary" disabled={isExecuting} onClick={() => handleExecuteStep(0)}><Play size={16} /> Run All</button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {selectedSequence.steps.map((step, idx) => (
                                    <div 
                                        key={idx} 
                                        style={{ 
                                            background: 'var(--bg-secondary)', 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--border-color)',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div 
                                            onClick={() => setActiveStepIndex(activeStepIndex === idx ? null : idx)}
                                            style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: activeStepIndex === idx ? '1px solid var(--border-color)' : 'none' }}
                                        >
                                            <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{idx + 1}</span>
                                            <span className={`badge ${step.status_code === 0 ? 'badge-muted' : (step.status_code < 400 ? 'badge-success' : 'badge-danger')}`}>
                                                {step.method}
                                            </span>
                                            <code style={{ fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.url}</code>
                                            <button 
                                                className="btn btn-sm btn-primary" 
                                                onClick={(e) => { e.stopPropagation(); handleExecuteStep(idx); }}
                                                disabled={isExecuting}
                                            >
                                                <Play size={12} />
                                            </button>
                                        </div>

                                        {activeStepIndex === idx && (
                                            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--bg-sidebar)' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '12px', fontWeight: '600', opacity: 0.7 }}>Variable Captures</label>
                                                        <button className="btn btn-sm btn-outline" onClick={() => handleAddVariable(idx)}><Plus size={12} /> Add</button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {step.captures.map((cap, vIdx) => (
                                                            <div key={vIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                <input 
                                                                    placeholder="Var Name" 
                                                                    value={cap.name} 
                                                                    onChange={(e) => handleUpdateVariable(idx, vIdx, 'name', e.target.value)}
                                                                    style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' }}
                                                                />
                                                                <input 
                                                                    placeholder="Source (e.g. json:id)" 
                                                                    value={cap.source} 
                                                                    onChange={(e) => handleUpdateVariable(idx, vIdx, 'source', e.target.value)}
                                                                    style={{ flex: 2, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' }}
                                                                />
                                                                <button className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '15px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: '11px', opacity: 0.5, display: 'block', marginBottom: '4px' }}>Request Body</label>
                                                        <textarea 
                                                            readOnly 
                                                            value={step.request_body || ''} 
                                                            style={{ width: '100%', height: '80px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: '11px', opacity: 0.5, display: 'block', marginBottom: '4px' }}>Response Body (Last Run)</label>
                                                        <textarea 
                                                            readOnly 
                                                            value={step.response_body || ''} 
                                                            style={{ width: '100%', height: '80px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <div style={{ textAlign: 'center' }}>
                            <ListOrdered size={64} style={{ marginBottom: '20px' }} />
                            <h3>Select a sequence to begin analysis</h3>
                            <p style={{ fontSize: '14px' }}>Capture variables from one response to use in the next request.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel: Variable Context & AI Insights */}
            <div style={{ width: '350px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <div 
                        onClick={() => setRightPanelTab('context')}
                        style={{ 
                            flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer',
                            borderBottom: rightPanelTab === 'context' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            background: rightPanelTab === 'context' ? 'var(--bg-tertiary)' : 'transparent',
                            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <Zap size={14} /> Context
                    </div>
                    <div 
                        onClick={() => setRightPanelTab('ai')}
                        style={{ 
                            flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer',
                            borderBottom: rightPanelTab === 'ai' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            background: rightPanelTab === 'ai' ? 'var(--bg-tertiary)' : 'transparent',
                            fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <BrainCircuit size={14} /> AI Insights
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {rightPanelTab === 'context' ? (
                        <div style={{ padding: '15px' }}>
                            {Object.keys(context).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {Object.entries(context).map(([k, v]) => (
                                        <div key={k} style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '4px' }}>{k}</div>
                                            <div style={{ fontSize: '12px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                                    No variables captured yet.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {!selectedSequence ? (
                                <div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                                    Select a sequence to generate insights.
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button 
                                            className="btn btn-outline" 
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={handleGenerateNarrative}
                                            disabled={isGeneratingAi}
                                        >
                                            <Wand2 size={16} /> {isGeneratingAi ? 'Analyzing...' : 'Generate Exploit Narrative'}
                                        </button>
                                        <button 
                                            className="btn btn-outline" 
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={handleGenerateRemediation}
                                            disabled={isGeneratingAi}
                                        >
                                            <RotateCcw size={16} /> {isGeneratingAi ? 'Analyzing...' : 'Generate Remediation Guide'}
                                        </button>
                                    </div>

                                    {(aiNarrative || aiRemediation) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {aiNarrative && (
                                                <div className="markdown-content ai-narrative" style={{ padding: '15px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)', fontSize: '13px' }}>
                                                    <ReactMarkdown>{aiNarrative}</ReactMarkdown>
                                                </div>
                                            )}
                                            {aiRemediation && (
                                                <div className="markdown-content ai-remediation" style={{ padding: '15px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px' }}>
                                                    <ReactMarkdown>{aiRemediation}</ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
