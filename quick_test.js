const http = require('http');
http.get('http://127.0.0.1:3000/api/site/content', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log('✅ Connected! Status:', res.statusCode);
      console.log('✅ Body:', data.substring(0, 200));
    } catch (e) {
      console.log('❌ Parse error:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('❌ Connection error:', e.message);
});