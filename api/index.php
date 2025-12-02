<?php
// api/index.php
// Main API entry point

// Set content type to JSON
header('Content-Type: application/json');

// Allow cross-origin requests during development
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../services/AuthService.php';
require_once __DIR__ . '/../services/FileService.php';

// Parse the request
$method = $_SERVER['REQUEST_METHOD'];
$request = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// The router handles the '/api' prefix, so we just need to process the remaining path
$parts = explode('/', ltrim($request, '/'));

// Initialize services
$authService = new AuthService();
$fileService = new FileService();

// Helper function to send JSON response
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Helper function to get JSON input
function getJsonInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    return $input ?: $_POST;
}

// API Routes
try {
    switch ($parts[0]) {
        case 'auth':
            if ($method === 'POST' && $parts[1] === 'register') {
                $input = getJsonInput();
                $result = $authService->register(
                    $input['username'] ?? '',
                    $input['email'] ?? '',
                    $input['password'] ?? ''
                );
                sendResponse($result, $result['success'] ? 200 : 400);
            } 
            elseif ($method === 'POST' && $parts[1] === 'login') {
                $input = getJsonInput();
                $result = $authService->login(
                    $input['username'] ?? '',
                    $input['password'] ?? ''
                );
                sendResponse($result, $result['success'] ? 200 : 400);
            }
            elseif ($method === 'POST' && $parts[1] === 'logout') {
                $result = $authService->logout();
                sendResponse($result, 200);
            }
            elseif ($method === 'GET' && $parts[1] === 'me') {
                $result = $authService->getCurrentUser();
                sendResponse($result, $result['success'] ? 200 : 401);
            }
            else {
                sendResponse(['success' => false, 'error' => 'Invalid auth endpoint'], 404);
            }
            break;
            
        case 'files':
            // Check authentication for file operations
            if (!$authService->isLoggedIn() && !in_array($parts[1], ['public', 'download'])) {
                sendResponse(['success' => false, 'error' => 'Authentication required'], 401);
            }
            
            $userID = $authService->getCurrentUserId();
            
            if ($method === 'GET' && $parts[1] === 'list') {
                $parentID = $_GET['parentID'] ?? 1; // Default to root directory
                // Support a special 'shared' parentID value to list items shared with the user
                if ($parentID === 'shared' || $parentID === 'Shared') {
                    $result = $fileService->listSharedItems($userID);
                } else {
                    $result = $fileService->listDirectory($parentID, $userID);
                }
                sendResponse($result, $result['success'] ? 200 : 400);
            }
            elseif ($method === 'POST' && $parts[1] === 'mkdir') {
                $input = getJsonInput();
                $result = $fileService->createDirectory(
                    $userID,
                    $input['parentID'] ?? 1, // Default to root
                    $input['name'] ?? ''
                );
                sendResponse($result, $result['success'] ? 200 : 400);
            }
            elseif ($method === 'POST' && $parts[1] === 'upload') {
                // Handle file upload
                if (isset($_FILES['file'])) {
                    $fileContent = file_get_contents($_FILES['file']['tmp_name']);
                    $fileName = $_FILES['file']['name'];
                    
                    $result = $fileService->uploadFile(
                        $userID,
                        $_POST['parentID'] ?? 1, // Default to root
                        $fileName,
                        $fileContent
                    );
                    sendResponse($result, $result['success'] ? 200 : 400);
                } else {
                    $input = getJsonInput();
                    $result = $fileService->uploadFile(
                        $userID,
                        $input['parentID'] ?? 1,
                        $input['name'] ?? 'untitled.txt',
                        $input['content'] ?? ''
                    );
                    sendResponse($result, $result['success'] ? 200 : 400);
                }
            }
            elseif ($method === 'GET' && $parts[1] === 'read') {
                $fileID = $_GET['id'] ?? null;
                if ($fileID) {
                    // Check if it's a download request
                    $isDownload = isset($_GET['download']) || isset($_GET['dl']);

                    $result = $fileService->downloadFile($fileID, $userID);

                    if ($result['success']) {
                        $fileData = $result['data'];
                        if ($isDownload) {
                            // If content is present, return it as a download; otherwise, fall back to a summary
                            $contentToReturn = isset($fileData['content']) ? $fileData['content'] : "File: {$fileData['name']}\nSize: {$fileData['size']} bytes\nChunks: {$fileData['chunkCount']}\n";

                            // Set headers for file download
                            header('Content-Type: application/octet-stream');
                            header('Content-Disposition: attachment; filename="' . basename($fileData['name']) . '"');
                            header('Content-Length: ' . strlen($contentToReturn));

                            echo $contentToReturn;
                            exit();
                        } else {
                            // Return file info and content as JSON (for view/cat)
                            sendResponse($result, 200);
                        }
                    } else {
                        sendResponse($result, $result['success'] ? 200 : 400);
                    }
                } else {
                    sendResponse(['success' => false, 'error' => 'File ID required'], 400);
                }
            }
            elseif ($method === 'DELETE' && $parts[1] === 'delete') {
                $itemID = $parts[2] ?? null;
                if ($itemID) {
                    $result = $fileService->deleteItem($itemID, $userID);
                    sendResponse($result, $result['success'] ? 200 : 400);
                } else {
                    sendResponse(['success' => false, 'error' => 'Item ID required'], 400);
                }
            }
            elseif ($method === 'POST' && $parts[1] === 'share') {
                $input = getJsonInput();
                $itemID = $input['itemID'] ?? null;
                $receiverUsername = $input['receiverUsername'] ?? null;
                $accessLevel = $input['accessLevel'] ?? null;

                // Need to get receiver's ID from username
                $userService = new User();
                $receiver = $userService->findByUsername($receiverUsername);

                if (!$itemID || !$receiver || !$accessLevel) {
                    sendResponse(['success' => false, 'error' => 'Item ID, receiver username, and access level required'], 400);
                } else {
                    // Use the SharedItem model to handle sharing
                    $sharedItemModel = new SharedItem();
                    $result = $sharedItemModel->shareItem($itemID, $userID, $receiver['UserID'], $accessLevel);

                    if ($result) {
                        sendResponse(['success' => true, 'data' => ['message' => 'Item shared successfully']], 200);
                    } else {
                        sendResponse(['success' => false, 'error' => 'Failed to share item'], 400);
                    }
                }
            }
            else {
                sendResponse(['success' => false, 'error' => 'Invalid file endpoint'], 404);
            }
            break;
            case 'storage':
                if ($method === 'GET' && ($parts[1] ?? '') === 'info') {
                    // Return storage capacity / available slots information
                    $result = $fileService->getStorageInfo();
                    sendResponse($result, $result['success'] ? 200 : 400);
                } else {
                    sendResponse(['success' => false, 'error' => 'Invalid storage endpoint'], 404);
                }
                break;
            
        default:
            sendResponse(['success' => false, 'error' => 'Endpoint not found'], 404);
    }
} catch (Exception $e) {
    sendResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}
?>