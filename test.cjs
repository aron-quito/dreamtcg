const Database = require('better-sqlite3');
const db = new Database('dreamtcg.db');

const email = 'test@example.com'; // Wait, what is the user's email?
const decks = db.prepare("SELECT * FROM decks").all();
console.log("DECKS:");
console.dir(decks, { depth: null });

const cards = db.prepare("SELECT id, template_id, owner_email FROM physical_cards").all();
console.log("CARDS:", cards.slice(0, 10));

