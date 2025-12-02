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
    
    public function __construct() {
        $this->itemModel = new Item();
        $this->fileModel = new File();
        $this->chunkModel = new Chunk();
        $this->sharedItemModel = new SharedItem();
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
        $chunkSize = 4096; // 4KB
        $chunks = str_split($fileContent, $chunkSize);
        $chunkCount = count($chunks);
        
        // Find and allocate storage slots
        $slots = $this->chunkModel->findAvailableSlots($chunkCount);
        if (count($slots) < $chunkCount) {
            // Clean up the file entry we just created
            $this->itemModel->delete($fileID);
            return ['success' => false, 'error' => 'Not enough storage space available'];
        }
        
        // Allocate the slots
        $this->chunkModel->allocateSlots($slots);
        
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
     * Download a file by reconstructing its chunks
     */
    public function downloadFile($fileID, $userID) {
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
        
        // Get all chunks for the file
        $chunks = $this->chunkModel->getByFileId($fileID);
        if (!$chunks) {
            return ['success' => false, 'error' => 'File chunks not found'];
        }
        
        // In a real implementation, we would retrieve the actual chunk data from storage servers
        // For now, we'll return the file metadata so the frontend knows what to expect
        return [
            'success' => true,
            'data' => [
                'fileID' => $fileID,
                'name' => $fileDetails['Name'],
                'size' => $fileDetails['Size'],
                'extension' => $fileDetails['Extension'],
                'chunkCount' => $fileDetails['ChunkCount'],
                'chunks' => $chunks // This would contain the location information for each chunk
            ]
        ];
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