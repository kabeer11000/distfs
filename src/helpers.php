<?php

function view($template, $data = []) {
    // Extract array keys as variable names
    // ['username' => 'John'] becomes $username = 'John';
    extract($data);

    // Buffer the output so we can capture it
    ob_start();
    
    // Include the template file (it now has access to the variables)
    require __DIR__ . '/../templates/' . $template . '.php';

    // Return the HTML cleanly
    return ob_get_clean();
}
