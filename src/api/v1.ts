import type { DBV1 } from '../db/v1.js';
import type { Request, Response, NextFunction, Express } from 'express';
import { USERNAME, PASSWORD, isAuthenticated } from '../utils.js';
import { WebSocketServer, WebSocket } from 'ws';

export function registerV1Routes(app: Express, db: DBV1, server: any) {
    const API_PREFIX = '/api/v1';

    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
        if (!isAuthenticated(req.headers.authorization)) {
            return res.status(401).json({ status: 'unauthorized' });
        }
        next();

    };

    app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get(
        `${API_PREFIX}/time/:service`,
        requireAuth,
        (req: Request, res: Response) => {
            const { service } = req.params;
            const time = db.getService(service);

            if (time === null) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }

            res.status(200).json({ time });
        }
    );

    app.post(
        `${API_PREFIX}/service/:service`,
        requireAuth,
        (req: Request, res: Response) => {
            const { service } = req.params;

            if (db.serviceExists(service)) {
                return res.status(409).json({
                    status: 'conflict',
                    error: 'service already exists'
                });
            }

            db.createService(service);
            res.status(201).json({ status: 'created' });
        }
    );

    app.put(
        `${API_PREFIX}/service/:service`,
        requireAuth,
        (req: Request, res: Response) => {
            const { service } = req.params;
            const { new_name } = req.body;

            if (!new_name || typeof new_name !== 'string') {
                return res.status(400).json({
                    status: 'bad request',
                    error: 'new_name is required'
                });
            }

            if (!db.serviceExists(service)) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }

            db.updateService(service, new_name);
            res.status(200).json({ status: 'ok' });
        }
    );

    app.delete(
        `${API_PREFIX}/service/:service`,
        requireAuth,
        (req: Request, res: Response) => {
            const { service } = req.params;

            if (!db.serviceExists(service)) {
                return res.status(404).json({
                    status: 'not found',
                    error: 'service does not exist'
                });
            }

            db.deleteService(service);
            res.status(200).json({ status: 'ok' });
        }
    );

    const wss = new WebSocketServer({ server, path: `${API_PREFIX}/ws/track` });

    wss.on('connection', (ws: WebSocket) => {
        let authenticated = false;
        let currentService: string | null = null;

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

                    if (!db.serviceExists(service)) {
                        ws.send('non-existant service');
                        ws.close();

                        return;
                    }

                    authenticated = true;
                    currentService = service;

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
