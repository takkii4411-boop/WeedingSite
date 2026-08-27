const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/site/content',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.end();
console.log('Request sent');