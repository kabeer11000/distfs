

// Initialize terminal
const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Courier New, monospace',
    theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
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

// Welcome message
term.writeln('Welcome to xterm.js Terminal Emulator!');
term.writeln('');
term.writeln('This is a browser-based terminal using xterm.js');
term.writeln('Type commands and see them echoed back.');
term.writeln('');
term.write('$ ');

// Command buffer
let currentLine = '';
let commandHistory = [];
let historyIndex = -1;

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
        term.write('$ ');
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
            // Clear current line
            term.write('\r\x1b[K$ ');
            historyIndex--;
            currentLine = commandHistory[historyIndex];
            term.write(currentLine);
        }
    }
    // Down arrow (history)
    else if (data === '\x1b[B') {
        if (historyIndex < commandHistory.length - 1) {
            term.write('\r\x1b[K$ ');
            historyIndex++;
            currentLine = commandHistory[historyIndex];
            term.write(currentLine);
        } else {
            term.write('\r\x1b[K$ ');
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
    
    switch(command) {
        case 'help':
            term.writeln('Available commands:');
            term.writeln('  help     - Show this help message');
            term.writeln('  clear    - Clear the terminal');
            term.writeln('  echo     - Echo text back');
            term.writeln('  date     - Show current date and time');
            term.writeln('  history  - Show command history');
            term.writeln('  upload   - Upload a .txt file (max 5MB)');
            term.writeln('  about    - About this terminal');
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
            
        default:
            if (cmd.trim()) {
                term.writeln(`Command not found: ${command}`);
                term.writeln('Type "help" for available commands');
            }
    }
}

// Resize handler
window.addEventListener('resize', () => {
    fitAddon.fit();
});

// Control functions
function clearTerminal() {
    term.clear();
    term.write('$ ');
}

let currentFontSize = 14;
function changeFontSize(delta) {
    currentFontSize = Math.max(8, Math.min(24, currentFontSize + delta));
    term.options.fontSize = currentFontSize;
    fitAddon.fit();
}

let isDarkTheme = true;
function changeTheme() {
    if (isDarkTheme) {
        // Light theme
        term.options.theme = {
            background: '#ffffff',
            foreground: '#000000',
            cursor: '#000000',
            selection: 'rgba(0, 0, 0, 0.3)'
        };
        document.body.style.backgroundColor = '#f0f0f0';
    } else {
        // Dark theme
        term.options.theme = {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: 'rgba(255, 255, 255, 0.3)'
        };
        document.body.style.backgroundColor = '#1e1e1e';
    }
    isDarkTheme = !isDarkTheme;
}

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
        term.write('$ ');
        return;
    }
    
    // Validate file type
    if (!file.name.endsWith('.txt')) {
        term.writeln('\x1b[31mError: Only .txt files are allowed\x1b[0m');
        term.write('$ ');
        fileInput.value = ''; // Reset input
        return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        term.writeln(`\x1b[31mError: File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of 5MB\x1b[0m`);
        term.write('$ ');
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
        term.write('$ ');
        fileInput.value = ''; // Reset input for next upload
    };
    
    reader.onerror = () => {
        term.writeln('\x1b[31mError: Failed to read file\x1b[0m');
        term.write('$ ');
        fileInput.value = ''; // Reset input
    };
    
    reader.readAsText(file);
});

// Focus terminal on load
term.focus();
