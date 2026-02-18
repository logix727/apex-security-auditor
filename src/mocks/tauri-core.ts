export async function invoke(cmd: string, args: any = {}): Promise<any> {
    console.log(`[Mock Invoke] ${cmd}`, args);
    switch (cmd) {
        case 'get_folders':
            return [{ id: 1, name: 'Default', parent_id: null }];
        case 'get_assets':
            return [
                { 
                    id: 1, 
                    url: 'https://example.com/api/v1/users', 
                    method: 'GET', 
                    status_code: 200,
                    risk_score: 10, 
                    findings: [],
                    triage_status: 'open'
                },
                { 
                    id: 2, 
                    url: 'https://api.test.com/login', 
                    method: 'POST', 
                    status_code: 200,
                    risk_score: 80, 
                    findings: [
                        { short: 'BOLA', severity: 'High', description: 'Broken Object Level Authorization' }
                    ],
                    triage_status: 'open'
                }
            ];
        case 'add_folder':
            return 2; // new folder id
        case 'scan_asset':
        case 'rescan_asset':
            return { id: args.id || 1, status: 'scanned' };
        case 'list_sequences':
            return [
                { id: 'seq-1', flow_name: 'Mock Flow', created_at: '2023-01-01', steps: [] }
            ];
        case 'get_sequence':
             return {
                id: 'seq-1',
                flow_name: 'Mock Flow',
                created_at: '2023-01-01',
                steps: [
                    { method: 'GET', url: 'https://example.com/api', status_code: 200, captures: [], request_body: '', response_body: '{"id": 1}' }
                ]
             };
        case 'export_findings_to_csv':
             return "URL,Method,Risk\nhttp://example.com,GET,10";
        case 'generate_audit_report':
             return "# Audit Report\n\nMock data.";
        case 'generate_html_report':
             return "<html><body><h1>Report</h1></body></html>";
        default:
            console.warn(`[Mock Invoke] Unknown command: ${cmd}`);
            return null;
    }
}

export async function listen(event: string, _handler: (payload: any) => void): Promise<() => void> {
    console.log(`[Mock Listen] ${event}`);
    // Mocking the event object structure for Tauri v2
    const mockUnlisten = () => {};
    return mockUnlisten;
}

export async function open(_options: any = {}) {
    console.log('[Mock Dialog Open]', _options);
    if (_options.multiple) {
        return ["C:\\Users\\User\\Downloads\\mock-import.csv"];
    }
    return "C:\\Users\\User\\Downloads\\mock-import.csv";
}

export async function save(_options: any = {}) {
    console.log('[Mock Dialog Save]', _options);
    return "C:\\Users\\User\\Downloads\\export.csv";
}

export async function message(msg: string, _options: any = {}) {
    console.log('[Mock Dialog Message]', msg, _options);
}

export async function ask(msg: string, _options: any = {}) {
    console.log('[Mock Dialog Ask]', msg, _options);
    return true;
}

export async function confirm(msg: string, _options: any = {}) {
    console.log('[Mock Dialog Confirm]', msg, _options);
    return true;
}

export async function readTextFile(path: string, _options: any = {}) {
    console.log('[Mock FS Read]', path, _options);
    if (path.endsWith('.csv')) {
        return "url,method\nhttps://example.com/api/v1/mock-user,GET\nhttps://example.com/api/v1/mock-login,POST";
    }
    return "GET https://example.com/api/v1/debug\nPOST https://example.com/api/v1/test";
}

export async function writeTextFile(path: string, _contents: string, _options: any = {}) {
    console.log('[Mock FS Write]', path, _contents, _options);
}

export async function exists(path: string, _options: any = {}) {
    console.log('[Mock FS Exists]', path, _options);
    return true;
}
export const BaseDirectory = {
    AppLocalData: 1,
    Desktop: 2,
    Document: 3,
    Download: 4,
    // Add others if needed
};

// Mock @tauri-apps/plugin-opener
// default export often used but alias might mapping module exports
export const revealItemInDir = async (path: string) => { console.log('reveal', path) };
