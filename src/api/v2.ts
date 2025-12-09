import type { Request, Response, NextFunction, Express } from 'express';
import { USERNAME, PASSWORD, isAuthenticated } from '../utils.js';
import { DBV2 } from '../db/v2.js';
import { WebSocketServer, WebSocket } from 'ws';

export function registerV2Routes(app: Express, db: DBV2, server: any) {
    const API_PREFIX = '/api/v2';

    const parseServicePath = (pathPrefix: string, reqPath: string): string[] => {
        const afterPrefix = reqPath.substring(pathPrefix.length);
        
        if (!afterPrefix) {
            return [];
        }
        
        return decodeURIComponent(afterPrefix).split('/').filter(p => p);
    };

    app.use(API_PREFIX, (req: Request, res: Response, next: NextFunction) => {
        const path = req.path;

        if (req.method === 'GET' && path === '/health') {
            return res.status(200).json({ status: 'ok' });
        }

        const isKnownRoute = 
            path === '/time' ||
            path.startsWith('/time/') ||
            path.startsWith('/tree/') ||
            path.startsWith('/service/');

        if (isKnownRoute && !isAuthenticated(req.headers.authorization)) {
            return res.status(401).json({ status: 'unauthorized' });
        }

        if (!isKnownRoute) {
            return next();
        }

        if (req.method === 'GET' && path === '/time') {
            const services = db.getTimeTree();
            return res.status(200).json({ services });
        }

        if (req.method === 'GET' && path.startsWith('/time/')) {
            const servicePath = parseServicePath('/time/', path);
            const time = db.getTime(servicePath);
            
            if (time === null) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }
            
            return res.status(200).json({ time });
        }

        if (req.method === 'GET' && path.startsWith('/tree/')) {
            const servicePath = parseServicePath('/tree/', path);
            
            if (servicePath.length === 0) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service path required'
                });
            }
            
            const tree = db.getServiceTree(servicePath);
            
            if (tree === null) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }
            
            return res.status(200).json(tree);
        }

        if (req.method === 'POST' && path.startsWith('/service/')) {
            const servicePath = parseServicePath('/service/', path);
            
            if (servicePath.length === 0) {
                return res.status(400).json({
                    status: 'bad request',
                    error: 'service path required'
                });
            }
            
            const created = db.createService(servicePath);
            
            if (!created) {
                if (servicePath.length > 1 && !db.serviceExists(servicePath.slice(0, -1))) {
                    return res.status(404).json({
                        status: 'not found',
                        error: 'parent service does not exist'
                    });
                }
                
                return res.status(409).json({
                    status: 'conflict',
                    error: 'service already exists'
                });
            }
            
            return res.status(201).json({ status: 'created' });
        }

        if (req.method === 'PUT' && path.startsWith('/service/')) {
            const { new_name } = req.body;
            
            if (!new_name || typeof new_name !== 'string') {
                return res.status(400).json({
                    status: 'bad request',
                    error: 'new_name is required'
                });
            }
            
            const servicePath = parseServicePath('/service/', path);
            
            if (servicePath.length === 0) {
                return res.status(400).json({
                    status: 'bad request',
                    error: 'service path required'
                });
            }
            
            const renamed = db.renameService(servicePath, new_name);
            
            if (!renamed) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }
            
            return res.status(200).json({ status: 'ok' });
        }

        if (req.method === 'DELETE' && path.startsWith('/service/')) {
            const servicePath = parseServicePath('/service/', path);
            
            if (servicePath.length === 0) {
                return res.status(400).json({
                    status: 'bad request',
                    error: 'service path required'
                });
            }
            
            const deleted = db.deleteService(servicePath);
            
            if (!deleted) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }
            
            return res.status(200).json({ status: 'ok' });
        }

        next();
    });

    const wss = new WebSocketServer({ server, path: `${API_PREFIX}/ws/track` });

    wss.on('connection', (ws: WebSocket) => {
        let authenticated = false;
        let currentService: string[] | null = null;

        ws.on('message', (message: Buffer) => {
            const msg = message.toString();

            if (!authenticated) {
                try {
                    const [credentials, service] = msg.split('|');

                    if (!credentials || !service) {
                        ws.send('unauthorized');
                        ws.close();
                        return;
                    }

                    const [username, password] = credentials.split(':');

                    if (username !== USERNAME || password !== PASSWORD) {
                        ws.send('unauthorized');
                        ws.close();

                        return;
                    }

                    const path = service.split('/').filter(p => p);
                    if (!db.serviceExists(path)) {
                        ws.send('non-existant service');
                        ws.close();

                        return;
                    }

                    authenticated = true;
                    currentService = path;

                    ws.send('ok');
                } catch {
                    ws.send('unauthorized');
                    ws.close();
                }

                return;
            }

            if (msg === '+' && currentService) {
                db.incrementTime(currentService);
            }
        });

        ws.on('error', (err) => {
            console.error('WS error:', err);
        });
    });
}
