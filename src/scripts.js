import { io } from "socket.io-client";
import './fontawesome/css/all.min.css';

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
let currentTheme = 'light'; // Default theme
let isPaletteOpen = false;
let currentFont = 'inter'; // Default font
let currentBackground = 'none'; // Default background
let socket = null;
let isOffline = !navigator.onLine; // Track online/offline status
let saveAbortController = null; // Added for AbortController
let isInfoPopupOpen = false;

// Wrap DOM-dependent code in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // Get essential containers first
    const appContainer = document.getElementById('app-container');
    const authModal = document.getElementById('auth-modal');
    const notesList = document.getElementById('notes-list');
    const noteView = document.getElementById('note-view');
    const themePalette = document.getElementById('theme-palette');
    const infoPopup = document.getElementById('info-popup');

    // Check if critical elements exist
    if (!appContainer || !authModal || !notesList || !noteView) {
        console.error("CRITICAL ERROR: Essential app containers not found. Aborting script.");
        return;
    }

    // --- Attach Event Listeners Safely --- 

    const showRegister = document.getElementById('show-register');
    if (showRegister) {
showRegister.addEventListener('click', () => {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const forgotPasswordForm = document.getElementById('forgot-password-form');
            const modalTitle = document.getElementById('modal-title');
            const modalSubtitle = document.getElementById('modal-subtitle');
            if(loginForm) loginForm.style.display = 'none';
            if(registerForm) registerForm.style.display = 'block';
            if(forgotPasswordForm) forgotPasswordForm.style.display = 'none';
            if(modalTitle) modalTitle.textContent = 'Register';
            if(modalSubtitle) modalSubtitle.textContent = 'Create an account to save notes';
        });
    } else console.warn('Element #show-register not found');

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
showLogin.addEventListener('click', () => {
             const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const forgotPasswordForm = document.getElementById('forgot-password-form');
            const modalTitle = document.getElementById('modal-title');
            const modalSubtitle = document.getElementById('modal-subtitle');
            if(registerForm) registerForm.style.display = 'none';
            if(loginForm) loginForm.style.display = 'block';
            if(forgotPasswordForm) forgotPasswordForm.style.display = 'none';
            if(modalTitle) modalTitle.textContent = 'Sign In';
            if(modalSubtitle) modalSubtitle.textContent = 'Sync your notes across devices';
        });
    } else console.warn('Element #show-login not found');

    const loginButton = document.getElementById('login-button');
    if (loginButton) loginButton.addEventListener('click', login);
    else console.warn('Element #login-button not found');

    const registerButton = document.getElementById('register-button');
    if (registerButton) registerButton.addEventListener('click', register);
    else console.warn('Element #register-button not found');

    const createNoteBtn = document.getElementById('create-note-btn');
    if (createNoteBtn) createNoteBtn.addEventListener('click', createNewNote);
    else console.warn('Element #create-note-btn not found');

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    else console.warn('Element #logout-btn not found');

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    else console.warn('Element #sidebar-toggle not found');

    const showLoginBtn = document.getElementById('show-login-btn');
    if (showLoginBtn) {
showLoginBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768 && document.body.classList.contains('sidebar-visible')) {
                toggleMobileSidebar();
            }
            if (!authModal) return;
    authModal.classList.add('visible');
            
            // Get refs inside callback to ensure they exist when clicked
            const currentLoginForm = document.getElementById('login-form');
            const currentRegisterForm = document.getElementById('register-form');
            const currentForgotForm = document.getElementById('forgot-password-form');
            const currentModalTitle = document.getElementById('modal-title');
            const currentModalSubtitle = document.getElementById('modal-subtitle');

            if(currentRegisterForm) currentRegisterForm.style.display = 'none';
            if(currentLoginForm) currentLoginForm.style.display = 'block';
            if(currentForgotForm) currentForgotForm.style.display = 'none';
            if(currentModalTitle) currentModalTitle.textContent = 'Sign In';
            if(currentModalSubtitle) currentModalSubtitle.textContent = 'Sync your notes across devices';
        }); 
    } else console.warn('Element #show-login-btn not found');

    const showForgotPassword = document.getElementById('show-forgot-password');
     if (showForgotPassword) {
showForgotPassword.addEventListener('click', () => {
             const currentLoginForm = document.getElementById('login-form');
             const currentRegisterForm = document.getElementById('register-form');
             const currentForgotForm = document.getElementById('forgot-password-form');
             const currentModalTitle = document.getElementById('modal-title');
             const currentModalSubtitle = document.getElementById('modal-subtitle');

             if(currentLoginForm) currentLoginForm.style.display = 'none';
             if(currentRegisterForm) currentRegisterForm.style.display = 'none';
             if(currentForgotForm) currentForgotForm.style.display = 'block';
             if(currentModalTitle) currentModalTitle.textContent = 'Reset Password';
             if(currentModalSubtitle) currentModalSubtitle.textContent = 'Enter your email to receive a reset link.';
         });
     } else console.warn('Element #show-forgot-password not found');

     const showLoginFromForgot = document.getElementById('show-login-from-forgot');
     if (showLoginFromForgot) {
showLoginFromForgot.addEventListener('click', () => {
             const currentLoginForm = document.getElementById('login-form');
             const currentRegisterForm = document.getElementById('register-form');
             const currentForgotForm = document.getElementById('forgot-password-form');
             const currentModalTitle = document.getElementById('modal-title');
             const currentModalSubtitle = document.getElementById('modal-subtitle');

             if(currentForgotForm) currentForgotForm.style.display = 'none';
             if(currentRegisterForm) currentRegisterForm.style.display = 'none';
             if(currentLoginForm) currentLoginForm.style.display = 'block';
             if(currentModalTitle) currentModalTitle.textContent = 'Sign In';
             if(currentModalSubtitle) currentModalSubtitle.textContent = 'Sync your notes across devices';
         });
     } else console.warn('Element #show-login-from-forgot not found');

    const forgotPasswordButton = document.getElementById('forgot-password-button');
    if (forgotPasswordButton) forgotPasswordButton.addEventListener('click', requestPasswordReset);
    else console.warn('Element #forgot-password-button not found');

    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
modalCloseBtn.addEventListener('click', () => {
            if(authModal) authModal.classList.remove('visible');
});
    } else console.warn('Element #modal-close-btn not found');

    if (authModal) {
authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.classList.remove('visible');
    }
});
    } // No warning needed for authModal, checked earlier

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleThemePalette);
    else console.warn('Element #theme-toggle not found');
    
    const infoToggle = document.getElementById('info-toggle'); 
    if (infoToggle) infoToggle.addEventListener('click', toggleInfoPopup);
    else console.warn('Element #info-toggle not found');

    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length > 0) {
themeOptions.forEach(option => {
    option.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme');
                if (!theme) return;
        setTheme(theme);
    });
});
    } else console.warn('No .theme-option elements found');

    const fontOptions = document.querySelectorAll('.font-option');
    if (fontOptions.length > 0) {
fontOptions.forEach(option => {
    option.addEventListener('click', function() {
        const font = this.getAttribute('data-font');
                if (!font) return;
        setFont(font);
    });
});
    } else console.warn('No .font-option elements found');

    const backgroundOptions = document.querySelectorAll('.background-option');
    if (backgroundOptions.length > 0) {
backgroundOptions.forEach(option => {
    option.addEventListener('click', function() {
        const background = this.getAttribute('data-background');
                if (typeof background === 'undefined' || background === null) return;
        setBackground(background);
    });
});
    } else console.warn('No .background-option elements found');

    // Document click listener for closing popups
    document.addEventListener('click', function(event) {
        // Use fresh references inside the handler
        const currentThemePalette = document.getElementById('theme-palette');
        const currentThemeToggle = document.getElementById('theme-toggle');
        const currentInfoPopup = document.getElementById('info-popup');
        const currentInfoToggle = document.getElementById('info-toggle');

        // Use state variables to check if popups *should* be open
        if (isPaletteOpen && currentThemePalette && !currentThemePalette.contains(event.target) && event.target !== currentThemeToggle) {
            toggleThemePalette();
        }
        if (isInfoPopupOpen && currentInfoPopup && !currentInfoPopup.contains(event.target) && event.target !== currentInfoToggle) {
            toggleInfoPopup();
        }
    });

    // Initialize the app *after* all listeners are attached
    console.log("Attaching listeners complete, initializing app...");
    initializeApp(); 
});

// Set up offline/online event listeners (can be outside DOMContentLoaded)
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
    const currentAppContainer = document.getElementById('app-container'); // Get fresh reference
    if (!currentAppContainer) return;

    if (window.innerWidth <= 768) {
        toggleMobileSidebar(); 
    } else {
        isSidebarHidden = !isSidebarHidden;
        currentAppContainer.classList.toggle('sidebar-hidden');
        localStorage.setItem('sidebarState', isSidebarHidden ? 'hidden' : 'visible');
        
        // Close popups - Get fresh refs inside
        const currentThemePalette = document.getElementById('theme-palette');
        if (currentThemePalette?.classList.contains('active')) { 
            toggleThemePalette();
        }
        const currentInfoPopup = document.getElementById('info-popup');
        if (currentInfoPopup?.classList.contains('active')) { 
            toggleInfoPopup();
        }
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
    // Define valid themes *after* removing dark/mono/warm
    const validThemes = ['light', 'sepia', 'slate', 'midnight', 'charcoal', 'forest', 'blue', 'mint', 'lavender', 'rose-gold', 'monochrome']; // Update this list if themes change
    let themeToSet = 'light'; // Default to light theme

    if (savedTheme && validThemes.includes(savedTheme)) {
        themeToSet = savedTheme;
    } else if (savedTheme) {
        // If saved theme is invalid (e.g., old 'dark'), use a fallback
        console.warn(`Invalid saved theme "${savedTheme}" found, falling back to light.`);
        themeToSet = 'light'; // Fallback for any invalid saved theme
    } else {
        // On first visit with no saved theme, use a random *valid* theme
        themeToSet = validThemes[Math.floor(Math.random() * validThemes.length)];
    }
    setTheme(themeToSet);
    
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

// Update page title based on current note
function updatePageTitle() {
    if (currentNoteId) {
        const currentNote = notes.find(note => note.id === currentNoteId);
        if (currentNote) {
            const noteTitle = currentNote.title || 'Untitled';
            document.title = `${noteTitle} - LiteNotes`;
        } else {
            document.title = 'LiteNotes - Minimalist Notes';
        }
    } else {
        document.title = 'LiteNotes - Minimalist Notes';
    }
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
        updatePageTitle(); // Update page title with note title
    } else {
        // Handle case where note might have been deleted
        currentNoteId = null;
        renderEmptyNoteView();
        updatePageTitle(); // Reset page title to default
    }
}

// Render the note editor
function renderNoteView(note) {
    // Store scroll position of the content area before clearing
    const contentArea = document.getElementById('note-content');
    const oldScrollTop = contentArea ? contentArea.scrollTop : 0;

    // Clear previous content
    noteView.innerHTML = '';

    const backgroundDiv = document.createElement('div');
    backgroundDiv.className = `note-background bg-${currentBackground}`;

    // Create Title Input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'note-title-input';
    titleInput.id = 'note-title';
    titleInput.placeholder = 'Note Title';
    titleInput.value = note.title || '';
    titleInput.spellcheck = false;
    titleInput.setAttribute('autocorrect', 'off');
    titleInput.setAttribute('autocapitalize', 'off');
    titleInput.setAttribute('dir', 'auto');

    // Create Content Textarea
    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'note-content-editor'; // Use the new class
    contentTextarea.id = 'note-content';
    contentTextarea.placeholder = 'Start typing...';
    contentTextarea.value = note.content || '';
    contentTextarea.spellcheck = false;
    contentTextarea.setAttribute('autocorrect', 'off');
    contentTextarea.setAttribute('autocapitalize', 'off');
    contentTextarea.setAttribute('dir', 'auto');

    // Action buttons and status dot - Use safe DOM manipulation instead of innerHTML
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-actions';

    const deleteNoteDiv = document.createElement('div');
    deleteNoteDiv.className = 'delete-note';
    deleteNoteDiv.id = 'delete-note-btn';
    deleteNoteDiv.title = 'Delete note';

    const trashIcon = document.createElement('i');
    trashIcon.className = 'fas fa-trash';
    deleteNoteDiv.appendChild(trashIcon);
    actionsDiv.appendChild(deleteNoteDiv);

    const statusDotDiv = document.createElement('div');
    statusDotDiv.id = 'save-status-dot';
    statusDotDiv.className = 'save-status-dot';

    // Append elements to noteView
    noteView.appendChild(backgroundDiv);
    noteView.appendChild(titleInput);
    noteView.appendChild(contentTextarea);
    noteView.appendChild(actionsDiv);
    noteView.appendChild(statusDotDiv);

    // Re-select elements after adding them
    const newTitleInput = document.getElementById('note-title');
    const newContentArea = document.getElementById('note-content');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const newStatusDot = document.getElementById('save-status-dot');

    // Add event listeners
    const saveHandler = () => scheduleNoteSave(newStatusDot);
    if (newTitleInput) {
        newTitleInput.addEventListener('input', saveHandler);
        // Add keydown listener to title input
        newTitleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default Enter behavior (like form submission if applicable)
                const contentEditor = document.getElementById('note-content');
                if (contentEditor) {
                    contentEditor.focus(); // Move focus to the content textarea
                }
            }
        });
    }
    if (newContentArea) {
        newContentArea.addEventListener('input', saveHandler);
        // Re-attach bullet point helper if desired (or keep removed)
        newContentArea.addEventListener('keydown', handleNoteEditorKeyDown);
    }
    if (deleteNoteBtn) {
        deleteNoteBtn.addEventListener('click', () => {
            showDeleteConfirmation(note.id, deleteNoteBtn);
        });
    }

    // Restore scroll position for the content area
    if (newContentArea && oldScrollTop > 0) {
        setTimeout(() => {
            newContentArea.scrollTop = oldScrollTop;
        }, 0);
    } else if (newContentArea) {
        newContentArea.scrollTop = 0;
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

// Render empty note view - Use safe DOM manipulation instead of innerHTML
function renderEmptyNoteView() {
    // Clear previous content
    noteView.innerHTML = '';

    const backgroundDiv = document.createElement('div');
    backgroundDiv.className = `note-background bg-${currentBackground}`;

    const emptyStateDiv = document.createElement('div');
    emptyStateDiv.className = 'empty-state';

    const icon = document.createElement('i');
    icon.className = 'fas fa-file-alt';

    const heading = document.createElement('h2');
    heading.textContent = 'No note selected';

    const paragraph = document.createElement('p');
    paragraph.textContent = 'Select a note from the sidebar or create a new one to get started.';

    emptyStateDiv.appendChild(icon);
    emptyStateDiv.appendChild(heading);
    emptyStateDiv.appendChild(paragraph);

    noteView.appendChild(backgroundDiv);
    noteView.appendChild(emptyStateDiv);

    updatePageTitle(); // Reset page title to default
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
    
    const titleInput = document.getElementById('note-title');
    const contentTextarea = document.getElementById('note-content');
    const saveStatusDot = document.getElementById('save-status-dot'); 
    
    if (!titleInput || !contentTextarea || !saveStatusDot) return;

    // --- Get title and content from separate fields --- 
    const title = titleInput.value; // Title is directly from input
    const content = contentTextarea.value; // Content is directly from textarea
    // ---------------------------------------------------

    // Update local array first for responsiveness
    const noteIndex = notes.findIndex(note => note.id === currentNoteId);
    if (noteIndex !== -1) {
        // Save old title before updating to check if it changed
        const oldTitle = notes[noteIndex].title || '';
        
        notes[noteIndex].title = title;
        notes[noteIndex].content = content;
        notes[noteIndex].updated_at = new Date().toISOString();

        // Update title in sidebar (check if it changed)
        const noteItem = notesList.querySelector(`.note-item[data-note-id="${currentNoteId}"]`);
        if (noteItem && noteItem.textContent !== (title || 'Untitled')) {
            noteItem.textContent = title || 'Untitled';
        }
        
        // Update page title if note title changed
        if (oldTitle !== title) {
            updatePageTitle();
        }
        
        // Re-sort the notes array after updating (only if necessary - title doesn't affect sort)
        // Sorting primarily relies on updated_at, which always changes
        notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        renderNotesList(); // Render list to reflect potential order change
        
    }

    if (currentToken && !isOffline) {
        // Logged in and online: Save to server
        try {
            // Abort previous fetch if exists
            if (saveAbortController) saveAbortController.abort();
            saveAbortController = new AbortController();
            
            const response = await fetch(`/notes/${currentNoteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: title, content: content }), // Send separate title/content
                signal: saveAbortController.signal 
            });

            saveAbortController = null;
            
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
            saveStatusDot.classList.remove('saving', 'error');
            saveStatusDot.classList.add('saved', 'visible');
            }

            clearTimeout(statusDotFadeTimeout);
            statusDotFadeTimeout = setTimeout(() => { saveStatusDot.classList.remove('visible'); }, 2000);

            // Save scroll position of content area
            if (contentTextarea) {
                saveScrollPosition(currentNoteId, contentTextarea.scrollTop);
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
        saveStatusDot.classList.remove('saving', 'error');
        saveStatusDot.classList.add('saved', 'visible');
        clearTimeout(statusDotFadeTimeout);
        statusDotFadeTimeout = setTimeout(() => { saveStatusDot.classList.remove('visible'); }, 2000);
        if (contentTextarea) {
            saveScrollPosition(currentNoteId, contentTextarea.scrollTop);
        }
        saveAbortController = null;
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
        updatePageTitle(); // Reset page title to default
        
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
        updatePageTitle(); // Reset page title to default
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
    const currentInfoPopup = document.getElementById('info-popup'); 
    if (currentInfoPopup?.classList.contains('active')) { 
        toggleInfoPopup();
    }
    const currentThemePalette = document.getElementById('theme-palette'); 
    if (!currentThemePalette) return;
    currentThemePalette.classList.toggle('active');
    isPaletteOpen = currentThemePalette.classList.contains('active'); 

    // Mobile backdrop logic
    const backdrop = document.querySelector('.palette-backdrop');
    if (isPaletteOpen && window.innerWidth <= 768) {
         if (!backdrop) {
             const newBackdrop = document.createElement('div');
             newBackdrop.className = 'palette-backdrop';
             // Add styles and listener (as before)
             newBackdrop.style.position = 'fixed';
             newBackdrop.style.top = '0';
             newBackdrop.style.left = '0';
             newBackdrop.style.right = '0';
             newBackdrop.style.bottom = '0';
             newBackdrop.style.zIndex = '109'; 
             newBackdrop.style.backgroundColor = 'transparent';
             newBackdrop.addEventListener('click', function() {
                 if (isPaletteOpen) { // Check state variable
                     toggleThemePalette();
                 }
             });
             document.body.appendChild(newBackdrop);
         }
    } else {
        if (backdrop) {
            backdrop.remove(); // Remove backdrop if palette closed or not mobile
        }
    }
}

// Toggle info popup
function toggleInfoPopup() {
    const currentThemePalette = document.getElementById('theme-palette');
    if (currentThemePalette?.classList.contains('active')) {
        toggleThemePalette();
    }
    const currentInfoPopup = document.getElementById('info-popup');
    if (!currentInfoPopup) return;
    currentInfoPopup.classList.toggle('active');
    isInfoPopupOpen = currentInfoPopup.classList.contains('active'); 
}

// Set theme function
function setTheme(theme) {
    const bodyClassList = document.body.classList;
    const themesToRemove = [
        'light-theme', 'sepia-theme', 'slate-theme', 'midnight-theme', 
        'charcoal-theme', 'forest-theme', 'blue-theme', 'mint-theme', 
        'lavender-theme', 'rose-gold-theme', 'monochrome-theme'
    ];
    
    themesToRemove.forEach(cls => bodyClassList.remove(cls));
    
    // Add the new theme class 
    bodyClassList.add(`${theme}-theme`); 
    
    // Update active state in theme palette - Use the options queried in DOMContentLoaded
    // Re-querying inside might be slightly safer if DOM changes, but let's simplify first.
    const allThemeOptions = document.querySelectorAll('.theme-option'); // Use local query
    allThemeOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-theme') === theme);
    });
    
    // Save theme preference
    localStorage.setItem('theme', theme);
    currentTheme = theme;

    // Clear any inline styles that might interfere
    const currentCreateNoteBtn = document.getElementById('create-note-btn');
    if (currentCreateNoteBtn) {
         currentCreateNoteBtn.removeAttribute('style');
    }
}

// Set font function
function setFont(font) {
    document.body.classList.remove('font-inter', 'font-mono', 'font-serif', 'font-space');
    document.body.classList.add(`font-${font}`);
    
    const currentFontOptions = document.querySelectorAll('.font-option');
    currentFontOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-font') === font);
    });
    
    localStorage.setItem('font', font);
    currentFont = font;

    if (currentNoteId) {
        const selectedNote = notes.find(note => note.id === currentNoteId);
        if (selectedNote) {
            renderNoteView(selectedNote);
        }
    }
}

// Set background function
function setBackground(background) {
    const currentBackgroundOptions = document.querySelectorAll('.background-option');
    currentBackgroundOptions.forEach(option => {
        option.classList.toggle('active', option.getAttribute('data-background') === background);
    });
    
    localStorage.setItem('background', background);
    currentBackground = background;
    
    if (currentNoteId) {
        const noteBackground = noteView.querySelector('.note-background'); 
        if (noteBackground) {
            noteBackground.className = `note-background bg-${background}`;
        } else {
            const selectedNote = notes.find(note => note.id === currentNoteId);
            if (selectedNote) {
                renderNoteView(selectedNote);
            }
        }
    } else {
        const emptyStateBackground = noteView.querySelector('.note-background');
        if (emptyStateBackground) {
             emptyStateBackground.className = `note-background bg-${background}`;
        } else {
            renderEmptyNoteView(); 
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

             const noteIndex = notes.findIndex(note => note.id === updatedNote.id);

             let needsListRender = false;
             let needsViewRender = false;
             let titleChanged = false;
             let contentChanged = false;

             if (noteIndex !== -1) {
                 if (new Date(updatedNote.updated_at) > new Date(notes[noteIndex].updated_at)) {
                     console.log(`Updating local note ${updatedNote.id}`);
                     const oldTitle = notes[noteIndex].title;
                     const oldContent = notes[noteIndex].content;
                     
                     // Update local data
                     notes[noteIndex].title = updatedNote.title;
                     notes[noteIndex].content = updatedNote.content;
                     notes[noteIndex].updated_at = updatedNote.updated_at;

                     titleChanged = oldTitle !== updatedNote.title;
                     contentChanged = oldContent !== updatedNote.content;

                     if (titleChanged) { needsListRender = true; }
                     if (currentNoteId === updatedNote.id) { needsViewRender = true; }

                     // Re-sort and mark for list render if order might change
                     notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                     needsListRender = true;

                 } else {
                      console.log(`Ignoring stale update for note ${updatedNote.id}`);
                 }

             } else {
                 // Note doesn't exist locally (maybe created on another device?)
                 // You could add logic here to insert it if needed, requires a 'note_created' event
                 console.log(`Received update for unknown note ID ${updatedNote.id}`);
             }

             if (needsListRender) { renderNotesList(); }
             
             // Update page title if the updated note is currently open
             if (currentNoteId === updatedNote.id && titleChanged) {
                 updatePageTitle();
             }
             
             if (needsViewRender) {
                 // --- Update separate title and content fields --- 
                 const titleInput = document.getElementById('note-title');
                 const contentTextarea = document.getElementById('note-content');

                 if (titleInput && titleChanged) { 
                     // Only update if focused element isn't this input
                     if (document.activeElement !== titleInput) {
                        titleInput.value = updatedNote.title || '';
                     } else {
                         console.log('Skipping title update as it is focused.');
                     }
                 }
                 if (contentTextarea && contentChanged) {
                     // Only update if focused element isn't this textarea
                     if (document.activeElement !== contentTextarea) {
                        const scrollTop = contentTextarea.scrollTop; // Preserve scroll
                        contentTextarea.value = updatedNote.content || '';
                        contentTextarea.scrollTop = scrollTop; // Restore scroll
                     } else {
                         console.log('Skipping content update as it is focused.');
                     }
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
