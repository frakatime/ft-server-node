import Database from 'better-sqlite3';

export class DBV1 {
    private db: Database.Database;

    constructor() {
        const dbPath = process.env.FT_DB || 'frakatime.db';
        this.db = new Database(dbPath);
        this.initDatabase();
    }

    private initDatabase(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS services_v1 (
                service TEXT PRIMARY KEY,
                time INTEGER NOT NULL DEFAULT 0
            )
        `);
    }

    getService(service: string): string | null {
        const row = this.db.prepare('SELECT time FROM services_v1 WHERE service = ?').get(service) as { time: number } | undefined;
        return row ? row.time.toString() : null;
    }

    createService(service: string): void {
        this.db.prepare('INSERT INTO services_v1 (service, time) VALUES (?, 0)').run(service);
    }

    updateService(oldName: string, newName: string): void {
        this.db.prepare('UPDATE services_v1 SET service = ? WHERE service = ?').run(newName, oldName);
    }

    deleteService(service: string): void {
        this.db.prepare('DELETE FROM services_v1 WHERE service = ?').run(service);
    }

    incrementTime(service: string): void {
        this.db.prepare('UPDATE services_v1 SET time = time + 1 WHERE service = ?').run(service);
    }

    serviceExists(service: string): boolean {
        const row = this.db.prepare('SELECT 1 FROM services_v1 WHERE service = ?').get(service);
        return row !== undefined;
    }
}
