const https = require('https');
const http = require('http');

const targetUrl = process.env.DEPLOY_URL || 'http://localhost:3001/api/health';
console.log(`🔍 Checking deployment health at: ${targetUrl}`);

let url;
try { url = new URL(targetUrl); }
catch { console.error('Health check FAILED: DEPLOY_URL no es una URL válida.'); process.exit(1); }
if (!['http:', 'https:'].includes(url.protocol)) {
  console.error('Health check FAILED: usa una URL HTTP o HTTPS.');
  process.exit(1);
}
const client = url.protocol === 'https:' ? https : http;
const req = client.get(url, { timeout: 15000 }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Body: ${data}`);
    try {
      const json = JSON.parse(data);
      if (res.statusCode === 200 && json.status === 'ok') {
        console.log('✅ Health check PASSED: Service is live and responding correctly.');
        process.exit(0);
      } else {
        console.error('❌ Health check FAILED: Unexpected response content.');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Health check FAILED: Response is not valid JSON.', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Network error during health check:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Request timed out after 15s');
  process.exit(1);
});
