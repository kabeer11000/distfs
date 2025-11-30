# setup_project.ps1
# Run this script to generate the PHP MVC structure.

$projectRoot = Get-Location

Write-Host "Setting up PHP MVC Project in: $projectRoot" -ForegroundColor Cyan

# 1. Define the directory structure
$directories = @(
    "config",
    "public",
    "public\css",
    "public\js",
    "src",
    "src\Controllers",
    "src\Models",
    "src\Services",
    "templates",
    "templates\layouts",
    "vendor"
)

# 2. Create Directories
foreach ($dir in $directories) {
    $path = Join-Path $projectRoot $dir
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "Directory already exists: $dir" -ForegroundColor Yellow
    }
}

# 3. Define File Contents

# --- config/db.php ---
$dbContent = @"
<?php
// config/db.php
// Database connection settings
define('DB_HOST', 'localhost');
define('DB_NAME', 'file_storage');
define('DB_USER', 'root');
define('DB_PASS', '');

try {
    \$pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME, DB_USER, DB_PASS);
    \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException \$e) {
    die("DB Connection failed: " . \$e->getMessage());
}
"@

# --- src/helpers.php (The View Function) ---
$helpersContent = @"
<?php
// src/helpers.php

function view(\$template, \$data = []) {
    // Extract array keys as variable names
    // ['username' => 'John'] becomes \$username = 'John';
    extract(\$data);

    // Buffer the output so we can capture it
    ob_start();
    
    // Include the template file (it now has access to the variables)
    // We use realpath to ensure we are finding the templates folder correctly relative to this file
    \$templatePath = __DIR__ . '/../templates/' . \$template . '.php';
    
    if (file_exists(\$templatePath)) {
        require \$templatePath;
    } else {
        echo "Error: Template '\$template' not found at \$templatePath";
    }

    // Return the HTML cleanly
    return ob_get_clean();
}
"@

# --- src/Services/Auth.php (Stub for the Router) ---
$authServiceContent = @"
<?php
// src/Services/Auth.php

class Auth {
    public static function isLoggedIn() {
        // Start session if not started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        return isset(\$_SESSION['user_id']);
    }

    public static function login(\$userId) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        \$_SESSION['user_id'] = \$userId;
    }

    public static function logout() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        session_destroy();
    }
}
"@

# --- src/Controllers/AuthController.php ---
$authControllerContent = @"
<?php
// src/Controllers/AuthController.php

class AuthController {
    public function login() {
        echo view('login', ['message' => 'Please enter your credentials']);
    }
}
"@

# --- src/Controllers/DashboardController.php ---
$dashboardControllerContent = @"
<?php
// src/Controllers/DashboardController.php

// Mock Model for demonstration
class FileModel {
    public static function getAllFilesForUser(\$userId) {
        return [
            ['name' => 'Report.pdf', 'size' => '2MB'],
            ['name' => 'Photo.jpg', 'size' => '5MB'],
            ['name' => 'Backup.zip', 'size' => '1GB']
        ];
    }
}

class DashboardController {
    public function index() {
        // 1. Get Data (normally from DB, here mocked)
        // \$files = FileModel::getAllFilesForUser(\$_SESSION['user_id']);
        \$files = FileModel::getAllFilesForUser(1); // Hardcoded for demo
        \$storageUsed = '1024 MB';

        // 2. Render Template with Data
        echo view('dashboard', [
            'pageTitle' => 'My Files',
            'files' => \$files,
            'usage' => \$storageUsed
        ]);
    }
}
"@

# --- templates/layouts/header.php ---
$headerContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Storage App</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <nav style="background: #333; color: #fff; padding: 1rem;">
        <a href="index.php?page=dashboard" style="color: #fff; margin-right: 15px;">Dashboard</a>
        <a href="index.php?page=login" style="color: #fff;">Login</a>
    </nav>
    <div class="container" style="padding: 20px;">
"@

# --- templates/layouts/footer.php ---
$footerContent = @"
    </div> <!-- End Container -->
    <footer style="margin-top: 50px; text-align: center; color: #777;">
        <p>&copy; 2024 File Storage System</p>
    </footer>
</body>
</html>
"@

# --- templates/dashboard.php ---
$dashboardViewContent = @"
<?php include 'layouts/header.php'; ?>

<h1><?= htmlspecialchars(\$pageTitle) ?></h1>

<p>Storage Used: <strong><?= \$usage ?></strong></p>

<div class="file-list" style="margin-top: 20px;">
    <?php foreach (\$files as \$file): ?>
        <div class="file-card" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 5px; border-radius: 4px;">
            📄 <strong><?= htmlspecialchars(\$file['name']) ?></strong> 
            <span style="color: #888; font-size: 0.9em;">(<?= \$file['size'] ?>)</span>
        </div>
    <?php endforeach; ?>
</div>

<?php include 'layouts/footer.php'; ?>
"@

# --- templates/login.php ---
$loginViewContent = @"
<?php include 'layouts/header.php'; ?>

<h1>Login</h1>
<p><?= isset(\$message) ? \$message : '' ?></p>

<form method="POST" action="index.php?page=login">
    <div style="margin-bottom: 10px;">
        <label>Email:</label><br>
        <input type="email" name="email" required>
    </div>
    <div style="margin-bottom: 10px;">
        <label>Password:</label><br>
        <input type="password" name="password" required>
    </div>
    <button type="submit">Log In</button>
</form>

<?php include 'layouts/footer.php'; ?>
"@

# --- public/index.php (The Entry Point) ---
$indexContent = @"
<?php
// public/index.php

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../src/helpers.php';
require_once __DIR__ . '/../src/Services/Auth.php';

// Get the requested page (e.g., example.com/index.php?page=dashboard)
\$page = \$_GET['page'] ?? 'dashboard'; // Default to dashboard for demo ease

// Basic Routing
switch (\$page) {
    case 'login':
        require __DIR__ . '/../src/Controllers/AuthController.php';
        \$controller = new AuthController();
        \$controller->login(); 
        break;

    case 'dashboard':
        // centralized Auth Check
        // For demo purposes, we will comment out the strict redirect so you can see the page
        // if (!Auth::isLoggedIn()) {
        //     header('Location: index.php?page=login');
        //     exit;
        // }
        
        require __DIR__ . '/../src/Controllers/DashboardController.php';
        \$controller = new DashboardController();
        \$controller->index();
        break;

    default:
        echo "404 Not Found";
        break;
}
"@

# --- public/css/style.css ---
$cssContent = @"
body { font-family: sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
.container { max-width: 800px; margin: 0 auto; background: white; min-height: 80vh; }
"@


# 4. Map files to their paths
$files = @{
    "config\db.php"                   = $dbContent
    "src\helpers.php"                 = $helpersContent
    "src\Services\Auth.php"           = $authServiceContent
    "src\Controllers\AuthController.php" = $authControllerContent
    "src\Controllers\DashboardController.php" = $dashboardControllerContent
    "templates\layouts\header.php"    = $headerContent
    "templates\layouts\footer.php"    = $footerContent
    "templates\dashboard.php"         = $dashboardViewContent
    "templates\login.php"             = $loginViewContent
    "public\index.php"                = $indexContent
    "public\css\style.css"            = $cssContent
}

# 5. Write Files
foreach ($file in $files.Keys) {
    $filePath = Join-Path $projectRoot $file
    Set-Content -Path $filePath -Value $files[$file] -Encoding UTF8
    Write-Host "Created file: $file" -ForegroundColor Green
}

Write-Host "`nProject setup complete! To test:" -ForegroundColor Cyan
Write-Host "1. Open your terminal in '$projectRoot\public'" -ForegroundColor Yellow
Write-Host "2. Run: php -S localhost:8000" -ForegroundColor Yellow
Write-Host "3. Visit: http://localhost:8000" -ForegroundColor Yellow