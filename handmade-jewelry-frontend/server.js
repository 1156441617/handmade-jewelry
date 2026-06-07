const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = '.' + decodeURIComponent(req.url.split('?')[0]);
  if (filePath === './') {
    filePath = './index.html';
  }
  const ext = path.extname(filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/plain;charset=utf-8'});
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('   匠心手作电商平台 - 前端服务');
  console.log('='.repeat(60));
  console.log(`   访问地址: http://localhost:${PORT}`);
  console.log('   按 Ctrl+C 停止服务');
  console.log('='.repeat(60));
});
