/**
 *   npm run feed:regional            -> create 6 drains + 7 days of history from real rainfall
 *   npm run feed:regional -- --reset -> delete & rebuild them
 *   npm run feed:regional -- --live  -> keep adding a live reading every 10 min (real current rainfall)
 *   npm run feed:regional -- --dry   -> print the localities, touch nothing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const feed = require('../services/regionalDrainFeed');
const args = process.argv.slice(2);

(async () => {
  if (args.includes('--dry')) { console.table(feed.LOCALITIES.map(({ deviceId, name, zone, lat, lng }) => ({ deviceId, name, zone, lat, lng }))); return; }
  await connectDB();
  await feed.seedAll({ reset: args.includes('--reset') });
  if (args.includes('--live')) {
    console.log('🛰️  Live mode (every 10 min). Ctrl+C to stop.');
    setInterval(() => feed.tickAll().catch((e) => console.error(e.message)), 10 * 60000);
    return;
  }
  await mongoose.disconnect();
  console.log('✅ Done');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
