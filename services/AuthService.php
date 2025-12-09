<?php
// services/AuthService.php
// Service class to handle user authentication

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../config/database.php';

class AuthService {
    private $userModel;
    
    public function __construct() {
        $this->userModel = new User();
    }
    
    /**
     * Register a new user
     */
    public function register($username, $email, $password) {
        // Check if username or email already exists
        if ($this->userModel->exists($username, $email)) {
            return ['success' => false, 'error' => 'Username or email already exists'];
        }
        
        // Validate input
        if (empty($username) || empty($email) || empty($password)) {
            return ['success' => false, 'error' => 'All fields are required'];
        }
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'Invalid email format'];
        }
        
        // Hash the password
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        
        // Create the user
        $userID = $this->userModel->create($username, $email, $passwordHash);

        if ($userID) {
            // Create a root directory for the new user
            $itemModel = new Item();
            $rootDirId = $itemModel->create($userID, null, 'Folder', 'root'); // ParentItemID is null for root

            if (!$rootDirId) {
                return ['success' => false, 'error' => 'Registration failed: Could not create user directory'];
            }

            return [
                'success' => true,
                'data' => [
                    'userID' => $userID,
                    'username' => $username,
                    'email' => $email
                ]
            ];
        }

        return ['success' => false, 'error' => 'Registration failed'];
    }
    
    /**
     * Authenticate a user
     */
    public function login($username, $password) {
        // Find user by username
        $user = $this->userModel->findByUsername($username);
        
        if (!$user) {
            return ['success' => false, 'error' => 'Invalid credentials'];
        }
        
        // Verify password
        if (password_verify($password, $user['PasswordHash'])) {
            // Create session data
            if (session_status() == PHP_SESSION_NONE) {
                session_start();
            }

            $_SESSION['user_id'] = $user['UserID'];
            $_SESSION['username'] = $user['Username'];
            $_SESSION['logged_in'] = true;

            // Get or create the user's root directory
            $itemModel = new Item();
            $userRoot = $this->getUserRootDirectory($user['UserID'], $itemModel);

            if (!$userRoot) {
                // Create a root directory if it doesn't exist
                $rootId = $itemModel->create($user['UserID'], null, 'Folder', 'Home');
                if (!$rootId) {
                    return ['success' => false, 'error' => 'Could not create user root directory'];
                }
                $userRoot = ['ItemID' => $rootId, 'Name' => 'Home'];
            }

            return [
                'success' => true,
                'data' => [
                    'userID' => $user['UserID'],
                    'username' => $user['Username'],
                    'rootDirectoryID' => $userRoot['ItemID']
                ]
            ];
        }
        
        return ['success' => false, 'error' => 'Invalid credentials'];
    }
    
    /**
     * Logout the current user
     */
    public function logout() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        // Unset all session variables
        $_SESSION = array();
        
        // Delete the session cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        // Destroy the session
        session_destroy();
        
        return ['success' => true, 'data' => ['message' => 'Logged out successfully']];
    }
    
    /**
     * Get current user info
     */
    public function getCurrentUser() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
            return [
                'success' => true,
                'data' => [
                    'userID' => $_SESSION['user_id'],
                    'username' => $_SESSION['username']
                ]
            ];
        }
        
        return ['success' => false, 'error' => 'Not logged in'];
    }
    
    /**
     * Check if user is logged in
     */
    public function isLoggedIn() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
    }
    
    /**
     * Get user ID of logged in user
     */
    public function getCurrentUserId() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }
        
        if (isset($_SESSION['user_id'])) {
            return $_SESSION['user_id'];
        }
        
        return null;
    }

    /**
     * Get the user's root/home directory
     * @param int $userID
     * @param Item $itemModel
     * @return array|null
     */
    private function getUserRootDirectory($userID, $itemModel) {
        $sql = "SELECT ItemID, Name FROM Item
                WHERE OwnerID = ? AND ParentItemID IS NULL
                ORDER BY CreatedAt LIMIT 1";
        $stmt = $itemModel->query($sql, [$userID]);
        $result = $stmt->fetch();

        return $result ?: null;
    }
}
?>