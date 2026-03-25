import { pool } from './server/db';

async function verifyAssociations() {
  try {
    const res = await pool.query('SELECT id, name, email, role, associated_provider_id FROM users');
    console.log('--- User Associations ---');
    console.table(res.rows);
    
    const designers = res.rows.filter(u => u.role === 'designer');
    const providers = res.rows.filter(u => u.role === 'print_provider' || u.role === 'admin');
    
    console.log(`Found ${designers.length} designers and ${providers.length} providers/admins.`);
    
    if (designers.length > 0 && designers.every(d => !d.associated_provider_id)) {
      console.warn('WARNING: No designers have an associated provider ID!');
    }
  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    process.exit();
  }
}

verifyAssociations();
