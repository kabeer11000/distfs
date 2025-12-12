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
     * Register a new user using stored procedure
     */
    public function register($username, $email, $password) {
        // Validate input
        if (empty($username) || empty($email) || empty($password)) {
            return ['success' => false, 'error' => 'All fields are required'];
        }

        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'Invalid email format'];
        }

        try {
            // Get database connection from the model
            $db = $this->userModel->getDb();

            // Call RegisterUser stored procedure
            $stmt = $db->prepare("CALL RegisterUser(?, ?, ?, @userID, @error)");
            $stmt->execute([$username, $email, $password]);

            // Get output parameters
            $result = $db->query("SELECT @userID AS userID, @error AS error")->fetch();

            if ($result['userID']) {
                return [
                    'success' => true,
                    'data' => [
                        'userID' => $result['userID'],
                        'username' => $username,
                        'email' => $email
                    ]
                ];
            } else {
                return [
                    'success' => false,
                    'error' => $result['error'] ?? 'Registration failed'
                ];
            }
        } catch (Exception $e) {
            return ['success' => false, 'error' => 'Registration failed: ' . $e->getMessage()];
        }
    }
    
    /**
     * Authenticate a user using stored procedure
     */
    public function login($username, $password) {
        try {
            // Get database connection from the model
            $db = $this->userModel->getDb();

            // Call VerifyLogin stored procedure
            $stmt = $db->prepare("CALL VerifyLogin(?, ?, @userID, @email, @success)");
            $stmt->execute([$username, $password]);

            // Get output parameters
            $result = $db->query("SELECT @userID AS userID, @email AS email, @success AS success")->fetch();

            if ($result['success']) {
                // Create session data
                if (session_status() == PHP_SESSION_NONE) {
                    session_start();
                }

                $_SESSION['user_id'] = $result['userID'];
                $_SESSION['username'] = $username;
                $_SESSION['logged_in'] = true;

                // Get or create the user's root directory
                $itemModel = new Item();
                $userRoot = $this->getUserRootDirectory($result['userID'], $itemModel);

                if (!$userRoot) {
                    // Create a root directory if it doesn't exist
                    $rootId = $itemModel->create($result['userID'], null, 'Folder', 'Home');
                    if (!$rootId) {
                        return ['success' => false, 'error' => 'Could not create user root directory'];
                    }
                    $userRoot = ['ItemID' => $rootId, 'Name' => 'Home'];
                }

                return [
                    'success' => true,
                    'data' => [
                        'userID' => $result['userID'],
                        'username' => $username,
                        'rootDirectoryID' => $userRoot['ItemID']
                    ]
                ];
            }

            return ['success' => false, 'error' => 'Invalid credentials'];
        } catch (Exception $e) {
            return ['success' => false, 'error' => 'Login failed: ' . $e->getMessage()];
        }
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
     * Get current user info (basic)
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
     * Get comprehensive user info including storage usage
     */
    public function getUserInfo() {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }

        if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
            return ['success' => false, 'error' => 'Not logged in'];
        }

        $userID = $_SESSION['user_id'];

        // Get user details
        $user = $this->userModel->findById($userID);
        if (!$user) {
            return ['success' => false, 'error' => 'User not found'];
        }

        // Get root directory
        $itemModel = new Item();
        $userRoot = $this->getUserRootDirectory($userID, $itemModel);

        // Get storage usage
        $fileModel = new File();
        $usage = $fileModel->getUserStorageUsage($userID);

        // Count folders
        $folderCount = $itemModel->query(
            "SELECT COUNT(*) as count FROM Item WHERE OwnerID = ? AND ItemType = 'Folder'",
            [$userID]
        )->fetch()['count'] ?? 0;

        return [
            'success' => true,
            'data' => [
                'userID' => $user['UserID'],
                'username' => $user['Username'],
                'email' => $user['Email'],
                'createdAt' => $user['CreatedAt'],
                'rootDirectoryID' => $userRoot ? $userRoot['ItemID'] : null,
                'storage' => [
                    'bytesUsed' => intval($usage['bytes'] ?? 0),
                    'fileCount' => intval($usage['count'] ?? 0),
                    'folderCount' => intval($folderCount),
                    'chunkCount' => intval($usage['chunks'] ?? 0)
                ]
            ]
        ];
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