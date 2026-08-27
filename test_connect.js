const http = require('http');
const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/site/content',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0, 200));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();