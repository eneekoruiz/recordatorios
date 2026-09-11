const https = require('https');

const targetUrl = process.env.DEPLOY_URL || 'https://ayudandonos.vercel.app/api/health';
console.log(`🔍 Checking deployment health at: ${targetUrl}`);

const req = https.get(targetUrl, { timeout: 15000 }, (res) => {
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
