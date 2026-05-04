import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { settings } from './schema.js';

export class SettingsRepository {
  constructor(private db: BetterSQLite3Database) {}

  async get(key: string, defaultValue?: string): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .all();
    if (rows.length > 0) return rows[0].value;
    return defaultValue ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = await this.get(key);
    if (existing !== null) {
      await this.db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await this.db.insert(settings).values({ key, value });
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(settings).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(settings).where(eq(settings.key, key));
  }
}
