<?php
// Use __DIR__ to build path to the templates folder
// $scripts = file_get_contents(__DIR__ . '/../../public/js/terminal-config.js');

$terminal_screen = <<<EOT
<!DOCTYPE html>
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
            background-color: #010409;
            font-family: 'Courier New', monospace;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
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
        }
        
        #terminal {
            height: 100%;
            width: 100%;
        }
        /* xterm inherits terminal theme from JS and page styles */
        
        .controls {
                background-color: #010409;
                padding: 10px 20px;
                border-top: 1px solid #6E7681;
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
    
        <!-- Controls removed -->
    
    <!-- Hidden file input for upload command -->
    <input type="file" id="fileInput" accept=".txt" style="display: none;">
    
    <!-- xterm.js and addons -->
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
    <script src="/js/terminal-config.js"></script>

    
</body>
</html>
EOT;

