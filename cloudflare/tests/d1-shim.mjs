import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
class Statement {
  constructor(db, sql, args = []) { Object.assign(this, { db, sql, args }); }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.raw.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.raw.prepare(this.sql).all(...this.args) }; }
  async run() {
    const r = this.db.raw.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}
export class D1 {
  constructor({ rateSchema = true } = {}) {
    this.raw = new DatabaseSync(':memory:');
    this.raw.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    if (rateSchema) this.raw.exec(readFileSync(new URL('../migrations/0006_request_rate.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    this.raw.exec('BEGIN');
    try {
      const results = statements.map(s => {
        const q = this.raw.prepare(s.sql);
        if (q.columns().length) return { success: true, results: q.all(...s.args), meta: { changes: 0 } };
        const r = q.run(...s.args);
        return { success: true, results: [], meta: { changes: Number(r.changes) } };
      });
      this.raw.exec('COMMIT');
      return results;
    } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
}
