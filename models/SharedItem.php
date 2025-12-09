<?php
// models/SharedItem.php
// SharedItem model for handling file sharing operations

require_once 'Model.php';

class SharedItem extends Model {
    protected $table = 'SharedItem';
    
    /**
     * Share an item with a user
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
     */
    public function getSharedWithUser($userID) {
        $stmt = $this->db->prepare("
            SELECT si.ItemID, i.Name, i.ItemType, u.Username as OwnerName, 
                   si.AccessLevel, si.CreatedAt
            FROM {$this->table} si
            JOIN Item i ON si.ItemID = i.ItemID
            JOIN User u ON si.OwnerID = u.UserID
            WHERE si.RecieverID = ?
        ");
        $stmt->execute([$userID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Get items owned by user that are shared
     */
    public function getSharedByUser($userID) {
        $stmt = $this->db->prepare("
            SELECT si.ItemID, i.Name, i.ItemType, u.Username as RecipientName, 
                   si.AccessLevel, si.CreatedAt
            FROM {$this->table} si
            JOIN Item i ON si.ItemID = i.ItemID
            JOIN User u ON si.RecieverID = u.UserID
            WHERE si.OwnerID = ?
        ");
        $stmt->execute([$userID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Check if an item is shared with a user and get access level
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