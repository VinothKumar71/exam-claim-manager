const { app, BrowserWindow } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const express = require('express');
const cors = require('cors');

const isDev = !app.isPackaged;
const dbPath = process.env.PORTABLE_EXECUTABLE_DIR 
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'database.sqlite')
  : (isDev ? path.join(__dirname, 'database.sqlite') : path.join(app.getPath('userData'), 'database.sqlite'));

let db;
try {
  db = new Database(dbPath);
  console.log('Connected to local SQLite database at:', dbPath);
  
  // Create users table and default admin
  db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT)`).run();
  const adminCount = db.prepare(`SELECT count(*) as c FROM users`).get().c;
  if (adminCount === 0) {
    db.prepare(`INSERT INTO users (id, email, password) VALUES ('1', 'admin@university.ac.in', 'admin123')`).run();
  }
} catch (error) {
  console.error('Failed to connect to SQLite database:', error);
}

const os = require('os');
const server = express();
server.use(cors());
server.use(express.json({ limit: '50mb' }));

// Serve static React files
const distPath = path.join(__dirname, 'dist');
server.use(express.static(distPath));

server.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  res.json({ ip: localIp, port: 3000 });
});

server.get('/api/backup', (req, res) => {
  res.download(dbPath, `backup_aec_manager_${Date.now()}.sqlite`);
});

server.post('/api/login', (req, res) => {
  console.log("LOGIN ATTEMPT RECEIVED:", req.body);
  try {
    if (!db) {
      console.error("Database connection was never initialized!");
      return res.json({ success: false, error: 'Database connection failed. Please check the terminal for startup errors.' });
    }
    const { email, password } = req.body;
    console.log(`Checking credentials for: ${email} / ${password}`);
    const user = db.prepare(`SELECT * FROM users WHERE email = ? AND password = ?`).get(email, password);
    console.log("DB RESULT:", user);
    if (user) return res.json({ success: true, user: { email: user.email } });
    return res.json({ success: false, error: 'Invalid email or password' });
  } catch (e) {
    console.error("LOGIN ENDPOINT ERROR:", e);
    return res.json({ success: false, error: e.message });
  }
});

server.post('/api/db-query', (req, res) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const { operation, table, payload } = req.body;
    
    if (operation === 'select') {
      let query = `SELECT * FROM "${table}"`;
      if (payload?.order) {
        const dir = payload.order.ascending === false ? 'DESC' : 'ASC';
        query += ` ORDER BY "${payload.order.column}" ${dir}`;
      }
      const rows = db.prepare(query).all();
      const parsedRows = rows.map(row => {
        const parsed = {};
        for (const [key, val] of Object.entries(row)) {
          try { parsed[key] = (val && typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) ? JSON.parse(val) : val; } 
          catch (e) { parsed[key] = val; }
        }
        return parsed;
      });
      return res.json(parsedRows);
    }
    
    if (operation === 'insert') {
      const rows = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (rows.length === 0) return res.json(null);
      const columns = Object.keys(rows[0]);
      const colsStr = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const insertStmt = db.prepare(`INSERT INTO "${table}" (${colsStr}) VALUES (${placeholders})`);
      db.transaction((items) => {
        for (const item of items) {
          const values = columns.map(col => {
            const val = item[col];
            return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
          });
          insertStmt.run(values);
        }
      })(rows);
      return res.json(rows);
    }
    
    if (operation === 'update') {
      const data = payload.data;
      const match = payload.match;
      const setClause = Object.keys(data).map(k => `"${k}" = ?`).join(', ');
      const matchClause = Object.keys(match).map(k => `"${k}" = ?`).join(' AND ');
      const values = [...Object.values(data).map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v), ...Object.values(match)];
      db.prepare(`UPDATE "${table}" SET ${setClause} WHERE ${matchClause}`).run(values);
      return res.json({ success: true });
    }
    
    if (operation === 'delete') {
      const match = payload.match;
      const matchClause = Object.keys(match).map(k => `"${k}" = ?`).join(' AND ');
      db.prepare(`DELETE FROM "${table}" WHERE ${matchClause}`).run(Object.values(match));
      return res.json({ success: true });
    }
    
    if (operation === 'upsert') {
      const data = payload.data;
      const columns = Object.keys(data);
      const colsStr = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const updateCols = columns.filter(c => c !== 'id').map(c => `"${c}"=excluded."${c}"`).join(', ');
      const values = columns.map(col => {
        const val = data[col];
        return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
      });
      db.prepare(`INSERT INTO "${table}" (${colsStr}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateCols}`).run(values);
      return res.json({ success: true });
    }
    
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server running on http://0.0.0.0:${PORT}`);
});
// ------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
