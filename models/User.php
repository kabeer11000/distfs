<?php
// models/User.php
// User model for handling user-related database operations

require_once 'Model.php';

class User extends Model {
    protected $table = 'User';
    protected $primaryKey = 'UserID';
    
    /**
     * Find user by username
     */
    public function findByUsername($username) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE Username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch();
    }
    
    /**
     * Find user by email
     */
    public function findByEmail($email) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE Email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }
    
    /**
     * Create a new user
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
     * Check if username or email already exists
     */
    public function exists($username, $email) {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM {$this->table} WHERE Username = ? OR Email = ?");
        $stmt->execute([$username, $email]);
        return $stmt->fetchColumn() > 0;
    }
}
?>