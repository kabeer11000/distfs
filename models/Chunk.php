<?php
/**
 * @file Chunk.php
 * @brief Chunk model for handling file chunk storage and allocation
 *
 * Manages metadata in the `Chunk` table and the physical chunk files on disk.
 * Provides helpers to store and remove chunk files, find available storage
 * slots, and update storage server slot accounting.
 */

require_once 'Model.php';

/**
 * @class Chunk
 * @brief Data model for file chunks
 *
 * Responsible for inserting chunk metadata, persisting chunk data to disk,
 * finding / allocating / freeing storage slots, and returning chunk lists
 * for a given file.
 */
class Chunk extends Model {
    protected $table = 'Chunk';
    
    /**
     * Store a chunk record in the database and save the actual chunk data
     *
     * Writes the chunk payload to a server slot file and inserts the
     * corresponding metadata row into the `Chunk` table. If the filesystem
     * write or DB insert fails, the method attempts to clean up the file.
     *
     * @param int $chunkID The sequence number (1-based) of the chunk in file
     * @param int $fileID FileID this chunk belongs to
     * @param int $serverID Storage server ID where this chunk will be stored
     * @param int $slotID Slot identifier on the storage server
     * @param string $checksum SHA-256 checksum of the chunk data
     * @param string $chunkData Raw binary chunk data to write
     * @return bool True on success (DB inserted and file written), false on failure
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

            // If not written, rollback DB insert
            if ($bytesWritten === false) return false;
        
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
         *
         * @param int $serverID Storage server ID
         * @param int $slotID Slot ID within the server
         * @return string Full filesystem path to the chunk file (may not exist)
         */
        public function getChunkFilePath($serverID, $slotID) {
            return __DIR__ . '/../storage/server' . $serverID . '/' . $slotID . '.chunk';
        }
    
    /**
     * Get all chunks for a specific file
     *
     * @param int $fileID File ID to fetch chunks for
     * @return array[] Array of chunk rows (ChunkID, ServerID, SlotID, Checksum)
     */
    public function getByFileId($fileID) {
        $stmt = $this->db->prepare(<<<SQL
            SELECT ChunkID, ServerID, SlotID, Checksum
            FROM {$this->table}
            WHERE FileID = ?
            ORDER BY ChunkID
        SQL
        );

        $stmt->execute([$fileID]);
        return $stmt->fetchAll();
    }
    
    /**
     * Delete all chunks for a specific file
     *
     * Frees storage slots (marks them unallocated), deletes the physical
     * chunk files, updates available space on affected storage servers, and
     * removes chunk rows from the `Chunk` table.
     *
     * @param int $fileID File ID whose chunks should be deleted
     * @return bool True when DB rows deleted successfully, false otherwise
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
     * Find available slots for storing chunks using stored procedure
     *
     * Calls the `GetRandomUnallocatedSlots` stored procedure which returns
     * server+slot pairs suitable for allocation. The method returns the raw
     * rows returned by the procedure (ServerID, SlotID).
     *
     * @param int $count Number of slots required
     * @return array[] Array of slot rows with keys 'ServerID' and 'SlotID'
     */
    public function findAvailableSlots($count) {
        $count = (int)$count; // Ensure count is an integer

        // Call the stored procedure to get N random unallocated slots
        $stmt = $this->db->prepare("CALL GetRandomUnallocatedSlots(?)");
        $stmt->execute([$count]);

        // Fetch results
        $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt->closeCursor();  // Close cursor to allow subsequent querie
        return $slots;
    }

    /**
     * Return the total number of available slots across all storage servers
     *
     * Useful for estimating maximum possible upload capacity from the UI.
     *
     * @return int Number of available slots (sum of StorageServer.AvailableSpace)
     */
    public function getTotalAvailableSlots() {
        $stmt = $this->db->prepare("SELECT COALESCE(SUM(AvailableSpace), 0) AS available FROM StorageServer");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? intval($row['available']) : 0;
    }
    
    /**
     * Allocate specific slots (mark as allocated)
     *
     * The input `$slots` should be an array of associative arrays with
     * keys 'ServerID' and 'SlotID'. This method will attempt to atomically
     * mark slots as allocated and decrement server available space.
     *
     * @param array[] $slots Array of slots to allocate, each with 'ServerID' and 'SlotID'
     * @return bool True on success, false on failure (no partial allocations)
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