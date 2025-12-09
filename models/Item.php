<?php
// models/Item.php
// Item model for handling file and folder metadata

require_once 'Model.php';

class Item extends Model {
    protected $table = 'Item';
    protected $primaryKey = 'ItemID';
    
    /**
     * Get items in a specific directory
     */
    public function getByParentAndOwner($parentItemID, $ownerID) {
        $stmt = $this->db->prepare("
            SELECT i.ItemID, i.Name, i.ItemType, i.CreatedAt, i.ModifiedAt, 
                   COALESCE(f.Size, 0) as Size
            FROM {$this->table} i
            LEFT JOIN File f ON i.ItemID = f.FileID
            WHERE i.ParentItemID = ? AND i.OwnerID = ?
            ORDER BY i.ItemType, i.Name
        ");
        $stmt->execute([$parentItemID, $ownerID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Create a new item (file or folder)
     */
    public function create($ownerID, $parentItemID, $itemType, $name) {
        try {
            $this->db->beginTransaction();
            
            // Insert into Item table
            $stmt = $this->db->prepare("
                INSERT INTO {$this->table} (OwnerID, ParentItemID, ItemType, Name) 
                VALUES (?, ?, ?, ?)
            ");
            $result = $stmt->execute([$ownerID, $parentItemID, $itemType, $name]);
            
            if (!$result) {
                $this->db->rollback();
                return false;
            }
            
            $itemID = $this->db->lastInsertId();
            
            // Insert into specific table based on type
            if ($itemType === 'Folder') {
                $folderStmt = $this->db->prepare("INSERT INTO Folder (FolderID) VALUES (?)");
                $folderResult = $folderStmt->execute([$itemID]);
                
                if (!$folderResult) {
                    $this->db->rollback();
                    return false;
                }
            } elseif ($itemType === 'File') {
                $fileStmt = $this->db->prepare("INSERT INTO File (FileID) VALUES (?)");
                $fileResult = $fileStmt->execute([$itemID]);
                
                if (!$fileResult) {
                    $this->db->rollback();
                    return false;
                }
            }
            
            $this->db->commit();
            return $itemID;
        } catch (Exception $e) {
            $this->db->rollback();
            return false;
        }
    }
    
    /**
     * Get item by ID with owner verification
     */
    public function getByIdAndOwner($itemID, $ownerID) {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table} 
            WHERE ItemID = ? AND OwnerID = ?
        ");
        $stmt->execute([$itemID, $ownerID]);
        return $stmt->fetch();
    }
    
    /**
     * Check if an item is shared with a user
     */
    public function isSharedWithUser($itemID, $userID) {
        $stmt = $this->db->prepare("
            SELECT AccessLevel FROM SharedItem 
            WHERE ItemID = ? AND RecieverID = ?
        ");
        $stmt->execute([$itemID, $userID]);
        return $stmt->fetch();
    }
    
    /**
     * Delete an item and its associated data
     */
    public function delete($itemID) {
        try {
            $this->db->beginTransaction();
            
            // First handle potential children if it's a folder
            $children = $this->getByParentAndOwner($itemID, 0); // We'll verify ownership separately
            foreach ($children as $child) {
                $this->delete($child['ItemID']);
            }
            
            // Delete from specific tables based on type
            $item = $this->find($itemID);
            if ($item) {
                if ($item['ItemType'] === 'Folder') {
                    $stmt = $this->db->prepare("DELETE FROM Folder WHERE FolderID = ?");
                    $stmt->execute([$itemID]);
                } elseif ($item['ItemType'] === 'File') {
                    // Delete associated chunks first
                    $chunkModel = new Chunk();
                    $chunkModel->deleteByFileId($itemID);
                    
                    $stmt = $this->db->prepare("DELETE FROM File WHERE FileID = ?");
                    $stmt->execute([$itemID]);
                }
            }
            
            // Delete from shared items
            $stmt = $this->db->prepare("DELETE FROM SharedItem WHERE ItemID = ?");
            $stmt->execute([$itemID]);
            
            // Finally delete from Item table
            $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE ItemID = ?");
            $result = $stmt->execute([$itemID]);
            
            $this->db->commit();
            return $result;
        } catch (Exception $e) {
            $this->db->rollback();
            return false;
        }
    }
    
    /**
     * Get parent ID of an item
     */
    public function getParentId($itemID) {
        $stmt = $this->db->prepare("SELECT ParentItemID FROM {$this->table} WHERE ItemID = ?");
        $stmt->execute([$itemID]);
        $result = $stmt->fetch();

        return $result ? $result['ParentItemID'] : null;
    }

    /**
     * Get full path of an item for breadcrumbs
     */
    public function getPath($itemID) {
        $path = [];
        $currentID = $itemID;

        while ($currentID !== null) {
            $stmt = $this->db->prepare("SELECT ItemID, Name, ParentItemID FROM {$this->table} WHERE ItemID = ?");
            $stmt->execute([$currentID]);
            $item = $stmt->fetch();

            if (!$item) {
                break;
            }

            array_unshift($path, $item);
            $currentID = $item['ParentItemID'];
        }

        return $path;
    }
}
?>