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
        $result = $stmt->execute([$chunkID, $fileID, $serverID, $slotID, $checksum]);

        if ($result) {
            // Now save the actual chunk data to the storage server directory
            return $this->saveChunkData($serverID, $slotID, $chunkData);
        }

        return false;
    }

    /**
     * Save chunk data to the appropriate storage location
     */
    private function saveChunkData($serverID, $slotID, $chunkData) {
        // Get the server information from the database
        $serverStmt = $this->db->prepare("SELECT Hostname, IPAddress FROM StorageServer WHERE ServerID = ?");
        $serverStmt->execute([$serverID]);
        $serverInfo = $serverStmt->fetch();

        if (!$serverInfo) {
            return false;
        }

        // For simulation, we'll use local directories named after server IDs
        $storagePath = __DIR__ . '/../storage/server' . $serverID . '/' . $slotID . '.chunk';

        // Ensure the directory exists
        $dir = dirname($storagePath);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        // Write the chunk data to the file
        return file_put_contents($storagePath, $chunkData) !== false;
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
     * Read a specific chunk from storage
     */
    public function readChunk($serverID, $slotID) {
        $storagePath = __DIR__ . '/../storage/server' . $serverID . '/' . $slotID . '.chunk';

        if (file_exists($storagePath)) {
            return file_get_contents($storagePath);
        }

        return false;
    }

    /**
     * Delete all chunks for a specific file
     */
    public function deleteByFileId($fileID) {
        // First, get all chunks for this file to know what to delete
        $chunks = $this->getByFileId($fileID);

        // Mark the corresponding storage slots as unallocated
        $slotStmt = $this->db->prepare("
            UPDATE StorageSlot SET IsAllocated = FALSE
            WHERE ServerID = ? AND SlotID = ?
        ");

        foreach ($chunks as $chunk) {
            $slotStmt->execute([$chunk['ServerID'], $chunk['SlotID']]);

            // Delete the actual chunk file
            $storagePath = __DIR__ . '/../storage/server' . $chunk['ServerID'] . '/' . $chunk['SlotID'] . '.chunk';
            if (file_exists($storagePath)) {
                unlink($storagePath);
            }
        }

        // Update available space in StorageServer
        if (!empty($chunks)) {
            $serverIds = array_unique(array_column($chunks, 'ServerID'));
            $serverStmt = $this->db->prepare("
                UPDATE StorageServer
                SET AvailableSpace = AvailableSpace + ?
                WHERE ServerID = ?
            ");
            foreach ($serverIds as $serverId) {
                // Calculate how much space was used by chunks on this server
                $chunksOnServer = array_filter($chunks, function($chunk) use ($serverId) {
                    return $chunk['ServerID'] == $serverId;
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