<?php
// router.php - Router for PHP built-in server

// Define the public directory
$publicDir = __DIR__ . '/public';

// Get the request URI and remove query string
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// If the request is for the API, handle it there
if (strpos($uri, '/api/') === 0) {
    // Set up the environment for the API script to work correctly
    $_SERVER['REQUEST_URI'] = substr($uri, 4); // Remove '/api' prefix for API processing
    // Include the API index file
    include __DIR__ . '/api/index.php';
    return; // Serve the API response
}

// If the requested file exists in the public directory, serve it
$requestedFile = $publicDir . $uri;
if (file_exists($requestedFile) && is_file($requestedFile)) {
    // Determine content type based on file extension
    $extension = pathinfo($requestedFile, PATHINFO_EXTENSION);
    $contentTypes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'font/eot'
    ];
    
    if (isset($contentTypes[$extension])) {
        header('Content-Type: ' . $contentTypes[$extension]);
    }
    
    readfile($requestedFile);
    return; // Serve the static file
}

// For all other requests, serve the main dashboard (public/index.php)
include $publicDir . '/index.php';
?>