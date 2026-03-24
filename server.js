/**
 * SecureVault - Express Server
 * Simple server to host the password manager
 * 
 * Features:
 * - Serve static files
 * - HTTPS ready
 * - Security headers
 * - Optional analytics endpoint
 * - CORS ready
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Parse JSON
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Security Headers
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy (relaxed for crypto operations)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  
  // CORS (allow all origins - modify if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// Main app route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'vault-single-user.html'));
});

// Manifest route
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Service Worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// ═══════════════════════════════════════════════════════════════
// OPTIONAL: ANALYTICS ENDPOINT (Anonymous)
// ═══════════════════════════════════════════════════════════════

// In-memory analytics (replace with database for production)
const analytics = {
  pageLoads: 0,
  accountsCreated: 0,
  passwordsAdded: 0,
  editsPerformed: 0,
  deletesPerformed: 0,
  searchUsed: 0,
  timestampStart: new Date()
};

// Track analytics event
app.post('/api/analytics', (req, res) => {
  const { event } = req.body;
  
  if (event === 'page_load') analytics.pageLoads++;
  if (event === 'account_created') analytics.accountsCreated++;
  if (event === 'password_added') analytics.passwordsAdded++;
  if (event === 'edit_performed') analytics.editsPerformed++;
  if (event === 'delete_performed') analytics.deletesPerformed++;
  if (event === 'search_used') analytics.searchUsed++;
  
  res.json({ ok: true });
});

// Get analytics (protected - add authentication for production)
app.get('/api/analytics/stats', (req, res) => {
  // In production, add authentication here
  // const token = req.headers.authorization;
  // if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const uptime = new Date() - analytics.timestampStart;
  const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
  
  res.json({
    ...analytics,
    uptime: `${uptimeHours} hours`,
    lastUpdate: new Date()
  });
});

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    app: 'SecureVault'
  });
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

function startServer() {
  if (USE_HTTPS) {
    // Use HTTPS (requires cert.pem and key.pem)
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };
    
    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║          SecureVault Server Started (HTTPS)               ║');
      console.log(`║  🔐 https://localhost:${PORT}${' '.repeat(24 - String(PORT).length)}║`);
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n📊 Analytics endpoint: https://localhost:' + PORT + '/api/analytics/stats');
      console.log('⚠️  Keep key.pem and cert.pem secret!\n');
    });
  } else {
    // Use HTTP
    http.createServer(app).listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║          SecureVault Server Started (HTTP)                ║');
      console.log(`║  🔐 http://localhost:${PORT}${' '.repeat(25 - String(PORT).length)}║`);
      console.log('╚════════════════════════════════════════════════════════════╝');
      
      // Get local IP
      const os = require('os');
      const ifaces = os.networkInterfaces();
      let localIP = 'localhost';
      
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
      }
      
      console.log(`\n📱 On same WiFi, use: http://${localIP}:${PORT}`);
      console.log('📊 Analytics endpoint: http://localhost:' + PORT + '/api/analytics/stats');
      console.log('✅ App ready! Open in browser now.\n');
    });
  }
}

startServer();

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

process.on('SIGTERM', () => {
  console.log('\n📛 Server shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📛 Server shutting down...');
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR DEPLOYMENT PLATFORMS
// ═══════════════════════════════════════════════════════════════

module.exports = app;