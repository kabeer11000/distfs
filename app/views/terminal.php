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
        
        .main-grid {
            display: grid;
            grid-template-rows: 1fr 8px 300px; /* browser | divider | terminal */
            grid-template-columns: 1fr;
            height: calc(100vh - 72px); /* account for header */
        }

        .browser-container {
            padding: 12px 20px;
            overflow: auto;
            /* Warm white background */
            background-color: #FAFAFA;
            color: #484B6A;
            border-bottom: 1px solid #D2D3DB;
        }

        .browser-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            background-color: #E4E5F1; /* slight header tint */
            padding: 8px 10px;
            border-radius: 6px;
        }

        .breadcrumb {
            color: #484B6A; /* primary text color */
            font-size: 13px;
            font-weight: 600;
        }
        .breadcrumb a { color: #484B6A; text-decoration: none; cursor: pointer; }
        .breadcrumb a:hover { text-decoration: underline; color: #484B6A; }

        .browser-actions button {
            margin-left: 8px;
            background: #484B6A !important; /* header/menu button color */
            color: #FAFAFA !important; /* white text */
            border: 1px solid #9394A5 !important;
            padding: 8px 12px;
            font-size: 13px;
            border-radius: 6px;
        }
        .browser-actions button:hover { background: #9394A5 !important; }

        .file-browser {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 8px;
            padding-top: 8px;
        }

        .file-entry {
            background: #E4E5F1; /* lighten file card */
            border: 1px solid #D2D3DB;
            padding: 10px;
            border-radius: 6px;
            color: #484B6A; /* primary text color */
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform 0.08s ease, background-color 0.08s ease;
        }
        .file-entry:hover {
            background-color: #D2D3DB;
            transform: translateY(-2px);
        }

        .file-entry .name { font-size: 14px; color: #484B6A; }
        .file-entry .meta { color: #9394A5; font-size: 12px; }

        .divider {
            height: 8px;
            /* Lighter grey gradient for subtle separation between browser and terminal */
            background: linear-gradient(180deg, #E4E5F1 0%, #D2D3DB 100%);
            cursor: row-resize;
            border-top: 1px solid rgba(0,0,0,0.04);
            border-bottom: 1px solid rgba(0,0,0,0.04);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .terminal-container {
            padding: 12px 16px;
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
    
    <div class="main-grid">
        <div class="browser-container">
            <div class="browser-header">
                <div id="breadcrumb" class="breadcrumb"></div>
                <div class="browser-actions">
                    <button id="btnRefresh">Refresh</button>
                    <button id="btnNewFolder">New Folder</button>
                    <button id="btnUpload">Upload</button>
                </div>
            </div>
            <div id="fileBrowser" class="file-browser"></div>
        </div>
        <div id="divider" class="divider" title="Drag to resize terminal"></div>
        <div class="terminal-container">
            <div id="terminal"></div>
        </div>
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