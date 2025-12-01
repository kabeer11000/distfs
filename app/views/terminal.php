<?php
// Moved terminal view from pages/terminal.php
// Use __DIR__ to build path to the templates folder
$scripts = file_get_contents(__DIR__ . '/../../templates/terminal_config.js');

// Theme is now provided via CSS variables in public/css/terminal-theme.css.
// The terminal JS will read CSS variables at runtime and build the XTERM theme object.
$terminal_screen = <<<EOT
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal - xterm.js</title>
    
    <!-- xterm.js CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css" />
    <!-- Theme variables (local) -->
    <!-- Use relative path so CSS loads correctly when the web root is `public/` or when the server isn't started with `-t public`. -->
    <link rel="stylesheet" href="css/terminal-theme.css" />
    <!-- Fallback: allow both absolute and relative link for easy dev setups (won't duplicate if one succeeds) -->
    <link rel="stylesheet" href="/css/terminal-theme.css" />
    
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--term-background);
            color: var(--term-foreground);
            /* Prefer InconsolataGo Nerd Font Mono for terminal, fall back to Consolas / system monospace */
            font-family: '"InconsolataGo Nerd Font Mono", Consolas, "Courier New", monospace';
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
            /* Use the terminal background for full-page consistency */
            background-color: var(--term-background);
            padding: 15px 20px;
            color: var(--term-foreground);
            border-bottom: 1px solid var(--term-brightBlack);
        }
        
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: normal;
        }
        
        .terminal-container {
            flex: 1;
            padding: 20px;
            overflow: hidden;
            background-color: var(--term-background);
        }
        
        #terminal {
            height: 100%;
            width: 100%;
            background-color: var(--term-background);
        }
        
        .controls {
            /* Use the terminal background so the controls blend with the page */
            background-color: var(--term-background);
            padding: 10px 20px;
            border-top: 1px solid var(--term-brightBlack);
            display: flex;
            gap: 10px;
        }
        
        button {
            background-color: var(--term-blue);
            color: var(--term-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: var(--term-brightBlue);
        }
        
        button:active {
            background-color: var(--term-brightBlack);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Distributed Filesystem</h1>
    </div>
    
    <div class="terminal-container">
        <div id="terminal"></div>
    </div>
    
    <div class="controls">
        <button onclick="clearTerminal()">Clear</button>
        <button onclick="changeFontSize(1)">Font +</button>
        <button onclick="changeFontSize(-1)">Font -</button>
        <button onclick="changeTheme()">Toggle Theme</button>
    </div>
    
    <!-- Hidden file input for upload command -->
    <input type="file" id="fileInput" accept=".txt" style="display: none;">
    
    <!-- xterm.js and addons -->
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
    <script>
        $scripts
        // Debug: log computed CSS var to ensure the theme stylesheet was loaded
        try { window.addEventListener('load', () => console.log('CSS term background:', getComputedStyle(document.documentElement).getPropertyValue('--term-background'))); } catch (e) {}
    </script>

    
</body>
</html>
EOT;

?>