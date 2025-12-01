<?php
// Moved terminal view from pages/terminal.php
// Include terminal client scripts from the public/js folder

// Terminal theme is fixed in the xterm creation and page styles use the same static values.
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
    <link rel="stylesheet" href="/css/terminal-theme.css" />
    
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #010409; /* static theme */
            color: #E6EDF3; /* static theme */
            /* Prefer InconsolataGo Nerd Font Mono for terminal, fall back to Consolas / system monospace */
            font-family: '"InconsolataGo Nerd Font Mono", Consolas, "Courier New", monospace';
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
            /* Use the terminal background for full-page consistency */
            background-color: #010409;
            padding: 15px 20px;
            color: #E6EDF3;
            border-bottom: 1px solid #6E7681;
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
            background-color: #010409;
        }
        
        #terminal {
            height: 100%;
            width: 100%;
            background-color: #010409;
        }
        /* xterm inherits terminal theme from JS and page styles */
        
        /* Controls removed - no bottom buttons are shown */
        
        button {
            background-color: #58A6FF;
            color: #E6EDF3;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: #79C0FF;
        }
        
        button:active {
            background-color: #6E7681;
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
    
    <!-- Controls removed: theme is fixed and no bottom buttons are shown -->
    
    <!-- Hidden file input for upload command -->
    <input type="file" id="fileInput" accept=".txt" style="display: none;">
    
    <!-- xterm.js and addons -->
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
    <script src="/js/terminal/fs.js"></script>
    <script src="/js/terminal/config.js"></script>

    
</body>
</html>
EOT;

?>