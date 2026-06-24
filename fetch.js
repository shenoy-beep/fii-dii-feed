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
      // Follow redirects
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

async function fetchFiiDii() {
  // Try 1: Groww public API (no auth needed)
  try {
    console.log('Trying Groww API...');
    const res = await get('https://groww.in/v1/api/stocks_fo/v1/fii_dii');
    console.log('  Status:', res.status);
    console.log('  Preview:', res.body.substring(0, 300));
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      // Groww returns { fiiData: {...}, diiData: {...} }
      const fii = parseFloat(String(data.fiiData?.netVal || data.fiiNetValue || data[0]?.netVal).replace(/,/g, ''));
      const dii = parseFloat(String(data.diiData?.netVal || data.diiNetValue || data[1]?.netVal).replace(/,/g, ''));
      if (!isNaN(fii) && !isNaN(dii)) return { fii, dii };
      console.log('  Parsed full:', JSON.stringify(data).substring(0, 500));
    }
  } catch(e) { console.log('  ❌ Groww failed:', e.message); }

  // Try 2: BSE India FII/DII (public CSV endpoint)
  try {
    console.log('Trying BSE...');
    const res = await get('https://api.bseindia.com/BseIndiaAPI/api/FIIDIIData/w');
    console.log('  Status:', res.status);
    console.log('  Preview:', res.body.substring(0, 300));
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      console.log('  Full:', JSON.stringify(data).substring(0, 500));
    }
  } catch(e) { console.log('  ❌ BSE failed:', e.message); }

  // Try 3: NSE with full session simulation
  try {
    console.log('Trying NSE direct with session...');
    const { request } = https;
    
    // Get cookies first
    const cookieRes = await get('https://www.nseindia.com/');
    console.log('  Cookie status:', cookieRes.status);
    await sleep(3000);
    
    const res = await get('https://www.nseindia.com/api/fiidiiTradeReact', {
      'Referer': 'https://www.nseindia.com/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    });
    console.log('  NSE status:', res.status);
    console.log('  NSE preview:', res.body.substring(0, 300));
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      const fii = parseFloat(String(data[0].netVal).replace(/,/g, ''));
      const dii = parseFloat(String(data[1].netVal).replace(/,/g, ''));
      return { fii, dii };
    }
  } catch(e) { console.log('  ❌ NSE direct failed:', e.message); }

  throw new Error('All sources failed — see logs above for clues');
}

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
  const { fii, dii } = await fetchFiiDii();
  console.log(`\n✅ FII: ₹${fii} Cr | DII: ₹${dii} Cr`);
  updateCSV('data/FII_NET/data.csv', fii);
  updateCSV('data/DII_NET/data.csv', dii);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
