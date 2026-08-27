const { spawn } = require('child_process');
const http = require('http');
require('dotenv').config();

const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: Object.assign(process.env, {
    PORT: '3000'
  }),
  stdio: 'ignore'
});

setTimeout(() => {
  const endpoints = [
    { url: 'http://localhost:3000/api/site/content', label: 'GET /api/site/content' },
    { url: 'http://localhost:3000/api/admin/status', label: 'GET /api/admin/status' },
    { url: 'http://localhost:3000/', label: 'GET / (landing page)' },
    { url: 'http://localhost:3000/story.html', label: 'GET /story.html' }
  ];

  let tested = 0;
  function testNext() {
    if (tested >= endpoints.length) {
      server.kill();
      process.exit(0);
    }
    const ep = endpoints[tested++];
    http.get(ep.url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const status = res.statusCode === 200 ? '✅' : '⚠️';
        console.log(`${status} ${ep.label}: ${res.statusCode}`);
        testNext();
      });
    }).on('error', e => {
      console.log(`❌ ${ep.label}: ${e.message}`);
      testNext();
    });
  }
  testNext();
}, 3000);