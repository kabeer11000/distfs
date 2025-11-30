<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../src/helpers.php';
require_once __DIR__ . '/../src/Services/Auth.php';

// Get the requested page (e.g., [example.com/index.php?page=dashboard](https://example.com/index.php?page=dashboard))
$page = $_GET['page'] ?? 'home';

// Basic Routing
switch ($page) {
    case 'login':
        require __DIR__ . '/../src/Controllers/AuthController.php';
        $controller = new AuthController();
        $controller->login(); 
        break;

    case 'dashboard':
        // // centralized Auth Check
        // if (!Auth::isLoggedIn()) {
        //     header('Location: index.php?page=login');
        //     exit;
        // }
        
        require __DIR__ . '/../src/Controllers/DashboardController.php';
        $controller = new DashboardController();
        $controller->index();
        break;

    default:
        echo "404 Not Found";
        break;
}
