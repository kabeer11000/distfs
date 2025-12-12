<?php
/**
 * @file Item.php
 * @brief Item model for handling file and folder metadata
 *
 * Provides operations to list items in a directory, create items (files/folders),
 * verify ownership, check sharing, delete items with cleanup, and compute
 * breadcrumb-style paths for a given item.
 */

require_once 'Model.php';

/**
 * @class Item
 * @brief Data model for items (files and folders)
 *
 * Uses the `Item` table and related tables (`File`, `Folder`, `SharedItem`, etc.)
 * to provide common operations required by FileService and API endpoints.
 */
class Item extends Model {
    protected $table = 'Item';
    protected $primaryKey = 'ItemID';
    
    /**
     * Get items in a specific directory
     *
     * @param int|null $parentItemID Parent ItemID to list within; pass NULL for root
     * @param int $ownerID Owner (user) ID to filter listing
     * @return array[] Rows representing files/folders in the directory
     */
    public function getByParentAndOwner($parentItemID, $ownerID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT i.ItemID, i.Name, i.ItemType, i.CreatedAt, i.ModifiedAt, 
                   COALESCE(f.Size, 0) as Size
            FROM {$this->table} i
            LEFT JOIN File f ON i.ItemID = f.FileID
            WHERE i.ParentItemID = ? AND i.OwnerID = ?
            ORDER BY i.ItemType, i.Name
        SQL
        );

        $stmt->execute([$parentItemID, $ownerID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Create a new Item (file or folder)
     *
     * Uses the `CreateItem` stored procedure which returns the created ItemID
     * as an OUT parameter on success.
     *
     * @param int $ownerID Owner user ID who will own the new item
     * @param int|null $parentItemID Parent Item ID (NULL for root)
     * @param string $itemType 'Folder' or 'File'
     * @param string $name Item name (non-empty)
     * @return int|false Inserted ItemID on success, false on failure
     */
    public function create($ownerID, $parentItemID, $itemType, $name) {
        try {
            // Call the stored procedure with positional placeholders
            $stmt = $this->db->prepare("CALL CreateItem(?, ?, ?, ?, @itemID)");

            // Execute the procedure with an array of values
            $stmt->execute([$ownerID, $parentItemID, $itemType, $name]);

            // Fetch the output parameter
            $itemID = $this->db->query("SELECT @itemID")->fetchColumn();

            if ($itemID === null) return false;
            return $itemID;
        } catch (Exception $e) {
            return false;
        }
    }

    
    /**
     * Get item by ID with owner verification
     *
     * @param int $itemID Item ID to fetch
     * @param int $ownerID Owner ID for ownership check
     * @return array|false Item row as associative array or false when not found
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
     *
     * NOTE: The DB column uses the name `RecieverID` (misspelled). This method
     * respects the column name as-is to avoid breaking existing schema.
     *
     * @param int $itemID Item ID to check
     * @param int $userID Potential recipient user ID
     * @return array|false Row with AccessLevel or false when not shared
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
     *
     * Recursively deletes children (for folders) and purges related rows from
     * `File`, `Chunk`, `Folder`, and `SharedItem` as needed. Operates inside
     * a transaction to ensure consistency.
     *
     * @param int $itemID Item ID to delete
     * @return bool True on success, false on failure
     */
    public function delete($itemID) {
        try {
            $this->db->beginTransaction();
            
            // First handle potential children if it's a folder
            $children = $this->getByParentAndOwner($itemID, 0); // We'll verify ownership separately
            
            // Recursively delete children
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
     * Get full path of an item for breadcrumbs
     *
     * Walks up the parent chain until the root and returns an array of items
     * ordered from root to the target item.
     *
     * @param int $itemID Item ID to compute path for
     * @return array[] Array of item rows describing the path (root ... item)
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