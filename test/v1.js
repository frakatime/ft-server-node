// Vibecoded tests ♥
import {
    USERNAME,
    PASSWORD,
    AUTH_HEADER,
    INVALID_AUTH,
    request as baseRequest,
    test,
    assert,
    assertDeepEqual,
    connectWebSocket as baseConnectWebSocket,
    wait,
    runTests,
    checkServer
} from './shared.js';

const API_BASE = '/api/v1';

console.log('Testing Frakatime V1 API\n');

const request = (method, path, options) => baseRequest(API_BASE, method, path, options);
const connectWebSocket = (path, onMessage) => baseConnectWebSocket(API_BASE, path, onMessage);


const v1Tests = [
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
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 201, `Expected status 201, got ${status}`);
        assertDeepEqual(data, { status: 'created' }, 'Created response mismatch');
    }),

    test('POST /service/:service - returns 409 for existing service', async () => {
        const { status, data } = await request('POST', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 409, `Expected status 409, got ${status}`);
        assertDeepEqual(data, { status: 'conflict', error: 'service already exists' }, 'Conflict response mismatch');
    }),

    test('GET /time/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('GET', '/time/nonexistent', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('GET /time/:service - returns time for existing service', async () => {
        const { status, data } = await request('GET', '/time/testservice1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time !== undefined, 'Time field missing');
        assert(typeof data.time === 'string', 'Time should be a string');
    }),

    test('PUT /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('PUT', '/service/nonexistent', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 'newname' }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('PUT /service/:service - returns 400 without new_name', async () => {
        const { status, data } = await request('PUT', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER() },
            body: {}
        });
        assert(status === 400, `Expected status 400, got ${status}`);
        assert(data.status === 'bad request', 'Bad request status mismatch');
    }),

    test('PUT /service/:service - updates service name', async () => {
        const { status, data } = await request('PUT', '/service/testservice1', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 'testservice2' }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Update response mismatch');
    }),

    test('GET /time/:service - old service name returns 404 after update', async () => {
        const { status } = await request('GET', '/time/testservice1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
    }),

    test('GET /time/:service - new service name returns time after update', async () => {
        const { status, data } = await request('GET', '/time/testservice2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time !== undefined, 'Time field missing');
    }),

    test('DELETE /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('DELETE', '/service/nonexistent', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assertDeepEqual(data, { status: 'not found', error: 'service does not exist' }, 'Not found response mismatch');
    }),

    test('DELETE /service/:service - deletes existing service', async () => {
        const { status, data } = await request('DELETE', '/service/testservice2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Delete response mismatch');
    }),

    test('GET /time/:service - returns 404 after deletion', async () => {
        const { status } = await request('GET', '/time/testservice2', {
            headers: { Authorization: AUTH_HEADER() }
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
            headers: { Authorization: AUTH_HEADER() }
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
            headers: { Authorization: AUTH_HEADER() }
        });
        const timeBefore = parseInt(before.data.time);
        
        ws.send('+');
        ws.send('+');
        ws.send('+');
        await wait(100);

        const after = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER() }
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
            headers: { Authorization: AUTH_HEADER() }
        });
        const timeBefore = parseInt(before.data.time);
        
        ws.send('invalid');
        ws.send('++');
        ws.send('');
        await wait(100);
        
        const after = await request('GET', '/time/wstest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const timeAfter = parseInt(after.data.time);
        
        assert(timeAfter === timeBefore, 'Time should not change with invalid messages');
        ws.close();
        
        await request('DELETE', '/service/wstest', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('PUT /service/:service - returns 401 without auth', async () => {
        await request('POST', '/service/authtest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status } = await request('PUT', '/service/authtest', {
            body: { new_name: 'newname' }
        });
        assert(status === 401, `Expected status 401, got ${status}`);
        await request('DELETE', '/service/authtest', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('DELETE /service/:service - returns 401 without auth', async () => {
        await request('POST', '/service/authtest2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status } = await request('DELETE', '/service/authtest2');
        assert(status === 401, `Expected status 401, got ${status}`);
        await request('DELETE', '/service/authtest2', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('POST /service/:service - handles special characters in service name', async () => {
        const { status } = await request('POST', '/service/test-service_123', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 201, `Expected status 201, got ${status}`);
        
        const { status: getStatus, data } = await request('GET', '/time/test-service_123', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(getStatus === 200, `Expected GET status 200, got ${getStatus}`);
        assert(data.time === '0', 'Initial time should be 0');
        
        await request('DELETE', '/service/test-service_123', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('PUT /service/:service - returns 400 with invalid new_name type', async () => {
        await request('POST', '/service/typetest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status } = await request('PUT', '/service/typetest', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 123 }
        });
        assert(status === 400, `Expected status 400, got ${status}`);
        await request('DELETE', '/service/typetest', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('PUT /service/:service - returns 400 with empty new_name', async () => {
        await request('POST', '/service/emptytest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status } = await request('PUT', '/service/emptytest', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: '' }
        });
        assert(status === 400, `Expected status 400, got ${status}`);
        await request('DELETE', '/service/emptytest', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('POST /service/:service - creates multiple services', async () => {
        const services = ['multi1', 'multi2', 'multi3'];
        for (const service of services) {
            const { status } = await request('POST', `/service/${service}`, {
                headers: { Authorization: AUTH_HEADER() }
            });
            assert(status === 201, `Expected status 201 for ${service}, got ${status}`);
        }
        
        for (const service of services) {
            const { status, data } = await request('GET', `/time/${service}`, {
                headers: { Authorization: AUTH_HEADER() }
            });
            assert(status === 200, `Expected status 200 for ${service}, got ${status}`);
            assert(data.time === '0', `Expected time 0 for ${service}`);
        }
        
        for (const service of services) {
            await request('DELETE', `/service/${service}`, {
                headers: { Authorization: AUTH_HEADER() }
            });
        }
    }),

    test('WebSocket /ws/track - rejects malformed auth message', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send('malformed');
        await wait(100);
        assert(messages.includes('unauthorized'), 'Expected unauthorized message');
        ws.close();
    }),

    test('WebSocket /ws/track - rejects missing service in auth', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}`);
        await wait(100);
        assert(messages.includes('unauthorized'), 'Expected unauthorized message');
        ws.close();
    }),

    test('WebSocket /ws/track - rejects missing credentials in auth', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send('|service');
        await wait(100);
        assert(messages.includes('unauthorized'), 'Expected unauthorized message');
        ws.close();
    })
];

checkServer(API_BASE).then(() => runTests(v1Tests));

