/***********************************************************************************************************
 * @file dashboard/config.js
 * @brief Initializes the xterm.js terminal and implements a lightweight in-browser CLI.
 *
 * This file contains the terminal setup (xterm.js), addons, an in-memory demo
 * filesystem, and a small set of CLI commands for demonstration and testing.
 *
 * Main responsibilities:
 *  - Initialize xterm and theme
 *  - Provide a `writePrompt()` function to display the user/path and prompt
 *  - Implement command handlers for `ls`, `cd`, `mkdir`, `add`, `upload`, `delete`, `share`, and `tree`
 *  - Manage a demo in-memory file system for client-side interactions
 *
 * @todo Replace demo fs operations with backend API calls and add real user auth.
 *
 * @author Syed Taha
 **********************************************************************************************************/

// Initialize terminal
const term = new Terminal({
    // cursorStyle: 'disable',
    // cursorInactiveStyle: 'outline',
    cursorBlink: true,
    fontSize: 14,
    // Prefer Geist Mono if installed, fall back to Geist Fallback and generic monospace
    fontFamily: '"Geist Mono", "Geist Fallback", monospace',
    theme: {
        "background": "#010409",
        "black": "#484F58",
        "blue": "#58A6FF",
        "brightBlack": "#6E7681",
        "brightBlue": "#79C0FF",
        "brightCyan": "#56D4DD",
        "brightGreen": "#56D364",
        "brightRed": "#FFA198",
        "brightWhite": "#FFFFFF",
        "brightYellow": "#E3B341",
        "cyan": "#39C5CF",
        "foreground": "#E6EDF3",
        "green": "#3FB950",
        "name": "Github Dark Default (vscode)",
        "brightMagenta": "#D2A8FF",
        "cursor": "#2F81F7",
        "magenta": "#BC8CFF",
        "red": "#FF7B72",
        "selectionBackground": "#031A35",
        "white": "#B1BAC4",
        "yellow": "#D29922"
    }
});

// Add addons
const fitAddon = new FitAddon.FitAddon();
const webLinksAddon = new WebLinksAddon.WebLinksAddon();

term.loadAddon(fitAddon);
term.loadAddon(webLinksAddon);

// Open terminal
term.open(document.getElementById('terminal'));
fitAddon.fit();

// Ctrl/Cmd+C handling: copy terminal selection to clipboard when present.
// Terminal-level handler: intercept only within the terminal viewport.
try {
    if (typeof term.attachCustomKeyEventHandler === 'function') {
        term.attachCustomKeyEventHandler((e) => {
            const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
            if (!isCopy) return true;
            if (term.getSelection && term.getSelection().length > 0) {
                copyTerminalSelection();
                return false; // block default
            }
            return true;
        });
    }
} catch (err) { /* ignore if unsupported */ }

// Global handler: keyboard shortcuts should still work even when the cmd
// input box is focused and the selection is in the terminal viewport.
document.addEventListener('keydown', (e) => {
    const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
    if (!isCopy) return;
    if (!term) return;
    try {
        if (term.getSelection && term.getSelection().length > 0) {
            e.preventDefault();
            e.stopPropagation();
            copyTerminalSelection();
        }
    } catch (err) { /* ignore */ }
});

// Override writeln to call fit after writes so terminal rows/scrollbar are updated
const _term_writeln = term.writeln.bind(term);
term.writeln = (...args) => {
    _term_writeln(...args);
    try { fitAddon.fit(); } catch (e) { /* ignore */ }
};

// DOM elements for file browser and terminal input & controls
const fileBrowserEl = document.getElementById('fileBrowser');
const pathInputEl = document.getElementById('pathInput');
const dividerEl = document.getElementById('divider');
const btnRefresh = document.getElementById('btnRefresh');
const btnNewFolder = document.getElementById('btnNewFolder');
const btnUploadButton = document.getElementById('btnUpload');
const cmdInputEl = document.getElementById('cmdInput');
const termBtnClose = document.getElementById('termBtnClose');
const termBtnMin = document.getElementById('termBtnMin');
const termBtnMax = document.getElementById('termBtnMax');
const termCollapse = document.getElementById('termCollapse');

// initialize CLI state
/**
 * Current (simulated) username displayed in the prompt. Defaults to "root" until
 * user authentication or a login command is implemented.
 * @type {string}
 */
var username = 'root';

/**
 * Current working directory path within the demo filesystem. This value is
 * used by the CLI `ls`, `cd`, `tree` and related commands.
 * @type {string}
 */
let currentPath = '/';

/**
 * Tracks whether the most recent command execution succeeded. The prompt's
 * symbol color is green for success and red for failures.
 * @type {boolean}
 */
let lastCommandSuccess = true;

/**
 * Normalize directory checks across API and in-memory objects
 * Recognize both 'dir' and 'folder' types returned by different APIs.
 * @param {Object|string} itemOrType - Either the item object or a string type.
 * @returns {boolean}
 */
function isDirectory(itemOrType) {
    const t = typeof itemOrType === 'string' ? itemOrType : (itemOrType && itemOrType.type);
    return t === 'dir' || t === 'folder';
}

// Welcome message
term.writeln('Welcome to xterm.js Terminal Emulator!');
term.writeln('');
term.writeln('This is a browser-based terminal using xterm.js');
term.writeln('Type commands and see them echoed back.');
term.writeln('');
// Initialize prompt UI and rely on later DOM wiring for the file browser
// Focus input element later after DOM is ready (cmdInputEl declared below)

// Command buffer
let currentLine = '';
let commandHistory = [];
let historyIndex = -1;

/**
 * Handle keyboard input coming from xterm. This includes control characters
 * such as Enter, Backspace, arrow keys for history, and text input.
 * The handler updates `currentLine` and triggers `handleCommand` on Enter.
 */
// The terminal input is handled by an external input box; ignore term keyboard input
term.onData(() => { });


/**
 * @brief Show help message with available commands.
 * @returns {boolean} True on success
 */
function cmdHelp() {
    term.writeln('Available commands:');
    term.writeln('  help                                  - Show this help message');
    term.writeln('  clear                                 - Clear the terminal');
    term.writeln('  echo                                  - Echo text back');
    term.writeln('  date                                  - Show current date and time');
    term.writeln('  history                               - Show command history');
    term.writeln('  whoami                                - Show current username');
    term.writeln('  health                                - Show storage health and capacity');
    term.writeln('  stats                                 - Show user statistics and storage usage');
    term.writeln('  login <username> <password>          - Login to your account');
    term.writeln('  logout                                - Logout from your account');
    term.writeln('  register <username> <email> <password> - Create new account');
    term.writeln('  cat <filename>                        - View file contents');
    term.writeln('  edit <filename>                       - Edit file in editor (or vim, nano)');
    term.writeln('  download <filename>                   - Download a file');
    term.writeln('  upload                                - Upload a .txt file (size limited by available storage)');
    term.writeln('  add <filename>                        - Create an empty file or run without args to upload');
    term.writeln('  share <filename> <user> <permissions> - Share a file');
    term.writeln('  delete <filename>                     - Delete a file or directory');
    term.writeln('  mkdir <dirname>                       - Create directory');
    term.writeln('  ls                                    - List files in current directory');
    term.writeln('  cd <path>                             - Change directory');
    term.writeln('  tree                                  - Show directory tree');
    term.writeln('  about                                 - About this terminal');
    return true;
}

/**
 * @brief Clear the terminal.
 * @returns {boolean} True on success
 */
function cmdClear() {
    term.clear();
    return true;
}

/**
 * @brief Echo text.
 * @returns {boolean} True on success
 */
function cmdEcho(parts) {
    term.writeln(parts.slice(1).join(' '));
    return true;
}

/**
 * @brief Show current date.
 * @returns {boolean} True on success
 */
function cmdDate() {
    term.writeln(new Date().toString());
    return true;
}

/**
 * @brief Print command history.
 * @returns {boolean} True on success
 */
function cmdHistory() {
    commandHistory.forEach((cmd, i) => {
        term.writeln(` ${i + 1}  ${cmd}`);
    });
    return true;
}

/**
 * @brief Show about information.
 * @returns {boolean} True on success
 */
function cmdAbout() {
    term.writeln('xterm.js Terminal Emulator');
    term.writeln('Version: 5.3.0');
    term.writeln('A full xterm terminal in your browser');
    return true;
}

/**
 * @brief Show current username.
 * @returns {boolean} True on success
 */
function cmdWhoami() {
    term.writeln(window.username || 'guest');
    return true;
}

/**
 * @brief Show storage health and capacity information.
 * @returns {Promise<boolean>} True on success
 */
async function cmdHealth() {
    try {
        const info = await fs.getStorageInfo();

        if (!info) {
            term.writeln('\x1b[38;2;248;113;113mFailed to fetch storage information\x1b[0m');
            return false;
        }

        const { availableSlots, chunkSize, maxUploadBytes } = info;
        const maxMB = (maxUploadBytes / 1024 / 1024).toFixed(2);

        // Calculate percentage based on server-4's capacity (2000 slots) + other servers
        // Total capacity ~2036 slots
        const totalCapacity = 2036;
        const percentage = ((availableSlots / totalCapacity) * 100).toFixed(1);
        const usedSlots = totalCapacity - availableSlots;

        term.writeln('\x1b[36m=== Storage Health ===\x1b[0m');
        term.writeln(`Available Slots: ${availableSlots}`);
        term.writeln(`Used Slots: ${usedSlots}`);
        term.writeln(`Total Capacity: ${totalCapacity} slots`);
        term.writeln(`Chunk Size: ${chunkSize} bytes (${(chunkSize / 1024).toFixed(1)} KB)`);
        term.writeln(`Max Upload Size: ${maxMB} MB`);
        term.writeln(`Capacity: ${percentage}% available`);
        term.writeln('');

        // Color-coded health indicator
        if (percentage > 50) {
            term.writeln('\x1b[32mStatus: Healthy ✓\x1b[0m');
        } else if (percentage > 20) {
            term.writeln('\x1b[33mStatus: Warning - Low storage ⚠\x1b[0m');
        } else {
            term.writeln('\x1b[38;2;248;113;113mStatus: Critical - Very low storage ✗\x1b[0m');
        }

        return true;
    } catch (error) {
        term.writeln('\x1b[38;2;248;113;113mError fetching health info: ' + error.message + '\x1b[0m');
        return false;
    }
}

/**
 * @brief Show user statistics from database.
 * @returns {Promise<boolean>} True on success
 */
async function cmdStats() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (!result.success) {
            term.writeln('\x1b[38;2;248;113;113mYou must be logged in to view stats\x1b[0m');
            return false;
        }

        const { username, email, createdAt, storage } = result.data;
        const sizeMB = (storage.bytesUsed / 1024 / 1024).toFixed(2);
        const sizeKB = (storage.bytesUsed / 1024).toFixed(2);

        term.writeln('');
        term.writeln('\x1b[36m=== User Statistics ===\x1b[0m');
        term.writeln(`Username: ${username}`);
        term.writeln(`Email: ${email}`);
        term.writeln(`Member Since: ${new Date(createdAt).toLocaleDateString()}`);
        term.writeln('');
        term.writeln('\x1b[33m--- Storage Usage ---\x1b[0m');
        term.writeln(`Files: ${storage.fileCount}`);
        term.writeln(`Folders: ${storage.folderCount}`);
        term.writeln(`Chunks: ${storage.chunkCount}`);
        term.writeln(`Total Size: ${sizeMB} MB (${sizeKB} KB)`);
        term.writeln('');

        return true;
    } catch (error) {
        term.writeln('\x1b[38;2;248;113;113mError fetching stats: ' + error.message + '\x1b[0m');
        return false;
    }
}

/**
 * @brief Trigger file upload dialog.
 * @returns {boolean} True on success
 */
function cmdUpload() {
    triggerFileUpload();
    return true;
}

/**
 * @brief Register a new user account.
 * @returns {boolean} True on success
 */
function cmdRegister(parts) {
    if (parts.length < 4) {
        term.writeln('Usage: register <username> <email> <password>');
        return false;
    }
    const username = parts[1];
    const email = parts[2];
    const password = parts[3];

    // Call the backend API to register
    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            email: email,
            password: password
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                term.writeln('\x1b[32mRegistration successful!\x1b[0m');
                lastCommandSuccess = true;
            } else {
                term.writeln('\x1b[38;2;248;113;113mRegistration failed: ' + data.error + '\x1b[0m');
                lastCommandSuccess = false;
            }
            writePrompt({ newlineBefore: true });
        })
        .catch(error => {
            term.writeln('\x1b[38;2;248;113;113mRegistration error: ' + error.message + '\x1b[0m');
            lastCommandSuccess = false;
            writePrompt({ newlineBefore: true });
        });

    // Return true to indicate command was processed (async operation)
    return true;
}

/**
 * @brief Login to user account.
 * @returns {boolean} True on success
 */
function cmdLogin(parts) {
    if (parts.length < 3) {
        term.writeln('Usage: login <username> <password>');
        return false;
    }
    const username = parts[1];
    const password = parts[2];

    // Call the backend API to login
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                term.writeln('\x1b[32mLogin successful! Welcome, ' + data.data.username + '\x1b[0m');
                window.username = data.data.username; // Update the username displayed in the prompt

                // Set the user's root directory ID
                if (data.data.rootDirectoryID) {
                    fs.setUserRootId(data.data.rootDirectoryID);
                    fs.setCurrentDirId(data.data.rootDirectoryID);
                }

                // Update profile section in header
                const headerUsername = document.getElementById('headerUsername');
                const dropdownUsername = document.getElementById('dropdownUsername');
                if (headerUsername) headerUsername.textContent = data.data.username;
                if (dropdownUsername) dropdownUsername.textContent = data.data.username;

                lastCommandSuccess = true;
                writePrompt({ newlineBefore: true });
                renderFileBrowser();
            } else {
                term.writeln('\x1b[38;2;248;113;113mLogin failed: ' + data.error + '\x1b[0m');
                lastCommandSuccess = false;
                writePrompt({ newlineBefore: true });
            }
        })
        .catch(error => {
            term.writeln('\x1b[38;2;248;113;113mLogin error: ' + error.message + '\x1b[0m');
            lastCommandSuccess = false;
            writePrompt({ newlineBefore: true });
        });

    // Return true to indicate command was processed (async operation)
    return true;
}

/**
 * @brief Logout from user account.
 * @returns {boolean} True on success
 */
function cmdLogout() {
    fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                term.writeln('\x1b[32mLogged out successfully\x1b[0m');
                window.username = 'guest'; // Reset to default username
                currentPath = '/'; // Reset to root
                // Clear stored user root & current directory ID so the dashboard
                // no longer renders user files for logged-out sessions
                if (window.fs && typeof window.fs.setUserRootId === 'function') {
                    window.fs.setUserRootId(null);
                }
                if (window.fs && typeof window.fs.setCurrentDirId === 'function') {
                    window.fs.setCurrentDirId(0);
                }

                // Reset profile section in header
                const headerUsername = document.getElementById('headerUsername');
                const dropdownUsername = document.getElementById('dropdownUsername');
                const dropdownEmail = document.getElementById('dropdownEmail');
                if (headerUsername) headerUsername.textContent = 'guest';
                if (dropdownUsername) dropdownUsername.textContent = 'guest';
                if (dropdownEmail) dropdownEmail.textContent = '';

                lastCommandSuccess = true;
            } else {
                term.writeln('\x1b[38;2;248;113;113mLogout failed: ' + data.error + '\x1b[0m');
                lastCommandSuccess = false;
            }
            writePrompt({ newlineBefore: true });
            renderFileBrowser(); // Refresh the file browser
        })
        .catch(error => {
            term.writeln('\x1b[38;2;248;113;113mLogout error: ' + error.message + '\x1b[0m');
            lastCommandSuccess = false;
            writePrompt({ newlineBefore: true });
        });

    // Return true to indicate command was processed (async operation)
    return true;
}

/**
 * @brief Add a new file or trigger upload when no filename provided.
 * @returns {boolean} True on success
 */
async function cmdAdd(parts) {
    if (parts.length > 1) {
        const filename = parts.slice(1).join(' ');
        const ok = await fs.uploadFileApi(filename, '', fs.getCurrentDirId());
        if (ok) {
            term.writeln('Created file ' + filename);
            renderFileBrowser();
        } else {
            // Try to fetch storage info to present a more helpful error
            try {
                const info = (window.fs && typeof window.fs.getStorageInfo === 'function') ? await window.fs.getStorageInfo() : null;
                if (info && typeof info.maxUploadBytes === 'number') {
                    term.writeln('\x1b[38;2;248;113;113mFailed to create file: not enough available storage (max ' + (info.maxUploadBytes / 1024 / 1024).toFixed(2) + 'MB)\x1b[0m');
                } else {
                    term.writeln('Failed to create file ' + filename);
                }
            } catch (e) {
                term.writeln('Failed to create file ' + filename);
            }
        }
        return !!ok;
    } else {
        triggerFileUpload();
        return true;
    }
}

/**
 * @brief Share a file with another user and permissions.
 * @returns {Promise<boolean>} True on success
 */
async function cmdShare(parts) {
    if (parts.length < 4) {
        term.writeln('Usage: share <filename> <user> <permissions>');
        return false;
    }
    const filename = parts[1];
    const user = parts[2];
    const perms = parts[3];

    // Since we don't have the direct ID, we'll need to list current directory and find the item
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    const fileToShare = listings.find(item => item.name === filename);
    if (!fileToShare || fileToShare.type !== 'file') {
        term.writeln('\x1b[38;2;248;113;113mshare: file not found: ' + filename + '\x1b[0m');
        return false;
    }

    // Call the sharing API
    try {
        const response = await fetch('/api/files/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                itemID: fileToShare.id,
                receiverUsername: user,
                accessLevel: perms
            })
        });

        const result = await response.json();

        if (result.success) {
            term.writeln('Shared ' + filename + ' with ' + user + ' (' + perms + ')');
            return true;
        } else {
            term.writeln('\x1b[38;2;248;113;113mShare failed: ' + result.error + '\x1b[0m');
            return false;
        }
    } catch (error) {
        term.writeln('\x1b[38;2;248;113;113mShare error: ' + error.message + '\x1b[0m');
        return false;
    }
}

/**
 * @brief Delete a file or dir.
 * @returns {Promise<boolean>} True on success
 */
async function cmdDelete(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: delete <filename>');
        return false;
    }
    // For now, we'll need to find the item by name to get its ID
    // In a full implementation, we'd have a function to resolve name to ID in the current directory
    const filename = parts[1];

    // Since we don't have the direct ID, we'll need to list current directory and find the item
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    const itemToDelete = listings.find(item => item.name === filename);
    if (!itemToDelete) {
        term.writeln('\x1b[38;2;248;113;113mDelete failed: ' + filename + ' not found\x1b[0m');
        return false;
    }

    const ok = await fs.rmNodeApi(itemToDelete.id);
    if (ok) {
        term.writeln('Deleted ' + filename);
        renderFileBrowser();
    } else {
        term.writeln('\x1b[38;2;248;113;113mDelete failed: ' + filename + '\x1b[0m');
    }
    return ok;
}

/**
 * @brief Create a directory.
 * @returns {Promise<boolean>} True on success
 */
async function cmdMkdir(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: mkdir <dirname>');
        return false;
    }
    const dirname = parts[1];
    const ok = await fs.mkdirApi(dirname, fs.getCurrentDirId());
    if (ok) {
        term.writeln('Directory created: ' + dirname);
        renderFileBrowser();
    } else {
        term.writeln('Failed to create directory: ' + dirname);
    }
    return ok;
}

/**
 * @brief List the contents of a directory via API. Dirs in cyan and files in green.
 * @returns {Promise<boolean>} True on success
 */
async function cmdLs(parts) {
    // List the current working directory using the fs-managed current ID
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot list: not a directory or access denied\x1b[0m');
        return false;
    }

    if (listings.length === 0) {
        term.writeln('(empty)');
        return true;
    }

    listings.forEach(it => {
        if (isDirectory(it)) {
            term.write('\x1b[36m' + it.name + '/' + '\x1b[0m');
        } else {
            term.write('\x1b[32m' + it.name + '\x1b[0m');
        }
        term.write('  ');
    });
    term.writeln('');
    return true;
}

/**
 * @brief Change directory.
 * @returns {Promise<boolean>} True on success
 */
async function cmdCd(parts) {
    if (parts.length < 2) {
        // Go back to root directory
        fs.setCurrentDirId(fs.getUserRootId());
        currentPath = '/';
        renderFileBrowser();
        return true;
    }

    let dirName = parts[1] || '/';
    if (!dirName) dirName = '/';

    // 'cd ..' is handled by the general multi-segment resolution logic below

    // Support both relative and absolute paths; allow multi-segment paths
    const isAbsolute = dirName.startsWith('/');
    const segments = dirName.split('/').filter(Boolean);

    // Determine starting id for resolution
    let workingId = isAbsolute ? fs.getUserRootId() : fs.getCurrentDirId();
    if (!workingId) {
        term.writeln('\x1b[38;2;248;113;113mcd: cannot determine starting directory\x1b[0m');
        return false;
    }

    // Build the new path segments progressively
    let newPathSegments = isAbsolute ? [] : (currentPath === '/' ? [] : currentPath.split('/').filter(Boolean));

    for (const seg of segments) {
        if (seg === '.' || seg === '') continue;
        // Special virtual shared folder handling
        if (seg === 'shared') {
            // Map to the virtual 'shared' parent identifier
            workingId = 'shared';
            newPathSegments.push('shared');
            continue;
        }
        if (seg === '..') {
            if (newPathSegments.length > 0) {
                newPathSegments.pop();
                // Reset workingId and re-walk newPathSegments to set the correct workingId
                workingId = fs.getUserRootId();
                for (const s of newPathSegments) {
                    const list = await fs.listDirApi(workingId);
                    const next = list ? list.find(it => it.name === s && isDirectory(it)) : null;
                    if (!next) {
                        term.writeln('\x1b[38;2;248;113;113mcd: not a directory: ' + s + '\x1b[0m');
                        return false;
                    }
                    workingId = next.id;
                }
            } else {
                workingId = fs.getUserRootId();
            }
            continue;
        }
        const listings = await fs.listDirApi(workingId);
        if (!listings) {
            term.writeln('\x1b[38;2;248;113;113mcd: cannot access directory\x1b[0m');
            return false;
        }
        const next = listings.find(item => item.name === seg && isDirectory(item));
        if (!next) {
            term.writeln('\x1b[38;2;248;113;113mcd: not a directory: ' + seg + '\x1b[0m');
            return false;
        }
        workingId = next.id;
        newPathSegments.push(seg);
    }

    fs.setCurrentDirId(workingId);
    currentPath = newPathSegments.length === 0 ? '/' : '/' + newPathSegments.join('/');
    renderFileBrowser();
    return true;
}

/**
 * @brief Print directory tree starting at the path.
 * @returns {boolean} True on success
 */
async function cmdTree(parts) {
    term.writeln('\x1b[38;2;248;113;113mTree command not yet implemented for API backend\x1b[0m');
    return false;
}

/**
 * @brief View file contents (cat command).
 * @returns {Promise<boolean>} True on success
 */
async function cmdCat(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: cat <filename>');
        return false;
    }

    const filename = parts[1];

    // Find the file in the current directory
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    const fileToRead = listings.find(item => item.name === filename && !isDirectory(item));
    if (!fileToRead) {
        term.writeln('\x1b[38;2;248;113;113mcat: file not found: ' + filename + '\x1b[0m');
        return false;
    }

    // Read the file contents via API
    const content = await fs.readFileApi(fileToRead.id);
    if (content !== null) {
        // Split content by lines to preserve formatting in terminal
        const lines = content.split('\n');
        lines.forEach(line => {
            term.writeln(line);
        });
        return true;
    } else {
        term.writeln('\x1b[38;2;248;113;113mcat: cannot read file: ' + filename + '\x1b[0m');
        return false;
    }
}

/**
 * @brief Download a file.
 * @returns {Promise<boolean>} True on success
 */
async function cmdDownload(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: download <filename>');
        return false;
    }

    const filename = parts[1];

    // Find the file in the current directory
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    const fileToDownload = listings.find(item => item.name === filename && !isDirectory(item));
    if (!fileToDownload) {
        term.writeln('\x1b[38;2;248;113;113mdownload: file not found: ' + filename + '\x1b[0m');
        return false;
    }

    // Create a download link using the file read API
    try {
        // In a real implementation, we would reconstruct the file from chunks
        // For now, we'll use the file read API to get a text representation
        window.open(`/api/files/read?id=${fileToDownload.id}&download=1`, '_blank');
        term.writeln('Download started for: ' + filename);
        return true;
    } catch (error) {
        term.writeln('\x1b[38;2;248;113;113mdownload: failed to download file: ' + error.message + '\x1b[0m');
        return false;
    }
}

/**
 * @brief Open a file in the editor/viewer.
 * @returns {Promise<boolean>} True on success
 */
async function cmdEdit(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: edit <filename>  (or vim, nano)');
        return false;
    }

    const filename = parts[1];

    // Find the file in the current directory
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    const fileToEdit = listings.find(item => item.name === filename && !isDirectory(item));
    if (!fileToEdit) {
        term.writeln('\x1b[38;2;248;113;113medit: file not found: ' + filename + '\x1b[0m');
        return false;
    }

    // Read file content
    const content = await fs.readFileApi(fileToEdit.id);
    if (content !== null) {
        window.fileEditor.open(fileToEdit, content);
        return true;
    }

    term.writeln('\x1b[38;2;248;113;113medit: cannot read file: ' + filename + '\x1b[0m');
    return false;
}

/**
 * Primary command dispatcher. Parses the entered `cmd` string and executes
 * the related command handler. This function updates `lastCommandSuccess` to
 * reflect execution outcome (true on success).
 *
 * Supported commands: help, clear, echo, date, history, upload, add, share, delete,
 * mkdir, ls, cd, tree, about
 *
 * @param {string} cmd - Raw command line input string
 */
async function handleCommand(cmd) {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();
    let success = true;

    try {
        switch (command) {
            case 'help': success = cmdHelp(); break;
            case 'clear': success = cmdClear(); break;
            case 'echo': success = cmdEcho(parts); break;
            case 'date': success = cmdDate(); break;
            case 'history': success = cmdHistory(); break;
            case 'about': success = cmdAbout(); break;
            case 'whoami': success = cmdWhoami(); break;
            case 'health': success = await cmdHealth(); break;
            case 'stats': success = await cmdStats(); break;
            case 'upload': success = cmdUpload(); break;
            case 'add':
                // Since cmdAdd is now async, we need to handle it properly
                success = await cmdAdd(parts);
                break;
            case 'share':
                // Since cmdShare is now async, we need to handle it properly
                success = await cmdShare(parts);
                break;
            case 'delete':
                // Since cmdDelete is now async, we need to handle it properly
                success = await cmdDelete(parts);
                break;
            case 'mkdir':
                // Since cmdMkdir is now async, we need to handle it properly
                success = await cmdMkdir(parts);
                break;
            case 'ls':
                // Since cmdLs is now async, we need to await it
                success = await cmdLs(parts);
                break;
            case 'cd':
                // Since cmdCd is now async, we need to handle it properly
                success = await cmdCd(parts);
                break;
            case 'cat':
                // Since cmdCat is now async, we need to handle it properly
                success = await cmdCat(parts);
                break;
            case 'download':
                // Since cmdDownload is now async, we need to handle it properly
                success = await cmdDownload(parts);
                break;
            case 'edit':
            case 'vim':
            case 'nano':
                success = await cmdEdit(parts);
                break;
            case 'tree': success = cmdTree(parts); break;
            case 'login': success = cmdLogin(parts); break;  // Added login command
            case 'logout': success = cmdLogout(); break;     // Added logout command
            case 'register': success = cmdRegister(parts); break; // Added register command
            default:
                if (cmd.trim()) {
                    term.writeln(`\x1b[38;2;248;113;113mCommand not found: ${command}\x1b[0m`);
                    term.writeln('Type "help" for available commands');
                    success = false;
                }
        }
    } catch (error) {
        console.error('Command execution error:', error);
        term.writeln(`\x1b[38;2;248;113;113mCommand execution error: ${error.message}\x1b[0m`);
        success = false;
    }

    lastCommandSuccess = !!success;
}

// Resize handler
window.addEventListener('resize', () => {
    fitAddon.fit();
});

// Control functions
/**
 * @brief Clear the terminal viewport and write a fresh prompt.
 *
 * This function clears the xterm instance and renders a new prompt line.
 */
function clearTerminal() {
    term.clear();
    writePrompt({ newlineBefore: true });
}

/**
 *  Render the terminal prompt. This prints an optional top-line containing
 * `username` and `currentPath` in cyan, and then the prompt symbol on the
 * following line. The prompt symbol is colored (green/red) based on
 * `lastCommandSuccess`.
 *
 * @param {Object} [opts] - Options
 * @param {boolean} [opts.newlineBefore=false] - Insert newline before prompt
 * @param {boolean} [opts.showPath=true] - Whether to show the username/path line
 */
function writePrompt({ newlineBefore = false, showPath = true } = {}) {
    if (newlineBefore) term.write('\r\n');
    // Update the file browser and focus the external input box instead of inline prompt symbol
    if (typeof renderFileBrowser === 'function') renderFileBrowser();
    if (cmdInputEl) cmdInputEl.focus();
}

/**
 * @brief Write a line to the terminal and force a layout reflow.
 *
 * This helper writes a single line to the terminal and then invokes the
 * `fitAddon` to ensure the terminal's layout and scrollbar sizing match the
 * new content size.
 *
 * @param {string} line - The line to write to the terminal.
 */
function writeAndFit(line) {
    term.writeln(line);
    try { fitAddon.fit(); } catch (e) { /* ignore */ }
}

let currentFontSize = 14;
/**
 * Change the terminal's fontSize by the given delta and refit the terminal.
 *
 * @param {number} delta - Positive or negative change to current font size.
 */
function changeFontSize(delta) {
    currentFontSize = Math.max(8, Math.min(24, currentFontSize + delta));
    term.options.fontSize = currentFontSize;
    fitAddon.fit();
}

// File upload functionality
/**
 * HTML/JS file input used by the `upload` command. The element is present
 * in the page's markup and gets clicked programmatically by `triggerFileUpload`.
 * @type {HTMLInputElement}
 */
const fileInput = document.getElementById('fileInput');

/**
 * Maximum upload size will be dynamically calculated by fetching storage
 * availability information from the backend. See `fs.getStorageInfo()`.
 * @type {number|null}
 */
let MAX_FILE_SIZE = null; // computed dynamically by query

/**
 * @brief Programmatically trigger the HTML5 file input for uploads.
 *
 * This function clicks the hidden `<input type="file"/>` element to open
 * the native file picker for the user.
 */
function triggerFileUpload() {
    fileInput.click();
}

/**
 * @brief Copy selected terminal text to the clipboard with fallbacks.
 *
 * Uses the modern Clipboard API where available, otherwise falls back to
 * creating a temporary textarea and executing `document.execCommand('copy')`.
 *
 * @param {string} text - The text to copy to the clipboard.
 * @returns {Promise<boolean>} Resolves to true when the copy was successful.
 */
function copyTextToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => {
            // fallback below
            return copyTextToClipboardFallback(text);
        });
    }
    return Promise.resolve(copyTextToClipboardFallback(text));
}

function copyTextToClipboardFallback(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
    } catch (e) {
        return false;
    }
}

/**
 * @brief Copy the terminal selection to the clipboard if a selection exists.
 *
 * Returns `true` if the copy was initiated, otherwise `false` (no selection).
 */
function copyTerminalSelection() {
    const sel = term.getSelection();
    if (!sel || sel.length === 0) return false;
    copyTextToClipboard(sel).then(ok => {
        if (!ok) {
            // Optional: show non-intrusive warning in terminal
            term.writeln('\x1b[38;2;248;113;113mWarning: Copy failed. Try using right-click or the browser menu.\x1b[0m');
        }
    });
    return true;
}

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) {
        term.writeln('No file selected');
        lastCommandSuccess = false;
        writePrompt({ newlineBefore: true });
        return;
    }

    // Validate file type
    if (!file.name.endsWith('.txt')) {
        term.writeln('\x1b[38;2;248;113;113mError: Only .txt files are allowed\x1b[0m');
        lastCommandSuccess = false;
        writePrompt({ newlineBefore: true });
        fileInput.value = ''; // Reset input
        return;
    }

    // Validate file size against storage availability by querying the backend
    try {
        const storageInfo = (window.fs && typeof window.fs.getStorageInfo === 'function') ? await window.fs.getStorageInfo() : null;
        if (storageInfo && typeof storageInfo.maxUploadBytes === 'number') {
            const maxBytes = storageInfo.maxUploadBytes;
            if (file.size > maxBytes) {
                const maxMB = (maxBytes / 1024 / 1024).toFixed(2);
                term.writeln(`\x1b[38;2;248;113;113mError: File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum available storage (${maxMB}MB)\x1b[0m`);
                lastCommandSuccess = false;
                writePrompt({ newlineBefore: true });
                fileInput.value = ''; // Reset input
                return;
            }
        }
        // If storageInfo is not available, we'll allow the upload and let backend validate
    } catch (err) {
        console.warn('Could not query storage info for validation', err);
    }

    // Read and display file contents
    const reader = new FileReader();

    reader.onload = (e) => {
        const contents = e.target.result;
        term.writeln(`\x1b[32mFile loaded successfully: ${file.name} (${(file.size / 1024).toFixed(2)}KB)\x1b[0m`);
        term.writeln('');
        term.writeln('--- File Contents ---');
        term.writeln(contents);
        term.writeln('--- End of File ---');
        term.writeln('');
        // Upload file to backend API
        fs.uploadFileApi(file.name, contents, fs.getCurrentDirId())
            .then(async (ok) => {
                if (ok) {
                    term.writeln(`\x1b[32mFile uploaded successfully: ${file.name}\x1b[0m`);
                    lastCommandSuccess = true;
                    renderFileBrowser();
                } else {
                    // Try to show detailed reason based on storage info
                    try {
                        const info = (window.fs && typeof window.fs.getStorageInfo === 'function') ? await window.fs.getStorageInfo() : null;
                        if (info && typeof info.maxUploadBytes === 'number') {
                            term.writeln(`\x1b[38;2;248;113;113mError: Failed to upload file: ${file.name}. Not enough storage available (max ${(info.maxUploadBytes / 1024 / 1024).toFixed(2)}MB)\x1b[0m`);
                        } else {
                            term.writeln(`\x1b[38;2;248;113;113mWarning: Failed to upload file: ${file.name}\x1b[0m`);
                        }
                    } catch (err) {
                        term.writeln(`\x1b[38;2;248;113;113mWarning: Failed to upload file: ${file.name}\x1b[0m`);
                    }
                    lastCommandSuccess = false;
                }
                writePrompt({ newlineBefore: true });
                fileInput.value = ''; // Reset input for next upload
            })
            .catch(error => {
                term.writeln(`\x1b[38;2;248;113;113mUpload error: ${error.message}\x1b[0m`);
                lastCommandSuccess = false;
                writePrompt({ newlineBefore: true });
                fileInput.value = ''; // Reset input for next upload
            });

    };

    reader.onerror = () => {
        term.writeln('\x1b[38;2;248;113;113mError: Failed to read file\x1b[0m');
        lastCommandSuccess = false;
        writePrompt({ newlineBefore: true });
        fileInput.value = ''; // Reset input
    };

    reader.readAsText(file);
});

// Focus input box on load (user types commands here)
if (cmdInputEl) cmdInputEl.focus();

// File browser UI elements (top pane) -- declared earlier

/**
 * @brief Render breadcrumb for the current path and attach quick navigation.
 *
 * Updates the `pathInput` element so it matches the current virtual working
 * directory. Segments may be clicked to navigate to parent paths.
 */
function renderBreadcrumb() {
    // Update the path input element with the current path
    if (pathInputEl) {
        pathInputEl.value = currentPath;
    }
}

/**
 * @brief Inline SVG helper wrapper that delegates to the centralized `icons` module.
 *
 * If the `icons` module is present it will be used; otherwise a fallback
 * empty SVG is returned to avoid throwing errors when an icon is missing.
 *
 * @param {string} name - Icon name to create.
 * @param {string} [color='#484B6A'] - Optional color for the icon stroke.
 * @return {SVGSVGElement} Newly created SVG element (icon or placeholder).
 */
function createIcon(name, color = '#484B6A') {
    // Delegate to centralized icons module if available
    try {
        if (window && window.icons && typeof window.icons.createIcon === 'function') {
            return window.icons.createIcon(name, color);
        }
    } catch (e) {
        // swallow errors and fallback to local implementation
    }
    // Fallback: tiny placeholder svg
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    return svg;
}

/**
 * Render the contents of the current directory in the file browser pane via API.
 */
async function renderFileBrowser() {
    // If the file browser element isn't present yet, don't attempt render.
    if (!fileBrowserEl) return;
    renderBreadcrumb();
    // If the user is not logged in (no user root ID), display a logged-out
    // placeholder instead of the file list. The `fs` module stores the
    // `userRootId` when the user logs in; when it's `null` we consider the
    // session unauthenticated for the dashboard.
    const userRootId = (window.fs && typeof window.fs.getUserRootId === 'function') ? window.fs.getUserRootId() : null;
    if (userRootId === null) {
        fileBrowserEl.innerHTML = '';
        fileBrowserEl.classList.add('logged-out');
        const msg = document.createElement('div');
        msg.className = 'logged-out-message';
        msg.textContent = 'Logged out. Please sign in or create an account';
        msg.setAttribute('role', 'status');
        msg.setAttribute('aria-live', 'polite');
        fileBrowserEl.appendChild(msg);
        // Disable browser actions when logged out
        if (btnRefresh) btnRefresh.disabled = true;
        if (btnNewFolder) btnNewFolder.disabled = true;
        if (btnUploadButton) btnUploadButton.disabled = true;
        return;
    }
    // Reset any previous logged-out styling
    fileBrowserEl.classList.remove('logged-out');
    // Re-enable browser actions
    if (btnRefresh) btnRefresh.disabled = false;
    if (btnNewFolder) btnNewFolder.disabled = false;
    if (btnUploadButton) btnUploadButton.disabled = false;

    // Get file list from API using the current directory ID from fs module
    const list = await fs.listDirApi(fs.getCurrentDirId());
    fileBrowserEl.innerHTML = '';
    if (!list) {
        const p = document.createElement('p');
        p.textContent = 'Error loading directory';
        fileBrowserEl.appendChild(p);
        return;
    }
    // Helper to format file size in KB/MB
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let idx = 0;
        let val = bytes;
        while (val >= 1024 && idx < units.length - 1) {
            val = val / 1024;
            idx++;
        }
        return `${val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
    }

    // Render a "go up" back row when not in the root.
    // For API version, we'll need to implement proper directory navigation
    if (currentPath !== '/') {
        const up = document.createElement('div');
        up.className = 'file-entry group';
        const left = document.createElement('div');
        left.className = 'file-left';
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '10px';
        const chev = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('chev', '#6B7280') : createIcon('chev', '#6B7280');
        chev.style.transform = 'rotate(180deg)';
        left.appendChild(chev);
        const txt = document.createElement('div');
        txt.className = 'name';
        txt.textContent = '..';
        left.appendChild(txt);
        up.appendChild(left);
        up.addEventListener('click', () => {
            handleCommand('cd ..');
            if (cmdInputEl) cmdInputEl.focus();
        });
        fileBrowserEl.appendChild(up);
    }

    list.forEach(item => {
        const div = document.createElement('div');
        // Copy the group behavior so action buttons appear on row hover
        div.className = 'file-entry group';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = item.name + (isDirectory(item) ? '/' : '');
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = isDirectory(item) ? 'Directory' : (item.size ? `${item.size} bytes` : 'File');
        const left = document.createElement('div');
        left.className = 'file-left';
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '10px';
        const iconName = isDirectory(item) ? 'folder' : (item.mimeType === 'image' ? 'file' : 'file');
        const iconColor = isDirectory(item) ? '#1E90FF' : (item.mimeType === 'image' ? '#A78BFA' : '#6B7280');
        const icon = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon(iconName, iconColor) : createIcon(iconName, iconColor);
        left.appendChild(icon);
        const textWrap = document.createElement('div');
        textWrap.className = 'file-meta';
        textWrap.style.display = 'flex';
        textWrap.style.flexDirection = 'column';
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = item.name + (isDirectory(item) ? '/' : '');
        const sizeEl = document.createElement('div');
        sizeEl.className = 'meta';
        sizeEl.textContent = item.size ? formatBytes(item.size) : '';
        textWrap.appendChild(nameEl);
        if (item.size) textWrap.appendChild(sizeEl);
        left.appendChild(textWrap);
        div.appendChild(left);
        const right = document.createElement('div');
        right.className = 'file-right';
        right.style.display = 'flex';
        right.style.gap = '8px';
        // action buttons for files
        const actions = document.createElement('div');
        actions.className = 'actions';
        if (!isDirectory(item)) {
            // Edit button: opens a prompt to edit file contents
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn action-edit';
            const pencil = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('pencil', '#374151') : createIcon('pencil', '#374151');
            editBtn.appendChild(pencil);
            editBtn.title = 'Edit';
            editBtn.setAttribute('aria-label', 'Edit file');
            editBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                try {
                    const contents = await fs.readFileApi(item.id);
                    if (contents === null) {
                        term.writeln('\x1b[31mError: Cannot read file\x1b[0m');
                        if (cmdInputEl) cmdInputEl.focus();
                        return;
                    }
                    // Open in the new editor
                    window.fileEditor.open(item, contents);
                } catch (err) {
                    term.writeln('\x1b[31mError: Cannot read file (' + (err && err.message ? err.message : err) + ')\x1b[0m');
                    lastCommandSuccess = false;
                    if (cmdInputEl) cmdInputEl.focus();
                }
            });
            actions.appendChild(editBtn);
            const viewBtn = document.createElement('button');
            viewBtn.className = 'action-btn action-view';
            const eye = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('eye', '#059669') : createIcon('eye', '#059669');
            viewBtn.appendChild(eye);
            viewBtn.title = 'View';
            viewBtn.setAttribute('aria-label', 'View file');
            viewBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                try {
                    const contents = await fs.readFileApi(item.id);
                    if (contents !== null) {
                        // Open in the new editor/viewer
                        window.fileEditor.open(item, contents);
                        lastCommandSuccess = true;
                    } else {
                        term.writeln('\x1b[31mError: Cannot read file\x1b[0m');
                        lastCommandSuccess = false;
                        if (cmdInputEl) cmdInputEl.focus();
                    }
                } catch (err) {
                    term.writeln('\x1b[31mError: Cannot read file (' + (err && err.message ? err.message : err) + ')\x1b[0m');
                    lastCommandSuccess = false;
                    if (cmdInputEl) cmdInputEl.focus();
                }
            });
            const dlBtn = document.createElement('button');
            dlBtn.className = 'action-btn action-download';
            const dl = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('download', '#0369A1') : createIcon('download', '#0369A1');
            dlBtn.appendChild(dl);
            dlBtn.title = 'Download';
            dlBtn.setAttribute('aria-label', 'Download file');
            dlBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                // Instead of using the in-memory function, create a download link to the API endpoint
                const downloadUrl = `/api/files/read?id=${item.id}&download=1`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = item.name; // This should trigger download
                link.target = '_blank'; // Open in new tab to allow download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                if (cmdInputEl) cmdInputEl.focus();
            });
            actions.appendChild(viewBtn);
            actions.appendChild(dlBtn);
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn action-delete';
            const trash = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('trash', '#EF4444') : createIcon('trash', '#EF4444');
            delBtn.appendChild(trash);
            delBtn.title = 'Delete';
            delBtn.setAttribute('aria-label', 'Delete file');
            delBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                try {
                    const ok = await fs.rmNodeApi(item.id);
                    if (ok) {
                        term.writeln('\x1b[32mDeleted ' + item.name + '\x1b[0m');
                        lastCommandSuccess = true;
                    } else {
                        term.writeln('\x1b[31mError: Delete failed: ' + item.name + '\x1b[0m');
                        lastCommandSuccess = false;
                    }
                } catch (err) {
                    term.writeln('\x1b[31mError: Delete failed: ' + (err && err.message ? err.message : err) + '\x1b[0m');
                    lastCommandSuccess = false;
                }
                renderFileBrowser();
                if (cmdInputEl) cmdInputEl.focus();
            });
            actions.appendChild(delBtn);
        }
        right.appendChild(actions);
        div.appendChild(right);
        div.addEventListener('click', async (e) => {
            // click on directory navigates, click on file shows content
            if (isDirectory(item)) {
                // Handle our virtual '/shared' folder: id is the string 'shared'
                if (item.id === 'shared') {
                    // Set to a sentinel value for shared virtual folder
                    if (window.fs && typeof window.fs.setCurrentDirId === 'function') {
                        window.fs.setCurrentDirId('shared');
                    }
                    currentPath = '/shared';
                    renderFileBrowser();
                } else {
                    // Use relative segment for UI navigation; `cmdCd` supports
                    // absolute and multi-segment paths, but passing just the
                    // child name keeps behavior predictable and avoids issues
                    // when the path changes.
                    handleCommand('cd ' + item.name);
                }
                if (cmdInputEl) cmdInputEl.focus();
            } else {
                try {
                    const contents = await fs.readFileApi(item.id);
                    if (contents !== null) {
                        term.writeln('');
                        term.writeln('\x1b[33m--- File: ' + item.name + ' ---\x1b[0m');
                        // Split content by lines to preserve formatting in terminal
                        const lines = contents.split('\n');
                        lines.forEach(line => {
                            term.writeln(line);
                        });
                        term.writeln('\x1b[33m--- End of File ---\x1b[0m');
                        lastCommandSuccess = true;
                        if (cmdInputEl) cmdInputEl.focus();
                    } else {
                        term.writeln('\x1b[38;2;248;113;113mError: Cannot read file\x1b[0m');
                        lastCommandSuccess = false;
                        if (cmdInputEl) cmdInputEl.focus();
                    }
                } catch (err) {
                    term.writeln('\x1b[38;2;248;113;113mError: Cannot read file: ' + (err && err.message ? err.message : err) + '\x1b[0m');
                    lastCommandSuccess = false;
                    if (cmdInputEl) cmdInputEl.focus();
                }
            }
            renderFileBrowser();
        });
        fileBrowserEl.appendChild(div);
    });
}

/**
 * Setup the resizable divider between file browser and terminal.
 */
function setupResizer() {
    let isDragging = false;
    let startX = 0;
    let startCols = null;
    dividerEl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        const grid = document.querySelector('.main-grid');
        startCols = grid.style.gridTemplateColumns || window.getComputedStyle(grid).gridTemplateColumns;
        startCols = startCols.split(' ').map(c => c.trim());
        document.body.style.cursor = 'col-resize';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const grid = document.querySelector('.main-grid');
        const rect = grid.getBoundingClientRect();
        const dx = e.clientX - rect.left; // new browser width in px
        // compute new widths: browser width = dx, terminal width = rect.width - dx - divider width
        const dividerWidth = parseInt(window.getComputedStyle(dividerEl).width || '8', 10);
        const browserWidth = Math.max(200, Math.min(dx, rect.width - 400)); // Min 200px, max leaves 400px for terminal
        const terminalWidth = Math.max(400, rect.width - browserWidth - dividerWidth);
        grid.style.gridTemplateColumns = `${browserWidth}px ${dividerWidth}px ${terminalWidth}px`;
        fitAddon.fit();
    });
    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = '';
    });
}

// Wire browser buttons
btnRefresh.addEventListener('click', (e) => { e.preventDefault(); renderFileBrowser(); });
btnNewFolder.addEventListener('click', async (e) => {
    const name = prompt('New folder name');
    if (name) {
        const ok = await fs.mkdirApi(name, fs.getCurrentDirId());
        if (ok) term.writeln('\x1b[32mDirectory created: ' + name + '\x1b[0m');
        else term.writeln('\x1b[38;2;248;113;113mFailed to create directory\x1b[0m');
        renderFileBrowser();
        writePrompt({ newlineBefore: true });
    }
});
btnUploadButton.addEventListener('click', (e) => { e.preventDefault(); triggerFileUpload(); });

// Path input: allow user to type an explicit path and press Enter to navigate.
if (pathInputEl) {
    pathInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = (pathInputEl.value || '').trim() || '/';
            // Accept direct directory changes. If the value isn't absolute, `cd` will resolve it.
            handleCommand('cd ' + val);
            renderFileBrowser();
            // Put focus back to the CLI input so users can continue typing commands.
            if (cmdInputEl) cmdInputEl.focus();
        }
    });
}

// Terminal header buttons: close/minimize/max (updated for horizontal layout)
if (termBtnClose) termBtnClose.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (grid) {
        // Hide terminal by collapsing its column
        grid.dataset.prev = grid.style.gridTemplateColumns || window.getComputedStyle(grid).gridTemplateColumns;
        grid.style.gridTemplateColumns = '1fr 0px 0px';
    }
});
if (termBtnMin) termBtnMin.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    // collapse the terminal: keep browser full width and terminal small
    grid.dataset.prev = grid.style.gridTemplateColumns || window.getComputedStyle(grid).gridTemplateColumns;
    grid.style.gridTemplateColumns = `1fr 8px 300px`;
    fitAddon.fit();
});
if (termBtnMax) termBtnMax.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    // Maximize terminal
    if (grid.dataset.prev) {
        grid.style.gridTemplateColumns = grid.dataset.prev;
    } else {
        grid.style.gridTemplateColumns = `200px 8px 1fr`;
    }
    fitAddon.fit();
});
if (termCollapse) termCollapse.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    if (!grid.dataset.prev) {
        // Save current and collapse terminal to minimum
        grid.dataset.prev = grid.style.gridTemplateColumns || window.getComputedStyle(grid).gridTemplateColumns;
        grid.style.gridTemplateColumns = `1fr 8px 300px`;
    } else {
        // Restore previous size
        grid.style.gridTemplateColumns = grid.dataset.prev;
        delete grid.dataset.prev;
    }
    fitAddon.fit();
});

// Initialize file browser and resizer after terminal is ready
/**
 * @brief Attach icons to elements with a `data-icon` attribute inside the header.
 *
 * Elements with `data-icon` will receive their icon via the `icons.insertIcon`
 * helper. The icon color is read from `data-icon-color` and passed through to
 * the generator function.
 */
function attachHeaderIcons() {
    try {
        if (window && window.icons && typeof window.icons.insertIcon === 'function') {
            document.querySelectorAll('[data-icon]').forEach(el => {
                const name = el.getAttribute('data-icon');
                const color = el.getAttribute('data-icon-color') || undefined;
                const target = el.querySelector('.icon') || el;
                window.icons.insertIcon(target, name, color);
            });
        }
    } catch (e) {
        // ignore
    }
}

attachHeaderIcons();
renderFileBrowser();
setupResizer();
fitAddon.fit();

// Setup profile dropdown
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const logoutBtn = document.getElementById('logoutBtn');

if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = profileDropdown.style.display !== 'none';

        if (isVisible) {
            profileDropdown.style.display = 'none';
            profileBtn.classList.remove('active');
        } else {
            profileDropdown.style.display = 'block';
            profileBtn.classList.add('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.style.display = 'none';
            profileBtn.classList.remove('active');
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        profileDropdown.style.display = 'none';
        profileBtn.classList.remove('active');
        handleCommand('logout');
    });
}

// Wire the terminal input element (bottom box)
if (cmdInputEl) {
    cmdInputEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = cmdInputEl.value.trim();
            if (!cmd) return;
            // Add to history
            commandHistory.push(cmd);
            historyIndex = commandHistory.length;
            // Special case: clear should not be echoed after clearing the terminal
            if (cmd.toLowerCase() === 'clear') {
                await handleCommand(cmd);
            } else {
                // Echo command in terminal with cyan prompt ($) color (#22D3EE) then execute
                term.writeln('\x1b[38;2;34;211;238m$ ' + cmd + '\x1b[0m');
                await handleCommand(cmd);
                term.writeln('');
            }
            // Clear input, refocus, update file browser
            cmdInputEl.value = '';
            cmdInputEl.focus();
            renderFileBrowser();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIndex = historyIndex + 1;
            if (newIndex < commandHistory.length) {
                historyIndex = newIndex;
                cmdInputEl.value = commandHistory[commandHistory.length - 1 - newIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                historyIndex = newIndex;
                cmdInputEl.value = commandHistory[commandHistory.length - 1 - newIndex];
            } else if (historyIndex === 0) {
                historyIndex = -1;
                cmdInputEl.value = '';
            }
        }
    });
}

// Export renderFileBrowser globally for use in editor.js
window.renderFileBrowser = renderFileBrowser;
window.handleCommand = handleCommand;

/**
 * Check and restore session on page load
 */
async function checkSession() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            const userData = result.data;
            window.username = userData.username;

            // Set root directory
            if (userData.rootDirectoryID) {
                fs.setUserRootId(userData.rootDirectoryID);
                fs.setCurrentDirId(userData.rootDirectoryID);
            }

            // Update UI with user info
            const headerUsername = document.getElementById('headerUsername');
            const dropdownUsername = document.getElementById('dropdownUsername');
            const dropdownEmail = document.getElementById('dropdownEmail');

            if (headerUsername) headerUsername.textContent = userData.username;
            if (dropdownUsername) dropdownUsername.textContent = userData.username;
            if (dropdownEmail && userData.email) dropdownEmail.textContent = userData.email;

            // Refresh file browser
            renderFileBrowser();

            // Show welcome message in terminal
            term.writeln('');
            term.writeln('\x1b[36m=== Session Restored ===\x1b[0m');
            term.writeln(`Welcome back, ${userData.username}!`);
            if (userData.storage) {
                const sizeMB = (userData.storage.bytesUsed / 1024 / 1024).toFixed(2);
                term.writeln(`Files: ${userData.storage.fileCount} | Folders: ${userData.storage.folderCount} | Storage: ${sizeMB} MB`);
            }
            term.writeln('');
        } else {
            // Not logged in
            term.writeln('Not logged in. Type "login <username> <password>" or "register" to get started.');
        }

        writePrompt({ newlineBefore: true });
    } catch (error) {
        console.error('Session check failed:', error);
        term.writeln('Session check failed. You may need to login.');
        writePrompt({ newlineBefore: true });
    }
}

// Check session when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
