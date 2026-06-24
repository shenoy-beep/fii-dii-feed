const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        ...headers
      },
      timeout: 20000
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateCSV(filepath, value) {
  const today = new Date().toISOString().split('T')[0];
  const header = 'Date,Time,Open,High,Low,Close,Volume';
  const row = `${today},00:00,${value},${value},${value},${value},0`;

  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  let lines = [];
  if (fs.existsSync(filepath)) {
    lines = fs.readFileSync(filepath, 'utf8').trim().split('\n').filter(Boolean);
  }
  if (!lines.length || !lines[0].startsWith('Date')) lines.unshift(header);

  const idx = lines.findIndex(l => l.startsWith(today));
  if (idx >= 0) lines[idx] = row;
  else lines.push(row);

  fs.writeFileSync(filepath, lines.join('\n') + '\n');
  console.log(`✅ ${filepath} → ${value}`);
}

async function main() {
  console.log('Trying NSE direct...');
  const res = await get('https://www.nseindia.com/api/fiidiiTradeReact', {
    'Referer': 'https://www.nseindia.com/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin'
  });

  console.log('Status:', res.status);
  console.log('Raw:', res.body);

  const data = JSON.parse(res.body);

  const fiiEntry = data.find(d => d.category === 'FII/FPI');
  const diiEntry = data.find(d => d.category === 'DII');

  console.log('FII entry:', JSON.stringify(fiiEntry));
  console.log('DII entry:', JSON.stringify(diiEntry));

  const fii = parseFloat(String(fiiEntry.netValue).replace(/,/g, ''));
  const dii = parseFloat(String(diiEntry.netValue).replace(/,/g, ''));

  console.log(`✅ FII: ₹${fii} Cr | DII: ₹${dii} Cr`);

  updateCSV('data/FII_NET/data.csv', fii);
  updateCSV('data/DII_NET/data.csv', dii);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
