const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');

require('dotenv').config();

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY
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

// Rate limiting store (in-memory - consider Redis/DB for production)
const failedLoginAttempts = {};
const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,       // e.g., 'smtp.gmail.com'
    port: process.env.EMAIL_PORT || 587, // Use 587 for TLS, 465 for SSL, or check your provider
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your email password or App Password
    },
    // Optional: Add TLS options if needed, e.g., for self-signed certs
    // tls: {
    //     rejectUnauthorized: false
    // }
});

// Function to add delay (simulates increased processing time)
const addDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // New table for password resets
    db.run(`CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
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
    const { username, password, email } = req.body;

    // Input validation
    if (!username || username.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }
    if (!password || password.length < 7) {
        return res.status(400).json({ message: 'Password must be at least 7 characters long' });
    }
    // Basic email format validation (optional)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Use parameters for all values, including optional email
    const sql = email ? 
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)' : 
        'INSERT INTO users (username, password) VALUES (?, ?)';
    const params = email ? [username, hashedPassword, email] : [username, hashedPassword];

    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed: users.username')) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            if (err.message.includes('UNIQUE constraint failed: users.email')) {
                return res.status(400).json({ message: 'Email already registered' });
            }
            console.error('Registration error:', err.message);
            return res.status(500).json({ message: 'Error creating user' });
        }
        res.status(201).json({ message: 'User created successfully' }); // Changed message for clarity
    });
});

// Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const attemptInfo = failedLoginAttempts[username] || { count: 0, lockoutUntil: null };

    // Check if user is locked out
    if (attemptInfo.lockoutUntil && Date.now() < attemptInfo.lockoutUntil) {
        const timeLeft = Math.ceil((attemptInfo.lockoutUntil - Date.now()) / 1000 / 60);
        return res.status(429).json({ message: `Too many failed attempts. Please try again in ${timeLeft} minutes.` });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        let validPassword = false;
        if (!err && user) {
            validPassword = await bcrypt.compare(password, user.password);
        }

        if (!user || !validPassword) {
            // Increment failed attempts
            attemptInfo.count++;
            attemptInfo.lastAttempt = Date.now();
            
            let delayMs = 0;
            if (attemptInfo.count >= MAX_FAILED_ATTEMPTS) {
                console.log(`Locking out user ${username} for 5 minutes.`);
                attemptInfo.lockoutUntil = Date.now() + LOCKOUT_TIME;
                // Optionally add a longer delay on lockout
                delayMs = 1000; // Add 1 second delay before responding on lockout
            }
            failedLoginAttempts[username] = attemptInfo;

            if (delayMs > 0) {
                await addDelay(delayMs);
            }

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Successful login: Reset failed attempts
        delete failedLoginAttempts[username];

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' }); // Added expiry
        res.json({ token });
    });
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: 'Error logging out' });
        res.json({ message: 'Logged out successfully' });
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

// Update note
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

// Delete note
app.delete('/notes/:id', authenticateToken, (req, res) => {
    const noteId = req.params.id;

    db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', 
        [noteId, req.user.id], 
        function(err) {
            if (err) return res.status(500).json({ message: 'Error deleting note' });
            if (this.changes === 0) return res.status(404).json({ message: 'Note not found' });
            res.json({ message: 'Note deleted' });
        });
});

// --- Forgot Password Routes ---

// 1. Request Password Reset

function sendResetEmail(email, username, resetLink, callback) {
    const curlCmd = `
curl --ssl-reqd --url 'smtp://live.smtp.mailtrap.io:587' \
--user 'api:6c9028fb843024dc0807f020e104f97a' \
--mail-from hello@demomailtrap.co \
--mail-rcpt ${email} \
--upload-file - <<EOF
From: FastNotes App <hello@demomailtrap.co>
To: ${email}
Subject: Password Reset Request for FastNotes
Content-Type: multipart/alternative; boundary="boundary-string"

--boundary-string
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: quoted-printable
Content-Disposition: inline

Hello ${username},

Please click on the following link, or paste it into your browser to complete the password reset process within one hour:

${resetLink}

If you did not request this, please ignore this email and your password will remain unchanged.

--boundary-string
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable
Content-Disposition: inline

<!doctype html>
<html>
  <head>
    <meta http-equiv=3D"Content-Type" content=3D"text/html; charset=3DUTF-8">
  </head>
  <body style=3D"font-family: sans-serif;">
    <div style=3D"display: block; margin: auto; max-width: 600px;">
      <h1 style=3D"font-size: 18px; font-weight: bold;">Password Reset Request for FastNotes</h1>
      <p>Hello ${username},</p>
      <p>Please click on the following link to complete the password reset process within one hour:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    </div>
  </body>
</html>

--boundary-string--
EOF
`;

    exec(curlCmd, (error, stdout, stderr) => {
        if (error) {
            console.error("Error sending password reset email:", error);
            return callback(error);
        }
        console.log("Password reset email sent.");
        callback(null);
    });
}
// ✅ Forgot password route
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error("DB error:", err.message);
            return res.status(500).json({ message: 'Error checking email' });
        }

        if (!user) {
            console.log(`Password reset requested for non-existent email: ${email}`);
            return res.json({ message: 'If an account with that email exists, a reset link will be sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000;

        db.run(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, datetime(?, \'unixepoch\'))',
            [user.id, token, expires / 1000],
            (err) => {
                if (err) {
                    console.error("Token DB error:", err.message);
                    return res.status(500).json({ message: 'Error generating reset token' });
                }

                const resetLink = `http://localhost:${PORT}/reset-password?token_${token}`;

                sendResetEmail(email, user.username, resetLink, (emailErr) => {
                    if (emailErr) {
                        db.run('DELETE FROM password_resets WHERE token = ?', [token]);
                        return res.status(500).json({ message: 'Error sending password reset email. Please try again later.' });
                    }

                    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
                });
            }
        );
    });
});


// 2. Reset Password with Token
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (newPassword.length < 7) {
        return res.status(400).json({ message: 'Password must be at least 7 characters long' });
    }

    // Find valid, non-expired token
    db.get(
        'SELECT user_id, expires_at FROM password_resets WHERE token = ? AND expires_at > datetime(\'now\')',
        [token],
        async (err, resetInfo) => {
            if (err) {
                console.error("Reset password DB error:", err.message);
                return res.status(500).json({ message: 'Error verifying token' });
            }
            if (!resetInfo) {
                return res.status(400).json({ message: 'Invalid or expired reset token' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update user's password
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetInfo.user_id], function(err) {
                if (err) {
                    console.error("Error updating password:", err.message);
                    return res.status(500).json({ message: 'Error resetting password' });
                }

                // Delete the used token (important!)
                db.run('DELETE FROM password_resets WHERE token = ?', [token], (deleteErr) => {
                   if (deleteErr) {
                       console.error("Error deleting used reset token:", deleteErr.message);
                       // Continue even if token deletion fails, but log it
                   }
                });

                res.json({ message: 'Password has been reset successfully' });
            });
        }
    );
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the new reset password page
app.get('/reset-password', (req, res) => {
    // We just serve the HTML, the token is handled by frontend JS
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Add route to toggle sidebar collapse
app.post('/toggle-sidebar', authenticateToken, (req, res) => {
    // This is a placeholder route. Actual implementation depends on frontend logic.
    res.json({ message: 'Sidebar toggled' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});