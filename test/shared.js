import { WebSocket } from "ws";

export const BASE_URL = 'http://localhost:3000';
export const USERNAME = 'user';
export const PASSWORD = 'passwd';
export const AUTH_HEADER = () => 'Basic ' + Buffer.from(`${USERNAME} ${PASSWORD}`).toString('base64');
export const INVALID_AUTH = 'Basic ' + Buffer.from('wrong credentials').toString('base64');

let passed = 0;
let failed = 0;
const failures = [];

export async function request(apiBase, method, path, options = {}) {
    const url = `${BASE_URL}${apiBase}${path}`;
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json();
    return { status: response.status, data };
}

export function test(name, fn) {
    return async () => {
        try {
            await fn();
            passed++;
            console.log(`[V] ${name}`);
        } catch (err) {
            failed++;
            failures.push({ name, error: err.message });

            console.log(`[X] ${name}`);
            console.log(`  ${err.message}`);
        }
    };
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

export function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
}

export function connectWebSocket(apiBase, path, onMessage) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000${apiBase}${path}`);
        const messages = [];
        
        ws.on('open', () => {
            resolve({ ws, messages });
        });
        
        ws.on('message', (data) => {
            messages.push(data.toString());
            if (onMessage) onMessage(data.toString(), ws);
        });
        
        ws.on('error', reject);
    });
}

export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function runTests(tests) {
    console.log('Starting Frakatime Tests...\n');
    console.log('='.repeat(60));
    
    for (const testFn of tests) {
        await testFn();
    }
    
    console.log('='.repeat(60));
    console.log(`\nTest Results: ${passed} passed, ${failed} failed\n`);
    
    if (failed > 0) {
        console.log('Failed tests:');

        failures.forEach(({ name, error }) => {
            console.log(`  - ${name}`);
            console.log(`    ${error}`);
        });

        process.exit(1);
    } else {
        console.log('All tests passed!');
        process.exit(0);
    }
}

export async function checkServer(apiBase) {
    try {
        await fetch(`${BASE_URL}${apiBase}/health`);
        return true;
    } catch {
        console.error(`Error: Server is not running on port 3000 or ${apiBase} endpoint not available`);
        console.error('Please start the server with: pnpm start');
        console.error(`Make sure FT_VERSION is set correctly`);
        process.exit(1);
    }
}
