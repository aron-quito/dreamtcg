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
      coins INTEGER DEFAULT 1000,
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
      can_be_ultra BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      user_email TEXT DEFAULT 'public',
      name TEXT NOT NULL,
      main_cards TEXT NOT NULL, -- JSON Stringified Array of Card IDs or Physical Card IDs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS physical_cards (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      quality TEXT NOT NULL, -- 'NORMAL', 'SPECIAL', 'ULTRA'
      durability INTEGER NOT NULL,
      max_durability INTEGER NOT NULL,
      original_owner TEXT DEFAULT 'UNKNOWN',
      serial_number INTEGER,
      win_count INTEGER DEFAULT 0,
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
    'ALTER TABLE rooms ADD COLUMN player2_email TEXT',
    'ALTER TABLE rooms ADD COLUMN turn_order INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'OFFLINE\'',
    'ALTER TABLE users ADD COLUMN last_seen_at DATETIME',
    'ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 1000'
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
    { table: 'rooms', column: 'player2_email', type: 'TEXT' },
    { table: 'rooms', column: 'turn_order', type: 'INTEGER' },
    { table: 'rooms', column: 'game_state', type: 'TEXT' },
    { table: 'rooms', column: 'updated_at', type: 'DATETIME' },
    { table: 'users', column: 'coins', type: 'INTEGER DEFAULT 1000' }
  ];

  nuclearColumns.forEach(c => {
    try {
      db.exec(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`);
    } catch (e) {}
  });

  // Manually backfill CURRENT_TIMESTAMP since SQLite ALTER TABLE doesn't allow it
  try { db.exec("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE last_seen_at IS NULL"); } catch (e) {}
  try { db.exec("UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"); } catch (e) {}

  // Migrations for backward compatibility
  try { db.exec("ALTER TABLE cards ADD COLUMN can_be_ultra BOOLEAN DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE physical_cards ADD COLUMN original_owner TEXT DEFAULT 'UNKNOWN';"); } catch (e) {}
  try { db.exec("ALTER TABLE physical_cards ADD COLUMN serial_number INTEGER;"); } catch (e) {}
  try { db.exec("ALTER TABLE physical_cards ADD COLUMN win_count INTEGER DEFAULT 0;"); } catch (e) {}
  
  // DB is not seeded with JSON AST cards anymore, they are managed via code.

  // --- CLEAN START PROTOCOL ---
  try {
    // 1. Reset all users to OFFLINE
    db.prepare("UPDATE users SET status = 'OFFLINE'").run();
    // 2. Clear all rooms (Re-synchronization required after restart)
    db.prepare("DELETE FROM rooms").run();
    // Seed base cards for the 'admin' user ONLY if cards table is empty
    const initialCards = [
      {
        id: 'base_01',
        name: 'Dream Weaver',
        type: 'MONSTER',
        level: 1,
        atk: 1800,
        def: 1200,
        attribute: 'LIGHT',
        description: 'Dragón obsceno',
        effects: JSON.stringify([
          {
            id: 'eff_01',
            name: 'Visionary Reach',
            restriction: { locations: ['MONSTER_ZONE'], frequency: 'ONCE_PER_TURN', hardOncePerTurn: true },
            trigger: { type: 'ON_SUMMON', params: { selfOnly: true } },
            speed: 1,
            isMandatory: false,
            causaText: "<span class='text-orange-400 font-bold drop-shadow-sm'>Cuando esta carta es Invocada</span>, 1 vez por turno, puedes <span class='text-red-400 font-bold drop-shadow-sm'>pagar 500 LP</span>.",
            efectoText: "Roba 1 carta.",
            costs: [{ action: 'PAY_LP', params: { n: 500 } }],
            resolutions: [{ action: 'DRAW', params: { n: 1 } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 1,
        user_email: 'admin'
      },
      {
        id: 'base_02',
        name: 'Nightmare Shade',
        type: 'MONSTER',
        level: 1,
        atk: 1500,
        def: 1500,
        attribute: 'DARK',
        description: 'Acecha desde las sombras eternas.',
        effects: JSON.stringify([
          {
            id: 'eff_02',
            name: 'Shadow Destroy',
            restriction: { locations: ['MONSTER_ZONE'], frequency: 'UNLIMITED' },
            trigger: { type: 'ANY_TIME' },
            speed: 2,
            isMandatory: false,
            causaText: "<span class='text-cyan-400 font-bold drop-shadow-sm'>(Efecto Rápido)</span>, puedes <span class='text-red-400 font-bold drop-shadow-sm'>descartar 1 carta</span>.",
            efectoText: "Destruye 1 monstruo del oponente.",
            costs: [{ action: 'DISCARD', params: { n: 1, filter: { type: 'carta' } } }],
            resolutions: [{ action: 'DESTROY_ENEMY', params: { n: 1, filter: { type: 'monstruo' } } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 0,
        user_email: 'admin'
      },
      {
        id: 'base_03',
        name: 'Pot of Greed',
        type: 'SPELL',
        level: 0,
        atk: 0,
        def: 0,
        attribute: 'NONE',
        description: 'Olla locasa',
        effects: JSON.stringify([
          {
            id: 'eff_03',
            name: 'Greedy Heal',
            restriction: { locations: ['HAND', 'SPELL_ZONE'], frequency: 'UNLIMITED' },
            trigger: { type: 'ANY_TIME' },
            speed: 2,
            isMandatory: false,
            efectoText: "Recupera 500 LP y roba 1 carta.",
            costs: [],
            resolutions: [
              { action: 'RECOVER_LP', params: { amount: 500 } },
              { action: 'DRAW', params: { n: 1 } }
            ]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 0,
        user_email: 'admin'
      },
      {
        id: 'base_04',
        name: 'Thunder Knight',
        type: 'MONSTER',
        level: 4,
        atk: 1600,
        def: 1200,
        attribute: 'LIGHT',
        description: 'Un caballero invocado por los cielos.',
        effects: JSON.stringify([
          {
            id: 'eff_04',
            name: 'Thunder Draw',
            restriction: { locations: ['MONSTER_ZONE'], frequency: 'UNLIMITED' },
            trigger: { type: 'ON_SUMMON' },
            speed: 1,
            isMandatory: true,
            causaText: "<span class='text-orange-400 font-bold drop-shadow-sm'>Cuando esta carta es Invocada</span>.",
            efectoText: "Roba 1 carta.",
            costs: [],
            resolutions: [{ action: 'DRAW', params: { n: 1 } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 0,
        user_email: 'admin'
      },
      {
        id: 'base_05',
        name: 'Quick Shield',
        type: 'SPELL',
        level: 0,
        atk: 0,
        def: 0,
        attribute: 'NONE',
        description: 'Una barrera mágica instantánea.',
        effects: JSON.stringify([
          {
            id: 'eff_05',
            name: 'Emergency Guard',
            restriction: { locations: ['HAND', 'SPELL_ZONE'], frequency: 'UNLIMITED' },
            trigger: { type: 'ANY_TIME' },
            speed: 2,
            isMandatory: false,
            causaText: "<span class='text-cyan-400 font-bold drop-shadow-sm'>(Efecto Rápido)</span>.",
            efectoText: "Recupera 1000 LP y roba 1 carta.",
            costs: [],
            resolutions: [
              { action: 'RECOVER_LP', params: { amount: 1000 } },
              { action: 'DRAW', params: { n: 1 } }
            ]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 0,
        user_email: 'admin'
      },
      {
        id: 'base_06',
        name: 'Phantom Veiler',
        type: 'MONSTER',
        level: 1,
        atk: 0,
        def: 0,
        attribute: 'LIGHT',
        description: 'Una ilusión que interrumpe la realidad.',
        effects: JSON.stringify([
          {
            id: 'eff_06',
            name: 'Veil of Illusion',
            restriction: { locations: ['HAND'], frequency: 'UNLIMITED' },
            trigger: { type: 'ANY_TIME' },
            speed: 2,
            isMandatory: false,
            causaText: "<span class='text-cyan-400 font-bold drop-shadow-sm'>(Efecto Rápido)</span>, puedes <span class='text-red-400 font-bold drop-shadow-sm'>descartar esta carta</span>.",
            efectoText: "Niega los efectos de 1 carta en el campo.",
            costs: [{ action: 'DISCARD', params: { n: 1, filter: { name: 'esta carta' } } }],
            resolutions: [{ action: 'NEGATE_EFFECT', params: { n: 1, filter: { name: 'en el campo' } } }]
          }
        ]),
        is_custom: 0,
        is_public: 1,
        can_be_ultra: 1,
        user_email: 'admin'
      }
    ];

    const upsert = db.prepare(`
      INSERT INTO cards (id, name, type, level, atk, def, attribute, description, effects, is_custom, is_public, can_be_ultra, user_email)
      VALUES (@id, @name, @type, @level, @atk, @def, @attribute, @description, @effects, @is_custom, @is_public, @can_be_ultra, @user_email)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        level=excluded.level,
        atk=excluded.atk,
        def=excluded.def,
        attribute=excluded.attribute,
        description=excluded.description,
        effects=excluded.effects,
        is_custom=excluded.is_custom,
        is_public=excluded.is_public,
        can_be_ultra=excluded.can_be_ultra,
        user_email=excluded.user_email
    `);

    for (const card of initialCards) {
      upsert.run(card);
    }
    console.log('[SYSTEM] Seeded base cards for user "admin".');

    // 4. Log server restart
    db.prepare("INSERT INTO user_logs (user_email, action, metadata) VALUES ('SYSTEM', 'SERVER_RESTART', 'Server rebooted')").run();
    console.log('[SYSTEM] Clean start protocol executed: Rooms cleared, users set to OFFLINE.');
  } catch (error) {
    console.error('[SYSTEM] Error during clean start protocol:', error);
  }

  console.log('Database initialized: Users, Cards and Decks tables are ready.');
};

export default db;
