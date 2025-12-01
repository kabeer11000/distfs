/***********************************************************************************************************
 * @file terminal/config.js
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
    cursorStyle: 'bar',
    cursorInactiveStyle: 'outline',
    cursorBlink: true,
    fontSize: 14,
    // Prefer InconsolataGo Nerd Font Mono if installed, fall back to Consolas and generic monospace
    fontFamily: '"InconsolataGo Nerd Font Mono", Consolas, "Courier New", monospace',
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

// initialize CLI state
/**
 * Current (simulated) username displayed in the prompt. Defaults to "root" until
 * user authentication or a login command is implemented.
 * @type {string}
 */
let username = 'root';

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
writePrompt({newlineBefore: true});

// Command buffer
let currentLine = '';
let commandHistory = [];
let historyIndex = -1;

/**
 * Handle keyboard input coming from xterm. This includes control characters
 * such as Enter, Backspace, arrow keys for history, and text input.
 * The handler updates `currentLine` and triggers `handleCommand` on Enter.
 */
term.onData(data => {
    const code = data.charCodeAt(0);
    
    // Enter key
    if (code === 13) {
        term.write('\r\n');
        if (currentLine.trim()) {
            commandHistory.push(currentLine);
            historyIndex = commandHistory.length;
            handleCommand(currentLine);
        }
                currentLine = '';
                writePrompt({newlineBefore: true});
    }
    // Backspace
    else if (code === 127) {
        if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
        }
    }
    // Up arrow (history)
    else if (data === '\x1b[A') {
        if (historyIndex > 0) {
            // Clear current line only (stay on same line; don't reprint path)
            term.write('\r\x1b[K');
            historyIndex--;
            currentLine = commandHistory[historyIndex];
            writePrompt({newlineBefore: false, showPath: false});
            term.write(currentLine);
        }
    }
    // Down arrow (history)
    else if (data === '\x1b[B') {
        if (historyIndex < commandHistory.length - 1) {
                    term.write('\r\x1b[K');
                    historyIndex++;
            currentLine = commandHistory[historyIndex];
            writePrompt({newlineBefore: false, showPath: false});
            term.write(currentLine);
        } else {
                term.write('\r\x1b[K');
                writePrompt({newlineBefore: false, showPath: false});
            historyIndex = commandHistory.length;
            currentLine = '';
        }
    }
    // Regular characters
    else if (code >= 32 && code < 127) {
        currentLine += data;
        term.write(data);
    }
});


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
    term.writeln('  upload                                - Upload a .txt file (max 5MB)');
    term.writeln('  add <filename>                        - Create an empty file or run without args to upload');
    term.writeln('  share <filename> <user> <permissions> - Share a file (simulated)');
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
 * @brief Add a new file or trigger upload when no filename provided.
 * @todo Implement real file creation via backend API.
 * @returns {boolean} True on success
 */
function cmdAdd(parts) {
    if (parts.length > 1) {
        const filename = parts.slice(1).join(' ');
        const ok = fs.addFile(filename, '', currentPath);
        if (ok) term.writeln('Created file ' + filename);
        else term.writeln('Failed to create file ' + filename);
        if (ok) renderFileBrowser();
        return !!ok;
    } else {
        triggerFileUpload();
        return true;
    }
}

/**
 * @brief Share a file (simulated) with another user and permissions.
 * @todo Implement real sharing via backend API.
 * @returns {boolean} True on success
 */
function cmdShare(parts) {
    if (parts.length < 4) {
        term.writeln('Usage: share <filename> <user> <permissions>');
        return false;
    }
    const filename = parts[1];
    const user = parts[2];
    const perms = parts[3];
    const target = fs.resolvePath(filename, currentPath);
    const f = fs.getNode(target);
    if (!f || f.node.type !== 'file') {
        term.writeln('share: file not found: ' + filename);
        return false;
    }
    term.writeln('Sharing ' + filename + ' with ' + user + ' (' + perms + ') - simulated');
    return true;
}

/**
 * @brief Delete a file or dir.
 * @returns {boolean} True on success
 */
function cmdDelete(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: delete <filename>');
        return false;
    }
    const filename = parts[1];
                const ok = fs.rmNode(filename, currentPath);
    if (ok) term.writeln('Deleted ' + filename);
    else term.writeln('Delete failed: ' + filename + ' not found');
    if (ok) renderFileBrowser();
    return !!ok;
}

/**
 * @brief Create a directory.
 * @returns {boolean} True on success
 */
function cmdMkdir(parts) {
    if (parts.length < 2) {
        term.writeln('Usage: mkdir <dirname>');
        return false;
    }
    const dirname = parts[1];
                const ok = fs.mkdirCmd(dirname, currentPath);
    if (ok) term.writeln('Directory created: ' + dirname);
    else term.writeln('Failed to create directory: ' + dirname);
    if (ok) renderFileBrowser();
    return !!ok;
}

/**
 * @brief List the contents of a directory. Dirs in cyan and files in green.
 * @returns {boolean} True on success
 */
function cmdLs(parts) {
            const listPath = parts.length > 1 ? fs.resolvePath(parts[1], currentPath) : currentPath;
            const listings = fs.listDir(listPath);
    if (!listings) { term.writeln('Cannot list: not a directory'); return false; }
    listings.forEach(it => {
        if (it.type === 'dir') {
            term.write('\x1b[36m' + it.name + '\x1b[0m');
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
 * @returns {boolean} True on success
 */
function cmdCd(parts) {
    if (parts.length < 2) {
        currentPath = '/';
        return true;
    }
                const target = fs.resolvePath(parts[1], currentPath);
                const tnode = fs.getNode(target);
    if (!tnode || tnode.node.type !== 'dir') {
        term.writeln('cd: not a directory: ' + parts[1]);
        return false;
    }
    currentPath = target;
    renderFileBrowser();
    return true;
}

/**
 * @brief Print directory tree starting at the path.
 * @returns {boolean} True on success
 */
function cmdTree(parts) {
    const treePath = parts.length > 1 ? fs.resolvePath(parts[1], currentPath) : currentPath;
    function printTree(node, prefix = '') {
        Object.keys(node.children || {}).forEach((k, i, arr) => {
            const child = node.children[k];
            const isLast = i === arr.length - 1;
            term.writeln(prefix + (isLast ? '└── ' : '├── ') + k + (child.type === 'file' ? '' : '/'));
            if (child.type === 'dir') {
                printTree(child, prefix + (isLast ? '    ' : '│   '));
            }
        });
    }
    const root = fs.getNode(treePath);
    if (!root || root.node.type !== 'dir') { term.writeln('Not a directory'); return false; }
    term.writeln(treePath);
    printTree(root.node);
    return true;
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
function handleCommand(cmd) {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();
    let success = true;
    switch (command) {
        case 'help': success = cmdHelp(); break;
        case 'clear': success = cmdClear(); break;
        case 'echo': success = cmdEcho(parts); break;
        case 'date': success = cmdDate(); break;
        case 'history': success = cmdHistory(); break;
        case 'about': success = cmdAbout(); break;
        case 'upload': success = cmdUpload(); break;
        case 'add': success = cmdAdd(parts); break;
        case 'share': success = cmdShare(parts); break;
        case 'delete': success = cmdDelete(parts); break;
        case 'mkdir': success = cmdMkdir(parts); break;
        case 'ls': success = cmdLs(parts); break;
        case 'cd': success = cmdCd(parts); break;
        case 'tree': success = cmdTree(parts); break;
        default:
            if (cmd.trim()) {
                term.writeln(`Command not found: ${command}`);
                term.writeln('Type "help" for available commands');
                success = false;
            }
    }
    lastCommandSuccess = !!success;
}

// Resize handler
window.addEventListener('resize', () => {
    fitAddon.fit();
});

// Control functions
/**
 * Clear current terminal output and render a fresh prompt.
 */
function clearTerminal() {
    term.clear();
    writePrompt({newlineBefore: true});
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
function writePrompt({newlineBefore = false, showPath = true} = {}) {
    if (newlineBefore) {
        term.write('\r\n');
    }

    // Format path for display: remove leading slash if present
    const displayPath = currentPath === '/' ? '' : currentPath.replace(/^\//, '');
    const top = displayPath ? `${username}/${displayPath}` : `${username}`;
    // Cyan for path/title — optionally show the path line
    if (showPath) term.writeln('\x1b[36m' + top + '\x1b[0m');
    // Prompt symbol color depends on previous command success (green/red)
    const symbol = lastCommandSuccess ? '\x1b[1;32m❯\x1b[0m' : '\x1b[1;31m❯\x1b[0m';
    term.write(symbol + ' ');
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
 * Programmatically trigger the HTML5 file input element for file uploads.
 */
function triggerFileUpload() {
    fileInput.click();
}

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (!file) {
        term.writeln('No file selected');
                    lastCommandSuccess = false;
                    writePrompt({newlineBefore: true});
        return;
    }
    
    // Validate file type
    if (!file.name.endsWith('.txt')) {
        term.writeln('\x1b[31mError: Only .txt files are allowed\x1b[0m');
                    lastCommandSuccess = false;
                    writePrompt({newlineBefore: true});
        fileInput.value = ''; // Reset input
        return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        term.writeln(`\x1b[31mError: File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of 5MB\x1b[0m`);
                    lastCommandSuccess = false;
                    writePrompt({newlineBefore: true});
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
                    // Add uploaded file to the demo filesystem at the current path
                    const ok = fs.addFile(file.name, contents, currentPath);
                    if (ok) {
                        term.writeln(`\x1b[32mFile stored in demo FS: ${file.name}\x1b[0m`);
                        lastCommandSuccess = true;
                        renderFileBrowser();
                    } else {
                        term.writeln(`\x1b[31mWarning: Failed to add file to demo FS: ${file.name}\x1b[0m`);
                        lastCommandSuccess = false;
                    }
                    writePrompt({newlineBefore: true});
        fileInput.value = ''; // Reset input for next upload
    };
    
    reader.onerror = () => {
        term.writeln('\x1b[31mError: Failed to read file\x1b[0m');
                    lastCommandSuccess = false;
                    writePrompt({newlineBefore: true});
        fileInput.value = ''; // Reset input
    };
    
    reader.readAsText(file);
});

// Focus terminal on load
term.focus();

// File browser UI elements (top pane)
const fileBrowserEl = document.getElementById('fileBrowser');
const breadcrumbEl = document.getElementById('breadcrumb');
const dividerEl = document.getElementById('divider');
const btnRefresh = document.getElementById('btnRefresh');
const btnNewFolder = document.getElementById('btnNewFolder');
const btnUploadButton = document.getElementById('btnUpload');

/**
 * Render breadcrumb for the current path and attach click handlers for each
 * segment to allow quick navigation.
 */
function renderBreadcrumb() {
    const parts = currentPath.split('/').filter(Boolean);
    let acc = '';
    breadcrumbEl.innerHTML = '';
    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = '/';
    rootLink.addEventListener('click', (e) => { e.preventDefault(); handleCommand('cd /'); });
    breadcrumbEl.appendChild(rootLink);
    parts.forEach((p, idx) => {
        const sep = document.createTextNode(' / ');
        breadcrumbEl.appendChild(sep);
        acc += '/' + p;
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = p;
        a.addEventListener('click', (e) => { e.preventDefault(); handleCommand('cd ' + acc); });
        breadcrumbEl.appendChild(a);
    });
}

/**
 * Render the contents of the current directory in the file browser pane.
 */
function renderFileBrowser() {
    renderBreadcrumb();
    const list = fs.listDir(currentPath);
    fileBrowserEl.innerHTML = '';
    if (!list) {
        const p = document.createElement('p');
        p.textContent = 'Not a directory';
        fileBrowserEl.appendChild(p);
        return;
    }
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'file-entry';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = item.name + (item.type === 'dir' ? '/' : '');
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = item.type === 'dir' ? 'Directory' : (item.size ? `${item.size} bytes` : 'File');
        div.appendChild(name);
        div.appendChild(meta);
        div.addEventListener('click', (e) => {
            // click on directory navigates, click on file shows content
            if (item.type === 'dir') {
                handleCommand('cd ' + (currentPath === '/' ? '' : currentPath.replace(/\/$/, '')) + '/' + item.name);
                writePrompt({newlineBefore: true});
            } else {
                const contents = fs.readFile(item.name, currentPath);
                if (contents !== null) {
                    term.writeln('');
                    term.writeln('\x1b[33m--- File: ' + item.name + ' ---\x1b[0m');
                    term.writeln(contents);
                    term.writeln('\x1b[33m--- End of File ---\x1b[0m');
                    lastCommandSuccess = true;
                    writePrompt({newlineBefore: true});
                } else {
                    term.writeln('\x1b[31mError: Cannot read file\x1b[0m');
                    lastCommandSuccess = false;
                    writePrompt({newlineBefore: true});
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
        else term.writeln('\x1b[31mFailed to create directory\x1b[0m');
        renderFileBrowser();
        writePrompt({newlineBefore: true});
    }
});
btnUploadButton.addEventListener('click', (e) => { e.preventDefault(); triggerFileUpload(); });

// Initialize file browser and resizer after terminal is ready
renderFileBrowser();
setupResizer();
