<?php
// services/FileService.php
// Service class to handle file operations business logic

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Item.php';
require_once __DIR__ . '/../models/File.php';
require_once __DIR__ . '/../models/Chunk.php';
require_once __DIR__ . '/../models/SharedItem.php';

class FileService {
    private $itemModel;
    private $fileModel;
    private $chunkModel;
    private $sharedItemModel;

    // Define chunk size (in bytes) used by this service
    private $chunkSize = 4096 * 1024; // ¬4Mb per chunk
    
    public function __construct() {
        $this->itemModel = new Item();
        $this->fileModel = new File();
        $this->chunkModel = new Chunk();
        $this->sharedItemModel = new SharedItem();
    }

    /**
     * Return storage information for clients, including available chunk slots
     * and configured chunk size (in bytes).
     * @return array { success: bool, data: { availableSlots, chunkSize, maxUploadBytes } }
     */
    public function getStorageInfo() {
        $availableSlots = $this->chunkModel->getTotalAvailableSlots();

        // calculate total slot capacity across all storage servers
        $db = $this->chunkModel->getDb();
        $stmt = $db->prepare("SELECT COALESCE(SUM(Capacity), 0) AS totalSlots FROM StorageServer");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalSlots = $row ? intval($row['totalSlots']) : 0;

        $maxUploadBytes = $availableSlots * $this->chunkSize;
        return ['success' => true, 'data' => ['availableSlots' => intval($availableSlots), 'totalSlots' => intval($totalSlots), 'chunkSize' => intval($this->chunkSize), 'maxUploadBytes' => intval($maxUploadBytes)]];
    }
    
    /**
     * List contents of a directory
     */
    public function listDirectory($parentItemID, $userID) {
        // If parentItemID is 0 or 1 (default), find or create the user's root directory
        if ($parentItemID == 0 || $parentItemID == 1) {
            // First, try to get existing root directory
            $userRoot = $this->getUserRootDirectory($userID);
            if ($userRoot) {
                $parentItemID = $userRoot['ItemID'];
            } else {
                // If no root directory exists, create one
                $itemID = $this->itemModel->create($userID, null, 'Folder', 'Home');
                if (!$itemID) {
                    return ['success' => false, 'error' => 'Could not create user root directory'];
                }
                $parentItemID = $itemID;
            }
        }

        // Check if user owns the directory (this is the main check for access)
        $ownedItem = $this->itemModel->getByIdAndOwner($parentItemID, $userID);
        if (!$ownedItem) {
            // Check if it's shared with the user
            $sharedInfo = $this->sharedItemModel->getSharingInfo($parentItemID, $userID);
            if (!$sharedInfo || ($sharedInfo['AccessLevel'] !== 'Read' &&
                                $sharedInfo['AccessLevel'] !== 'Write' &&
                                $sharedInfo['AccessLevel'] !== 'Admin')) {
                return ['success' => false, 'error' => 'Access denied'];
            }
        }

        // Get contents of the directory
        $items = $this->itemModel->getByParentAndOwner($parentItemID, $userID);

        // If the parent is the user's root, and user has shared items, add a virtual '/shared' folder
        $userRoot = $this->getUserRootDirectory($userID);
        $rootID = $userRoot ? $userRoot['ItemID'] : null;
        if ($rootID && $parentItemID == $rootID) {
            $sharedList = $this->sharedItemModel->getSharedWithUser($userID);
            if (!empty($sharedList)) {
                // Add a virtual folder entry 'Shared' with ID 'shared'
                $items[] = [
                    'ItemID' => 'shared',
                    'Name' => 'Shared',
                    'ItemType' => 'Folder',
                    'Size' => 0
                ];
                // Also merge shared items directly into the root listing so they appear in root
                foreach ($sharedList as $sItem) {
                    // Skip if an item with same name already exists in root
                    $exists = false;
                    foreach ($items as $it) {
                        if ($it['Name'] === $sItem['Name']) { $exists = true; break; }
                    }
                    if (!$exists) {
                        // Determine size for files
                        $size = 0;
                        if ($sItem['ItemType'] === 'File') {
                            $details = $this->fileModel->getDetails($sItem['ItemID']);
                            $size = $details ? ($details['Size'] ?? 0) : 0;
                        }
                        $items[] = [
                            'ItemID' => $sItem['ItemID'],
                            'Name' => $sItem['Name'],
                            'ItemType' => $sItem['ItemType'],
                            'Size' => $size,
                            'OwnerName' => $sItem['OwnerName'],
                            'AccessLevel' => $sItem['AccessLevel']
                        ];
                    }
                }
            }
        }

        return ['success' => true, 'data' => $items ?: []];
    }

    /**
     * Get the user's root/home directory
     */
    public function getUserRootDirectory($userID) {
        $sql = "SELECT ItemID, Name FROM Item
                WHERE OwnerID = ? AND ParentItemID IS NULL
                ORDER BY CreatedAt LIMIT 1";
        $stmt = $this->itemModel->query($sql, [$userID]);
        $result = $stmt->fetch();

        return $result ?: null;
    }
    
    /**
     * Get contents of a directory when the directory itself is shared with the user
     */
    private function getSharedDirectoryContents($parentItemID, $userID) {
        // This would require a more complex query to find items shared within a directory
        // For now, we'll just return an empty array
        return [];
    }
    
    /**
     * Create a new directory
     */
    public function createDirectory($userID, $parentItemID, $name) {
        // Normalize parent ID 0 or 1 to the user's root directory, similar to listDirectory logic
        if ($parentItemID == 0 || $parentItemID == 1) {
            $userRoot = $this->getUserRootDirectory($userID);
            if ($userRoot) {
                $parentItemID = $userRoot['ItemID'];
            } else {
                // If the user doesn't yet have a root, create it
                $itemID = $this->itemModel->create($userID, null, 'Folder', 'Home');
                $parentItemID = $itemID;
            }
        }
        // Verify user has permission to create in the parent directory
        $accessInfo = $this->sharedItemModel->canUserAccess($parentItemID, $userID);
        if (!$accessInfo['accessible'] || 
            ($accessInfo['accessLevel'] !== 'Write' && $accessInfo['accessLevel'] !== 'Admin')) {
            return ['success' => false, 'error' => 'Access denied'];
        }
        
        $itemID = $this->itemModel->create($userID, $parentItemID, 'Folder', $name);
        if ($itemID) {
            return ['success' => true, 'data' => ['itemID' => $itemID, 'name' => $name]];
        }
        
        return ['success' => false, 'error' => 'Failed to create directory'];
    }
    
    /**
     * Upload a file and store it in chunks
     */
    public function uploadFile($userID, $parentItemID, $fileName, $fileContent) {
        // Normalize parent ID 0 or 1 to the user's root directory (compat with listDirectory defaults)
        if ($parentItemID == 0 || $parentItemID == 1) {
            $userRoot = $this->getUserRootDirectory($userID);
            if ($userRoot) {
                $parentItemID = $userRoot['ItemID'];
            } else {
                // If the user doesn't yet have root folder, create it
                $itemID = $this->itemModel->create($userID, null, 'Folder', 'Home');
                $parentItemID = $itemID;
            }
        }
        // Verify user has permission to upload to the parent directory
        $accessInfo = $this->sharedItemModel->canUserAccess($parentItemID, $userID);
        if (!$accessInfo['accessible'] || 
            ($accessInfo['accessLevel'] !== 'Write' && $accessInfo['accessLevel'] !== 'Admin')) {
            return ['success' => false, 'error' => 'Access denied'];
        }
        
        // Determine file extension
        $pathInfo = pathinfo($fileName);
        $extension = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';
        
        // Create the file entry
        $fileID = $this->itemModel->create($userID, $parentItemID, 'File', $fileName);
        if (!$fileID) {
            return ['success' => false, 'error' => 'Failed to create file entry'];
        }
        
        // Split file content into chunks (4KB chunks)
        $chunks = str_split($fileContent, $this->chunkSize);
        $chunkCount = count($chunks);
        
        // Find and allocate storage slots
        $slots = $this->chunkModel->findAvailableSlots($chunkCount);
        if (count($slots) < $chunkCount) {
            // Clean up the file entry we just created
            $this->itemModel->delete($fileID);
            return ['success' => false, 'error' => 'Not enough storage space available'];
        }
        
        // Allocate the slots (returns false if allocation fails due to race conditions)
        $allocated = $this->chunkModel->allocateSlots($slots);
        if (!$allocated) {
            // Clean up the file entry we just created
            $this->itemModel->delete($fileID);
            return ['success' => false, 'error' => 'Failed to allocate storage slots (may be insufficient free slots)'];
        }
        
        // Store each chunk
        $success = true;
        for ($i = 0; $i < $chunkCount; $i++) {
            $chunkData = $chunks[$i];
            $checksum = hash('sha256', $chunkData);
            
            $result = $this->chunkModel->storeChunk(
                $i + 1, // ChunkID
                $fileID, 
                $slots[$i]['ServerID'], 
                $slots[$i]['SlotID'], 
                $checksum
                , $chunkData
            );
            
            if (!$result) {
                $success = false;
                break;
            }
        }
        
        if (!$success) {
            // If storing chunks failed, clean up
            $this->chunkModel->deleteByFileId($fileID);
            $this->itemModel->delete($fileID);
            return ['success' => false, 'error' => 'Failed to store file chunks'];
        }
        
        // Update file metadata
        $this->fileModel->updateMetadata($fileID, strlen($fileContent), $extension, $chunkCount);
        
        return [
            'success' => true, 
            'data' => [
                'fileID' => $fileID, 
                'name' => $fileName, 
                'size' => strlen($fileContent),
                'chunkCount' => $chunkCount
            ]
        ];
    }

    /**
     * Update an existing file's content without deleting its Item entry.
     * Uses chunk replacement so ItemID and ownership remains intact.
     */
    public function updateFile($userID, $fileID, $newContent) {
        // Verify user has write or admin permission to update the file
        $accessInfo = $this->sharedItemModel->canUserAccess($fileID, $userID);
        if (!$accessInfo['accessible'] || ($accessInfo['accessLevel'] !== 'Write' && $accessInfo['accessLevel'] !== 'Admin')) {
            return ['success' => false, 'error' => 'Access denied'];
        }

        // Ensure the file exists
        $fileDetails = $this->fileModel->getByIdAndOwner($fileID, $userID);
        if (!$fileDetails) {
            // If it's shared with the user and they have write/admin access, get details
            $sharedInfo = $this->sharedItemModel->getSharingInfo($fileID, $userID);
            if ($sharedInfo) {
                $fileDetails = $this->fileModel->getDetails($fileID);
            }
        }
        if (!$fileDetails) {
            return ['success' => false, 'error' => 'File not found'];
        }

        // Delete current chunks and free slots
        $this->chunkModel->deleteByFileId($fileID);

        $chunks = str_split($newContent, $this->chunkSize);
        $chunkCount = count($chunks);

        // Find and allocate storage slots
        $slots = $this->chunkModel->findAvailableSlots($chunkCount);
        if (count($slots) < $chunkCount) {
            return ['success' => false, 'error' => 'Not enough storage space available'];
        }

        $allocated = $this->chunkModel->allocateSlots($slots);
        if (!$allocated) {
            return ['success' => false, 'error' => 'Failed to allocate storage slots (may be insufficient free slots)'];
        }

        // Store each chunk
        $success = true;
        for ($i = 0; $i < $chunkCount; $i++) {
            $chunkData = $chunks[$i];
            $checksum = hash('sha256', $chunkData);
            $result = $this->chunkModel->storeChunk(
                $i + 1,
                $fileID,
                $slots[$i]['ServerID'],
                $slots[$i]['SlotID'],
                $checksum,
                $chunkData
            );
            if (!$result) {
                $success = false;
                break;
            }
        }

        if (!$success) {
            // cleanup
            $this->chunkModel->deleteByFileId($fileID);
            return ['success' => false, 'error' => 'Failed to store file chunks'];
        }

        // Update metadata
        $pathInfo = pathinfo($fileDetails['Name']);
        $extension = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';
        $this->fileModel->updateMetadata($fileID, strlen($newContent), $extension, $chunkCount);

        // Determine parent id for the response
        $parentID = null;
        $itemModel = new Item();
        $itemDetails = $itemModel->find($fileID);
        if ($itemDetails) $parentID = $itemDetails['ParentItemID'];

        return ['success' => true, 'data' => ['fileID' => $fileID, 'name' => $fileDetails['Name'], 'size' => strlen($newContent), 'chunkCount' => $chunkCount, 'parentID' => $parentID]];
    }
    
    /**
     * Download a file by reconstructing its chunks
     */
    public function downloadFile($fileID, $userID, $rangeStart = null, $rangeEnd = null) {
        // Check if user has access to the file
        $accessInfo = $this->sharedItemModel->canUserAccess($fileID, $userID);
        if (!$accessInfo['accessible'] ||
            ($accessInfo['accessLevel'] !== 'Read' &&
             $accessInfo['accessLevel'] !== 'Write' &&
             $accessInfo['accessLevel'] !== 'Admin')) {
            return ['success' => false, 'error' => 'Access denied'];
        }

        // Get file details
        $fileDetails = $this->fileModel->getByIdAndOwner($fileID, $userID);
        if (!$fileDetails) {
            // Check if it's shared with the user
            $sharedInfo = $this->sharedItemModel->getSharingInfo($fileID, $userID);
            if ($sharedInfo) {
                $fileDetails = $this->fileModel->getDetails($fileID);
            }
        }

        if (!$fileDetails) {
            return ['success' => false, 'error' => 'File not found'];
        }

        // Get the parent directory ID for this file
        $itemModel = new Item();
        $itemDetails = $itemModel->getByIdAndOwner($fileID, $userID);
        if (!$itemDetails) {
            // Check if it's shared
            $itemDetails = $itemModel->find($fileID);
        }

        $parentID = $itemDetails ? $itemDetails['ParentItemID'] : null;

        // Get all chunks for the file
        $chunks = $this->chunkModel->getByFileId($fileID);
        $fileChunkCount = intval($fileDetails['ChunkCount']);
        if ($fileChunkCount === 0) {
            // Empty file: allow editing/viewing with no chunk files
            return [
                'success' => true,
                'data' => [
                    'fileID' => $fileID,
                    'name' => $fileDetails['Name'],
                    'size' => intval($fileDetails['Size']),
                    'extension' => $fileDetails['Extension'],
                    'chunkCount' => 0,
                    'parentID' => $parentID,
                    'chunks' => [],
                    'content' => '',
                    'rangeStart' => null,
                    'rangeEnd' => null,
                    'totalSize' => intval($fileDetails['Size'])
                ]
            ];
        }
        if (!$chunks || count($chunks) < $fileChunkCount) {
            return ['success' => false, 'error' => 'File chunks not found'];
        }

        // Read actual chunk files from disk and concatenate them in order to reconstruct file (support range requests)
        $content = '';
        $totalSize = intval($fileDetails['Size']);

        // Normalize range values
        if ($rangeStart !== null) $rangeStart = max(0, intval($rangeStart));
        if ($rangeEnd !== null) $rangeEnd = min($totalSize - 1, intval($rangeEnd));

        if ($rangeStart !== null && $rangeEnd !== null && $rangeStart > $rangeEnd) {
            return ['success' => false, 'error' => 'Invalid range'];
        }

        // Decide which chunks to read
        $firstChunkIndex = 0;
        $lastChunkIndex = count($chunks) - 1;
        if ($rangeStart !== null || $rangeEnd !== null) {
            $firstChunkIndex = floor(($rangeStart !== null ? $rangeStart : 0) / $this->chunkSize);
            $lastChunkIndex = floor(($rangeEnd !== null ? $rangeEnd : ($totalSize - 1)) / $this->chunkSize);
            $firstChunkIndex = max(0, $firstChunkIndex);
            $lastChunkIndex = min($lastChunkIndex, count($chunks) - 1);
        }

        for ($i = $firstChunkIndex; $i <= $lastChunkIndex; $i++) {
            $c = $chunks[$i];
            $path = $this->chunkModel->getChunkFilePath($c['ServerID'], $c['SlotID']);
            if (!is_file($path)) {
                return ['success' => false, 'error' => 'Missing chunk file on storage: ' . $path];
            }
            $chunkContent = file_get_contents($path);
            if ($chunkContent === false) {
                return ['success' => false, 'error' => 'Failed to read chunk file: ' . $path];
            }

            // For first and last chunk, we might need to take slices
            if ($i === $firstChunkIndex || $i === $lastChunkIndex) {
                $startOffset = 0;
                $endOffset = strlen($chunkContent) - 1;
                if ($i === $firstChunkIndex && $rangeStart !== null) {
                    $startOffset = $rangeStart - ($i * $this->chunkSize);
                    $startOffset = max(0, $startOffset);
                }
                if ($i === $lastChunkIndex && $rangeEnd !== null) {
                    $endOffset = $rangeEnd - ($i * $this->chunkSize);
                    $endOffset = min($endOffset, strlen($chunkContent) - 1);
                }
                $content .= substr($chunkContent, $startOffset, $endOffset - $startOffset + 1);
            } else {
                $content .= $chunkContent;
            }
        }

        // Provide full file content in the response
        return [
            'success' => true,
            'data' => [
                'fileID' => $fileID,
                'name' => $fileDetails['Name'],
                'size' => $fileDetails['Size'],
                'extension' => $fileDetails['Extension'],
                'chunkCount' => $fileDetails['ChunkCount'],
                'parentID' => $parentID,
                'chunks' => $chunks, // location information for each chunk
                'content' => $content,
                'rangeStart' => $rangeStart,
                'rangeEnd' => $rangeEnd,
                'totalSize' => $totalSize
            ]
        ];
    }

    /**
     * List items that are shared with a given user
     */
    public function listSharedItems($userID) {
        $shared = $this->sharedItemModel->getSharedWithUser($userID);
        $items = [];
        foreach ($shared as $s) {
            $size = 0;
            if ($s['ItemType'] === 'File') {
                $details = $this->fileModel->getDetails($s['ItemID']);
                $size = $details ? ($details['Size'] ?? 0) : 0;
            }
            $items[] = [
                'ItemID' => $s['ItemID'],
                'Name' => $s['Name'],
                'ItemType' => $s['ItemType'],
                'Size' => $size,
                'OwnerName' => $s['OwnerName'],
                'AccessLevel' => $s['AccessLevel']
            ];
        }
        return ['success' => true, 'data' => $items];
    }
    
    /**
     * Delete a file or directory
     */
    public function deleteItem($itemID, $userID) {
        // Check if user has permission to delete the item
        $accessInfo = $this->sharedItemModel->canUserAccess($itemID, $userID);
        if (!$accessInfo['accessible'] || 
            ($accessInfo['accessLevel'] !== 'Write' && $accessInfo['accessLevel'] !== 'Admin')) {
            return ['success' => false, 'error' => 'Access denied'];
        }
        
        // If user is the owner, they can delete
        $item = $this->itemModel->getByIdAndOwner($itemID, $userID);
        if ($item) {
            $result = $this->itemModel->delete($itemID);
            return ['success' => $result, 'data' => ['message' => 'Item deleted successfully']];
        }
        
        // If it's shared with write/admin access, they can delete
        if ($accessInfo['accessLevel'] === 'Write' || $accessInfo['accessLevel'] === 'Admin') {
            // In a real system, we might need to update the logic to handle deletion of shared files
            return ['success' => false, 'error' => 'Shared file deletion not allowed'];
        }
        
        return ['success' => false, 'error' => 'Access denied'];
    }
    
    /**
     * Get breadcrumbs for a path
     */
    public function getPathBreadcrumbs($itemID) {
        $path = $this->itemModel->getPath($itemID);
        return ['success' => true, 'data' => $path];
    }
}
?>