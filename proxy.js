const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/', createProxyMiddleware({
  target: 'http://localhost:9002',
  changeOrigin: true,
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Bypass-Tunnel-Reminder', '1');
  }
}));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}`);
});