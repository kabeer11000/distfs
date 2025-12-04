<?php
/**
 * @file SharedItem.php
 * @brief SharedItem model for handling file sharing operations
 *
 * Provides methods to share items between users, list items shared with or
 * by a user, remove sharing, and check access permissions. This model
 * centralizes sharing-related database operations used by the FileService
 * and other parts of the application.
 */

require_once 'Model.php';

/**
 * @class SharedItem
 * @brief Data model for sharing items between users
 *
 * Inherits from `Model` and implements operations for creating and
 * querying sharing relationships stored in the `SharedItem` table.
 */
class SharedItem extends Model {
    protected $table = 'SharedItem';
    
    /**
     * Share an item with a user
     *
     * @param int $itemID Item (file or folder) ID to share
     * @param int $ownerID Owner (sharer) user ID
     * @param int $receiverID Recipient user ID
     * @param string $accessLevel Access level ('Read', 'Write', 'Admin')
     * @return bool True on success, false on failure (e.g., duplicate share)
     */
    public function shareItem($itemID, $ownerID, $receiverID, $accessLevel) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO {$this->table} (ItemID, OwnerID, RecieverID, AccessLevel) 
                VALUES (?, ?, ?, ?)
            ");
            return $stmt->execute([$itemID, $ownerID, $receiverID, $accessLevel]);
        } catch (PDOException $e) {
            // Might be a duplicate key error
            return false;
        }
    }
    
    /**
     * Get items shared with a specific user
     *
     * @param int $userID User ID for whom to list shared items
     * @return array[] Array of shared item rows with owner and access info
     */
    public function getSharedWithUser($userID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT si.ItemID, i.Name, i.ItemType, u.Username as OwnerName, 
                si.AccessLevel, si.CreatedAt
            FROM {$this->table} si
            JOIN Item i ON si.ItemID = i.ItemID
            JOIN User u ON si.OwnerID = u.UserID
            WHERE si.RecieverID = ?
        SQL
        );

        $stmt->execute([$userID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get items owned by a user that are shared with others
     *
     * @param int $userID Owner user ID
     * @return array[] Array of shared item records showing recipients and access
     */
    public function getSharedByUser($userID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT si.ItemID, i.Name, i.ItemType, u.Username as RecipientName, 
                si.AccessLevel, si.CreatedAt
            FROM {$this->table} si
            JOIN Item i ON si.ItemID = i.ItemID
            JOIN User u ON si.RecieverID = u.UserID
            WHERE si.OwnerID = ?
        SQL
        );
        
        $stmt->execute([$userID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Check if an item is shared with a user and get access level
     *
     * @param int $itemID Item ID
     * @param int $userID Potential recipient user ID
     * @return array|false Associative array containing 'AccessLevel' or false if not shared
     */
    public function getSharingInfo($itemID, $userID) {
        $stmt = $this->db->prepare("
            SELECT AccessLevel FROM {$this->table} 
            WHERE ItemID = ? AND RecieverID = ?
        ");
        $stmt->execute([$itemID, $userID]);
        return $stmt->fetch();
    }
    
    /**
     * Remove sharing for an item
     *
     * @param int $itemID Item ID to stop sharing
     * @param int $ownerID Owner user ID
     * @param int $receiverID Recipient user ID
     * @return bool True on success, false otherwise
     */
    public function removeSharing($itemID, $ownerID, $receiverID) {
        $stmt = $this->db->prepare("
            DELETE FROM {$this->table} 
            WHERE ItemID = ? AND OwnerID = ? AND RecieverID = ?
        ");
        return $stmt->execute([$itemID, $ownerID, $receiverID]);
    }
    
    /**
     * Check if user can access an item (either owns it or has sharing permission)
     *
     * Returns an array with keys:
     * - 'accessible' => bool
     * - 'accessLevel' => string|null (one of 'Read','Write','Admin' or 'Admin' for owners)
     *
     * @param int $itemID Item ID to check
     * @param int $userID User ID requesting access
     * @return array Associative result with 'accessible' and 'accessLevel'
     */
    public function canUserAccess($itemID, $userID) {
        // First check if user owns the item
        $itemModel = new Item();
        $ownedItem = $itemModel->getByIdAndOwner($itemID, $userID);
        if ($ownedItem) {
            return ['accessible' => true, 'accessLevel' => 'Admin'];
        }
        
        // Check if item is shared with user
        $sharedInfo = $this->getSharingInfo($itemID, $userID);
        if ($sharedInfo) {
            return ['accessible' => true, 'accessLevel' => $sharedInfo['AccessLevel']];
        }
        
        return ['accessible' => false, 'accessLevel' => null];
    }
}
?>