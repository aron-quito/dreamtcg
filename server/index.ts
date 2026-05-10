import express from 'express';
import cors from 'cors';
import db, { initDb } from './database';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize DB
initDb();

// GET all cards
app.get('/api/cards', (req, res) => {
  try {
    const cards = db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all();
    // Parse the JSON effects before sending
    const parsedCards = cards.map((c: any) => ({
      ...c,
      effects: JSON.parse(c.effects),
      isCustom: Boolean(c.is_custom),
      isPublic: Boolean(c.is_public),
      limit: c.limit_count
    }));
    res.json(parsedCards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// POST save or update card
app.post('/api/cards', (req, res) => {
  const card = req.body;
  
  try {
    const upsert = db.prepare(`
      INSERT INTO cards (id, name, type, attribute, level, atk, def, description, effects, image, is_custom, is_public, limit_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// GET all decks
app.get('/api/decks', (req, res) => {
  try {
    const decks = db.prepare('SELECT * FROM decks ORDER BY created_at DESC').all();
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
  const deck = req.body;
  try {
    const upsert = db.prepare(`
      INSERT INTO decks (id, name, main_cards)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        main_cards=excluded.main_cards
    `);

    upsert.run(
      deck.id,
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

app.listen(PORT, () => {
  console.log(`DreamTCG Backend running at http://localhost:${PORT}`);
});
