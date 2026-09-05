const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const requestPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const safePath = path.normalize(requestPath).replace(/^\.+[\\/]+/, '');
  const filePath = path.join(rootDir, safePath);

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
});
