#!/usr/bin/env node
/**
 * Einfacher CORS-Proxy für Groq API
 * Starte mit: node proxy-server.js
 * Dann in LifeOS einstellen:
 *   Base URL: http://localhost:8787/openai/v1
 *   Model: qwen/qwen3-27b
 */

const http = require('http');
const https = require('https');

const PORT = 8787;
const GROQ_API = 'api.groq.com';

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy nur für /openai/v1/*
  if (!req.url?.startsWith('/openai/v1/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const targetPath = req.url.replace('/openai/v1', '/openai/v1');
  
  const options = {
    hostname: GROQ_API,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: GROQ_API,
    },
  };

  // Entferne Host-Header vom Original-Request
  delete options.headers['host'];
  delete options.headers['origin'];
  delete options.headers['referer'];

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, {
      ...proxyRes.headers,
      'access-control-allow-origin': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: { message: err.message } }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Groq CORS-Proxy läuft auf http://localhost:${PORT}`);
  console.log(`\n📋 In LifeOS einstellen:`);
  console.log(`   Base URL: http://localhost:${PORT}/openai/v1`);
  console.log(`   Model: qwen/qwen3-27b`);
  console.log(`   API-Key: Dein Groq-Key (gsk_...)`);
  console.log(`\n⏹️  Stoppen mit: Strg+C\n`);
});
