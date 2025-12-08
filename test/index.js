import { WebSocket } from "ws";

const BASE_URL = 'http://localhost:3000';
const API_BASE = '/api/v1';
const USERNAME = 'user';
const PASSWORD = 'passwd';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${USERNAME} ${PASSWORD}`).toString('base64');
const INVALID_AUTH = 'Basic ' + Buffer.from('wrong credentials').toString('base64');

let passed = 0;
let failed = 0;
const failures = [];

async function request(method, path, options = {}) {
    const url = `${BASE_URL}${API_BASE}${path}`;
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

function test(name, fn) {
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

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
}

function connectWebSocket(path, onMessage) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000${API_BASE}${path}`);
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

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const tests = [
    test('GET /health - returns 200 and status ok', async () => {
        const { status, data } = await request('GET', '/health');
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Health check response mismatch');
    }),

    test('GET /time/:service - returns 401 without auth', async () => {
        const { status, data } = await request('GET', '/time/testservice');
        assert(status === 401, `Expected status 401, got ${status}`);
        assertDeepEqual(data, { status: 'unauthorized' }, 'Unauthorized response mismatch');
    }),

    test('GET /time/:service - returns 401 with invalid auth', async () => {
        const { status, data } = await request('GET', '/time/testservice', {
            headers: { Authorization: INVALID_AUTH }
        });
        assert(status === 401, `Expected status 401, got ${status}`);
        assertDeepEqual(data, { status: 'unauthorized' }, 'Unauthorized response mismatch');
    }),

    test('POST /service/:service - returns 401 without auth', async () => {
        const { status, data } = await request('POST', '/service/testservice');
        assert(status === 401, `Expected status 401, got ${status}`);
        assertDeepEqual(data, { status: 'unauthorized' }, 'Unauthorized response mismatch');
    }),

    test('POST /service/:service - creates a new service', async () => {
        const { status, data } = await request('POST', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 201, `Expected status 201, got ${status}`);
        assertDeepEqual(data, { status: 'created' }, 'Created response mismatch');
    }),

    test('POST /service/:service - returns 409 for existing service', async () => {
        const { status, data } = await request('POST', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 409, `Expected status 409, got ${status}`);
        assertDeepEqual(data, { status: 'conflict', error: 'service already exists' }, 'Conflict response mismatch');
    }),

    test('GET /time/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('GET', '/time/nonexistent', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('GET /time/:service - returns time for existing service', async () => {
        const { status, data } = await request('GET', '/time/testservice1', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time !== undefined, 'Time field missing');
        assert(typeof data.time === 'string', 'Time should be a string');
    }),

    test('PUT /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('PUT', '/service/nonexistent', {
            headers: { Authorization: AUTH_HEADER },
            body: { new_name: 'newname' }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('PUT /service/:service - returns 400 without new_name', async () => {
        const { status, data } = await request('PUT', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER },
            body: {}
        });
        assert(status === 400, `Expected status 400, got ${status}`);
        assert(data.status === 'bad request', 'Bad request status mismatch');
    }),

    test('PUT /service/:service - updates service name', async () => {
        const { status, data } = await request('PUT', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER },
            body: { new_name: 'testservice2' }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Update response mismatch');
    }),

    test('GET /time/:service - old service name returns 404 after update', async () => {
        const { status } = await request('GET', '/time/testservice1', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
    }),

    test('GET /time/:service - new service name returns time after update', async () => {
        const { status, data } = await request('GET', '/time/testservice2', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time !== undefined, 'Time field missing');
    }),

    test('DELETE /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('DELETE', '/service/nonexistent', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('DELETE /service/:service - deletes existing service', async () => {
        const { status, data } = await request('DELETE', '/service/testservice2', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Delete response mismatch');
    }),

    test('GET /time/:service - returns 404 after deletion', async () => {
        const { status } = await request('GET', '/time/testservice2', {
            headers: { Authorization: AUTH_HEADER }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
    }),

    test('GET /invalid - returns 404 for invalid endpoint', async () => {
        const { status, data } = await request('GET', '/invalid');
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found' }, 'Not found response mismatch');
    }),

    test('WebSocket /ws/track - rejects unauthorized connection', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send('wrong:credentials|service');
        await wait(100);
        assert(messages.includes('unauthorized'), 'Expected unauthorized message');
        ws.close();
    }),

    test('WebSocket /ws/track - rejects non-existent service', async () => {
        await request('POST', '/service/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|nonexistent`);
        await wait(100);
        assert(messages.includes('non-existant service'), 'Expected non-existant service message');
        ws.close();
    }),

    test('WebSocket /ws/track - accepts valid connection and tracks time', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|wstest`);
        await wait(100);
        assert(messages.includes('ok'), 'Expected ok message');

        const before = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
        const timeBefore = parseInt(before.data.time);
        
        ws.send('+');
        ws.send('+');
        ws.send('+');
        await wait(100);

        const after = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
        const timeAfter = parseInt(after.data.time);
        
        assert(timeAfter === timeBefore + 3, `Expected time to increase by 3, got ${timeAfter - timeBefore}`);
        ws.close();
    }),

    test('WebSocket /ws/track - ignores invalid messages after auth', async () => {
        const { ws } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|wstest`);
        await wait(100);
        
        const before = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
        const timeBefore = parseInt(before.data.time);
        
        ws.send('invalid');
        ws.send('++');
        ws.send('');
        await wait(100);
        
        const after = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
        const timeAfter = parseInt(after.data.time);
        
        assert(timeAfter === timeBefore, 'Time should not change with invalid messages');
        ws.close();
        
        await request('DELETE', '/service/wstest', {
            headers: { Authorization: AUTH_HEADER }
        });
    })
];

async function runTests() {
    console.log('Starting Frakatime API Tests...\n');
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
        console.log('All tests passed! ✓');
        process.exit(0);
    }
}

fetch(`${BASE_URL}${API_BASE}/health`)
    .then(() => runTests())
    .catch(() => {
        console.error('Error: Server is not running on port 3000');
        console.error('Please start the server with: pnpm start');
        process.exit(1);
    });
