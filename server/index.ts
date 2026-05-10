import express from 'express';
import cors from 'cors';
import db, { initDb } from './database';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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
      isCustom: Boolean(c.is_custom)
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
      INSERT INTO cards (id, name, type, attribute, level, atk, def, description, effects, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        type=excluded.type,
        attribute=excluded.attribute,
        level=excluded.level,
        atk=excluded.atk,
        def=excluded.def,
        description=excluded.description,
        effects=excluded.effects
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
      card.isCustom ? 1 : 0
    );

    res.json({ success: true, card });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save card' });
  }
});

app.listen(PORT, () => {
  console.log(`DreamTCG Backend running at http://localhost:${PORT}`);
});
