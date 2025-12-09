import type { Request, Response, NextFunction } from 'express';

import express from 'express';

import { PORT, VERSION } from './utils.js';
import { DBV1 } from './db/v1.js';
import { DBV2 } from './db/v2.js';
import { registerV1Routes } from './api/v1.js';
import { registerV2Routes } from './api/v2.js';

const app = express();
app.use(express.json());

let dbV1: DBV1 | null = null;
let dbV2: DBV2 | null = null;

if (VERSION === 'V1') {
    dbV1 = new DBV1();
} else if (VERSION === 'V2') {
    dbV2 = new DBV2();
} else {
    throw new Error(`Invalid VERSION: ${VERSION}, must be 'V1' or 'V2'`);
}

const server = app.listen(PORT, () => {
    console.log(`Frakatime Server running on port ${PORT} (Version: ${VERSION})`);
});

if (VERSION === 'V1') {
    registerV1Routes(app, dbV1!, server);
    
    app.use('/api/v2', (_req: Request, res: Response) => {
        res.status(501).json({ status: 'not implemented' });
    });
} else if (VERSION === 'V2') {
    registerV2Routes(app, dbV2!, server);
    
    app.use('/api/v1', (_req: Request, res: Response) => {
        res.status(501).json({ status: 'not implemented' });
    });
}

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
