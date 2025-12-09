<?php
// models/Chunk.php
// Chunk model for handling file chunk storage and allocation

require_once 'Model.php';

class Chunk extends Model {
    protected $table = 'Chunk';
    
    /**
     * Store a chunk record in the database
     */
    public function storeChunk($chunkID, $fileID, $serverID, $slotID, $checksum) {
        $stmt = $this->db->prepare("
            INSERT INTO {$this->table} (ChunkID, FileID, ServerID, SlotID, Checksum) 
            VALUES (?, ?, ?, ?, ?)
        ");
        return $stmt->execute([$chunkID, $fileID, $serverID, $slotID, $checksum]);
    }
    
    /**
     * Get all chunks for a specific file
     */
    public function getByFileId($fileID) {
        $stmt = $this->db->prepare("
            SELECT ChunkID, ServerID, SlotID, Checksum
            FROM {$this->table}
            WHERE FileID = ?
            ORDER BY ChunkID
        ");
        $stmt->execute([$fileID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Delete all chunks for a specific file
     */
    public function deleteByFileId($fileID) {
        // First, mark the corresponding storage slots as unallocated
        $getSlotsStmt = $this->db->prepare("
            SELECT ServerID, SlotID FROM {$this->table} 
            WHERE FileID = ?
        ");
        $getSlotsStmt->execute([$fileID]);
        $slots = $getSlotsStmt->fetchAll();
        
        // Mark slots as unallocated
        $slotStmt = $this->db->prepare("
            UPDATE StorageSlot SET IsAllocated = FALSE 
            WHERE ServerID = ? AND SlotID = ?
        ");
        foreach ($slots as $slot) {
            $slotStmt->execute([$slot['ServerID'], $slot['SlotID']]);
        }
        
        // Update available space in StorageServer
        if (!empty($slots)) {
            $serverIds = array_unique(array_column($slots, 'ServerID'));
            $serverStmt = $this->db->prepare("
                UPDATE StorageServer 
                SET AvailableSpace = AvailableSpace + ? 
                WHERE ServerID = ?
            ");
            foreach ($serverIds as $serverId) {
                // Calculate how much space was used by chunks on this server
                $chunksOnServer = array_filter($slots, function($slot) use ($serverId) {
                    return $slot['ServerID'] == $serverId;
                });
                $spaceToFree = count($chunksOnServer) * 4096; // Assuming 4KB chunks
                $serverStmt->execute([$spaceToFree, $serverId]);
            }
        }
        
        // Delete chunks from Chunk table
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE FileID = ?");
        return $stmt->execute([$fileID]);
    }
    
    /**
     * Find available slots for storing chunks
     */
    public function findAvailableSlots($count) {
        $stmt = $this->db->prepare("
            SELECT ServerID, SlotID FROM StorageSlot 
            WHERE IsAllocated = FALSE 
            LIMIT ?
        ");
        $stmt->execute([$count]);
        return $stmt->fetchAll();
    }
    
    /**
     * Allocate specific slots (mark as allocated)
     */
    public function allocateSlots($slots) {
        $this->db->beginTransaction();
        
        try {
            $updateStmt = $this->db->prepare("
                UPDATE StorageSlot SET IsAllocated = TRUE 
                WHERE ServerID = ? AND SlotID = ?
            ");
            
            foreach ($slots as $slot) {
                $updateStmt->execute([$slot['ServerID'], $slot['SlotID']]);
                
                // Update available space in StorageServer
                $spaceStmt = $this->db->prepare("
                    UPDATE StorageServer 
                    SET AvailableSpace = AvailableSpace - 4096 
                    WHERE ServerID = ?
                ");
                $spaceStmt->execute([$slot['ServerID']]);
            }
            
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            return false;
        }
    }
}
?>