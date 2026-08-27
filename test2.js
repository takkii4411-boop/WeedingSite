const http = require('http');
const url = 'http://localhost:3000/api/site/content';
http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log('SUCCESS:', JSON.parse(data));
    } catch (e) {
      console.log('Raw response:', data.substring(0, 200));
    }
  });
}).on('error', e => {
  console.error('ERROR:', e.message);
});