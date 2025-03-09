const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-secret-key'; // In production, use environment variable

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: false
}));

// Database setup
const db = new sqlite3.Database('./notes.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes
// Register
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
        [username, hashedPassword], 
        function(err) {
            if (err) return res.status(400).json({ message: 'Username already exists' });
            res.status(201).json({ message: 'User created' });
        });
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'Invalid credentials' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
        res.json({ token });
    });
});

// Create note
app.post('/notes', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
        [req.user.id, title, content],
        function(err) {
            if (err) return res.status(500).json({ message: 'Error creating note' });
            res.status(201).json({ id: this.lastID });
        });
});

// Get all notes
app.get('/notes', authenticateToken, (req, res) => {
    db.all('SELECT * FROM notes WHERE user_id = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching notes' });
        res.json(rows);
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Add this new route for updating notes
app.put('/notes/:id', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    const noteId = req.params.id;
    
    db.run('UPDATE notes SET title = ?, content = ? WHERE id = ? AND user_id = ?',
        [title, content, noteId, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ message: 'Error updating note' });
            if (this.changes === 0) return res.status(404).json({ message: 'Note not found' });
            res.json({ message: 'Note updated' });
        });
});