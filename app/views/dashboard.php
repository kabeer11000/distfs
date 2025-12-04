<?php
// Terminal theme is fixed in the xterm creation and page styles use the same static values.
$terminal_screen = <<<EOT
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal - xterm.js</title>
    
    <!-- xterm.js CSS -->
    <link rel="stylesheet" href="/xterm.min.css" />
    <!-- Geist fonts (if available) and fallbacks (Inter, JetBrains Mono) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet">
    <!-- Optional local Geist if you have it; keep it as a fallback if you host it locally or via CDN -->
    <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap" rel="stylesheet">
    
    <!-- Styles consolidated into local stylesheet -->
    <link rel="stylesheet" href="/css/styles.css" />

</head>
<body>
    <div class="header">
        <h1>Distfs Dashboard</h1>
        <div class="profile-section">
            <button class="profile-btn" id="profileBtn" aria-label="User profile">
                <span class="icon user-icon" data-icon="user" data-icon-color="#E6EDF3"></span>
                <span class="username" id="headerUsername">guest</span>
                <span class="icon chevron-icon" data-icon="chevronDown" data-icon-color="#9CA3AF"></span>
            </button>
            <div class="profile-dropdown" id="profileDropdown" style="display: none;">
                <div class="profile-info">
                    <strong id="dropdownUsername">guest</strong>
                    <small id="dropdownEmail"></small>
                </div>
                <div class="profile-actions">
                    <button class="profile-action-btn" id="logoutBtn">
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <div class="main-grid">
        <div class="browser-container">
            <div class="browser-header">
                <div class="path-input-wrapper">
                    <input id="pathInput" type="text" class="path-input geist-mono-regular" placeholder="/" aria-label="Current path" />
                    <button id="btnRefresh" title="Refresh" aria-label="Refresh" class="icon-btn in-input" data-icon="refresh" data-icon-color="#6B7280">
                        <span class="icon" aria-hidden="true"></span>
                    </button>
                </div>
                <div class="browser-actions">
                    <button id="btnNewFolder" title="New folder" aria-label="New folder" class="icon-btn" data-icon="plus" data-icon-color="currentColor">
                        <span class="icon" aria-hidden="true"></span>
                    </button>
                    <button id="btnUpload" title="Upload file" aria-label="Upload file" class="icon-btn" data-icon="upload" data-icon-color="currentColor">
                        <span class="icon" aria-hidden="true"></span>
                    </button>
                </div>
            </div>
            <div id="fileBrowser" class="file-browser"></div>
        </div>
        <div id="divider" class="divider" title="Drag to resize terminal"></div>
        <div class="terminal-container">
            <div class="term-header">
                <div class="controls">
                    <div class="title">Terminal</div>
                </div>
                <div class="term-actions">
                    <button id="termCollapse" title="Collapse terminal" aria-label="Collapse terminal" data-icon="close" data-icon-color="#D1D5DB">
                        <span class="icon" aria-hidden="true"></span>
                    </button>
                </div>
            </div>
            <div id="terminal"></div>
            <div class="terminal-input-area">
                <span class="geist-mono-regular">$</span>
                <input class="geist-mono-regular" type="text" id="cmdInput" placeholder="Enter command..." autofocus />
            </div>
        </div>
    </div>
    
    <!-- Controls removed: theme is fixed and no bottom buttons are shown -->
    
    <!-- Hidden file input for upload command -->
    <input type="file" id="fileInput" accept=".txt" style="display: none;">

    <!-- Editor/Viewer Modal -->
    <div id="editorModal" class="editor-modal" style="display: none;">
        <div class="editor-container">
            <div class="editor-header">
                <div class="editor-title-section">
                    <span class="editor-filename" id="editorFilename">untitled.txt</span>
                    <span class="editor-mode-badge" id="editorModeBadge">Text</span>
                    <!-- New badges for file owner and access level -->
                    <span class="editor-owner-badge badge" id="editorOwnerBadge" style="display:none">Owner</span>
                    <span class="editor-access-badge badge" id="editorAccessBadge" style="display:none">Read</span>
                </div>
                <div class="editor-actions">
                    <button id="editorSave" class="editor-action-btn save-btn" title="Save (Ctrl+S)">
                        <span>Save</span>
                    </button>
                    <button id="editorClose" class="editor-action-btn close-btn" title="Close (Esc)">
                        <span>Close</span>
                    </button>
                </div>
            </div>
            <div class="editor-body" id="editorBody">
                <!-- Text Editor -->
                <div id="textEditor" class="text-editor" contenteditable="true" spellcheck="false"></div>
                <!-- Media Preview -->
                <div id="mediaPreview" class="media-preview" style="display: none;">
                    <img id="imagePreview" style="display: none;" alt="Image preview">
                    <video id="videoPreview" style="display: none;" controls>
                        Your browser does not support the video tag.
                    </video>
                    <div id="unsupportedPreview" style="display: none;" class="unsupported-preview">
                        <p>Preview not available for this file type</p>
                        <small id="fileTypeInfo"></small>
                    </div>
                </div>
            </div>
            <div class="editor-footer">
                <span id="editorStatus" class="editor-status">Ready</span>
                <span id="editorInfo" class="editor-info"></span>
            </div>
        </div>
    </div>

    <!-- xterm.js and addons -->
    <script src="/js/xterm.min.js"></script>
    <script src="/js/xterm-addon-fit.min.js"></script>
    <script src="/js/xterm-addon-web-links.min.js"></script>
    <script src="/js/dashboard/fs.js"></script>
    <script src="/js/dashboard/icons.js"></script>
    <script src="/js/dashboard/editor.js"></script>
    <script src="/js/dashboard/config.js"></script>

    
</body>
</html>
EOT;
?>