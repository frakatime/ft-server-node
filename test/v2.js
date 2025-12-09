// Vibecoded tests ♥
import {
    USERNAME,
    PASSWORD,
    AUTH_HEADER,
    request as baseRequest,
    test,
    assert,
    assertDeepEqual,
    connectWebSocket as baseConnectWebSocket,
    wait,
    runTests,
    checkServer
} from './shared.js';

const API_BASE = '/api/v2';

console.log('Testing Frakatime V2 API\n');

const request = (method, path, options) => baseRequest(API_BASE, method, path, options);
const connectWebSocket = (path, onMessage) => baseConnectWebSocket(API_BASE, path, onMessage);

const v2Tests = [
    test('GET /health - returns 200 and status ok', async () => {
        const { status, data } = await request('GET', '/health');
        assert(status === 200, `Expected status 200, got ${status}`);
        assertDeepEqual(data, { status: 'ok' }, 'Health check response mismatch');
    }),

    test('GET /time - returns all time data', async () => {
        const { status, data } = await request('GET', '/time', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.services !== undefined, 'Services field missing');
        assert(Array.isArray(data.services), 'Services should be an array');
    }),

    test('POST /service/:service - creates root service', async () => {
        const { status } = await request('POST', '/service/app1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 201, `Expected status 201, got ${status}`);
    }),

    test('POST /service/:service - returns 409 for existing service', async () => {
        const { status } = await request('POST', '/service/app1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 409, `Expected status 409, got ${status}`);
    }),

    test('GET /time/:service - returns time for existing service', async () => {
        const { status, data } = await request('GET', '/time/app1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time === '0', 'Initial time should be 0');
    }),

    test('POST /service/:service/* - creates nested service', async () => {
        const { status } = await request('POST', '/service/app1/category1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 201, `Expected status 201, got ${status}`);
    }),

    test('POST /service/:service/* - returns 404 if parent does not exist', async () => {
        const { status, data } = await request('POST', '/service/nonexistent/child', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assert(data.error === 'parent service does not exist', 'Error message mismatch');
    }),

    test('GET /time/:service/* - returns time for nested service', async () => {
        const { status, data } = await request('GET', '/time/app1/category1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time === '0', 'Initial time should be 0');
    }),

    test('GET /tree/:service - returns service tree', async () => {
        const { status, data } = await request('GET', '/tree/app1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.service === 'app1', 'Service name mismatch');
        assert(Array.isArray(data.children), 'Children should be an array');
    }),

    test('PUT /service/:service/* - renames nested service', async () => {
        const { status } = await request('PUT', '/service/app1/category1', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 'category2' }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
    }),

    test('GET /time/:service/* - old name returns 404 after rename', async () => {
        const { status } = await request('GET', '/time/app1/category1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
    }),

    test('GET /time/:service/* - new name returns time after rename', async () => {
        const { status } = await request('GET', '/time/app1/category2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
    }),

    test('DELETE /service/:service/* - deletes nested service', async () => {
        const { status } = await request('DELETE', '/service/app1/category2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
    }),

    test('DELETE /service/:service - deletes root service and all children', async () => {
        const { status } = await request('DELETE', '/service/app1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
    }),

    test('GET /invalid - returns 404 for invalid endpoint', async () => {
        const { status } = await request('GET', '/invalid');
        assert(status === 404, `Expected status 404, got ${status}`);
    }),

    test('WebSocket /ws/track - tracks deeply nested service', async () => {
        await request('POST', '/service/app2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/app2/cat1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/app2/cat1/subcat1', {
            headers: { Authorization: AUTH_HEADER() }
        });

        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|app2/cat1/subcat1`);
        await wait(100);
        assert(messages.includes('ok'), 'Expected ok message');
        
        ws.send('+');
        ws.send('+');
        await wait(100);
        
        const subcat = await request('GET', '/time/app2/cat1/subcat1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const cat = await request('GET', '/time/app2/cat1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const app = await request('GET', '/time/app2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        assert(subcat.data.time === '2', `Expected subcat time to be 2, got ${subcat.data.time}`);
        assert(cat.data.time === '2', `Expected cat time to be 2, got ${cat.data.time}`);
        assert(app.data.time === '2', `Expected app time to be 2, got ${app.data.time}`);
        
        ws.close();
        
        await request('DELETE', '/service/app2', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('GET /time - returns 401 without auth', async () => {
        const { status } = await request('GET', '/time');
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('GET /time/:service - returns 401 without auth', async () => {
        const { status } = await request('GET', '/time/someservice');
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('GET /tree/:service - returns 401 without auth', async () => {
        const { status } = await request('GET', '/tree/someservice');
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('POST /service/:service - returns 401 without auth', async () => {
        const { status } = await request('POST', '/service/noauth');
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('PUT /service/:service - returns 401 without auth', async () => {
        const { status } = await request('PUT', '/service/noauth', {
            body: { new_name: 'newname' }
        });
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('DELETE /service/:service - returns 401 without auth', async () => {
        const { status } = await request('DELETE', '/service/noauth');
        assert(status === 401, `Expected status 401, got ${status}`);
    }),

    test('GET /time/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('GET', '/time/doesnotexist', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assert(data.error === 'service does not exist', 'Error message mismatch');
    }),

    test('GET /tree/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('GET', '/tree/doesnotexist', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assert(data.error === 'service does not exist', 'Error message mismatch');
    }),

    test('PUT /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('PUT', '/service/doesnotexist', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 'newname' }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assert(data.error === 'service does not exist', 'Error message mismatch');
    }),

    test('DELETE /service/:service - returns 404 for non-existent service', async () => {
        const { status, data } = await request('DELETE', '/service/doesnotexist', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 404, `Expected status 404, got ${status}`);
        assert(data.error === 'service does not exist', 'Error message mismatch');
    }),

    test('PUT /service/:service - returns 400 without new_name', async () => {
        await request('POST', '/service/badrename', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status, data } = await request('PUT', '/service/badrename', {
            headers: { Authorization: AUTH_HEADER() },
            body: {}
        });
        assert(status === 400, `Expected status 400, got ${status}`);
        assert(data.error === 'new_name is required', 'Error message mismatch');
        await request('DELETE', '/service/badrename', {
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

    test('POST /service/:service/* - creates deeply nested services', async () => {
        await request('POST', '/service/deep1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/deep1/level2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/deep1/level2/level3', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/deep1/level2/level3/level4', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { status, data } = await request('GET', '/time/deep1/level2/level3/level4', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.time === '0', 'Initial time should be 0');
        
        const { data: tree } = await request('GET', '/tree/deep1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(tree.children.length > 0, 'Root should have children');
        assert(tree.children[0].children.length > 0, 'Level 2 should have children');
        
        await request('DELETE', '/service/deep1', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('DELETE /service/:service - deletes service with nested children', async () => {
        await request('POST', '/service/parent', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/parent/child1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/parent/child2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { status } = await request('DELETE', '/service/parent', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        
        const { status: status1 } = await request('GET', '/time/parent', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status: status2 } = await request('GET', '/time/parent/child1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status1 === 404, 'Parent should be deleted');
        assert(status2 === 404, 'Children should be deleted');
    }),

    test('GET /tree/:service - returns correct tree structure', async () => {
        await request('POST', '/service/treetest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/treetest/branch1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/treetest/branch2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { status, data } = await request('GET', '/tree/treetest', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        assert(data.service === 'treetest', 'Service name should match');
        assert(data.time === '0', 'Time should be 0');
        assert(Array.isArray(data.children), 'Children should be array');
        assert(data.children.length === 2, `Expected 2 children, got ${data.children.length}`);
        
        await request('DELETE', '/service/treetest', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('PUT /service/:service/* - renames deeply nested service', async () => {
        await request('POST', '/service/rename1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/rename1/sub1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/rename1/sub1/subsub1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { status } = await request('PUT', '/service/rename1/sub1/subsub1', {
            headers: { Authorization: AUTH_HEADER() },
            body: { new_name: 'subsub2' }
        });
        assert(status === 200, `Expected status 200, got ${status}`);
        
        const { status: oldStatus } = await request('GET', '/time/rename1/sub1/subsub1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        const { status: newStatus } = await request('GET', '/time/rename1/sub1/subsub2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(oldStatus === 404, 'Old name should return 404');
        assert(newStatus === 200, 'New name should return 200');
        
        await request('DELETE', '/service/rename1', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('POST /service/:service/* - handles multiple siblings', async () => {
        await request('POST', '/service/siblings', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/siblings/child1', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/siblings/child2', {
            headers: { Authorization: AUTH_HEADER() }
        });
        await request('POST', '/service/siblings/child3', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { data } = await request('GET', '/tree/siblings', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(data.children.length === 3, `Expected 3 children, got ${data.children.length}`);
        
        const childNames = data.children.map(c => c.service).sort();
        assertDeepEqual(childNames, ['child1', 'child2', 'child3'], 'Children names mismatch');
        
        await request('DELETE', '/service/siblings', {
            headers: { Authorization: AUTH_HEADER() }
        });
    }),

    test('WebSocket /ws/track - rejects unauthorized connection', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send('wrong:credentials|service');
        await wait(100);
        assert(messages.includes('unauthorized'), 'Expected unauthorized message');
        ws.close();
    }),

    test('WebSocket /ws/track - rejects non-existent service', async () => {
        const { ws, messages } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|nonexistent/service`);
        await wait(100);
        assert(messages.includes('non-existant service'), 'Expected non-existant service message');
        ws.close();
    }),

    test('WebSocket /ws/track - ignores invalid messages after auth', async () => {
        await request('POST', '/service/wsignore', {
            headers: { Authorization: AUTH_HEADER() }
        });
        
        const { ws } = await connectWebSocket('/ws/track');
        ws.send(`${USERNAME}:${PASSWORD}|wsignore`);
        await wait(100);
        
        ws.send('invalid');
        ws.send('++');
        ws.send('');
        await wait(100);
        
        const { data } = await request('GET', '/time/wsignore', {
            headers: { Authorization: AUTH_HEADER() }
        });
        assert(data.time === '0', 'Time should not change with invalid messages');
        
        ws.close();
        await request('DELETE', '/service/wsignore', {
            headers: { Authorization: AUTH_HEADER() }
        });
    })
];

checkServer(API_BASE).then(() => runTests(v2Tests));
