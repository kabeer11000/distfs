// Build xterm theme from CSS variables
// NOTE: Theme is set statically inside the xterm Terminal creation below.

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
let username = 'root';
let currentPath = '/';
// Track last command success for prompt color (green on success, red on failure)
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
// Simple in-memory filesystem for demo commands
const fileSystem = { type: 'dir', name: '/', children: {
    'example.txt': { type: 'file', content: 'This is an example file', size: 1024 },
    'document.txt': { type: 'file', content: 'Document contents', size: 2048 },
}};

function resolvePath(p) {
    if (!p) return currentPath;
    let path;
    if (p.startsWith('/')) {
        path = p;
    } else {
        path = currentPath.replace(/\/$/, '') + '/' + p;
    }
    const parts = path.split('/').filter(Boolean);
    const out = [];
    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') out.pop();
        else out.push(part);
    }
    return '/' + out.join('/');
}

function getNode(path) {
    if (path === '/') return { node: fileSystem, parent: null, name: '/' };
    const parts = path.split('/').filter(Boolean);
    let node = fileSystem;
    let parent = null;
    let name = '/';
    for (const p of parts) {
        if (!node || node.type !== 'dir' || !node.children) return null;
        parent = node;
        node = node.children[p];
        name = p;
    }
    if (!node) return null;
    return { node, parent, name };
}

function listDir(path) {
    const r = getNode(path);
    if (!r) return null;
    if (r.node.type !== 'dir') return null;
    return Object.entries(r.node.children || {}).map(([k,v]) => ({ name: k, type: v.type, size: v.size || 0 }));
}

function mkdirCmd(path) {
    const resolved = resolvePath(path);
    const parentPath = resolved.replace(/\/[^^/]+$/, '') || '/';
    const name = resolved.split('/').filter(Boolean).pop();
    const parent = getNode(parentPath);
    if (!parent || parent.node.type !== 'dir') return false;
    if (parent.node.children[name]) return false;
    parent.node.children[name] = { type: 'dir', name, children: {} };
    return true;
}

function addFile(path, content = '') {
    const resolved = resolvePath(path);
    const parentPath = resolved.replace(/\/[^^/]+$/, '') || '/';
    const name = resolved.split('/').filter(Boolean).pop();
    const parent = getNode(parentPath);
    if (!parent || parent.node.type !== 'dir') return false;
    parent.node.children[name] = { type: 'file', content: content, size: (content || '').length };
    return true;
}

function rmNode(path) {
    const resolved = resolvePath(path);
    const parts = resolved.split('/').filter(Boolean);
    const name = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parent = getNode(parentPath);
    if (!parent || parent.node.type !== 'dir') return false;
    if (!parent.node.children[name]) return false;
    delete parent.node.children[name];
    return true;
}

// Handle terminal input
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

// Handle commands
function handleCommand(cmd) {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();
    let success = true;
    
    switch(command) {
        case 'help':
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
            break;
            
        case 'clear':
            term.clear();
            break;
            
        case 'echo':
            term.writeln(parts.slice(1).join(' '));
            break;
            
        case 'date':
            term.writeln(new Date().toString());
            break;
            
        case 'history':
            commandHistory.forEach((cmd, i) => {
                term.writeln(` ${i + 1}  ${cmd}`);
            });
            break;
            
        case 'about':
            term.writeln('xterm.js Terminal Emulator');
            term.writeln('Version: 5.3.0');
            term.writeln('A full xterm terminal in your browser');
            break;
            
        case 'upload':
            triggerFileUpload();
            break;

        case 'add':
            if (parts.length > 1) {
                const filename = parts.slice(1).join(' ');
                const ok = addFile(filename, '');
                if (ok) term.writeln('Created file ' + filename);
                else term.writeln('Failed to create file ' + filename);
                success = !!ok;
            } else {
                triggerFileUpload();
                success = true; // upload initiated
            }
            break;

        case 'share':
            if (parts.length < 4) {
                term.writeln('Usage: share <filename> <user> <permissions>');
            } else {
                const filename = parts[1];
                const user = parts[2];
                const perms = parts[3];
                const target = resolvePath(filename);
                const f = getNode(target);
                if (!f || f.node.type !== 'file') {
                    term.writeln('share: file not found: ' + filename);
                    success = false;
                } else {
                    term.writeln('Sharing ' + filename + ' with ' + user + ' (' + perms + ') - simulated');
                    success = true;
                }
            }
            break;

        case 'delete':
            if (parts.length < 2) {
                term.writeln('Usage: delete <filename>');
                success = false;
            } else {
                const filename = parts[1];
                const ok = rmNode(filename);
                if (ok) term.writeln('Deleted ' + filename);
                else term.writeln('Delete failed: ' + filename + ' not found');
                success = !!ok;
            }
            break;

        case 'mkdir':
            if (parts.length < 2) {
                term.writeln('Usage: mkdir <dirname>');
                success = false;
            } else {
                const dirname = parts[1];
                const ok = mkdirCmd(dirname);
                if (ok) term.writeln('Directory created: ' + dirname);
                else term.writeln('Failed to create directory: ' + dirname);
                success = !!ok;
            }
            break;

        case 'ls':
            const listPath = parts.length > 1 ? resolvePath(parts[1]) : currentPath;
            const listings = listDir(listPath);
            if (!listings) { term.writeln('Cannot list: not a directory'); success = false; }
            else {
                listings.forEach(it => {
                    if (it.type === 'dir') {
                        // directories in cyan
                        term.write('\x1b[36m' + it.name + '\x1b[0m');
                    } else {
                        // regular files in green
                        term.write('\x1b[32m' + it.name + '\x1b[0m');
                    }
                    term.write('  '); // spacing
                });
            }
            term.writeln(''); // final newline
            break;

        case 'cd':
            if (parts.length < 2) {
                currentPath = '/';
                success = true;
            } else {
                const target = resolvePath(parts[1]);
                const tnode = getNode(target);
                if (!tnode || tnode.node.type !== 'dir') {
                    term.writeln('cd: not a directory: ' + parts[1]);
                    success = false;
                } else {
                    currentPath = target;
                    success = true;
                }
            }
            break;

        case 'tree':
            const treePath = parts.length > 1 ? resolvePath(parts[1]) : currentPath;
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
            const root = getNode(treePath);
            if (!root || root.node.type !== 'dir') { term.writeln('Not a directory'); success = false; }
            else {
                term.writeln(treePath);
                printTree(root.node);
            }
            break;
            
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
function clearTerminal() {
    term.clear();
    writePrompt({newlineBefore: true});
}

// Prompt helper - prints the username/path line and the prompt symbol on the next line
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
function changeFontSize(delta) {
    currentFontSize = Math.max(8, Math.min(24, currentFontSize + delta));
    term.options.fontSize = currentFontSize;
    fitAddon.fit();
}

// Theme is fixed; no light/dark toggle
// Theme is fixed and set statically in the Terminal constructor; no theme toggle needed.

// File upload functionality
const fileInput = document.getElementById('fileInput');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

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
                    lastCommandSuccess = true;
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
