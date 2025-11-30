<?php include 'layouts/header.php'; ?>

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
<script src="/js/terminal/config.js"></script>

<?php include 'layouts/footer.php'; ?>