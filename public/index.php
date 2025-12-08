<?php
// Public entry - include terminal view from app/views
// Using __DIR__ ensures the include is resolved correctly regardless of current working directory.
include __DIR__ . '/../app/views/terminal.php';
if (isset($terminal_screen)) {
    echo $terminal_screen;
} else {
    echo "<h1>Terminal not found</h1>";
}
?>