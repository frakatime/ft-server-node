import Database from 'better-sqlite3';

interface ServiceNode {
    service: string;
    time: string;
    children: ServiceNode[];
}

export class DBV2 {
    private db: Database.Database;

    constructor() {
        const dbPath = process.env.FT_DB || 'frakatime.db';
        this.db = new Database(dbPath);
        this.initDatabase();
    }

    private initDatabase(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS services_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                service TEXT NOT NULL,
                time INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_path ON services_v2(path);
        `);
    }

    private pathToString(path: string[]): string {
        return '/' + path.join('/');
    }

    private buildTree(rows: Array<{ path: string; service: string; time: number }>): ServiceNode[] {
        const rootNodes: ServiceNode[] = [];
        const nodeMap = new Map<string, ServiceNode>();
        const sortedRows = rows.sort((a, b) => {
            const depthA = a.path.split('/').length;
            const depthB = b.path.split('/').length;
            return depthA - depthB;
        });

        for (const row of sortedRows) {
            const node: ServiceNode = {
                service: row.service,
                time: row.time.toString(),
                children: []
            };

            nodeMap.set(row.path, node);
            const pathParts = row.path.split('/').filter(p => p);

            if (pathParts.length === 1) {
                rootNodes.push(node);
            } else {
                const parentPath = '/' + pathParts.slice(0, -1).join('/');
                const parent = nodeMap.get(parentPath);

                if (parent) {
                    parent.children.push(node);
                }
            }
        }

        return rootNodes;
    }

    getTime(path: string[]): string | null {
        const pathStr = this.pathToString(path);
        const row = this.db.prepare('SELECT time FROM services_v2 WHERE path = ?').get(pathStr) as { time: number } | undefined;
        return row ? row.time.toString() : null;
    }

    getTimeTree(): ServiceNode[] {
        const rows = this.db.prepare('SELECT path, service, time FROM services_v2').all() as Array<{ path: string; service: string; time: number }>;
        return this.buildTree(rows);
    }

    getServiceTree(path: string[]): ServiceNode | null {
        const pathStr = this.pathToString(path);
        const pathPrefix = pathStr + '/';
        
        const rows = this.db.prepare(`
            SELECT path, service, time FROM services_v2 
            WHERE path = ? OR path LIKE ?
        `).all(pathStr, pathPrefix + '%') as Array<{ path: string; service: string; time: number }>;
        
        if (rows.length === 0) return null;
        
        const tree = this.buildTree(rows);
        return tree[0] || null;
    }

    serviceExists(path: string[]): boolean {
        const pathStr = this.pathToString(path);
        const row = this.db.prepare('SELECT 1 FROM services_v2 WHERE path = ?').get(pathStr);
        return row !== undefined;
    }

    createService(path: string[]): boolean {
        if (path.length === 0) return false;

        const pathStr = this.pathToString(path);
        const serviceName = path[path.length - 1];
        
        if (path.length > 1) {
            const parentPath = this.pathToString(path.slice(0, -1));
            const parentExists = this.db.prepare('SELECT 1 FROM services_v2 WHERE path = ?').get(parentPath);
            if (!parentExists) return false;
        }

        const exists = this.db.prepare('SELECT 1 FROM services_v2 WHERE path = ?').get(pathStr);
        if (exists) return false;

        this.db.prepare('INSERT INTO services_v2 (path, service, time) VALUES (?, ?, 0)').run(pathStr, serviceName);
        return true;
    }

    renameService(path: string[], newName: string): boolean {
        if (path.length === 0 || !newName) return false;

        const pathStr = this.pathToString(path);
        const parentPath = path.slice(0, -1);
        const newPath = this.pathToString([...parentPath, newName]);
        const exists = this.db.prepare('SELECT 1 FROM services_v2 WHERE path = ?').get(pathStr);

        if (!exists) return false;

        const transaction = this.db.transaction(() => {
            const pathPrefix = pathStr + '/';
            const descendants = this.db.prepare('SELECT path FROM services_v2 WHERE path LIKE ?').all(pathPrefix + '%') as Array<{ path: string }>;
            
            for (const desc of descendants) {
                const newDescPath = desc.path.replace(pathStr, newPath);
                this.db.prepare('UPDATE services_v2 SET path = ? WHERE path = ?').run(newDescPath, desc.path);
            }
            
            this.db.prepare('UPDATE services_v2 SET path = ?, service = ? WHERE path = ?').run(newPath, newName, pathStr);
        });

        transaction();
        return true;
    }

    deleteService(path: string[]): boolean {
        if (path.length === 0) return false;

        const pathStr = this.pathToString(path);
        const exists = this.db.prepare('SELECT 1 FROM services_v2 WHERE path = ?').get(pathStr);

        if (!exists) return false;

        const pathPrefix = pathStr + '/';
        this.db.prepare('DELETE FROM services_v2 WHERE path = ? OR path LIKE ?').run(pathStr, pathPrefix + '%');
        
        return true;
    }

    incrementTime(path: string[]): boolean {
        if (path.length === 0) return false;

        const transaction = this.db.transaction(() => {
            for (let i = 1; i <= path.length; i++) {
                const subPath = this.pathToString(path.slice(0, i));
                this.db.prepare('UPDATE services_v2 SET time = time + 1 WHERE path = ?').run(subPath);
            }
        });

        transaction();
        return true;
    }
}
