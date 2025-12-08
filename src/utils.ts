import { existsSync, readFileSync, writeFileSync } from 'fs';

export const USERNAME = process.env.FT_USERNAME || 'user';
export const PASSWORD = process.env.FT_PASSWORD || 'passwd';

export const PORT = process.env.PORT || 3000;

export const API_BASE = '/api';
export const API_VERSION = '/v1';
export const API_PREFIX = `${API_BASE}${API_VERSION}`;

export function buildPath(path: string): string {
    return `${API_PREFIX}${path}`;
}

export function decodeBasicAuth(header: string): { 
    username: string; 
    password: string 
} | null {
    try {
        const b64Creds = header.replace('Basic ', '');
        const creds = Buffer.from(b64Creds, 'base64').toString('utf-8');

        const [username, password] = creds.split(' ');
        return { username, password };
    } catch {
        return null;
    }
}

export function isAuthenticated(header: string | undefined): boolean {
    if (!header) return false;

    const creds = decodeBasicAuth(header);
    return creds?.username === USERNAME && creds?.password === PASSWORD;
}

/*
{
    "service": "unix timestamp"
}
*/
export class DB {
    private filePath: string;

    constructor() {
        this.filePath = process.env.FT_DB || 'db.json';

        if (!existsSync(this.filePath)) {
            writeFileSync(this.filePath, JSON.stringify({}, null, 2));
        }
    }

    getService(service: string): string | null {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        return data[service] || null;
    }

    createService(service: string): void {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        data[service] = '0';
        writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    updateService(oldName: string, newName: string): void {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[oldName] !== undefined) {
            data[newName] = data[oldName];
            delete data[oldName];
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    deleteService(service: string): void {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[service] !== undefined) {
            delete data[service];
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    incrementTime(service: string): void {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[service] !== undefined) {
            const currentTime = parseInt(data[service]) || 0;
            data[service] = (currentTime + 1).toString();
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    serviceExists(service: string): boolean {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        return data[service] !== undefined;
    }
}
