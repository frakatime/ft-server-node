import type { Request, Response, NextFunction } from 'express';

import dotenv from 'dotenv';
dotenv.config();

import { 
    USERNAME, 
    PASSWORD, 
    PORT, 
    buildPath,
    DB,
    isAuthenticated
} from './utils.js';

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';

const app = express();
app.use(express.json());

const db = new DB();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthenticated(req.headers.authorization)) {
        return res.status(401).json({ status: 'unauthorized' });
    }

    next();
};

app.get(buildPath('/health'), (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get(buildPath('/time/:service'), requireAuth, (req: Request, res: Response) => {
    const { service } = req.params;
    const time = db.getService(service);
    
    if (time === null) {
        return res.status(404).json({
            status: 'not found',
            error: 'service does not exist'
        });
    }
    
    res.status(200).json({ time });
});

app.post(buildPath('/service/:service'), requireAuth, (req: Request, res: Response) => {
    const { service } = req.params;
    
    if (db.serviceExists(service)) {
        return res.status(409).json({
            status: 'conflict',
            error: 'service already exists'
        });
    }
    
    db.createService(service);
    res.status(201).json({ status: 'created' });
});

app.put(buildPath('/service/:service'), requireAuth, (req: Request, res: Response) => {
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
});

app.delete(buildPath('/service/:service'), requireAuth, (req: Request, res: Response) => {
    const { service } = req.params;
    
    if (!db.serviceExists(service)) {
        return res.status(404).json({
            status: 'not found',
            error: 'service does not exist'
        });
    }
    
    db.deleteService(service);
    res.status(200).json({ status: 'ok' });
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({ status: 'not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'internal server error',
        error: err.stack
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocketServer({ server, path: buildPath('/ws/track') });

wss.on('connection', (ws: WebSocket) => {
    let authenticated = false;
    let currentService: string | null = null;
    let trackingInterval: NodeJS.Timeout | null = null;

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

    ws.on('close', () => {
        if (trackingInterval) {
            clearInterval(trackingInterval);
        }
    });

    ws.on('error', (err) => {
        console.error('WS error:', err);

        if (trackingInterval) {
            clearInterval(trackingInterval);
        }
    });
});
