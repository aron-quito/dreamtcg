import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'dreamtcg.db'));

// Initialize Database Schema
export const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      attribute TEXT NOT NULL,
      level INTEGER,
      atk INTEGER,
      def INTEGER,
      description TEXT,
      effects TEXT NOT NULL, -- JSON Stringified AST
      is_custom BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database initialized: cards table is ready.');
};

export default db;
