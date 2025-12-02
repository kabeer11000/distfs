<?php
// models/Chunk.php
// Chunk model for handling file chunk storage and allocation

require_once 'Model.php';

class Chunk extends Model {
    protected $table = 'Chunk';
    
    /**
     * Store a chunk record in the database and save the actual chunk data
     */
    public function storeChunk($chunkID, $fileID, $serverID, $slotID, $checksum, $chunkData) {
        // First store the chunk metadata in the database
        $stmt = $this->db->prepare("
            INSERT INTO {$this->table} (ChunkID, FileID, ServerID, SlotID, Checksum) 
            VALUES (?, ?, ?, ?, ?)
        ");
            // Compute storage path for the chunk file and write the actual data
            $storageDir = __DIR__ . '/../storage/server' . $serverID;
            if (!is_dir($storageDir)) {
                if (!mkdir($storageDir, 0775, true)) {
                    return false; // Failed to create storage directory
                }
            }
            $storagePath = $storageDir . '/' . $slotID . '.chunk';
            $bytesWritten = file_put_contents($storagePath, $chunkData, LOCK_EX);
            if ($bytesWritten === false) {
                return false;
            }

            // Now store the chunk metadata in the database
            $stmt = $this->db->prepare("
                INSERT INTO {$this->table} (ChunkID, FileID, ServerID, SlotID, Checksum) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $ok = $stmt->execute([$chunkID, $fileID, $serverID, $slotID, $checksum]);
            if (!$ok) {
                if (is_file($storagePath)) {
                    @unlink($storagePath);
                }
            }
            return $ok;
    }

        /**
         * Get the filesystem path for a given chunk slot on a server
         */
        public function getChunkFilePath($serverID, $slotID) {
            return __DIR__ . '/../storage/server' . $serverID . '/' . $slotID . '.chunk';
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
            // Delete the physical .chunk file from disk if present
            $chunkPath = $this->getChunkFilePath($slot['ServerID'], $slot['SlotID']);
            if (is_file($chunkPath)) {
                @unlink($chunkPath);
            }
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
                    $chunksOnServer = array_filter($slots, function($slot) use ($serverId) {
                        return $slot['ServerID'] == $serverId;
                    });
                    $spaceToFree = count($chunksOnServer); // Number of slots freed
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
        $count = (int)$count; // Ensure count is an integer
        // Use RAND() to choose random free slots across servers for distribution
        $sql = "SELECT ServerID, SlotID FROM StorageSlot WHERE IsAllocated = FALSE ORDER BY RAND() LIMIT {$count}";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Return the total number of available slots across all storage servers
     * This can be used by the front-end to estimate maximum upload size.
     */
    public function getTotalAvailableSlots() {
        $stmt = $this->db->prepare("SELECT COALESCE(SUM(AvailableSpace), 0) AS available FROM StorageServer");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? intval($row['available']) : 0;
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
                // Attempt to allocate the slot only if it's still free; if not, fail
                $updateStmt->execute([$slot['ServerID'], $slot['SlotID']]);
                if ($updateStmt->rowCount() === 0) {
                    throw new Exception('Failed to allocate slot: ' . $slot['ServerID'] . ':' . $slot['SlotID']);
                }

                // Update available space in StorageServer (decrement by 1 slot)
                $spaceStmt = $this->db->prepare("
                    UPDATE StorageServer 
                    SET AvailableSpace = AvailableSpace - 1 
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