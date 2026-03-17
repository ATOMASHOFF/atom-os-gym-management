const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

// Check build folder exists
const fs = require('fs');
if (!fs.existsSync(BUILD_DIR)) {
  console.error('ERROR: build/ folder not found. Did npm run build complete?');
  process.exit(1);
}

// Serve static files from build/
app.use(express.static(BUILD_DIR));

// Health check
app.get('/healthz', (req, res) => res.send('ok'));

// All other routes → index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});
