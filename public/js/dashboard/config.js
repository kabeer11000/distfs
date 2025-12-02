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
    term.writeln('  login <username> <password>          - Login to your account');
    term.writeln('  logout                                - Logout from your account');
    term.writeln('  register <username> <email> <password> - Create new account');
    term.writeln('  cat <filename>                        - View file contents');
    term.writeln('  download <filename>                   - Download a file');
    term.writeln('  upload                                - Upload a .txt file (max 5MB)');
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
            term.writeln('Failed to create file ' + filename);
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
    // For now, just use the root directory ID (1) - in a full implementation we'd track directory IDs
    const listings = await fs.listDirApi(1);
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot list: not a directory or access denied\x1b[0m');
        return false;
    }

    if (listings.length === 0) {
        term.writeln('(empty)');
        return true;
    }

    listings.forEach(it => {
        if (it.type === 'folder') {
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

    const dirName = parts[1];

    // If trying to go up a level
    if (dirName === '..') {
        // For now, just go to root if at root level
        // In a full implementation, we'd track parent directory IDs
        fs.setCurrentDirId(fs.getUserRootId());
        currentPath = '/';
        renderFileBrowser();
        return true;
    }

    // List current directory contents to find the target directory
    const listings = await fs.listDirApi(fs.getCurrentDirId());
    if (!listings) {
        term.writeln('\x1b[38;2;248;113;113mCannot access current directory\x1b[0m');
        return false;
    }

    // Find the directory to change to
    const targetDir = listings.find(item => item.name === dirName && item.type === 'folder');
    if (!targetDir) {
        term.writeln('\x1b[38;2;248;113;113mcd: not a directory: ' + dirName + '\x1b[0m');
        return false;
    }

    // Change to the target directory
    fs.setCurrentDirId(targetDir.id);
    currentPath = currentPath + '/' + dirName;
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

    const fileToRead = listings.find(item => item.name === filename && item.type === 'file');
    if (!fileToRead) {
        term.writeln('\x1b[38;2;248;113;113mcat: file not found: ' + filename + '\x1b[0m');
        return false;
    }

    // Read the file contents via API
    const content = await fs.readFileApi(fileToRead.id);
    if (content !== null) {
        term.writeln(content);
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

    const fileToDownload = listings.find(item => item.name === filename && item.type === 'file');
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
 * Maximum allowed size (bytes) for uploaded files.
 * @const {number}
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

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

fileInput.addEventListener('change', (event) => {
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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        term.writeln(`\x1b[38;2;248;113;113mError: File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of 5MB\x1b[0m`);
        lastCommandSuccess = false;
        writePrompt({ newlineBefore: true });
        fileInput.value = ''; // Reset input
        return;
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
        .then(ok => {
            if (ok) {
                term.writeln(`\x1b[32mFile uploaded successfully: ${file.name}\x1b[0m`);
                lastCommandSuccess = true;
                renderFileBrowser();
            } else {
                term.writeln(`\x1b[38;2;248;113;113mWarning: Failed to upload file: ${file.name}\x1b[0m`);
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
    // Get file list from API - for now using directory ID 1 (root directory)
    // In a full implementation, we'd track the current directory ID
    const list = await fs.listDirApi(1);
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
        name.textContent = item.name + (item.type === 'dir' ? '/' : '');
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = item.type === 'dir' ? 'Directory' : (item.size ? `${item.size} bytes` : 'File');
        const left = document.createElement('div');
        left.className = 'file-left';
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '10px';
        const iconName = item.type === 'dir' ? 'folder' : (item.mimeType === 'image' ? 'file' : 'file');
        const icon = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon(iconName, item.type === 'dir' ? '#1E90FF' : (item.mimeType === 'image' ? '#A78BFA' : '#6B7280')) : createIcon(iconName, item.type === 'dir' ? '#1E90FF' : (item.mimeType === 'image' ? '#A78BFA' : '#6B7280'));
        left.appendChild(icon);
        const textWrap = document.createElement('div');
        textWrap.className = 'file-meta';
        textWrap.style.display = 'flex';
        textWrap.style.flexDirection = 'column';
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = item.name + (item.type === 'dir' ? '/' : '');
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
        if (item.type === 'file') {
            // Edit button: opens a prompt to edit file contents
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn action-edit';
            const pencil = (window && window.icons && typeof window.icons.createIcon === 'function') ? window.icons.createIcon('pencil', '#374151') : createIcon('pencil', '#374151');
            editBtn.appendChild(pencil);
            editBtn.title = 'Edit';
            editBtn.setAttribute('aria-label', 'Edit file');
            editBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const contents = fs.readFile(item.name, currentPath);
                if (contents === null) {
                    term.writeln('\x1b[31mError: Cannot read file\x1b[0m');
                    if (cmdInputEl) cmdInputEl.focus();
                    return;
                }
                const newContents = window.prompt('Edit file contents for ' + item.name, contents);
                if (newContents !== null) {
                    const ok = fs.addFile(item.name, newContents, currentPath);
                    if (ok) {
                        term.writeln('\x1b[32mFile saved: ' + item.name + '\x1b[0m');
                        lastCommandSuccess = true;
                        renderFileBrowser();
                    } else {
                        term.writeln('\x1b[31mError: Failed to save ' + item.name + '\x1b[0m');
                        lastCommandSuccess = false;
                    }
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
            viewBtn.addEventListener('click', (ev) => { ev.stopPropagation(); const contents = fs.readFile(item.name, currentPath); if (contents !== null) { term.writeln(''); term.writeln('\x1b[33m--- File: ' + item.name + ' ---\x1b[0m'); term.writeln(contents); term.writeln('\x1b[33m--- End of File ---\x1b[0m'); if (cmdInputEl) cmdInputEl.focus(); } else { term.writeln('\x1b[31mError: Cannot read file\x1b[0m'); if (cmdInputEl) cmdInputEl.focus(); } });
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
            delBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const ok = fs.rmNode(item.name, currentPath);
                if (ok) {
                    term.writeln('\x1b[32mDeleted ' + item.name + '\x1b[0m');
                    lastCommandSuccess = true;
                } else {
                    term.writeln('\x1b[31mError: Delete failed: ' + item.name + '\x1b[0m');
                    lastCommandSuccess = false;
                }
                renderFileBrowser();
                if (cmdInputEl) cmdInputEl.focus();
            });
            actions.appendChild(delBtn);
        }
        right.appendChild(actions);
        div.appendChild(right);
        div.addEventListener('click', (e) => {
            // click on directory navigates, click on file shows content
            if (item.type === 'dir') {
                handleCommand('cd ' + (currentPath === '/' ? '' : currentPath.replace(/\/$/, '')) + '/' + item.name);
                if (cmdInputEl) cmdInputEl.focus();
            } else {
                const contents = fs.readFile(item.name, currentPath);
                if (contents !== null) {
                    term.writeln('');
                    term.writeln('\x1b[33m--- File: ' + item.name + ' ---\x1b[0m');
                    term.writeln(contents);
                    term.writeln('\x1b[33m--- End of File ---\x1b[0m');
                    lastCommandSuccess = true;
                    if (cmdInputEl) cmdInputEl.focus();
                } else {
                    term.writeln('\x1b[38;2;248;113;113mError: Cannot read file\x1b[0m');
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
    let startY = 0;
    let startRows = null;
    dividerEl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        const grid = document.querySelector('.main-grid');
        startRows = grid.style.gridTemplateRows || window.getComputedStyle(grid).gridTemplateRows;
        startRows = startRows.split(' ').map(r => r.trim());
        document.body.style.cursor = 'row-resize';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const grid = document.querySelector('.main-grid');
        const rect = grid.getBoundingClientRect();
        const dy = e.clientY - rect.top; // new browser height in px
        // compute new heights: browser height = dy, terminal height = rect.height - dy - divider height
        const dividerHeight = parseInt(window.getComputedStyle(dividerEl).height || '8', 10);
        const browserHeight = Math.max(60, dy);
        const terminalHeight = Math.max(120, rect.height - browserHeight - dividerHeight);
        grid.style.gridTemplateRows = `${browserHeight}px ${dividerHeight}px ${terminalHeight}px`;
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
btnNewFolder.addEventListener('click', (e) => {
    const name = prompt('New folder name');
    if (name) {
        const ok = fs.mkdirCmd(name, currentPath);
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

// Terminal header buttons: close/minimize/max
if (termBtnClose) termBtnClose.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (grid) grid.style.display = 'none';
});
if (termBtnMin) termBtnMin.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    // collapse the terminal: keep browser full height and terminal small
    grid.dataset.prev = grid.style.gridTemplateRows || window.getComputedStyle(grid).gridTemplateRows;
    grid.style.gridTemplateRows = `1fr 8px 40px`;
    fitAddon.fit();
});
if (termBtnMax) termBtnMax.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    grid.style.gridTemplateRows = `1fr 8px 600px`;
    fitAddon.fit();
});
if (termCollapse) termCollapse.addEventListener('click', () => {
    const grid = document.querySelector('.main-grid');
    if (!grid) return;
    if (!grid.dataset.prev) {
        // Save current and collapse
        grid.dataset.prev = grid.style.gridTemplateRows || window.getComputedStyle(grid).gridTemplateRows;
        grid.style.gridTemplateRows = `1fr 8px 40px`;
    } else {
        grid.style.gridTemplateRows = grid.dataset.prev;
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
