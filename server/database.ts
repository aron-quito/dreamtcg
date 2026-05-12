import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'dreamtcg.db'));

// Initialize Database Schema
export const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT DEFAULT 'OFFLINE',
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      user_email TEXT DEFAULT 'public',
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
      user_email TEXT DEFAULT 'public',
      name TEXT NOT NULL,
      main_cards TEXT NOT NULL, -- JSON Stringified Array of Card IDs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      host_email TEXT NOT NULL,
      guest_email TEXT,
      host_deck_id TEXT,
      guest_deck_id TEXT,
      host_ready BOOLEAN DEFAULT 0,
      guest_ready BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'LOBBY', -- LOBBY, RPS, DUELING, FINISHED
      host_choice TEXT,            -- ROCK, PAPER, SCISSORS
      guest_choice TEXT,           -- ROCK, PAPER, SCISSORS
      turn_order_decider TEXT,     -- Email of player who decides turn order
      winner_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations
  const migrations = [
    'ALTER TABLE cards ADD COLUMN image TEXT',
    'ALTER TABLE cards ADD COLUMN is_public BOOLEAN DEFAULT 1',
    'ALTER TABLE cards ADD COLUMN limit_count INTEGER DEFAULT 3',
    'ALTER TABLE cards ADD COLUMN user_email TEXT DEFAULT \'public\'',
    'ALTER TABLE decks ADD COLUMN user_email TEXT DEFAULT \'public\'',
    'ALTER TABLE rooms ADD COLUMN guest_choice TEXT',
    'ALTER TABLE rooms ADD COLUMN turn_order_decider TEXT',
    'ALTER TABLE rooms ADD COLUMN game_state TEXT',
    'ALTER TABLE rooms ADD COLUMN spectator1_email TEXT',
    'ALTER TABLE rooms ADD COLUMN spectator2_email TEXT',
    'ALTER TABLE rooms ADD COLUMN player1_email TEXT',
    'ALTER TABLE rooms ADD COLUMN player2_email TEXT',
    'ALTER TABLE rooms ADD COLUMN turn_order INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'OFFLINE\'',
    'ALTER TABLE users ADD COLUMN last_seen_at DATETIME'
  ];

  migrations.forEach(m => {
    try { db.prepare(m).run(); } catch (e) {}
  });

  // NUCLEAR REPAIR: Ensure these columns exist no matter what
  const nuclearColumns = [
    { table: 'users', column: 'status', type: 'TEXT DEFAULT \'OFFLINE\'' },
    { table: 'users', column: 'last_seen_at', type: 'DATETIME' },
    { table: 'rooms', column: 'spectator1_email', type: 'TEXT' },
    { table: 'rooms', column: 'spectator2_email', type: 'TEXT' },
    { table: 'rooms', column: 'player1_email', type: 'TEXT' },
    { table: 'rooms', column: 'player2_email', type: 'TEXT' },
    { table: 'rooms', column: 'turn_order', type: 'INTEGER' },
    { table: 'rooms', column: 'game_state', type: 'TEXT' },
    { table: 'rooms', column: 'updated_at', type: 'DATETIME' }
  ];

  nuclearColumns.forEach(c => {
    try {
      db.exec(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`);
    } catch (e) {}
  });

  // Manually backfill CURRENT_TIMESTAMP since SQLite ALTER TABLE doesn't allow it
  try { db.exec("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE last_seen_at IS NULL"); } catch (e) {}
  try { db.exec("UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"); } catch (e) {}

  // Seed Initial Cards if empty
  const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
  if (cardCount.count === 0) {
    const initialCards = [
      {
        id: 'base_01',
        name: 'Dream Weaver',
        type: 'MONSTER',
        level: 4,
        atk: 1800,
        def: 1200,
        attribute: 'LIGHT',
        description: 'When summoned, draw 2 cards by paying 500 LP.',
        effects: JSON.stringify([
          {
            id: 'eff_01',
            name: 'Visionary Reach',
            restriction: { locations: ['MONSTER_ZONE'], frequency: 'ONCE_PER_TURN' },
            trigger: { type: 'ON_SUMMON' },
            costs: [{ action: 'PAY_LP', params: { n: 500 } }],
            resolutions: [{ action: 'DRAW', params: { n: 2 } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        user_email: 'public'
      },
      {
        id: 'base_02',
        name: 'Nightmare Shade',
        type: 'MONSTER',
        level: 4,
        atk: 1500,
        def: 1500,
        attribute: 'DARK',
        description: 'Any time: Banish 1 card from opponent GY.',
        effects: JSON.stringify([
          {
            id: 'eff_02',
            name: 'Shadow Banish',
            restriction: { locations: ['MONSTER_ZONE'], frequency: 'UNLIMITED' },
            trigger: { type: 'ANY_TIME' },
            costs: [],
            resolutions: [{ action: 'BANISH_CARD', params: { target: 'OPPONENT_GY' } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        user_email: 'public'
      }
    ];

    const insert = db.prepare(`
      INSERT INTO cards (id, name, type, level, atk, def, attribute, description, effects, is_custom, is_public, user_email)
      VALUES (@id, @name, @type, @level, @atk, @def, @attribute, @description, @effects, @is_custom, @is_public, @user_email)
    `);

    for (const card of initialCards) {
      insert.run(card);
    }
    console.log('Database seeded with initial cards.');
  }

  // --- CLEAN START PROTOCOL ---
  try {
    // 1. Reset all users to OFFLINE
    db.prepare("UPDATE users SET status = 'OFFLINE'").run();
    // 2. Clear all rooms (Re-synchronization required after restart)
    db.prepare("DELETE FROM rooms").run();
    // 3. Log server restart
    db.prepare("INSERT INTO user_logs (user_email, action, metadata) VALUES ('SYSTEM', 'SERVER_RESTART', 'All sessions and rooms cleared')").run();
    console.log('[SYSTEM] Clean start protocol executed: All rooms cleared and users set to OFFLINE.');
  } catch (error) {
    console.error('[SYSTEM] Error during clean start protocol:', error);
  }

  console.log('Database initialized: Users, Cards and Decks tables are ready.');
};

export default db;
