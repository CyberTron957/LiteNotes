document.addEventListener('DOMContentLoaded', function () {
    const themeSwitcher = document.getElementById('theme-switcher');
    const icon = themeSwitcher ? themeSwitcher.querySelector('i') : null;

    // Define all available themes in order of rotation
    const themes = [
        'light',
        'sepia',
        'slate',
        'midnight',
        'forest',
        'blue',
        'mint',
        'lavender',
        'rose-gold'
    ];

    // Define font options
    const fonts = [
        'inter',
        'mono',
        'serif',
        'space'
    ];

    let currentThemeIndex = 0;
    let currentFontIndex = 0;
    let autoRotate = true; // Set to true by default
    let isTransitioning = false; // Flag to prevent multiple transitions at once

    // Initialize with random theme and font
    currentThemeIndex = Math.floor(Math.random() * themes.length);
    currentFontIndex = Math.floor(Math.random() * fonts.length);

    // Apply initial theme immediately
    setTheme(themes[currentThemeIndex], fonts[currentFontIndex], false);

    // Function to set theme and font with smooth transition
    function setTheme(themeName, fontName, animate = true) {
        if (isTransitioning) return; // Prevent multiple transitions

        isTransitioning = animate; // Only set to true if we're animating

        // Fade out content slightly
        if (animate) {
            document.body.style.opacity = '0.92';
        }

        const applyTheme = () => {
            // Remove all theme classes
            themes.forEach(theme => {
                document.body.classList.remove(`${theme}-theme`);
            });

            // Remove all font classes
            fonts.forEach(font => {
                document.body.classList.remove(`font-${font}`);
            });

            // Add selected theme class
            document.body.classList.add(`${themeName}-theme`);

            // Add selected font class
            document.body.classList.add(`font-${fontName}`);

            // Update theme icon
            updateThemeIcon(themeName);

            // Update current indices
            currentThemeIndex = themes.indexOf(themeName);
            currentFontIndex = fonts.indexOf(fontName);

            // Fade back in
            if (animate) {
                setTimeout(() => {
                    document.body.style.opacity = '1';

                    // Allow next transition after fade completes
                    setTimeout(() => {
                        isTransitioning = false;
                    }, 300);
                }, 300);
            }
        };

        if (animate) {
            setTimeout(applyTheme, 300);
        } else {
            applyTheme();
        }
    }

    function updateThemeIcon(theme) {
        if (!icon) return;
        // Show sun icon for light themes, moon for dark
        if (['dark', 'slate', 'mono', 'midnight', 'forest'].includes(theme)) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    // Get random theme (different from current)
    function getRandomTheme() {
        // Get all themes except current one
        const availableThemes = themes.filter((t, i) => i !== currentThemeIndex);
        // Pick random from remaining themes
        const randomIndex = Math.floor(Math.random() * availableThemes.length);
        return availableThemes[randomIndex];
    }

    // Theme rotation interval (5 seconds)
    const rotationInterval = setInterval(() => {
        if (!autoRotate || isTransitioning) return;

        // Choose random theme different from current
        const nextTheme = getRandomTheme();

        // Keep current font (don't change font with every theme change)
        setTheme(nextTheme, fonts[currentFontIndex], true);
    }, 5000);

    // Toggle auto-rotation on click
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', function () {
            autoRotate = !autoRotate;

            // Visual indicator that auto-rotation is paused
            if (autoRotate) {
                themeSwitcher.style.opacity = '1';
            } else {
                themeSwitcher.style.opacity = '0.7';
            }
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
