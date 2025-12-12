<?php
/**
 * @file User.php
 * @brief User model for handling user-related database operations
 *
 * Provides convenience methods for finding users by ID, username, or email,
 * creating new users, and checking for existing usernames/emails.
 */

require_once 'Model.php';

/**
 * @class User
 * @brief Data model for user CRUD and lookup operations
 *
 * Inherits from `Model` and uses the shared PDO connection to perform
 * database queries related to user management.
 */
class User extends Model {
    protected $table = 'User';
    protected $primaryKey = 'UserID';
    
    /**
     * Find user by ID
     *
     * @param int $userID The user primary key (UserID)
     * @return array|false Associative array of user data or false if not found
     */
    public function findById($userID) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE UserID = ?");
        $stmt->execute([$userID]);
        return $stmt->fetch();
    }

    /**
     * Find user by username
     *
     * @param string $username Username to search for
     * @return array|false Associative array of user data or false if not found
     */
    public function findByUsername($username) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE Username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch();
    }
    
    /**
     * Find user by email
     *
     * @param string $email Email address to search for
     * @return array|false Associative array of user data or false if not found
     */
    public function findByEmail($email) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE Email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }
    
    /**
     * Create a new user record
     *
     * @param string $username Username for the new user
     * @param string $email Email address for the user
     * @param string $passwordHash Pre-hashed password string (SHA2/other)
     * @return int|false Inserted UserID on success, or false on failure
     */
    public function create($username, $email, $passwordHash) {
        try {
            $stmt = $this->db->prepare("INSERT INTO {$this->table} (Username, Email, PasswordHash) VALUES (?, ?, ?)");
            $result = $stmt->execute([$username, $email, $passwordHash]);
            
            if ($result) {
                return $this->db->lastInsertId();
            }
            return false;
        } catch (PDOException $e) {
            // Duplicate entry might occur
            return false;
        }
    }
    
    /**
     * Check if a username or email already exists in the database
     *
     * @param string $username Username to check
     * @param string $email Email to check
     * @return bool True if either username or email exists, false otherwise
     */
    public function exists($username, $email) {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM {$this->table} WHERE Username = ? OR Email = ?");
        $stmt->execute([$username, $email]);
        return $stmt->fetchColumn() > 0;
    }
}
?>