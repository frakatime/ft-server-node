import { existsSync, readFileSync, writeFileSync } from 'fs';


export class DBV1 {
    private filePath: string;

    constructor() {
        this.filePath = process.env.FT_DB || 'db.json';
        this.ensureFileExists();
    }

    private ensureFileExists(): void {
        if (!existsSync(this.filePath)) {
            writeFileSync(this.filePath, JSON.stringify({}, null, 2));
        }
    }

    getService(service: string): string | null {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        return data[service] || null;
    }

    createService(service: string): void {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        data[service] = '0';
        writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    updateService(oldName: string, newName: string): void {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[oldName] !== undefined) {
            data[newName] = data[oldName];
            delete data[oldName];
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    deleteService(service: string): void {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[service] !== undefined) {
            delete data[service];
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    incrementTime(service: string): void {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));

        if (data[service] !== undefined) {
            const currentTime = parseInt(data[service]) || 0;
            data[service] = (currentTime + 1).toString();
            writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        }
    }

    serviceExists(service: string): boolean {
        this.ensureFileExists();
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        return data[service] !== undefined;
    }
}
