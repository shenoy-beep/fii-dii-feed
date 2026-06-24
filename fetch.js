const https = require('https');
const http = require('http');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchWithProxy(proxyName, buildUrl, parseResponse) {
  try {
    console.log(`Trying ${proxyName}...`);
    const res = await get(buildUrl());
    console.log(`  Status: ${res.status}`);
    console.log(`  Body preview: ${res.body.substring(0, 200)}`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return parseResponse(res.body);
  } catch (e) {
    console.log(`  ❌ ${proxyName} failed: ${e.message}`);
    return null;
  }
}

async function fetchFiiDii() {
  const nseUrl = 'https://www.nseindia.com/api/fiidiiTradeReact';

  // Proxy 1: allorigins
  let data = await fetchWithProxy('allorigins', 
    () => `https://api.allorigins.win/get?url=${encodeURIComponent(nseUrl)}`,
    body => JSON.parse(JSON.parse(body).contents)
  );

  // Proxy 2: corsproxy.io
  if (!data) data = await fetchWithProxy('corsproxy.io',
    () => `https://corsproxy.io/?${encodeURIComponent(nseUrl)}`,
    body => JSON.parse(body)
  );

  // Proxy 3: thingproxy
  if (!data) data = await fetchWithProxy('thingproxy',
    () => `https://thingproxy.freeboard.io/fetch/${nseUrl}`,
    body => JSON.parse(body)
  );

  if (!data) throw new Error('All proxies failed');
  return data;
}

function updateCSV(filepath, value) {
  const today = new Date().toISOString().split('T')[0];
  const header = 'Date,Time,Open,High,Low,Close,Volume';
  const row = `${today},00:00,${value},${value},${value},${value},0`;

  fs.mkdirSync(require('path').dirname(filepath), { recursive: true });

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
  const data = await fetchFiiDii();
  console.log('Raw parsed data:', JSON.stringify(data).substring(0, 400));

  const fiiNet = parseFloat(String(data[0].netVal).replace(/,/g, ''));
  const diiNet = parseFloat(String(data[1].netVal).replace(/,/g, ''));

  console.log(`✅ FII: ₹${fiiNet} Cr | DII: ₹${diiNet} Cr`);

  updateCSV('data/FII_NET/data.csv', fiiNet);
  updateCSV('data/DII_NET/data.csv', diiNet);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
