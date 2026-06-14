require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error('No API key'); process.exit(1); }
const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  const url = 'https://generativelanguage.googleapis.com/v1/models/text-embedding-gecko-001';
  console.log('url', url);
  const res = await fetch(url + '?key=' + apiKey, { method: 'GET' });
  const data = await res.text();
  console.log('status', res.status);
  console.log(data);
})();
