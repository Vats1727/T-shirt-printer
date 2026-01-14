import { pool } from './db';

(async () => {
  try {
    const res = await pool.query('SELECT id, slogan, color, created_at FROM designs ORDER BY id DESC LIMIT 5');
    console.log('rows:', res.rows);
    process.exit(0);
  } catch (e) {
    console.error('error running query', e);
    process.exit(1);
  }
})();