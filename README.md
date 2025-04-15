# LiteNotes - Minimalist Notes App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Optional: Add relevant badges -->

LiteNotes is a fast, secure, and minimalist web-based notes application built with Node.js, Express.js, PostgreSQL, and Redis. It allows users to create, edit, and delete notes with a clean, customizable interface, featuring end-to-end encryption, robust authentication, and real-time saving.



## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Cloning the Repository](#cloning-the-repository)
  - [Installation](#installation)
  - [Configuration (.env)](#configuration-env)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Security Features](#security-features)
- [Contributing](#contributing)
- [License](#license)

## Key Features


-   **End-to-End Note Encryption:** Note titles and content are encrypted using AES-256-GCM before being stored in the database. Each user has a unique data key, which itself is encrypted using a key derived from their login password, ensuring only the user can decrypt their notes upon login.
-   **Offline Note Fallback:** Notes created or edited while logged out are saved to local storage.
-   **Cloud Sync & Merge:** Local notes are automatically uploaded/merged to the user's encrypted cloud storage upon login.
-   **Real-time Saving:** Notes are automatically saved (and encrypted) shortly after edits (debounced).
-   **Customizable UI:**
    -   Multiple color themes (Dark, Light, Sepia, Slate, Blue, Mint, Lavender, Warm).
    -   Multiple typography options (Inter, Mono, Serif, Space Mono).
    -   Various background patterns (Dots, Grid, Diamonds, Scatter, Paper).
    -   Theme/font/background choices are saved locally.
-   **Mobile Responsive:** Fully optimized for mobile viewing.
-   **Password Reset:** Secure password reset functionality via email link (requires email configuration).
-   **Login Rate Limiting:** Basic protection against brute-force login attempts.
-   **Styled Components:** Includes custom-styled scrollbars and toast notifications.


## Technology Stack

-   **Backend:**
    -   Node.js
    -   Express.js
    -   PostgreSQL (Database)
    -   Redis (Caching decrypted user keys)
    -   `bcryptjs` (Password Hashing)
    -   `jsonwebtoken` (JWT Authentication)
    -   `pg` (PostgreSQL Client)
    -   `redis` (Redis Client)
    -   `nodemailer` (Email Sending - for password reset)
    -   `dotenv` (Environment Variables)
-   **Frontend:**
    -   HTML5
    -   CSS3 (Variables, Custom Properties)
    -   Vanilla JavaScript (ES6+)

## Getting Started

Follow these instructions to set up and run the LiteNotes application locally.

### Prerequisites

-   **Node.js & npm:** (v16 or later recommended) [Download Node.js](https://nodejs.org/)
-   **PostgreSQL:** A running PostgreSQL server instance. [Download PostgreSQL](https://www.postgresql.org/download/)
-   **Redis:** A running Redis server instance. [Install Redis](https://redis.io/docs/getting-started/installation/)
-   **Git:** For cloning the repository. [Download Git](https://git-scm.com/)
-   **(Optional) Mail Server/Service:** An SMTP server or service (like Mailtrap for development, SendGrid/AWS SES for production) for password reset emails.

### Cloning the Repository

```bash
git clone https://github.com/CyberTron957/LiteNotes
cd LiteNotes
```

### Installation

Install the necessary Node.js dependencies:

```bash
npm install
```

### Configuration (.env)

Create a `.env` file in the root of the project directory with the following variables:

```dotenv
# Application Configuration
SECRET_KEY=your_strong_jwt_secret_key_here # IMPORTANT: Generate a strong, random key

# PostgreSQL Database Configuration
PG_USER=your_db_user
PG_HOST=localhost # Or your DB host
PG_DATABASE=litenotes_db # Or your preferred DB name
PG_PASSWORD=your_db_password
PG_PORT=5432 # Or your DB port

# Redis Configuration
REDIS_URL=redis://localhost:6379 # Or your Redis connection URL

# Email Configuration (for Password Reset - using Mailtrap sandbox example)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your_mailtrap_username
EMAIL_PASS=your_mailtrap_password
# EMAIL_FROM='"LiteNotes App" <hello@demomailtrap.co>' # Optional: Override sender

```

### Database Setup

1.  Ensure your PostgreSQL server is running.
2.  Connect to PostgreSQL using a tool like `psql` or a GUI client.
3.  Create the database specified in your `.env` file (e.g., `CREATE DATABASE litenotes_db;`).
4.  The application (`app.js`) will automatically attempt to create the necessary tables (`users`, `notes`, `password_resets`) and functions/triggers when it starts if they don't exist. Ensure the database user specified in `.env` has permission to create tables and functions in the target database.

### Running the Application

1.  Ensure your PostgreSQL and Redis servers are running.
2.  Start the Node.js server:

    ```bash
    npm start
    # OR directly:
    # node app.js
    ```

3.  Open your web browser and navigate to `http://localhost:PORT` (e.g., `http://localhost:3000` if `PORT=3000`).

## Security Features

-   **Password Hashing:** User passwords are securely hashed using `bcrypt` before storage. Plain text passwords are never stored.
-   **Note Encryption:** Note titles and content are encrypted using AES-256-GCM. The decryption key is derived from the user's password at login and cached securely (using Redis) for the duration of the session, minimizing exposure.
-   **JWT Authentication:** Secure, stateless authentication using JSON Web Tokens with an expiration time.
-   **Input Validation:** Basic validation is performed on user inputs (username length, password length, email format).
-   **Rate Limiting:** Limits failed login attempts per user to mitigate brute-force attacks.
-   **Secure Key Management:** Relies on a strong, configurable `SECRET_KEY` for JWT signing and derivation of encryption keys from user passwords.
-   **HTTPS:** Recommended for production deployment to protect data in transit. (Requires separate setup on the deployment server/proxy).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue for bugs, feature requests, or improvements.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## License

Distributed under the MIT License.

