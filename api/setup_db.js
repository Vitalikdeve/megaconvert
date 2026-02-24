const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  
  const files = ['promo_codes_v1.sql', 'account_identity_v1.sql'];
  for (const f of files) {
    const p = path.join(process.env.SQL_DIR, f);
    await c.query(fs.readFileSync(p, 'utf8'));
    console.log('applied', f);
  }
  
  const r = await c.query("select to_regclass('public.promo_codes') as promo_codes, to_regclass('public.account_profiles') as account_profiles, to_regclass('public.user_connections') as user_connections, to_regclass('public.user_sessions') as user_sessions");
  console.log(r.rows[0]);
  await c.end();
  console.log('db ready');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
