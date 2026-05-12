import express from 'express';
import cors from 'cors';
import db, { initDb } from './database';

// Helper for logging and status
const logUserAction = (email: string, action: string, metadata: any = null) => {
  try {
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    db.prepare('INSERT INTO user_logs (user_email, action, metadata) VALUES (?, ?, ?)').run(email, action, metaStr);
    
    // Auto-derive status from action
    let status = 'ONLINE';
    if (action === 'HOST_ROOM' || action === 'JOIN_ROOM') status = 'SALA';
    if (action === 'START_DUEL') status = 'DUELO';
    if (action === 'LEAVE_ROOM') status = 'ONLINE';
    if (action === 'LOGOUT') status = 'OFFLINE';
    
    db.prepare('UPDATE users SET status = ?, last_seen_at = CURRENT_TIMESTAMP WHERE email = ?').run(status, email);
  } catch (e) {
    console.error("Logging error:", e);
  }
};

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize DB
initDb();

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body;
  try {
    const insert = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)');
    insert.run(email, name, password);
    res.json({ success: true, user: { email, name } });
  } catch (error) {
    res.status(500).json({ error: 'Email already exists or invalid data' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
    if (user) {
      logUserAction(email, 'LOGIN');
      res.json({ success: true, user: { email: user.email, name: user.name } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- CARD ENDPOINTS ---

// GET all cards for a specific user
app.get('/api/cards', (req, res) => {
  const userEmail = req.query.userEmail as string;
  if (!userEmail) return res.status(400).json({ error: 'User context required' });

  try {
    const cards = db.prepare("SELECT * FROM cards WHERE user_email = ? OR user_email = 'public' ORDER BY created_at DESC").all(userEmail);
    const parsedCards = cards.map((c: any) => ({
      ...c,
      effects: JSON.parse(c.effects || '[]'),
      isCustom: Boolean(c.is_custom),
      isPublic: Boolean(c.is_public),
      limit: c.limit_count
    }));
    res.json(parsedCards);
  } catch (error) {
    console.error('FETCH CARDS ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch cards', details: error instanceof Error ? error.message : String(error) });
  }
});

// POST save or update card
app.post('/api/cards', (req, res) => {
  const { card, userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'User context required' });
  
  try {
    const upsert = db.prepare(`
      INSERT INTO cards (id, user_email, name, type, attribute, level, atk, def, description, effects, image, is_custom, is_public, limit_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        attribute=excluded.attribute,
        level=excluded.level,
        atk=excluded.atk,
        def=excluded.def,
        description=excluded.description,
        effects=excluded.effects,
        image=excluded.image,
        is_custom=excluded.is_custom,
        is_public=excluded.is_public,
        limit_count=excluded.limit_count
    `);

    upsert.run(
      card.id,
      userEmail,
      card.name,
      card.type,
      card.attribute,
      card.level || null,
      card.atk ?? null,
      card.def ?? null,
      card.description || '',
      JSON.stringify(card.effects),
      card.image || null,
      card.isCustom ? 1 : 0,
      card.isPublic !== undefined ? (card.isPublic ? 1 : 0) : 1,
      card.limit ?? 3
    );

    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save card' });
  }
});

// DELETE card
app.delete('/api/cards/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// --- DECK ENDPOINTS ---

// GET all decks for a specific user
app.get('/api/decks', (req, res) => {
  const userEmail = req.query.userEmail as string;
  if (!userEmail) return res.status(400).json({ error: 'User context required' });

  try {
    const decks = db.prepare("SELECT * FROM decks WHERE user_email = ? OR user_email = 'public' ORDER BY created_at DESC").all(userEmail);
    const parsedDecks = decks.map((d: any) => ({
      ...d,
      mainCards: JSON.parse(d.main_cards)
    }));
    res.json(parsedDecks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// POST save or update deck
app.post('/api/decks', (req, res) => {
  const { deck, userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'User context required' });

  try {
    const upsert = db.prepare(`
      INSERT INTO decks (id, user_email, name, main_cards)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        main_cards=excluded.main_cards
    `);

    upsert.run(
      deck.id,
      userEmail,
      deck.name,
      JSON.stringify(deck.mainCards)
    );

    res.json({ success: true, deck });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save deck' });
  }
});

// DELETE deck
app.delete('/api/decks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM decks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

// --- ROOM ENDPOINTS ---

// Host a new room
app.post('/api/rooms/host', (req, res) => {
  const { email } = req.body;
  try {
    // PREVENT MULTI-PRESENCE: Check if already a player in any active room
    const existing = db.prepare('SELECT id FROM rooms WHERE player1_email = ? OR player2_email = ?').get(email, email) as any;
    if (existing) {
      return res.status(400).json({ 
        error: 'already_in_match', 
        roomId: existing.id,
        message: 'You are already in an active match. Redirecting...' 
      });
    }

    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const insert = db.prepare('INSERT INTO rooms (id, host_email, player1_email, status) VALUES (?, ?, ?, \'LOBBY\')');
    insert.run(roomId, email, email);
    
    logUserAction(email, 'HOST_ROOM', { roomId });
    res.json({ success: true, roomId: roomId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join a room as Player
app.post('/api/rooms/join', (req, res) => {
  const { roomId, email } = req.body;
  try {
    // PREVENT MULTI-PRESENCE
    const existing = db.prepare('SELECT id FROM rooms WHERE (player1_email = ? OR player2_email = ?) AND id != ?').get(email, email, roomId) as any;
    if (existing) {
      return res.status(400).json({ 
        error: 'already_in_match', 
        roomId: existing.id,
        message: 'You are already in another match. Redirecting...' 
      });
    }

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    // SAFETY: If match is in progress, you MUST join as spectator
    if (room.status !== 'LOBBY') {
      return res.status(400).json({ 
        error: 'match_in_progress', 
        message: 'The match has already started. Join as a spectator instead.' 
      });
    }

    if (room.player1_email === email || room.player2_email === email) {
      return res.status(403).json({ error: 'already_a_player' });
    }
    
    // Check if there is an empty seat
    if (room.player1_email && room.player2_email) {
      return res.status(403).json({ error: 'room_full' });
    }

    const seatColumn = !room.player1_email ? 'player1_email' : 'player2_email';
    const readyColumn = !room.player1_email ? 'host_ready' : 'guest_ready';

    db.prepare(`UPDATE rooms SET ${seatColumn} = ?, ${readyColumn} = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(email, roomId);
    
    logUserAction(email, 'JOIN_ROOM', { roomId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Join as Spectator
app.post('/api/rooms/spectate', (req, res) => {
  const { roomId, email } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    if (room.spectator1_email === email || room.spectator2_email === email) return res.json({ success: true });

    if (!room.spectator1_email) {
      db.prepare('UPDATE rooms SET spectator1_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(email, roomId);
    } else if (!room.spectator2_email) {
      db.prepare('UPDATE rooms SET spectator2_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(email, roomId);
    } else {
      return res.status(403).json({ error: 'Spectator slots full' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join as spectator' });
  }
});

// Leave Room
app.post('/api/rooms/leave', (req, res) => {
  const { roomId, email } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isOwner = room.host_email === email;

    if (isOwner) {
      db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
    } else {
      // CLEAR PLAYER SLOTS
      db.prepare(`
        UPDATE rooms SET 
          player1_email = CASE WHEN player1_email = ? THEN NULL ELSE player1_email END,
          player2_email = CASE WHEN player2_email = ? THEN NULL ELSE player2_email END,
          spectator1_email = CASE WHEN spectator1_email = ? THEN NULL ELSE spectator1_email END,
          spectator2_email = CASE WHEN spectator2_email = ? THEN NULL ELSE spectator2_email END,
          spectator3_email = CASE WHEN spectator3_email = ? THEN NULL ELSE spectator3_email END,
          spectator4_email = CASE WHEN spectator4_email = ? THEN NULL ELSE spectator4_email END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(email, email, email, email, email, email, roomId);

      // CRITICAL: If a duel was in progress and someone left, the duel is broken.
      // We should check if players are missing and update status or close room.
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
      if (room && (room.status === 'DUELING' || room.status === 'RPS')) {
        if (!room.player1_email || !room.player2_email) {
          // If a player is missing during a duel, close the room as it's invalid now.
          db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
        }
      }
    }
    
    logUserAction(email, 'LEAVE_ROOM', { roomId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Switch Role inside room
app.post('/api/rooms/roles/switch', (req, res) => {
  const { roomId, email, targetRole } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // 1. Clear current slots (except ownership)
    db.prepare(`
      UPDATE rooms SET 
        player1_email = CASE WHEN player1_email = ? THEN NULL ELSE player1_email END,
        player2_email = CASE WHEN player2_email = ? THEN NULL ELSE player2_email END,
        spectator1_email = CASE WHEN spectator1_email = ? THEN NULL ELSE spectator1_email END,
        spectator2_email = CASE WHEN spectator2_email = ? THEN NULL ELSE spectator2_email END,
        host_ready = CASE WHEN player1_email = ? THEN 0 ELSE host_ready END,
        guest_ready = CASE WHEN player2_email = ? THEN 0 ELSE guest_ready END
      WHERE id = ?
    `).run(email, email, email, email, email, email, roomId);

    const freshRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;

    if (targetRole === 'PLAYER') {
      if (room.status !== 'LOBBY') {
        return res.status(403).json({ error: 'Cannot join as player: Match already in progress.' });
      }
      if (!freshRoom.player1_email) {
        db.prepare('UPDATE rooms SET player1_email = ?, host_ready = 0 WHERE id = ?').run(email, roomId);
      } else if (!freshRoom.player2_email) {
        db.prepare('UPDATE rooms SET player2_email = ?, guest_ready = 0 WHERE id = ?').run(email, roomId);
      } else {
        return res.status(403).json({ error: 'Player slots are full' });
      }
    } else {
      if (!freshRoom.spectator1_email) {
        db.prepare('UPDATE rooms SET spectator1_email = ? WHERE id = ?').run(email, roomId);
      } else if (!freshRoom.spectator2_email) {
        db.prepare('UPDATE rooms SET spectator2_email = ? WHERE id = ?').run(email, roomId);
      } else {
        return res.status(403).json({ error: 'Spectator slots are full' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to switch role' });
  }
});

// Heartbeat
app.post('/api/users/heartbeat', (req, res) => {
  const { email } = req.body;
  try {
    db.prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE email = ?').run(email);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// Find active room for user (Reconnection logic)
app.get('/api/rooms/active', (req, res) => {
  const { email } = req.query;
  try {
    const room = db.prepare(`
      SELECT * FROM rooms 
      WHERE (player1_email = ? OR player2_email = ? OR spectator1_email = ? OR spectator2_email = ? OR spectator3_email = ? OR spectator4_email = ?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(email, email, email, email, email, email) as any;
    res.json(room || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to find active room' });
  }
});

// List online users (Social Telemetry)
app.get('/api/users/online', (req, res) => {
  try {
    // Defensive check: only query if columns exist
    const users = db.prepare(`
      SELECT name, email, status, last_seen_at 
      FROM users 
      WHERE last_seen_at > datetime('now', '-5 minutes')
      ORDER BY last_seen_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    // Fallback if schema migration hasn't finished
    res.json([]);
  }
});

// List all active rooms with auto-cleanup
app.get('/api/rooms', (req, res) => {
  try {
    // DEFENSIVE: Ensure columns exist
    try { db.prepare("ALTER TABLE rooms ADD COLUMN player1_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN player2_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN spectator1_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN spectator2_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN spectator3_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN spectator4_email TEXT").run(); } catch(e){}
    try { db.prepare("ALTER TABLE rooms ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP").run(); } catch(e){}

    // 1. Cleanup old rooms (1 hour of total inactivity)
    db.prepare("DELETE FROM rooms WHERE updated_at < datetime('now', '-60 minutes')").run();

    // 2. GHOST CLEANUP
    const inactiveUsers = db.prepare("SELECT email FROM users WHERE last_seen_at < datetime('now', '-10 minutes') AND status != 'OFFLINE'").all() as any[];
    
    inactiveUsers.forEach(u => {
      db.prepare("UPDATE users SET status = 'OFFLINE' WHERE email = ?").run(u.email);
      db.prepare(`
        UPDATE rooms SET 
          player1_email = CASE WHEN player1_email = ? THEN NULL ELSE player1_email END,
          player2_email = CASE WHEN player2_email = ? THEN NULL ELSE player2_email END,
          spectator1_email = CASE WHEN spectator1_email = ? THEN NULL ELSE spectator1_email END,
          spectator2_email = CASE WHEN spectator2_email = ? THEN NULL ELSE spectator2_email END,
          spectator3_email = CASE WHEN spectator3_email = ? THEN NULL ELSE spectator3_email END,
          spectator4_email = CASE WHEN spectator4_email = ? THEN NULL ELSE spectator4_email END
        WHERE player1_email = ? OR player2_email = ? OR spectator1_email = ? OR spectator2_email = ? OR spectator3_email = ? OR spectator4_email = ?
      `).run(u.email, u.email, u.email, u.email, u.email, u.email, u.email, u.email, u.email, u.email, u.email, u.email);
    });

    // 3. Final Room Cleanup: Only if NO PLAYERS are present in seats
    db.prepare("DELETE FROM rooms WHERE player1_email IS NULL AND player2_email IS NULL").run();

    const rooms = db.prepare(`
      SELECT r.id, r.host_email, u.name as host_name, r.player1_email, r.player2_email, r.status, r.created_at,
             (CASE WHEN r.player1_email IS NOT NULL THEN 1 ELSE 0 END + 
              CASE WHEN r.player2_email IS NOT NULL THEN 1 ELSE 0 END) as player_count,
             (CASE WHEN r.spectator1_email IS NOT NULL THEN 1 ELSE 0 END + 
              CASE WHEN r.spectator2_email IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN r.spectator3_email IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN r.spectator4_email IS NOT NULL THEN 1 ELSE 0 END) as spectators
      FROM rooms r
      LEFT JOIN users u ON r.host_email = u.email
      ORDER BY r.created_at DESC
    `).all();

    console.log(`[DEBUG] Active rooms found: ${rooms.length}`);
    res.json(rooms);
  } catch (error) {
    console.error('FETCH ROOMS CRITICAL ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get Room State with Player Names
app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.prepare(`
      SELECT r.*, 
             u1.name as p1_name, 
             u2.name as p2_name,
             u3.name as spec1_name,
             u4.name as spec2_name,
             u5.name as owner_name
      FROM rooms r
      LEFT JOIN users u1 ON r.player1_email = u1.email
      LEFT JOIN users u2 ON r.player2_email = u2.email
      LEFT JOIN users u3 ON r.spectator1_email = u3.email
      LEFT JOIN users u4 ON r.spectator2_email = u4.email
      LEFT JOIN users u5 ON r.host_email = u5.email
      WHERE r.id = ?
    `).get(req.params.id);
    
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Update Room (Deck/Ready Status)
app.post('/api/rooms/update', (req, res) => {
  const { roomId, email, deckId, ready, status, turnOrder } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (status) {
      db.prepare('UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, roomId);
    }

    if (turnOrder !== undefined) {
      db.prepare('UPDATE rooms SET turn_order = ? WHERE id = ?').run(turnOrder, roomId);
    }

    let query = 'UPDATE rooms SET updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [];

    if (room.player1_email === email) {
      if (deckId !== undefined) { query += ', host_deck_id = ?'; params.push(deckId); }
      if (ready !== undefined) { query += ', host_ready = ?'; params.push(ready ? 1 : 0); }
    } else if (room.player2_email === email) {
      if (deckId !== undefined) { query += ', guest_deck_id = ?'; params.push(deckId); }
      if (ready !== undefined) { query += ', guest_ready = ?'; params.push(ready ? 1 : 0); }
    }

    if (status !== undefined) { query += ', status = ?'; params.push(status); }

    query += ' WHERE id = ?';
    params.push(roomId);

    db.prepare(query).run(...params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Update RPS Choice
app.post('/api/rooms/rps', (req, res) => {
  const { roomId, email, choice } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // AUTH: Only official players can participate in RPS
    if (room.player1_email !== email && room.player2_email !== email) {
      return res.status(403).json({ error: 'Unauthorized: Only duelists can participate in RPS.' });
    }

    if (room.player1_email === email) {
      db.prepare('UPDATE rooms SET host_choice = ? WHERE id = ?').run(choice, roomId);
    } else if (room.player2_email === email) {
      db.prepare('UPDATE rooms SET guest_choice = ? WHERE id = ?').run(choice, roomId);
    }

    // Check if both chose and determine winner
    const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (updatedRoom.host_choice && updatedRoom.guest_choice) {
      const h = updatedRoom.host_choice;
      const g = updatedRoom.guest_choice;
      
      if (h === g) {
        db.prepare("UPDATE rooms SET host_choice = NULL, guest_choice = NULL, turn_order_decider = 'TIE' WHERE id = ?").run(roomId);
      } else {
        const p1Wins = (h === 'ROCK' && g === 'SCISSORS') || (h === 'PAPER' && g === 'ROCK') || (h === 'SCISSORS' && g === 'PAPER');
        const winnerEmail = p1Wins ? updatedRoom.player1_email : updatedRoom.player2_email;
        db.prepare("UPDATE rooms SET turn_order_decider = ? WHERE id = ?").run(winnerEmail, roomId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record RPS choice' });
  }
});

// Reset RPS for Ties
app.post('/api/rooms/rps/reset', (req, res) => {
  const { roomId } = req.body;
  try {
    db.prepare("UPDATE rooms SET host_choice = NULL, guest_choice = NULL, turn_order_decider = NULL WHERE id = ?").run(roomId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset RPS' });
  }
});

// Update Game State
app.post('/api/rooms/game/update', (req, res) => {
  const { roomId, gameState, email } = req.body;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // AUTH: Only player1 or player2 can update the game state
    if (room.player1_email !== email && room.player2_email !== email) {
      return res.status(403).json({ error: 'Unauthorized: Only duelists can update the game state.' });
    }

    db.prepare('UPDATE rooms SET game_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      JSON.stringify(gameState),
      roomId
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update game' });
  }
});

app.listen(PORT, () => {
  console.log(`DreamTCG Backend running at http://localhost:${PORT}`);
});
