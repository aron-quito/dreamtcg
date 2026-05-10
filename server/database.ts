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
      image TEXT,            -- Base64 Art
      is_custom BOOLEAN DEFAULT 1,
      is_public BOOLEAN DEFAULT 1,
      limit_count INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      main_cards TEXT NOT NULL, -- JSON Stringified Array of Card IDs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations
  try {
    db.prepare('ALTER TABLE cards ADD COLUMN image TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE cards ADD COLUMN is_public BOOLEAN DEFAULT 1').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE cards ADD COLUMN limit_count INTEGER DEFAULT 3').run();
  } catch (e) {}
  console.log('Database initialized: cards table is ready.');
};

export default db;
