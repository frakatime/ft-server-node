import { existsSync, readFileSync, writeFileSync } from 'fs';

interface ServiceNode {
    service: string;
    time: string;
    children: ServiceNode[];
}

interface DBData {
    services: ServiceNode[];
}

export class DBV2 {
    private filePath: string;

    constructor() {
        this.filePath = process.env.FT_DB || 'db.json';
        this.ensureFileExists();
    }

    private ensureFileExists(): void {
        if (!existsSync(this.filePath)) {
            const initialData: DBData = { services: [] };
            writeFileSync(this.filePath, JSON.stringify(initialData, null, 2));
        }
    }

    private getData(): DBData {
        this.ensureFileExists();
        const content = readFileSync(this.filePath, 'utf-8');

        try {
            return JSON.parse(content);
        } catch {
            return { services: [] };
        }
    }

    private saveData(data: DBData): void {
        writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    private navigateToNode(path: string[]): ServiceNode | null {
        if (path.length === 0) return null;
        
        let current: ServiceNode[] = this.getData().services;
        let targetNode: ServiceNode | null = null;

        for (const part of path) {
            const found = current.find(s => s.service === part);

            if (!found) return null;
            targetNode = found;
            current = found.children || [];
        }

        return targetNode;
    }

    getTime(path: string[]): string | null {
        const node = this.navigateToNode(path);
        return node?.time ?? null;
    }

    getTimeTree(): ServiceNode[] {
        const data = this.getData();
        return data.services;
    }

    getServiceTree(path: string[]): ServiceNode | null {
        return this.navigateToNode(path);
    }

    serviceExists(path: string[]): boolean {
        return this.navigateToNode(path) !== null;
    }

    createService(path: string[]): boolean {
        if (path.length === 0) return false;

        const data = this.getData();
        const serviceName = path[path.length - 1];
        const parentPath = path.slice(0, -1);

        if (parentPath.length === 0) {
            const exists = data.services.find(s => s.service === serviceName);
            if (exists) return false;

            data.services.push({
                service: serviceName,
                time: '0',
                children: []
            });

            this.saveData(data);
            return true;
        }

        let current: ServiceNode[] = data.services;

        for (const part of parentPath) {
            const found = current.find(s => s.service === part);

            if (!found) return false;
            if (!found.children) found.children = [];

            current = found.children;
        }

        const exists = current.find(s => s.service === serviceName);
        if (exists) return false;

        current.push({
            service: serviceName,
            time: '0',
            children: []
        });

        this.saveData(data);
        return true;
    }

    renameService(path: string[], newName: string): boolean {
        if (path.length === 0 || !newName) return false;

        const data = this.getData();
        const serviceName = path[path.length - 1];
        const parentPath = path.slice(0, -1);

        let current: ServiceNode[] = data.services;

        for (const part of parentPath) {
            const found = current.find(s => s.service === part);

            if (!found) return false;
            if (!found.children) found.children = [];

            current = found.children;
        }

        const service = current.find(s => s.service === serviceName);
        if (!service) return false;

        service.service = newName;
        this.saveData(data);

        return true;
    }

    deleteService(path: string[]): boolean {
        if (path.length === 0) return false;

        const data = this.getData();
        const serviceName = path[path.length - 1];
        const parentPath = path.slice(0, -1);

        if (parentPath.length === 0) {
            const index = data.services.findIndex(s => s.service === serviceName);
            if (index === -1) return false;

            data.services.splice(index, 1);
            this.saveData(data);

            return true;
        }

        let current: ServiceNode[] = data.services;

        for (const part of parentPath) {
            const found = current.find(s => s.service === part);
            if (!found) return false;

            if (!found.children) found.children = [];
            current = found.children;
        }

        const index = current.findIndex(s => s.service === serviceName);
        if (index === -1) return false;

        current.splice(index, 1);
        this.saveData(data);

        return true;
    }


    incrementTime(path: string[]): boolean {
        if (path.length === 0) return false;
        const data = this.getData();

        let current: ServiceNode[] = data.services;
        const nodes: ServiceNode[] = [];

        for (const part of path) {
            const found = current.find(s => s.service === part);
            if (!found) return false;

            nodes.push(found);
            current = found.children || [];
        }

        for (const node of nodes) {
            const currentTime = parseInt(node.time) || 0;
            node.time = (currentTime + 1).toString();
        }

        this.saveData(data);
        return true;
    }
}
