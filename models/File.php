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
        $stmt = $this->db->prepare("
            UPDATE {$this->table} 
            SET Size = ?, Extension = ?, ChunkCount = ? 
            WHERE FileID = ?
        ");
        return $stmt->execute([$size, $extension, $chunkCount, $fileID]);
    }
    
    /**
     * Get file details by ID
     */
    public function getDetails($fileID) {
        $stmt = $this->db->prepare("
            SELECT f.FileID, f.Size, f.Extension, f.ChunkCount, 
                   i.Name, i.CreatedAt, i.ModifiedAt
            FROM {$this->table} f
            JOIN Item i ON f.FileID = i.ItemID
            WHERE f.FileID = ?
        ");
        $stmt->execute([$fileID]);
        return $stmt->fetch();
    }
    
    /**
     * Get file with owner verification
     */
    public function getByIdAndOwner($fileID, $ownerID) {
        $stmt = $this->db->prepare("
            SELECT f.FileID, f.Size, f.Extension, f.ChunkCount,
                   i.Name, i.CreatedAt, i.ModifiedAt
            FROM {$this->table} f
            JOIN Item i ON f.FileID = i.ItemID
            WHERE f.FileID = ? AND i.OwnerID = ?
        ");
        $stmt->execute([$fileID, $ownerID]);
        return $stmt->fetch();
    }
}
?>