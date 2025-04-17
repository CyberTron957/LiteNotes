const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const userInitial = document.getElementById('user-initial');
const displayUsername = document.getElementById('display-username');
const notesList = document.getElementById('notes-list');
const createNoteBtn = document.getElementById('create-note-btn');
const noteView = document.getElementById('note-view');
const toast = document.getElementById('toast');
const logoutBtn = document.getElementById('logout-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');
const userInfoSection = document.getElementById('user-info-section');
const signinPrompt = document.getElementById('signin-prompt');
const showLoginBtn = document.getElementById('show-login-btn');
const authModal = document.getElementById('auth-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const showForgotPassword = document.getElementById('show-forgot-password');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordButton = document.getElementById('forgot-password-button');
const showLoginFromForgot = document.getElementById('show-login-from-forgot');
const themeToggle = document.getElementById('theme-toggle');
const themePalette = document.getElementById('theme-palette');
const themeOptions = document.querySelectorAll('.theme-option');
const fontOptions = document.querySelectorAll('.font-option');
const backgroundOptions = document.querySelectorAll('.background-option');
const infoToggle = document.getElementById('info-toggle');
const infoPopup = document.getElementById('info-popup');

// Global variables
let currentUser = null;
let currentToken = null;
let notes = [];
let currentNoteId = null;
let saveTimeout = null;
let statusDotFadeTimeout = null; // Timeout ID for dot fade
let isSidebarHidden = true; // Default to hidden
let isDarkMode = true; // Default to dark mode
let currentTheme = 'dark'; // Default theme
let isPaletteOpen = false;
let currentFont = 'inter'; // Default font
let currentBackground = 'none'; // Default background
let socket = null;
let isOffline = !navigator.onLine; // Track online/offline status
let saveAbortController = null; // Added for AbortController
let isInfoPopupOpen = false; // Added global for info popup state

// Set up offline/online event listeners
window.addEventListener('online', handleOnlineStatusChange);
window.addEventListener('offline', handleOnlineStatusChange);

// Handle online/offline status changes
function handleOnlineStatusChange() {
    const wasOffline = isOffline;
    isOffline = !navigator.onLine;
    
    if (wasOffline && !isOffline) {
        // Went from offline to online
        showToast('Connected! You are back online.', 'success');
        // Try to sync local changes if user is logged in
        if (currentToken) {
            fetchNotes();
        }
    } else if (!wasOffline && isOffline) {
        // Went from online to offline
        showToast('Offline mode enabled. Changes will be saved locally.', 'info');
    }
}

// Event Listeners
showRegister.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    forgotPasswordForm.style.display = 'none';
    modalTitle.textContent = 'Register';
    modalSubtitle.textContent = 'Create an account to save notes';
});

showLogin.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    forgotPasswordForm.style.display = 'none';
    modalTitle.textContent = 'Sign In';
    modalSubtitle.textContent = 'Sync your notes across devices';
});

loginButton.addEventListener('click', login);
registerButton.addEventListener('click', register);
createNoteBtn.addEventListener('click', createNewNote);

// Logout functionality
logoutBtn.addEventListener('click', logout);

// Toggle sidebar
sidebarToggle.addEventListener('click', toggleSidebar);

// Show login modal
showLoginBtn.addEventListener('click', () => {
    // Close mobile sidebar if open before showing modal
    if (window.innerWidth <= 768 && document.body.classList.contains('sidebar-visible')) {
        toggleMobileSidebar();
    }
    
    authModal.classList.add('visible');
    // Ensure login form is visible by default when modal opens
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    forgotPasswordForm.style.display = 'none';
    modalTitle.textContent = 'Sign In';
    modalSubtitle.textContent = 'Sync your notes across devices';
});

// Show Forgot Password form
showForgotPassword.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    forgotPasswordForm.style.display = 'block';
    modalTitle.textContent = 'Reset Password';
    modalSubtitle.textContent = 'Enter your email to receive a reset link.';
});

// Show Login from Forgot Password form
showLoginFromForgot.addEventListener('click', () => {
    forgotPasswordForm.style.display = 'none';
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    modalTitle.textContent = 'Sign In';
    modalSubtitle.textContent = 'Sync your notes across devices';
});

// Forgot Password button action
forgotPasswordButton.addEventListener('click', requestPasswordReset);

// Close login modal
modalCloseBtn.addEventListener('click', () => {
    authModal.classList.remove('visible');
});

authModal.addEventListener('click', (event) => {
    // Close if clicked outside the modal content
    if (event.target === authModal) {
        authModal.classList.remove('visible');
    }
});

// Theme toggle functionality
themeToggle.addEventListener('click', toggleThemePalette);

// Info toggle functionality
infoToggle.addEventListener('click', toggleInfoPopup);

// Theme options click events
themeOptions.forEach(option => {
    option.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme');
        setTheme(theme);
    });
});

// Font option click events
fontOptions.forEach(option => {
    option.addEventListener('click', function() {
        const font = this.getAttribute('data-font');
        setFont(font);
        // Don't close the palette when changing font
    });
});

// Close theme palette or info popup when clicking outside
document.addEventListener('click', function(event) {
    // Close theme palette
    if (isPaletteOpen && !themePalette.contains(event.target) && event.target !== themeToggle) {
        toggleThemePalette();
    }
    // Close info popup
    if (isInfoPopupOpen && !infoPopup.contains(event.target) && event.target !== infoToggle) {
        toggleInfoPopup();
    }
});

// Background option click events
backgroundOptions.forEach(option => {
    option.addEventListener('click', function() {
        const background = this.getAttribute('data-background');
        setBackground(background);
        // Don't close the palette when changing background
    });
});

// Mobile sidebar overlay handling
let sidebarOverlay;
function createMobileElements() {
    // Create sidebar overlay if it doesn't exist
    if (!document.querySelector('.sidebar-overlay')) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);

        // Close sidebar when clicking overlay (only needed once)
        sidebarOverlay.addEventListener('click', toggleMobileSidebar);
    }
}

// Unified mobile sidebar toggle function
function toggleMobileSidebar() {
    if (window.innerWidth <= 768) {
        document.body.classList.toggle('sidebar-visible');
    }
}

// Toggle sidebar (handles both desktop and mobile)
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        toggleMobileSidebar(); // Use the unified mobile toggle
    } else {
        // Desktop behavior
        isSidebarHidden = !isSidebarHidden;
        appContainer.classList.toggle('sidebar-hidden');
        localStorage.setItem('sidebarState', isSidebarHidden ? 'hidden' : 'visible');
    }
}

// Check if mobile view on resize
window.addEventListener('resize', handleResize);

function handleResize() {
    if (window.innerWidth <= 768) {
        // Mobile view
        createMobileElements();
        // Ensure sidebar is initially hidden and body class is set
        document.body.classList.remove('sidebar-visible');
        appContainer.classList.add('sidebar-hidden-init-mobile'); // Use a temp class if needed
        // Remove desktop classes if present
        appContainer.classList.remove('sidebar-hidden');
    } else {
        // Desktop view
        appContainer.classList.remove('sidebar-hidden-init-mobile'); // Remove temp class
        document.body.classList.remove('sidebar-visible'); // Ensure mobile class is removed
        const storedState = localStorage.getItem('sidebarState');
        if (storedState === 'visible') {
            appContainer.classList.remove('sidebar-hidden');
        } else {
            appContainer.classList.add('sidebar-hidden');
        }
        // Remove overlay if it exists
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
    }
}

// Check auth status and initialize app
async function initializeApp() {
    // Create mobile elements
    createMobileElements();
    
    // Handle mobile/desktop view on startup first
    handleResize(); 

    // Check for saved theme and font preferences
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        // Handle case where saved theme is 'dark' which we've removed
        if (savedTheme === 'dark') {
            // Use 'slate' as fallback for 'dark'
            setTheme('slate');
        } 
        // Handle case where saved theme is 'mono' or 'warm' which we've removed
        else if (savedTheme === 'mono' || savedTheme === 'warm') {
            // Use 'rose-gold' as fallback for removed themes
            setTheme('rose-gold');
        }
        else {
            setTheme(savedTheme);
        }
    } else {
        // On first visit with no saved theme, use a random theme
        const themes = ['light', 'sepia', 'blue', 'mint', 'lavender', 'rose-gold', 'slate', 'midnight', 'forest', 'monochrome'];
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        setTheme(randomTheme);
    }
    
    const savedFont = localStorage.getItem('font');
    if (savedFont) {
        setFont(savedFont);
    } else {
        setFont('inter'); // Default font
    }
    
    const savedBackground = localStorage.getItem('background');
    if (savedBackground) {
        setBackground(savedBackground);
    } else {
        setBackground('none'); // Default background
    }
    
    // Initialize theme, font, and background options
    initThemeAndFontOptions();
    
    // Restore sidebar state first
    const storedSidebarState = localStorage.getItem('sidebarState');
    if (storedSidebarState) {
        isSidebarHidden = storedSidebarState === 'hidden';
        if (isSidebarHidden) {
            appContainer.classList.add('sidebar-hidden');
        } else {
            appContainer.classList.remove('sidebar-hidden');
        }
    } else {
        localStorage.setItem('sidebarState', 'hidden');
    }

    // Determine auth status
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        // User is logged in
        currentToken = token;
        currentUser = username;
        displayUsername.textContent = username;
        userInitial.textContent = username.charAt(0).toUpperCase();
        userInfoSection.style.display = 'flex';
        signinPrompt.style.display = 'none';
        authModal.classList.remove('visible');
        // Initialize Socket.IO connection
        initializeSocket();
        // Fetch notes (this function now sorts and updates global `notes`)
        await fetchNotes(); 
    } else {
        // User is not logged in
        userInfoSection.style.display = 'none';
        signinPrompt.style.display = 'block';
        // Load notes (this function now sorts and updates global `notes`)
        loadLocalNotes(); 
    }

    // Ensure app container is visible AFTER potentially loading notes
    appContainer.style.display = 'flex';
    // Force a style recalculation maybe?
    window.getComputedStyle(appContainer).display;
    // Remove temporary mobile init class after display
    appContainer.classList.remove('sidebar-hidden-init-mobile');

    // If no notes exist after loading, create a default one
    if (notes.length === 0) {
        //console.log("No notes found, creating initial note...");
        await createNewNote(); // Wait for creation and selection
        //console.log("Initial note created.");
    } else {
        // Only try to select existing note if we didn't just create one
        //console.log("Attempting to select last opened note...");
        const lastOpenNoteId = localStorage.getItem('lastOpenNoteId');
        //console.log("lastOpenNoteId from storage:", lastOpenNoteId);
        //console.log("Current notes array (length):", notes.length);
        //console.log("Current notes array (IDs):", notes.map(n => n.id));

        const lastNote = notes.find(note => note.id === lastOpenNoteId);

        if (lastNote) {
            //console.log("Found last note, selecting:", lastNote.id);
            selectNote(lastNote.id);
        } else if (notes.length > 0) { // Should always be true here unless create failed
            //console.log("Last note not found or invalid, selecting first note:", notes[0].id);
            selectNote(notes[0].id); // Select the first (most recent) note
        } else {
             // This case should ideally not be reached if creation worked
            //console.log("No notes found, rendering empty view.");
            renderEmptyNoteView();
        }
    }
}

// Load notes from local storage
function loadLocalNotes() {
    const localNotes = localStorage.getItem('localNotes');
    let loaded = localNotes ? JSON.parse(localNotes) : [];
    // Ensure timestamps exist and sort
    loaded.forEach(note => {
        if (!note.updated_at) note.updated_at = note.created_at || new Date(0).toISOString(); 
    });
    loaded.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    notes = loaded; // Directly update global notes
    renderNotesList(); // Update sidebar list
    // Don't return anything, rely on global update
}

// Save notes to local storage
function saveLocalNotes() {
    localStorage.setItem('localNotes', JSON.stringify(notes));
}

// Login function
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showToast('Please enter both username and password', 'error');
        return;
    }

    // Check if there are local notes
    const localNotesRaw = localStorage.getItem('localNotes');
    const localNotesExist = localNotesRaw && localNotesRaw !== '[]';

    if (localNotesExist) {
        // Show custom merge modal instead of confirm dialog
        showMergeNotesModal(username, password);
        return; // Exit the function here; the actual login will happen after user's choice
    }

    // If no local notes, proceed with login directly
    await performLogin(username, password, false);
}

// Function to show the merge notes modal
function showMergeNotesModal(username, password) {
    const mergeModal = document.getElementById('merge-notes-modal');
    const confirmBtn = document.getElementById('merge-confirm-btn');
    const cancelBtn = document.getElementById('merge-cancel-btn');
    
    // Show the modal
    mergeModal.classList.add('visible');
    
    // Setup event listeners for the buttons
    confirmBtn.onclick = async () => {
        mergeModal.classList.remove('visible');
        await performLogin(username, password, true); // Login with merge=true
    };
    
    cancelBtn.onclick = async () => {
        mergeModal.classList.remove('visible');
        await performLogin(username, password, false); // Login with merge=false
    };
}

// Separated login functionality to be called after user decision
async function performLogin(username, password, shouldMerge) {
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        currentToken = data.token;
        currentUser = username;
        
        // Save to localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', username);
        
        displayUsername.textContent = username;
        userInitial.textContent = username.charAt(0).toUpperCase();
        userInfoSection.style.display = 'flex';
        signinPrompt.style.display = 'none';
        
        // Close modal on successful login
        authModal.classList.remove('visible');
        
        // Initialize Socket.IO connection AFTER successful login
        initializeSocket();
        
        // Fetch server notes first, BEFORE merge attempt
        const serverNotes = await fetchNotes(); // <-- Capture the returned notes

        // Attempt to merge local notes if they existed and user chose to merge
        const localNotesRaw = localStorage.getItem('localNotes');
        const localNotesExist = localNotesRaw && localNotesRaw !== '[]';
        
        if (localNotesExist && shouldMerge && serverNotes) {
             //console.log("Starting merge process...");
             await mergeLocalNotesWithServer(JSON.parse(localNotesRaw), serverNotes);
             //console.log("Merge process finished. Clearing local notes and fetching final list.");
             // Clear local notes *after* successful merge attempt
             localStorage.removeItem('localNotes');
             // Re-fetch the final merged list from the server to ensure consistency
             await fetchNotes(); 
        } else if (localNotesExist && !shouldMerge) {
             // User chose NOT to merge - just clear local notes
             localStorage.removeItem('localNotes');
             // No need to re-fetch; serverNotes already contains the server state
        } else {
             //console.log("No local notes to merge or server notes fetch failed.");
             // If no merge happened, the global `notes` variable was already updated 
             // by the initial fetchNotes call above, so no need to fetch again unless serverNotes failed.
             if (!serverNotes) {
                 await fetchNotes(); // Retry fetch if the first one failed
             }
        }
        
        showToast('Logged in successfully', 'success');

         // Select the first note after login/merge
         if (notes.length > 0) {
             selectNote(notes[0].id);
         } else {
             renderEmptyNoteView();
         }

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Register function
async function register() {
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const email = document.getElementById('reg-email').value; // Get email value
    
    // Basic Frontend Validation (already done mostly on backend, but good practice)
    if (!username || username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    if (!password || password.length < 7) {
        showToast('Password must be at least 7 characters', 'error');
        return;
    }
    // Basic email format validation (optional)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Invalid email format', 'error');
        return;
    }
    
    try {
        const body = { username, password };
        if (email) {
            body.email = email; // Include email if provided
        }

        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body) // Send body object
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        showToast('Account created successfully', 'success');
        
        // Switch back to login in the modal
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        forgotPasswordForm.style.display = 'none'; // Hide forgot form
        modalTitle.textContent = 'Sign In';
        modalSubtitle.textContent = 'Sync your notes across devices';
        
        // Auto-fill login fields in the modal
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Fetch all notes (from server)
async function fetchNotes() {
    if (!currentToken) return null;
    
    // If offline, don't attempt to fetch from server
    if (isOffline) {
        showToast('Working offline. Your notes are saved locally.', 'info');
        return notes; // Return current notes array
    }
    
    //console.log("Fetching notes from server...");
    try {
        const response = await fetch('/notes', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            // Handle token expiration/invalidation
            if (response.status === 401 || response.status === 403) {
                //console.log("Token invalid/expired during fetchNotes. Logging out.");
                logout(); // Attempt logout to clear local state
                return []; // Return empty array as user is logged out
            }
            throw new Error('Failed to fetch notes from server');
        }
        
        let fetchedNotes = await response.json();
        //console.log(`Fetched ${fetchedNotes.length} notes.`);

        // Ensure timestamps exist and sort (using updated_at)
        fetchedNotes.forEach(note => {
            // Use updated_at if available, otherwise created_at, fallback to epoch
            note.sort_timestamp = note.updated_at || note.created_at || new Date(0).toISOString(); 
        });
        fetchedNotes.sort((a, b) => new Date(b.sort_timestamp) - new Date(a.sort_timestamp));
        
        // Update global notes array (still useful for immediate UI updates)
        notes = fetchedNotes; 
        renderNotesList();
        
        //console.log("Notes fetched, sorted, and sidebar rendered.");
        return fetchedNotes; // <-- RETURN the fetched notes

    } catch (error) {
        if (isOffline) {
            showToast('Working offline. Your notes are saved locally.', 'info');
        } else {
            showToast('Error connecting to server. Working in offline mode.', 'warning');
            isOffline = true; // Manually set offline mode
        }
        return notes; // Return current notes (may be empty or from local storage)
    }
}

// Render the notes list in the sidebar
function renderNotesList() {
    notesList.innerHTML = '';
    
    if (notes.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'note-item';
        emptyItem.textContent = 'No notes yet';
        notesList.appendChild(emptyItem);
        return;
    }
    
    notes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        if (currentNoteId === note.id) {
            noteItem.classList.add('active');
        }
        // Display "Untitled" in the sidebar for empty titles, but keep the actual title empty
        noteItem.textContent = note.title || 'Untitled';
        // Ensure note IDs are unique for local notes
        noteItem.dataset.noteId = note.id;
        noteItem.addEventListener('click', () => selectNote(note.id));
        notesList.appendChild(noteItem);
    });
}

// Select a note
function selectNote(noteId) {
    currentNoteId = noteId;
    // Find note by ID (works for both server and local)
    const selectedNote = notes.find(note => note.id === noteId);
    
    if (selectedNote) {
        renderNoteView(selectedNote);
        renderNotesList(); // Update the active state in the list
        localStorage.setItem('lastOpenNoteId', noteId); // Store last opened note
    } else {
        // Handle case where note might have been deleted
        currentNoteId = null;
        renderEmptyNoteView();
    }
}

// Render the note editor
function renderNoteView(note) {
    const created = new Date(note.created_at);
    const formattedDate = created.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
    });
    
    // Combine title and content for the textarea
    const combinedContent = `${note.title || ''}\n${note.content || ''}`;

    noteView.innerHTML = `
        <div class="note-background bg-${currentBackground}"></div>
        <div class="note-content">
            <textarea 
                class="note-editor" 
                id="note-content" 
                placeholder="Start typing... Title is the first line."
                spellcheck="false" 
                autocorrect="off" 
                autocapitalize="off"
            >${combinedContent}</textarea>
        </div>
        <!-- Action buttons and status dot positioned absolutely/fixed -->
        <div class="note-actions">
            <div class="delete-note" id="delete-note-btn" title="Delete note">
                 <i class="fas fa-trash"></i>
            </div>
        </div>
        <div id="save-status-dot" class="save-status-dot"></div>
    `;
    
    // Get elements after setting innerHTML
    const contentInput = document.getElementById('note-content');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const saveStatusDot = document.getElementById('save-status-dot');

    // Add standard event listeners
    contentInput.addEventListener('input', () => scheduleNoteSave(saveStatusDot));
    deleteNoteBtn.addEventListener('click', () => {
        showDeleteConfirmation(note.id, deleteNoteBtn);
    });

    // ---- Add Keydown Listener for Bullet Points ----
    contentInput.addEventListener('keydown', handleNoteEditorKeyDown);
    // ----------------------------------------------

    // Restore scroll position
    const savedScrollPosition = getScrollPosition(note.id);
    if (contentInput && savedScrollPosition > 0) {
        // Use setTimeout to ensure content is rendered before setting scroll
        setTimeout(() => {
            contentInput.scrollTop = savedScrollPosition;
        }, 0);
    }
}

// Show delete confirmation popup
function showDeleteConfirmation(noteId, buttonElement) {
    const popup = document.getElementById('delete-confirm-popup');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    
    // Position the popup near the delete button
    const buttonRect = buttonElement.getBoundingClientRect();
    popup.style.top = `${buttonRect.bottom + 10}px`;
    popup.style.left = `${buttonRect.left - 160 + buttonRect.width / 2}px`; // Center it near the button
    
    // Show the popup
    popup.classList.add('visible');
    
    // Handle button clicks
    confirmBtn.onclick = () => {
        popup.classList.remove('visible');
        deleteNote(noteId);
    };
    
    cancelBtn.onclick = () => {
        popup.classList.remove('visible');
    };
    
    // Close popup when clicking outside
    document.addEventListener('click', function closePopup(e) {
        if (!popup.contains(e.target) && e.target !== buttonElement) {
            popup.classList.remove('visible');
            document.removeEventListener('click', closePopup);
        }
    });
}

// Render empty note view
function renderEmptyNoteView() {
    noteView.innerHTML = `
        <div class="note-background bg-${currentBackground}"></div>
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <h2>No note selected</h2>
            <p>Select a note from the sidebar or create a new one to get started.</p>
        </div>
    `;
}

// Create a new note
async function createNewNote() {
    if (currentToken && !isOffline) {
        // Logged in and online: Create on server
        try {
            const response = await fetch('/notes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: '',
                    content: ''
                })
            });
            
            if (!response.ok) {
                // Check if it's a network error
                if (response.status === 0) {
                    isOffline = true;
                    showToast('Network unavailable. Working in offline mode.', 'info');
                    // Fall back to local note creation
                    createLocalNote();
                    return;
                } else {
                    throw new Error('Failed to create note on server');
                }
            }
            
            const data = await response.json();
            
            const newNote = {
                id: data.id,
                title: '',
                content: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString() // Add updated_at
            };
            
            notes.unshift(newNote); // Add to beginning
            // No need to sort here, unshift keeps it at the top temporarily
            renderNotesList();
            selectNote(newNote.id);
        } catch (error) {
            // Check if it's a network error
            if (!navigator.onLine || error.message.includes('network') || error.message.includes('fetch')) {
                isOffline = true;
                showToast('Network unavailable. Working in offline mode.', 'info');
                // Fall back to local note creation
                createLocalNote();
            } else {
                showToast(error.message, 'error');
            }
        }
    } else {
        // Not logged in or offline: Create locally
        createLocalNote();
    }
}

// Helper function to create a local note
function createLocalNote() {
    const newNote = {
        id: `local-${Date.now()}`, 
        title: '',
        content: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString() // Add updated_at
    };
    notes.unshift(newNote);
    // No need to sort here
    saveLocalNotes(); // Save to local storage
    renderNotesList();
    selectNote(newNote.id);
}

// Schedule a note save (debounce)
function scheduleNoteSave(saveStatusDot) { // Pass the dot element
    // Show saving indicator dot
    if (saveStatusDot) {
        clearTimeout(statusDotFadeTimeout);
        saveStatusDot.classList.remove('saved', 'error');
        saveStatusDot.classList.add('saving', 'visible');
    }

    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // --- Abort previous pending save fetch --- Added
    if (saveAbortController) {
        console.log('Aborting previous save request...');
        saveAbortController.abort();
    }
    // Create a new controller for the upcoming save
    saveAbortController = new AbortController();
    // -------------------------------------------

    // Schedule new save
    saveTimeout = setTimeout(() => {
        saveCurrentNote();
    }, 1500); // Increased delay to 1.5 seconds (from 0.5)
}

// --- Scroll Position Persistence ---
function getScrollPositions() {
    const data = localStorage.getItem('noteScrollPositions');
    return data ? JSON.parse(data) : {};
}

function saveScrollPosition(noteId, scrollTop) {
    if (!noteId) return;
    const positions = getScrollPositions();
    positions[noteId] = scrollTop;
    localStorage.setItem('noteScrollPositions', JSON.stringify(positions));
}

function getScrollPosition(noteId) {
    if (!noteId) return 0;
    const positions = getScrollPositions();
    return positions[noteId] || 0; // Default to 0 if not found
}
// --- End Scroll Position --- 

// Save the current note
async function saveCurrentNote() {
    if (!currentNoteId) return;
    
    const contentInput = document.getElementById('note-content');
    const saveStatusDot = document.getElementById('save-status-dot'); 
    
    if (!contentInput || !saveStatusDot) return;
    
    // Extract title and content from textarea
    const fullText = contentInput.value;
    const newlineIndex = fullText.indexOf('\n');
    let title = '';
    let content = '';

    if (newlineIndex === -1) {
        // No newline, entire text is title
        title = fullText;
    } else {
        title = fullText.substring(0, newlineIndex);
        content = fullText.substring(newlineIndex + 1);
    }

    title = title.trim(); // Trim whitespace from title
    // Use the title as-is, even if empty - no automatic "Untitled" replacement
    // const finalTitle = title === '' ? 'Untitled' : title;

    // Update local array first for responsiveness
    const noteIndex = notes.findIndex(note => note.id === currentNoteId);
    if (noteIndex !== -1) {
        notes[noteIndex].title = title; // Use the exact title without defaulting
        notes[noteIndex].content = content;
        notes[noteIndex].updated_at = new Date().toISOString(); // Update timestamp
        
        // Re-sort the notes array after updating
        notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        renderNotesList(); // Update title/order in sidebar immediately
    }

    if (currentToken && !isOffline) {
        // Logged in and online: Save to server
        try {
            const response = await fetch(`/notes/${currentNoteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: title, content }),
                signal: saveAbortController?.signal // Pass the abort signal - Added
            });
            
            // Reset controller only after successful completion or non-abort error
            saveAbortController = null; // Added reset here

            if (!response.ok) {
                if (response.status === 0) {
                    // Network error - likely offline
                    isOffline = true;
                    showToast('Network unavailable. Working in offline mode.', 'info');
                    saveLocalNotes(); // Save locally as fallback
                } else {
                    throw new Error('Failed to save note to server');
                }
            } else {
                // Update save indicator dot to green (saved)
                saveStatusDot.classList.remove('saving', 'error');
                saveStatusDot.classList.add('saved', 'visible');
            }
            
            // Set timeout to hide the dot after a delay
            clearTimeout(statusDotFadeTimeout);
            statusDotFadeTimeout = setTimeout(() => {
                saveStatusDot.classList.remove('visible');
            }, 2000); // Hide after 2 seconds

            // Save scroll position after successful server save
            if (contentInput) {
                saveScrollPosition(currentNoteId, contentInput.scrollTop);
            }

        } catch (error) {
            // Handle AbortError specifically
            if (error.name === 'AbortError') {
                console.log('Save fetch request aborted.');
                // Don't show an error toast for expected aborts
                // Keep the saving indicator potentially?
                saveStatusDot.classList.remove('saved', 'error'); // Reset dot state
                saveStatusDot.classList.add('saving'); // Maybe keep saving? Or remove visible? Test UX.
                // saveStatusDot.classList.remove('visible'); 
            } else if (!navigator.onLine || error.message.includes('network') || error.message.includes('fetch')) {
                isOffline = true;
                showToast('Network unavailable. Working in offline mode.', 'info');
                saveLocalNotes(); // Save locally as fallback
                
                // Update dot to indicate local save (still green)
                saveStatusDot.classList.remove('saving', 'error');
                saveStatusDot.classList.add('saved', 'visible');
                saveAbortController = null; // Reset controller on other errors too
            } else {
                showToast(error.message, 'error');
                // Indicate error with red dot
                saveStatusDot.classList.remove('saving', 'saved');
                saveStatusDot.classList.add('error', 'visible');
                saveAbortController = null; // Reset controller on other errors too
            }
        }
    } else {
        // Not logged in or offline: Save locally
        saveLocalNotes();
        // Update dot to indicate local save (green)
        saveStatusDot.classList.remove('saving', 'error');
        saveStatusDot.classList.add('saved', 'visible');
        
        // Set timeout to hide the dot after a delay
        clearTimeout(statusDotFadeTimeout);
        statusDotFadeTimeout = setTimeout(() => {
            saveStatusDot.classList.remove('visible');
        }, 2000); 
        
        //console.log("Note saved locally");
         // Save scroll position after successful local save
        if (contentInput) {
            saveScrollPosition(currentNoteId, contentInput.scrollTop);
        }
        saveAbortController = null; // Reset controller even for local save
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('visible');
    
    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

// Delete note function
async function deleteNote(noteId) {
    if (currentToken && !isOffline) {
        // Logged in and online: Delete from server
        try {
            const response = await fetch(`/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            if (!response.ok) {
                // Check if it's a network error
                if (response.status === 0) {
                    isOffline = true;
                    showToast('Network unavailable. Deleted note locally only.', 'info');
                    // Continue with local deletion
                } else {
                    throw new Error('Failed to delete note from server');
                }
            }
            
            // Successfully deleted from server, proceed with local deletion
        } catch (error) {
            // Check if it's a network error
            if (!navigator.onLine || error.message.includes('network') || error.message.includes('fetch')) {
                isOffline = true;
                showToast('Network unavailable. Deleted note locally only.', 'info');
                // Continue with local deletion
            } else {
                showToast(error.message, 'error');
                return; // Stop if server delete failed for a reason other than network
            }
        }
    }
    
    // Remove note from local array (for both logged in and local)
    notes = notes.filter(note => note.id !== noteId);
    
    if (!currentToken || isOffline) {
        saveLocalNotes(); // Update local storage if not logged in or offline
    }
    
    // Update UI
    renderNotesList();
    
    // Select next note or show empty state
    if (currentNoteId === noteId) {
        localStorage.removeItem('lastOpenNoteId'); // Clear last opened if it was deleted
        if (notes.length > 0) {
            selectNote(notes[0].id); // Select the new top note
        } else {
            currentNoteId = null;
            renderEmptyNoteView();
        }
    }
    
    showToast('Note deleted successfully', 'success');
}

// Logout function
async function logout() {
    // Disconnect Socket.IO before clearing local data
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    try {
        // Call the backend logout, even if it just clears session
        // The client-side token removal is the main part for JWT logout
        await fetch('/logout', {
            method: 'POST',
             headers: {
                 // Include token if backend expects it, though not strictly necessary
                 // if logout only destroys server session
                 'Authorization': `Bearer ${currentToken}`
             }
        });
        
        // Proceed with local logout regardless of server response
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        currentToken = null;
        currentUser = null;
        notes = [];
        currentNoteId = null;
        
        // Clear local data (including local notes)
        localStorage.removeItem('localNotes');
        localStorage.removeItem('sidebarState'); // Clear sidebar state too
        localStorage.removeItem('lastOpenNoteId'); // Clear last open note ID
        localStorage.removeItem('noteScrollPositions'); // Clear scroll positions
        localStorage.removeItem('theme'); // Reset theme
        localStorage.removeItem('font'); // Reset font
        localStorage.removeItem('background'); // Reset background
        
        // Reset UI to logged-out state
        userInfoSection.style.display = 'none';
        signinPrompt.style.display = 'block';
        setTheme('light'); // Reset to default theme
        setFont('inter'); // Reset to default font
        setBackground('none'); // Reset to default background
        loadLocalNotes(); // Load any potentially remaining local notes (though usually cleared)
        renderEmptyNoteView(); // Show empty state
        
        showToast('Logged out successfully', 'success');
    } catch (error) {
        // Just log the error but still log out
        console.error('Error during logout:', error);
        
        // Clear local data anyway
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('localNotes');
        localStorage.removeItem('sidebarState'); // Clear sidebar state too
        localStorage.removeItem('lastOpenNoteId');
        localStorage.removeItem('noteScrollPositions');
        localStorage.removeItem('theme');
        localStorage.removeItem('font');
        localStorage.removeItem('background');
        
        // Reset UI to logged-out state
        userInfoSection.style.display = 'none';
        signinPrompt.style.display = 'block';
        setTheme('dark');
        setFont('inter');
        setBackground('none');
        loadLocalNotes();
        renderEmptyNoteView();
    }
}

// Function to merge local notes with server
async function mergeLocalNotesWithServer(localNotes, serverNotes) {
    //console.log("Attempting to merge local notes...");
    let uploadPromises = [];

    for (const localNote of localNotes) {
        // Check if a similar note exists on the server (simple title/content check)
        const existsOnServer = serverNotes.some(serverNote => 
            serverNote.title === localNote.title && serverNote.content === localNote.content
        );

        if (!existsOnServer) {
            //console.log(`Uploading local note: ${localNote.title}`);
            // If it doesn't exist, upload it
            uploadPromises.push(
                fetch('/notes', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        title: localNote.title || '', 
                        content: localNote.content || '' 
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        console.error(`Failed to upload local note: ${localNote.title}`);
                    }
                    return response;
                })
                .catch(error => {
                     console.error(`Error uploading local note: ${localNote.title}`, error);
                })
            );
        }
    }

    // Wait for all uploads to attempt
    await Promise.all(uploadPromises);
    //console.log("Local note merge process finished.");
}

// Request Password Reset function
async function requestPasswordReset() {
    const email = document.getElementById('forgot-email').value;
    const forgotButton = document.getElementById('forgot-password-button'); // Get button

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    try {
        // Disable button and show loading state
        forgotButton.disabled = true;
        forgotButton.textContent = 'Sending...';

        const response = await fetch('/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
             // Even on failure from backend, show generic message to avoid revealing info
             showToast('If an account exists for that email, a reset link has been sent.', 'success');
        } else {
             showToast(data.message, 'success');
        }

        // Optionally hide modal or switch back to login after request
        authModal.classList.remove('visible'); 

    } catch (error) {
        console.error('Forgot password error:', error);
        showToast('An error occurred. Please try again.', 'error');
        // Re-enable button and restore text on error
        forgotButton.disabled = false;
        forgotButton.textContent = 'Send Reset Link';
    }
}

// Toggle theme palette
function toggleThemePalette() {
    // Close info popup if it's open
    if (isInfoPopupOpen) {
        toggleInfoPopup(); 
    }
    
    isPaletteOpen = !isPaletteOpen;
    if (isPaletteOpen) {
        themePalette.classList.add('active');
        
        // For mobile, also add a touch-friendly way to close by tapping outside
        if (window.innerWidth <= 768) {
            // Create and add a backdrop if it doesn't exist
            if (!document.querySelector('.palette-backdrop')) {
                const backdrop = document.createElement('div');
                backdrop.className = 'palette-backdrop';
                backdrop.style.position = 'fixed';
                backdrop.style.top = '0';
                backdrop.style.left = '0';
                backdrop.style.right = '0';
                backdrop.style.bottom = '0';
                backdrop.style.zIndex = '109'; // Below palette but above other elements
                backdrop.style.backgroundColor = 'transparent'; // Just for capturing taps
                
                // Close palette when tapping outside
                backdrop.addEventListener('click', function(e) {
                    if (isPaletteOpen) {
                        toggleThemePalette();
                    }
                    this.remove();
                });
                
                document.body.appendChild(backdrop);
            }
        }
    } else {
        themePalette.classList.remove('active');
        // Remove backdrop when closing
        const backdrop = document.querySelector('.palette-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }
}

// Toggle info popup
function toggleInfoPopup() {
    // Close theme palette if it's open
    if (isPaletteOpen) {
        toggleThemePalette();
    }
    
    isInfoPopupOpen = !isInfoPopupOpen;
    if (isInfoPopupOpen) {
        infoPopup.classList.add('active');
    } else {
        infoPopup.classList.remove('active');
    }
}

// Set theme function
function setTheme(theme) {
    // Remove all possible theme classes
    document.body.classList.remove(
        'light-theme', 
        'sepia-theme', 
        'slate-theme', 
        'midnight-theme', 
        'charcoal-theme', 
        'forest-theme', 
        'blue-theme', 
        'mint-theme', 
        'lavender-theme', 
        'rose-gold-theme',
        'monochrome-theme'
    );
    
    // Add appropriate theme class
    if (theme !== 'dark') {
        document.body.classList.add(`${theme}-theme`);
    }
    
    // Update active state in theme palette
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === theme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Save theme preference
    localStorage.setItem('theme', theme);
    currentTheme = theme;

    // Clear any inline styles that might interfere with CSS variables
    createNoteBtn.removeAttribute('style');
}

// Set font function
function setFont(font) {
    // Remove all existing font classes
    document.body.classList.remove('font-inter', 'font-mono', 'font-serif', 'font-space');
    
    // Add appropriate font class
    document.body.classList.add(`font-${font}`);
    
    // Update active state in font options
    fontOptions.forEach(option => {
        if (option.getAttribute('data-font') === font) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Save font preference
    localStorage.setItem('font', font);
    currentFont = font;

    // If we've already loaded a note, refresh the editor to apply the new font
    if (currentNoteId) {
        const selectedNote = notes.find(note => note.id === currentNoteId);
        if (selectedNote) {
            renderNoteView(selectedNote);
        }
    }
}

// Set background function
function setBackground(background) {
    // Update active state in background options
    backgroundOptions.forEach(option => {
        if (option.getAttribute('data-background') === background) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Save background preference
    localStorage.setItem('background', background);
    currentBackground = background;
    
    // Update background on current note view if one is open
    if (currentNoteId) {
        const noteBackground = document.querySelector('.note-background');
        if (noteBackground) {
            noteBackground.className = `note-background bg-${background}`;
        } else {
            // If the background element doesn't exist yet, re-render the note view
            const selectedNote = notes.find(note => note.id === currentNoteId);
            if (selectedNote) {
                renderNoteView(selectedNote);
            }
        }
    }
}

// Initialize theme and font options
function initThemeAndFontOptions() {
    // Set initial active states
    themeOptions.forEach(option => {
        if (option.getAttribute('data-theme') === currentTheme) {
            option.classList.add('active');
        }
    });

    fontOptions.forEach(option => {
        if (option.getAttribute('data-font') === currentFont) {
            option.classList.add('active');
        }
    });
    
    backgroundOptions.forEach(option => {
        if (option.getAttribute('data-background') === currentBackground) {
            option.classList.add('active');
        }
    });
}

// Function to initialize Socket.IO connection
function initializeSocket() {
    // Disconnect existing socket if any
    if (socket) {
        console.log('Disconnecting existing socket...');
        socket.disconnect();
        socket = null;
    }

    // Only connect if we have a token
    if (currentToken) {
        console.log('Attempting to connect Socket.IO...');
        socket = io({
            // Send token for authentication
            auth: {
                token: currentToken
            }
            // Optional: Add reconnection attempts etc.
            // reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            console.log('Socket.IO connected successfully:', socket.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected:', reason);
            // Optionally attempt to reconnect or notify user
            socket = null; // Clear socket variable
        });

        socket.on('connect_error', (err) => {
            console.error('Socket.IO connection error:', err.message);
            // Handle auth errors potentially
            if (err.message.includes("Invalid token")) {
                 // Token might be expired/invalid, force logout or re-login prompt
                 console.log("Socket auth failed, logging out.");
                 logout(); // Or show a specific message
            }
        });

        // --- Listen for note updates ---
        socket.on('note_updated', (updatedNote) => {
            console.log('Received note_updated event:', updatedNote);

             // Find the note in the local array
             const noteIndex = notes.findIndex(note => note.id === updatedNote.id);

             let needsListRender = false;
             let needsViewRender = false;

             if (noteIndex !== -1) {
                 // Check if timestamp is newer to avoid race conditions (optional but good)
                 if (new Date(updatedNote.updated_at) > new Date(notes[noteIndex].updated_at)) {
                     console.log(`Updating local note ${updatedNote.id}`);
                     // Update local data
                     const oldTitle = notes[noteIndex].title;
                     notes[noteIndex].title = updatedNote.title;
                     notes[noteIndex].content = updatedNote.content;
                     notes[noteIndex].updated_at = updatedNote.updated_at; // Update timestamp

                     // Mark for UI updates
                     if (oldTitle !== updatedNote.title) {
                          needsListRender = true; // Title changed, update list
                     }

                     // If this is the currently viewed note, update the editor
                     if (currentNoteId === updatedNote.id) {
                         needsViewRender = true; // Content likely changed
                     }

                     // Re-sort notes based on the new timestamp
                     notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                     needsListRender = true; // Order might have changed

                 } else {
                      console.log(`Ignoring stale update for note ${updatedNote.id}`);
                 }

             } else {
                 // Note doesn't exist locally (maybe created on another device?)
                 // You could add logic here to insert it if needed, requires a 'note_created' event
                 console.log(`Received update for unknown note ID ${updatedNote.id}`);
             }

             // Apply UI updates if needed
             if (needsListRender) {
                  renderNotesList(); // Update sidebar titles/order
             }
             if (needsViewRender) {
                 // Re-render the currently viewed note
                 const noteContentView = document.getElementById('note-content');
                 if (noteContentView) {
                     // Preserve cursor/scroll position if possible (basic example)
                     const selectionStart = noteContentView.selectionStart;
                     const selectionEnd = noteContentView.selectionEnd;
                     const scrollTop = noteContentView.scrollTop;

                     // Update the textarea content (title + content)
                     const combinedContent = `${updatedNote.title || ''}\n${updatedNote.content || ''}`;
                     noteContentView.value = combinedContent;

                     // Restore cursor/scroll (might need adjustment)
                     noteContentView.selectionStart = selectionStart;
                     noteContentView.selectionEnd = selectionEnd;
                     noteContentView.scrollTop = scrollTop;
                 } else {
                      // Fallback: re-render the whole view (loses cursor)
                      renderNoteView(notes[noteIndex]);
                 }
             }
        });

    } else {
        console.log('No token found, skipping Socket.IO connection.');
    }
}

// Handle Keydown events in the note editor (for bullet points)
function handleNoteEditorKeyDown(event) {
    if (event.key === 'Enter') {
        const textarea = event.target;
        const currentPos = textarea.selectionStart;
        const text = textarea.value;

        // Find the start of the current line
        let lineStart = currentPos - 1;
        while (lineStart >= 0 && text[lineStart] !== '\n') {
            lineStart--;
        }
        lineStart++; // Move past the '\n' or to the beginning of the text

        const currentLine = text.substring(lineStart, currentPos);

        // Regex to match a bullet point line (*, -, +) with optional indentation
        // It captures: 1=indentation, 2=bullet char, 3=rest of the line
        const bulletRegex = /^(\s*)([\*\-\+])(\s+)(.*)/;
        const match = currentLine.match(bulletRegex);

        if (match) {
            const indentation = match[1];
            const bulletChar = match[2];
            const spacing = match[3]; // Space(s) after bullet
            const lineContent = match[4];

            if (lineContent.trim().length > 0) {
                // If the line has content, create a new bullet point below it
                event.preventDefault(); // Stop default Enter behavior

                const newBullet = `\n${indentation}${bulletChar}${spacing}`;

                // Insert the new bullet point
                textarea.value = text.substring(0, currentPos) + newBullet + text.substring(currentPos);

                // Move cursor to the end of the new bullet point
                textarea.selectionStart = textarea.selectionEnd = currentPos + newBullet.length;

            } else {
                // If the line is empty except for the bullet point, remove the bullet point
                event.preventDefault(); // Stop default Enter behavior

                // Remove the current empty bullet line
                textarea.value = text.substring(0, lineStart) + text.substring(currentPos);

                // Move cursor to the start of the (now empty) line
                textarea.selectionStart = textarea.selectionEnd = lineStart;
            }
            // Trigger input event manually for auto-save
             textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // If it wasn't a bullet point line, Enter behaves normally
    }
    // Add Tab/Shift+Tab handling here in the future if needed
}

// Initialize the app
initializeApp();
