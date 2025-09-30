// Project: Simple Short Link Webapp (Node + Express + SQLite)
// Files shown below — save each section as the named file and run with `node server.js`.

/* ===== package.json =====
{
  "name": "shortlink-app",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "body-parser": "^1.20.2",
    "ejs": "^3.1.9",
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "valid-url": "^1.0.9"
  }
}
*/

/* ===== server.js ===== */
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const validUrl = require('valid-url');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup view engine and static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Init DB
const db = new sqlite3.Database(path.join(__dirname, 'data.sqlite'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    url TEXT,
    title TEXT,
    description TEXT,
    image TEXT,
    quote TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function makeCode(len = 6) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  while (out.length < len) {
    const bytes = crypto.randomBytes(8).toString('hex');
    for (let i = 0; i < bytes.length && out.length < len; i += 2) {
      const n = parseInt(bytes.substr(i, 2), 16);
      out += alphabet[n % alphabet.length];
    }
  }
  return out;
}

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/shorten', (req, res) => {
  const { url, title, description, image, quote } = req.body;
  if (!url || !validUrl.isWebUri(url)) {
    return res.status(400).send('مہر بانی کر کے درست URL دیں۔');
  }
  const trySave = () => {
    const code = makeCode(6);
    const stmt = db.prepare('INSERT INTO links (code, url, title, description, image, quote) VALUES (?,?,?,?,?,?)');
    stmt.run(code, url, title || '', description || '', image || '', quote || DEFAULT_TAMIL_QUOTE, function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return trySave();
        return res.status(500).send('ڈیٹا بیس میں مسئلہ ہوا۔');
      }
      res.render('created', { short: req.protocol + '://' + req.get('host') + '/s/' + code, code });
    });
    stmt.finalize();
  };
  trySave();
});

const DEFAULT_TAMIL_QUOTE = 'எப்போதும் நோய் நீங்க… வாழ்க்கை சிரிப்பாக இருக்கும்.'; // a short Tamil quote

app.get('/s/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT * FROM links WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).send('سرور غلطی');
    if (!row) return res.status(404).send('لنک نہیں ملا');
    // Show preview page which then redirects after a short delay
    res.render('preview', { row });
  });
});

// API to fetch metadata (optional) — could be used by clients
app.get('/api/link/:code', (req, res) => {
  db.get('SELECT * FROM links WHERE code = ?', [req.params.code], (err, row) => {
    if (err) return res.json({ error: true });
    if (!row) return res.status(404).json({ error: true });
    res.json(row);
  });
});

app.listen(PORT, () => {
  console.log('Shortlink app listening on port ' + PORT);
});

/* ===== views/index.ejs =====
<!doctype html>
<html lang="ur">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Shortlink بنائیں</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="card">
    <h1>Shortlink بنائیں</h1>
    <form action="/shorten" method="post">
      <label>اصل لنک (URL)</label>
      <input name="url" placeholder="https://example.com" required>

      <label>ٹائٹل (اختیاری)</label>
      <input name="title" placeholder="صفحت کا عنوان">

      <label>ڈسکریپشن (اختیاری)</label>
      <textarea name="description" placeholder="صفحت کی مختصر تفصیل"></textarea>

      <label>امیج URL (اختیاری)</label>
      <input name="image" placeholder="https://example.com/image.jpg">

      <label>تیمِل قول (اختیاری)</label>
      <input name="quote" value="<%= DEFAULT_TAMIL_QUOTE %>">

      <button type="submit">Shorten</button>
    </form>
    <p class="muted">بنیادی فیچر: ٹائٹل، ڈسکریپشن، امیج اور تیمِل قول کے ساتھ پریویو صفحہ، پھر آٹو ری ڈائریکٹ۔</p>
  </div>
</body>
</html>
*/

/* ===== views/created.ejs =====
<!doctype html>
<html lang="ur">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Shortlink بنایا گیا</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="card">
    <h2>Shortlink تیار ہوگیا</h2>
    <p>آپ کا لنک: <a href="<%= short %>"><%= short %></a></p>
    <p>کوڈ: <strong><%= code %></strong></p>
    <p><a href="/">مزید بنائیں</a></p>
  </div>
</body>
</html>
*/

/* ===== views/preview.ejs =====
<!doctype html>
<html lang="ur">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><%= row.title || 'Preview' %></title>
  <meta name="description" content="<%= row.description %>">
  <meta property="og:title" content="<%= row.title %>">
  <meta property="og:description" content="<%= row.description %>">
  <% if (row.image) { %>
    <meta property="og:image" content="<%= row.image %>">
  <% } %>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="card preview">
    <% if (row.image) { %>
      <div class="thumb"><img src="<%= row.image %>" alt="image"></div>
    <% } %>
    <h2><%= row.title || row.url %></h2>
    <p class="desc"><%= row.description %></p>
    <blockquote class="quote"><%= row.quote || '' %></blockquote>

    <div class="actions">
      <a id="openNow" href="<%= row.url %>" class="btn">اب کھولیں</a>
      <button id="waitBtn" class="btn muted">اپنے آپ ری ڈائریکٹ ہو رہا ہے</button>
    </div>
    <p class="muted">اگر ری ڈائریکٹ نہ ہوا تو <a id="fallback" href="<%= row.url %>">یہاں کلک کریں</a></p>
  </div>

  <script>
    // Auto redirect after a short delay (3 seconds)
    setTimeout(() => {
      window.location.href = '<%= row.url %>';
    }, 3000);
  </script>
</body>
</html>
*/

/* ===== public/style.css =====
body{font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Nastaliq Urdu', sans-serif; background:#f5f7fb; padding:30px}
.card{max-width:720px;margin:0 auto;background:#fff;padding:20px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.06)}
input,textarea{width:100%;padding:10px;margin:6px 0 12px;border:1px solid #ddd;border-radius:8px}
button, .btn{display:inline-block;padding:10px 14px;border-radius:8px;border:none;background:#2b6ef6;color:#fff;text-decoration:none}
.muted{color:#666;font-size:14px}
.preview .thumb img{max-width:100%;height:auto;border-radius:8px;margin-bottom:12px}
.quote{font-style:italic;color:#333;padding-left:12px;border-left:3px solid #ddd}
*/

/* ===== Notes =====
How to run:
1) create project folder and save the files shown above with the exact filenames/paths.
2) run: npm install
3) run: node server.js
4) open http://localhost:3000

What it does:
- Shorten a URL with optional title, description, image and a Tamil quote.
- When visiting the short link (e.g. /s/abc123) user sees a preview page that contains the title, description, image and the Tamil quote, and then is auto-redirected to the original URL after 3 seconds. There is also an "Open Now" button.

You can change the auto-redirect delay inside views/preview.ejs's script timeout.
*/
