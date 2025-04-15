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
const redis = require('redis');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
// Load SECRET_KEY from environment, provide a default ONLY for dev if not set
const SECRET_KEY = process.env.SECRET_KEY;

const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000; // Standard iteration count for PBKDF2

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
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to PostgreSQL database successfully!');

        // Update users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                -- New columns for encryption key handling
                encryption_salt TEXT, -- Store salt as hex string
                encrypted_user_key TEXT -- Store base64(iv:ciphertext:authTag)
            );
        `);
        // Add columns if they don't exist (simple check)
        try {
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_salt TEXT;');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_user_key TEXT;');
             console.log('Columns encryption_salt and encrypted_user_key checked/added.');
        } catch (alterErr) {
            // Ignore errors if columns already exist, log others
            if (!alterErr.message.includes('already exists')) {
                 console.error('Error altering users table:', alterErr.stack);
            }
        }
         console.log('Table \'users\' checked/created successfully.');

        // Update notes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                -- Change title and content to TEXT to store encrypted Base64 data
                title TEXT,
                content TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
         // Change column types if they exist and are not TEXT
         try {
             await client.query('ALTER TABLE notes ALTER COLUMN title TYPE TEXT;');
             await client.query('ALTER TABLE notes ALTER COLUMN content TYPE TEXT;');
             console.log('Columns notes.title and notes.content type checked/set to TEXT.');
         } catch (alterNotesErr) {
             // Log errors if altering fails (might happen if table doesn't exist yet, which is handled above)
             if (!alterNotesErr.message.includes('does not exist')) { // Ignore "table does not exist"
                 console.error('Error altering notes table columns:', alterNotesErr.stack);
             }
         }
         console.log('Table \'notes\' checked/created successfully.');

        // Password resets table (remains the same)
        await client.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );
        `);
         console.log('Table \'password_resets\' checked/created successfully.');

        // Trigger function and trigger (remains the same)
        await client.query(`
            CREATE OR REPLACE FUNCTION update_modified_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW.updated_at = NOW();
               RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
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
        process.exit(1);
    } finally {
        if (client) {
            client.release();
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

// --- Encryption/Decryption Helpers ---

// Derive a key from password and salt
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha512'); // 32 bytes for AES-256
}

// Encrypt data using AES-256-GCM
function encryptData(data, key) {
    const iv = crypto.randomBytes(12); // 12 bytes IV for GCM is recommended
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Return IV, encrypted data, and auth tag together (e.g., Base64 encoded)
    return Buffer.from(`${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`).toString('base64');
}

// Decrypt data using AES-256-GCM
function decryptData(encryptedString, key) {
    try {
        const decoded = Buffer.from(encryptedString, 'base64').toString('utf8');
        const parts = decoded.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format.');
        }
        const [ivHex, encryptedHex, authTagHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedData = Buffer.from(encryptedHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error.message);
        // Depending on context, you might return null, an error string, or throw
        return null; // Indicate decryption failure
    }
}

// --- Redis Client Setup ---
// Use environment variables for production, provide defaults for local dev
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = redis.createClient({
    url: redisUrl
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis successfully!'));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));

// Connect the client (async operation)
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        // Decide if the app should exit or run without cache
        // For this app, cache is critical for encrypted notes, so maybe exit
        // process.exit(1);
    }
})();
// --- End Redis Client Setup ---

// Function to get user's decrypted key from Redis
async function getUserDecryptionKey(userId) { // Make async
    if (!userId) return null; // Handle case where userId might be missing

    const redisKey = `userKey:${userId}`;
    try {
        const keyHex = await redisClient.get(redisKey);
        if (!keyHex) {
            console.warn(`Decryption key not found in Redis cache for user ${userId}. User may need to log in again.`);
            return null; // Key not found or expired
        }
        // Key found in Redis, return as buffer
        return Buffer.from(keyHex, 'hex');
    } catch (redisErr) {
        console.error(`Redis GET error for key ${redisKey}:`, redisErr);
        // Return null to indicate failure, forcing re-login
        return null;
    }
}

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
        // 1. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Generate user's unique data encryption key
        const userDataKey = crypto.randomBytes(32); // 32 bytes for AES-256

        // 3. Generate salt for deriving the key-encryption key
        const encryptionSalt = crypto.randomBytes(16);

        // 4. Derive the key-encryption key from the user's *plain text* password and salt
        const keyEncryptionKey = deriveKey(password, encryptionSalt);

        // 5. Encrypt the user's data key using the derived key-encryption key
        const encryptedUserKey = encryptData(userDataKey.toString('hex'), keyEncryptionKey); // Store key as hex before encrypting

        // 6. Store user, salt (hex), and encrypted key (base64)
        const sql = `
            INSERT INTO users (username, password, email, encryption_salt, encrypted_user_key)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (username) DO NOTHING -- Handle conflict separately for email
            RETURNING id;
        `;
        // Prepare params - handle optional email
        const params = [
            username,
            hashedPassword,
            email || null, // Use null if email is not provided
            encryptionSalt.toString('hex'), // Store salt as hex
            encryptedUserKey // Store encrypted key as base64 string
        ];

        const result = await pool.query(sql, params);

        // Check if insert happened (result.rows might be empty on conflict)
        if (result.rowCount === 0) {
             // Explicitly check for email conflict if email was provided
            if (email) {
                const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
                if (emailCheck.rowCount > 0) {
                    return res.status(400).json({ message: 'Email already registered' });
                }
            }
            // If no rows inserted and not an email conflict, it must be a username conflict
            return res.status(400).json({ message: 'Username already exists' });
        }

        res.status(201).json({ message: 'User created successfully' });

    } catch (err) {
        // Handle other potential errors (DB connection, etc.)
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
        // Retrieve necessary fields for login and key decryption
        const result = await pool.query(
            'SELECT id, username, password, encryption_salt, encrypted_user_key FROM users WHERE username = $1',
            [username]
        );
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

        // Check if user has encryption info (should exist for users registered with new logic)
        if (!user.encryption_salt || !user.encrypted_user_key) {
            console.error(`User ${username} (ID: ${user.id}) is missing encryption salt or key.`);
            return res.status(500).json({ message: 'Account configuration error. Cannot decrypt notes.' });
        }

        // Derive the key-encryption key
        const salt = Buffer.from(user.encryption_salt, 'hex');
        const keyEncryptionKey = deriveKey(password, salt);

        // Decrypt the user's data key
        const decryptedUserDataKeyHex = decryptData(user.encrypted_user_key, keyEncryptionKey);

        if (!decryptedUserDataKeyHex) {
            console.error(`Failed to decrypt user data key for user ${username} (ID: ${user.id}). Wrong password during derivation?`);
            // This *shouldn't* happen if bcrypt.compare passed, but check anyway.
            return res.status(500).json({ message: 'Failed to access encryption key.' });
        }

        // Store the decrypted key in Redis with expiration (e.g., 1 hour = 3600 seconds)
        try {
            const redisKey = `userKey:${user.id}`;
            await redisClient.set(redisKey, decryptedUserDataKeyHex, {
                // EX: 3600 // Expires in 1 hour (seconds) - Use same as JWT
                // You can adjust the expiration time as needed
                EX: 3600 // Example: 1 hour expiry
            });
            console.log(`User ${user.id} key decrypted and cached in Redis.`);
        } catch (redisErr) {
            console.error('Redis SET error during login:', redisErr);
            // Decide how to handle Redis failure - maybe log and proceed without cache?
            // For this app, failing to cache means notes won't work, so return error
            return res.status(500).json({ message: 'Failed to cache user session key.' });
        }

        if (!SECRET_KEY) {
             console.error("Login failed: SECRET_KEY not configured on server.");
             return res.status(500).json({ message: 'Server configuration error' });
        }

        // Create JWT
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });

    } catch (err) {
        console.error('Login error:', err.stack);
        res.status(500).json({ message: 'Error during login' });
    }
});

// Logout
app.post('/logout', authenticateToken, async (req, res) => {
    const userId = req.user?.id;

    // Clear the cached key from Redis
    if (userId) {
        try {
            const redisKey = `userKey:${userId}`;
            const deletedCount = await redisClient.del(redisKey);
            if (deletedCount > 0) {
                console.log(`Cleared cached key from Redis for user ${userId}`);
            }
        } catch(redisErr) {
            console.error('Redis DEL error during logout:', redisErr);
            // Log error but proceed with logout as Redis failure isn't critical here
        }
    }

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

    const userKey = await getUserDecryptionKey(userId);
    if (!userKey) {
        return res.status(401).json({ message: 'User key not available. Please log in again.' });
    }

    try {
        // Encrypt title and content
        const encryptedTitle = title ? encryptData(title, userKey) : null;
        const encryptedContent = content ? encryptData(content, userKey) : null;

        const result = await pool.query(
            'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at',
            [userId, encryptedTitle, encryptedContent] // Store encrypted data
        );

        // Return DECRYPTED data for immediate use by client
        res.status(201).json({
            id: result.rows[0].id,
            user_id: userId,
            title: title, // Return original plain text title
            content: content, // Return original plain text content
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

    const userKey = await getUserDecryptionKey(userId);
    if (!userKey) {
        return res.status(401).json({ message: 'User key not available. Please log in again.' });
    }

    try {
        const result = await pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);

        // Decrypt notes before sending
        const decryptedNotes = result.rows.map(note => {
            try {
                const decryptedTitle = note.title ? decryptData(note.title, userKey) : ''; // Default to empty string if null/decryption fails
                const decryptedContent = note.content ? decryptData(note.content, userKey) : '';
                // Handle potential decryption failure (decryptData returns null)
                 if (note.title && decryptedTitle === null) {
                     console.warn(`Failed to decrypt title for note ID ${note.id}`);
                 }
                 if (note.content && decryptedContent === null) {
                     console.warn(`Failed to decrypt content for note ID ${note.id}`);
                 }
                return {
                    ...note,
                    title: decryptedTitle === null ? '[Decryption Error]' : decryptedTitle, // Provide feedback on error
                    content: decryptedContent === null ? '[Decryption Error]' : decryptedContent
                };
            } catch (decryptErr) {
                 console.error(`Error decrypting note ID ${note.id}:`, decryptErr);
                 return {
                     ...note,
                     title: '[Decryption Error]',
                     content: '[Decryption Error]'
                 };
            }
        });

        res.json(decryptedNotes);
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

    const userKey = await getUserDecryptionKey(userId);
    if (!userKey) {
        return res.status(401).json({ message: 'User key not available. Please log in again.' });
    }

    try {
        // Encrypt new title and content
        const encryptedTitle = title ? encryptData(title, userKey) : null;
        const encryptedContent = content ? encryptData(content, userKey) : null;

        const result = await pool.query(
            'UPDATE notes SET title = $1, content = $2 WHERE id = $3 AND user_id = $4 RETURNING updated_at',
            [encryptedTitle, encryptedContent, noteId, userId] // Store encrypted data
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Note not found or user mismatch' });
        }
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
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
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