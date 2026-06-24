const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString()
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
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
  const target = encodeURIComponent('https://www.nseindia.com/api/fiidiiTradeReact');
  const proxyUrl = `https://api.allorigins.win/get?url=${target}`;

  console.log('Fetching via allorigins proxy...');
  const res = await get(proxyUrl);
  console.log('Status:', res.status);
  console.log('Raw:', res.body.substring(0, 300));

  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

  const wrapper = JSON.parse(res.body);
  const data = JSON.parse(wrapper.contents);

  const fiiNet = parseFloat(String(data[0].netVal).replace(/,/g, ''));
  const diiNet = parseFloat(String(data[1].netVal).replace(/,/g, ''));

  console.log(`✅ FII: ₹${fiiNet} Cr | DII: ₹${diiNet} Cr`);

  updateCSV('data/FII_NET/data.csv', fiiNet);
  updateCSV('data/DII_NET/data.csv', diiNet);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
