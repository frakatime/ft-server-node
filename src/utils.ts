import dotenv from 'dotenv';
dotenv.config();

export const USERNAME = process.env.FT_USERNAME || 'user';
export const PASSWORD = process.env.FT_PASSWORD || 'passwd';
export const PORT = process.env.PORT || 3000;
export const VERSION = process.env.FT_VERSION || 'V2';

function decodeBasicAuth(header: string): { 
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
