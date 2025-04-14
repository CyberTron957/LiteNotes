const express = require('express');
const session = require('express-session');
// Remove sqlite3: const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg'); // Use pg Pool
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
// Nodemailer is not used if sendResetEmail uses curl, but keep require if needed later
const nodemailer = require('nodemailer');
const { exec } = require('child_process'); // Keep for sendResetEmail function
// Remove axios if not needed elsewhere: const axios = require('axios'); 

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
// Load SECRET_KEY from environment, provide a default ONLY for dev if not set
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Consider removing session middleware if only using JWT and not session features
// If keeping, ensure a proper session store (like connect-pg-simple) is used for production
app.use(session({
    secret: SECRET_KEY || 'insecure-fallback-key-for-session', // Use fallback ONLY if SECRET_KEY is missing, but session needs a secret
    resave: false,
    saveUninitialized: false,
    // Production recommendation: use a proper session store like connect-pg-simple
    // store: new (require('connect-pg-simple')(session))({
    //   pool : pool,                // Connection pool
    //   tableName : 'user_sessions' // Use another table-name than the default "session" one
    // }),
    // cookie: { secure: process.env.NODE_ENV === 'production', maxAge: ... } // Set secure flag in production (requires HTTPS)
}));

// PostgreSQL Connection Pool
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Configure Nodemailer Transporter for Mailtrap Sandbox
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // smtp.mailtrap.io (from .env)
    port: parseInt(process.env.EMAIL_PORT || '2525', 10), // Port from .env
    auth: {
        user: process.env.EMAIL_USER, // Mailtrap Sandbox username from .env
        pass: process.env.EMAIL_PASS  // Mailtrap Sandbox password from .env
    }
});

// Verify transporter config (optional, good for debugging)
transporter.verify(function(error, success) {
  if (error) {
    console.error("Nodemailer transporter verification failed:", error);
  } else {
    console.log("Nodemailer transporter is configured correctly for sending.");
  }
});

// Check DB connection and create tables
const initializeDatabase = async () => {
    let client; // Define client outside try block
    try {
        // Test connection
        client = await pool.connect();
        console.log('Connected to PostgreSQL database successfully!');

        // Create tables using PostgreSQL syntax
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table \'users\' checked/created successfully.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT,
                content TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table \'notes\' checked/created successfully.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );
        `);
        console.log('Table \'password_resets\' checked/created successfully.');

         // Add updated_at trigger function
         await client.query(`
            CREATE OR REPLACE FUNCTION update_modified_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW.updated_at = NOW();
               RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        // Add trigger to notes table if it doesn't exist
        const triggerExists = await client.query(`
            SELECT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = 'update_notes_modtime'
            );
        `);

        if (!triggerExists.rows[0].exists) {
            await client.query(`
                CREATE TRIGGER update_notes_modtime
                BEFORE UPDATE ON notes
                FOR EACH ROW
                EXECUTE FUNCTION update_modified_column();
            `);
             console.log('Trigger for notes.updated_at created.');
        } else {
             console.log('Trigger for notes.updated_at already exists.');
        }

    } catch (err) {
        console.error('Error initializing database:', err.stack);
        process.exit(1); // Exit if DB initialization fails
    } finally {
        if (client) {
            client.release(); // Ensure client is released back to the pool
        }
    }
};

initializeDatabase();

// Rate limiting store (in-memory - consider Redis/DB for production)
const failedLoginAttempts = {};
const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to add delay (simulates increased processing time)
const addDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Handle "Bearer <token>" format
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
         console.log("Auth failed: No token provided");
         return res.status(401).json({ message: 'No token provided' });
    }

    // Ensure SECRET_KEY is loaded before verifying
    if (!SECRET_KEY) {
        console.error("Auth failed: SECRET_KEY not configured on server.");
        return res.status(500).json({ message: 'Server configuration error' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log("Auth failed: Invalid token", err.message);
            return res.status(403).json({ message: 'Invalid or expired token' }); // More specific error
        }
        // Add user info from token payload to request object
        req.user = { id: user.id, username: user.username }; // Only include necessary info
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

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = email ?
            'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)' :
            'INSERT INTO users (username, password) VALUES ($1, $2)';
        const params = email ? [username, hashedPassword, email] : [username, hashedPassword];

        await pool.query(sql, params);
        res.status(201).json({ message: 'User created successfully' });

    } catch (err) {
        // Check for unique constraint violation (PostgreSQL error code 23505)
        if (err.code === '23505') {
            if (err.constraint === 'users_username_key') {
                return res.status(400).json({ message: 'Username already exists' });
            }
            if (err.constraint === 'users_email_key') {
                return res.status(400).json({ message: 'Email already registered' });
            }
            // Handle other unique constraints if added later
            return res.status(400).json({ message: 'Unique constraint violation' });
        }
        console.error('Registration error:', err.stack);
        return res.status(500).json({ message: 'Error creating user' });
    }
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

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        let validPassword = false;
        if (user) {
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

        if (!SECRET_KEY) {
             console.error("Login failed: SECRET_KEY not configured on server.");
             return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });

    } catch (err) {
        console.error('Login error:', err.stack);
        res.status(500).json({ message: 'Error during login' });
    }
});

// Logout
app.post('/logout', (req, res) => {
    // For JWT, logout is typically handled client-side by discarding the token.
    // If using sessions alongside JWT, you might destroy the session here.
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error("Session destroy error:", err);
                return res.status(500).json({ message: 'Error logging out' });
            }
             res.json({ message: 'Logged out successfully (session destroyed)' });
        });
    } else {
         res.json({ message: 'Logged out successfully (token needs discarding client-side)' });
    }
});

// Create note
app.post('/notes', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at', // Return timestamps
            [userId, title, content]
        );
        // Return the newly created note object including timestamps
        res.status(201).json({
            id: result.rows[0].id,
            user_id: userId, // Include user_id if needed client-side
            title: title,
            content: content,
            created_at: result.rows[0].created_at,
            updated_at: result.rows[0].updated_at
        });
    } catch (err) {
        console.error('Create note error:', err.stack);
        res.status(500).json({ message: 'Error creating note' });
    }
});

// Get all notes
app.get('/notes', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // Order by updated_at descending
        const result = await pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Get notes error:', err.stack);
        res.status(500).json({ message: 'Error fetching notes' });
    }
});

// Update note
app.put('/notes/:id', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    const noteId = req.params.id;
    const userId = req.user.id;

    try {
        // The trigger will automatically update updated_at
        const result = await pool.query(
            'UPDATE notes SET title = $1, content = $2 WHERE id = $3 AND user_id = $4 RETURNING updated_at',
            [title, content, noteId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Note not found or user mismatch' });
        }
        // Return the new updated_at timestamp if needed by the client
        res.json({ message: 'Note updated', updated_at: result.rows[0].updated_at });
    } catch (err) {
        console.error('Update note error:', err.stack);
        res.status(500).json({ message: 'Error updating note' });
    }
});

// Delete note
app.delete('/notes/:id', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Note not found or user mismatch' });
        }
        res.json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Delete note error:', err.stack);
        res.status(500).json({ message: 'Error deleting note' });
    }
});


// --- Forgot Password Routes ---

// 1. Request Password Reset (Using Nodemailer + Mailtrap Sandbox)
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Valid email is required' });
    }

    // No need to check for Mailtrap API key anymore

    try {
        // Select id, username, AND email
        const userResult = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            console.log(`Password reset requested for non-existent or non-matching email: ${email}`);
            return res.json({ message: 'If an account with that email exists, a reset link will be sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour expiry

        await pool.query(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expires]
        );

        const resetLink = `http://localhost:${PORT}/reset-password?token_${token}`; // Using underscore

        // --- Send Email using Nodemailer ---
        const mailOptions = {
            from: '"LiteNotes App" <hello@demomailtrap.co>', // Placeholder sender
            to: user.email, // Send to the user's actual email (Mailtrap will catch it)
            subject: "Password Reset Request for LiteNotes",
            text: `Hello ${user.username},\n\nPlease click on the following link, or paste it into your browser to complete the password reset process within one hour:\n\n${resetLink}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
            html: `<p>Hello ${user.username},</p>
                   <p>Please click on the following link to complete the password reset process within one hour:</p>
                   <p><a href="${resetLink}">${resetLink}</a></p>
                   <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
        };

        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Password reset email sent via Nodemailer: %s', info.messageId);
            // The email is caught by Mailtrap Sandbox, check your inbox there.
            res.json({ message: 'If an account with that email exists, a reset link will be sent.' });

        } catch (emailError) {
            console.error("Error sending password reset email via Nodemailer:", emailError);
            // Attempt to delete the token we just created, as email failed
            await pool.query('DELETE FROM password_resets WHERE token = $1', [token]).catch(delErr => {
                 console.error("Error deleting reset token after failed email send:", delErr.stack);
            });
            return res.status(500).json({ message: 'Error sending password reset email. Please try again later.' });
        }
        // --- End Send Email ---

    } catch (err) {
        console.error("Forgot password processing error:", err.stack);
        res.status(500).json({ message: 'Error processing password reset request' });
    }
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

    try {
        // Find valid, non-expired token
        const resetResult = await pool.query(
            // Use NOW() for PostgreSQL timestamp comparison
            'SELECT user_id, expires_at FROM password_resets WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        const resetInfo = resetResult.rows[0];

        if (!resetInfo) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Use a transaction for atomicity (update password AND delete token)
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Start transaction
            await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetInfo.user_id]);
            await client.query('DELETE FROM password_resets WHERE token = $1', [token]);
            await client.query('COMMIT'); // Commit transaction
            res.json({ message: 'Password has been reset successfully' });
        } catch (txErr) {
            await client.query('ROLLBACK'); // Roll back transaction on error
            console.error("Reset password transaction error:", txErr.stack);
            res.status(500).json({ message: 'Error updating password' });
        } finally {
            client.release(); // Release client back to pool
        }

    } catch (err) {
        console.error("Reset password initial query error:", err.stack);
        res.status(500).json({ message: 'Error resetting password' });
    }
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

// Add route to toggle sidebar collapse (remains the same)
app.post('/toggle-sidebar', authenticateToken, (req, res) => {
    res.json({ message: 'Sidebar toggled' });
});

// Basic 404 handler for routes not found
app.use((req, res, next) => {
    res.status(404).send("Sorry, that route doesn't exist.");
});

// Basic error handler middleware (add after all routes)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).send('Something broke!');
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!process.env.SECRET_KEY) {
        console.warn("!!! REMINDER: SECRET_KEY is not set in .env. Application is insecure. !!!");
    }
     if (!process.env.PG_PASSWORD) { // Example check for DB config
        console.warn("!!! REMINDER: PostgreSQL environment variables (e.g., PG_PASSWORD) might be missing in .env. !!!");
    }
});