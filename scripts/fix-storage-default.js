require('dotenv').config();
const db = require('../database/db');
db.prepare("UPDATE client_galleries SET storage_backend = 'telegram'").run();
console.log('All galleries updated to telegram!');
