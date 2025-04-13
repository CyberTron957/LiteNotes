# FastNotes (Minimalist Notes App)

FastNotes is a minimalist web-based notes application built with Node.js, Express.js, and SQLite. It allows users to create, edit, and delete notes with a clean, dark-themed interface. The application features JWT-based user authentication and local storage support for offline note-taking, with automatic merging of local notes upon login.

## Features

- **User Authentication:** Register and Login via a popup modal using JWT for secure sessions.
- **Offline Support:** Notes are saved to local storage when offline.
- **Cloud Sync:** Local notes are automatically uploaded/merged to the user's account upon login.
- **CRUD Operations:** Create, read, update, and delete notes.
- **Real-time Saving:** Notes are automatically saved shortly after edits (debounced).
- **Speed:** Focused on 
- **Single Editor:** Uses a single textarea where the first line serves as the note's title.
- **Minimalist UI:** Custom-built dark theme with a focus on simplicity.
- **Collapsible Sidebar:** Sidebar lists notes and can be hidden (state is remembered).
- **Styled Components:** Includes custom-styled scrollbars and toast notifications.
- **Technology Stack:**
    - Backend: Node.js, Express.js, SQLite
    - Frontend: HTML, CSS, JavaScript (no framework)
    - Authentication: bcryptjs (hashing), jsonwebtoken (JWT)

