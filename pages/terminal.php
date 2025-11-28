<?php
$terminal_screen = <<<EOT
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal - xterm.js</title>
    
    <!-- xterm.js CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css" />
    
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #1e1e1e;
            font-family: 'Courier New', monospace;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
            background-color: #2d2d2d;
            padding: 15px 20px;
            color: #ffffff;
            border-bottom: 1px solid #3e3e3e;
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
        }
        
        #terminal {
            height: 100%;
            width: 100%;
        }
        
        .controls {
            background-color: #2d2d2d;
            padding: 10px 20px;
            border-top: 1px solid #3e3e3e;
            display: flex;
            gap: 10px;
        }
        
        button {
            background-color: #0e639c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: #1177bb;
        }
        
        button:active {
            background-color: #0d5689;
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
        ${file_get_contents('templates/terminal_config.js')}
    </script>

    
</body>
</html>
EOT;

