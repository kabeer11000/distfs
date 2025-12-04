<?php
// models/File.php
// File model for handling file-specific operations

require_once 'Model.php';

class File extends Model {
    protected $table = 'File';
    protected $primaryKey = 'FileID';
    
    /**
     * Update file metadata after upload
     */
    public function updateMetadata($fileID, $size, $extension, $chunkCount) {
        $stmt = $this->db->prepare(<<<SQL
            UPDATE {$this->table} 
            SET Size = ?, Extension = ?, ChunkCount = ? 
            WHERE FileID = ?
        SQL
        );
        
        return $stmt->execute([$size, $extension, $chunkCount, $fileID]);
    }
    
    /**
     * Get file details by ID
     */
    public function getDetails($fileID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT f.FileID, f.Size, f.Extension, f.ChunkCount, 
                   i.Name, i.CreatedAt, i.ModifiedAt
            FROM {$this->table} f
            JOIN Item i ON f.FileID = i.ItemID
            WHERE f.FileID = ?
        SQL
        );

        $stmt->execute([$fileID]);
        return $stmt->fetch();
    }
    
    /**
     * Get file with owner verification
     */
    public function getByIdAndOwner($fileID, $ownerID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT f.FileID, f.Size, f.Extension, f.ChunkCount,
                   i.Name, i.CreatedAt, i.ModifiedAt
            FROM {$this->table} f
            JOIN Item i ON f.FileID = i.ItemID
            WHERE f.FileID = ? AND i.OwnerID = ?
        SQL
        );

        $stmt->execute([$fileID, $ownerID]);
        return $stmt->fetch();
    }

    /**
     * Get total storage usage for a user
     */
    public function getUserStorageUsage($userID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT
                COUNT(DISTINCT File.FileID) as count,
                COALESCE(SUM(File.Size), 0) as bytes,
                COALESCE(SUM(File.ChunkCount), 0) as chunks
            FROM {$this->table} File
            INNER JOIN Item ON File.FileID = Item.ItemID
            WHERE Item.OwnerID = ?
        SQL
        );

        $stmt->execute([$userID]);
        return $stmt->fetch();
    }
}
?>