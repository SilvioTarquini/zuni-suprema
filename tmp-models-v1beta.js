require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error('No API key'); process.exit(1); }
const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
  const data = await res.json();
  console.log('status', res.status);
  console.log(JSON.stringify(data, null, 2));
})();
