<?php
// Database initialization script with database creation
// config/init_db.php

require_once 'database.php';

try {
    // First, connect without specifying a database to create it
    $pdo = new PDO(
        "mysql:host=localhost;port=3306",
        'root',
        '',
        array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"
        )
    );
    
    // Create the database if it doesn't exist
    $pdo->exec("CREATE DATABASE IF NOT EXISTS FileStorageSystem");
    echo "Database created successfully!\n";
    
    // Now connect to the specific database
    $pdo->exec("USE FileStorageSystem");

    // Clean up existing tables (development-only): drop in a safe order
    // so we can re-create them with constraints. DO NOT RUN in production
    // without backups.
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("DROP TABLE IF EXISTS Chunk");
    $pdo->exec("DROP TABLE IF EXISTS `File`");
    $pdo->exec("DROP TABLE IF EXISTS Folder");
    $pdo->exec("DROP TABLE IF EXISTS SharedItem");
    $pdo->exec("DROP TABLE IF EXISTS StorageSlot");
    $pdo->exec("DROP TABLE IF EXISTS StorageServer");
    $pdo->exec("DROP TABLE IF EXISTS Item");
    $pdo->exec("DROP TABLE IF EXISTS `User`");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    // Create User table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `User` (
        UserID INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(50) NOT NULL,
        Email VARCHAR(100) NOT NULL UNIQUE,
        PasswordHash VARCHAR(255) NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_username (Username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create StorageServer table
    $pdo->exec("CREATE TABLE IF NOT EXISTS StorageServer (
        ServerID INT AUTO_INCREMENT PRIMARY KEY,
        Hostname VARCHAR(255) NOT NULL,
        IPAddress VARCHAR(45) NOT NULL,
        Capacity INT NOT NULL,
        AvailableSpace INT NOT NULL,
        UNIQUE KEY unique_hostname (Hostname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create StorageSlot table
    $pdo->exec("CREATE TABLE IF NOT EXISTS StorageSlot (
        ServerID INT,
        SlotID INT,
        IsAllocated BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (ServerID, SlotID),
        FOREIGN KEY (ServerID) REFERENCES StorageServer(ServerID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create Item table
    $pdo->exec("CREATE TABLE IF NOT EXISTS Item (
        ItemID INT AUTO_INCREMENT PRIMARY KEY,
        OwnerID INT NOT NULL,
        ParentItemID INT NULL,
        ItemType ENUM('Folder', 'File') NOT NULL,
        Name VARCHAR(255) NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        ModifiedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (OwnerID) REFERENCES `User`(UserID),
        FOREIGN KEY (ParentItemID) REFERENCES Item(ItemID) ON DELETE CASCADE,
        UNIQUE KEY unique_parent_name (ParentItemID, Name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create Folder table
    $pdo->exec("CREATE TABLE IF NOT EXISTS Folder (
        FolderID INT PRIMARY KEY,
        FOREIGN KEY (FolderID) REFERENCES Item(ItemID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create File table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `File` (
        FileID INT PRIMARY KEY,
        Size BIGINT DEFAULT 0,
        Extension VARCHAR(20),
        ChunkCount INT DEFAULT 0,
        FOREIGN KEY (FileID) REFERENCES Item(ItemID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create Chunk table
    $pdo->exec("CREATE TABLE IF NOT EXISTS Chunk (
        ChunkID INT,
        FileID INT,
        ServerID INT,
        SlotID INT,
        Checksum VARCHAR(64),
        PRIMARY KEY (ChunkID, FileID),
        FOREIGN KEY (FileID) REFERENCES File(FileID) ON DELETE CASCADE,
        FOREIGN KEY (ServerID, SlotID) REFERENCES StorageSlot(ServerID, SlotID)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create SharedItem table
    $pdo->exec("CREATE TABLE IF NOT EXISTS SharedItem (
        ItemID INT,
        OwnerID INT,
        RecieverID INT,
        AccessLevel ENUM('Read', 'Write', 'Admin') NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (ItemID, OwnerID, RecieverID),
        FOREIGN KEY (ItemID) REFERENCES Item(ItemID) ON DELETE CASCADE,
        FOREIGN KEY (OwnerID) REFERENCES User(UserID),
        FOREIGN KEY (RecieverID) REFERENCES User(UserID)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Create an SQL stored procedure to add a storage server with a specified
    // number of slots (Capacity) and set its AvailableSpace equal to Capacity
    // measured in number of chunks/slots.
    $pdo->exec("DROP PROCEDURE IF EXISTS AddStorageServer");
    $pdo->exec("CREATE PROCEDURE AddStorageServer(IN p_hostname VARCHAR(255), IN p_ip VARCHAR(45), IN p_capacity INT) BEGIN INSERT IGNORE INTO StorageServer (Hostname, IPAddress, Capacity, AvailableSpace) VALUES (p_hostname, p_ip, p_capacity, p_capacity); END");

    // Use the procedure to create three development servers with specified
    // capacities (number of chunk/slots): 4, 8, and 12.
    $pdo->exec("CALL AddStorageServer('server-4', '127.0.0.4', 2000)");
    $pdo->exec("CALL AddStorageServer('server-8', '127.0.0.8', 8)");
    $pdo->exec("CALL AddStorageServer('server-12', '127.0.0.12', 12)");

    // For convenience also add a 'localhost' development server (optional)
    $pdo->exec("CALL AddStorageServer('localhost', '127.0.0.1', 16)");

    // Create slots for each server by reading back their ServerID and Capacity
    $serverNames = ['server-4', 'server-8', 'server-12', 'localhost'];
    foreach ($serverNames as $name) {
        $row = $pdo->query("SELECT ServerID, Capacity FROM StorageServer WHERE Hostname = '" . addslashes($name) . "' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        if ($row && isset($row['ServerID']) && isset($row['Capacity'])) {
            $sid = (int)$row['ServerID'];
            $cap = (int)$row['Capacity'];
            for ($i = 1; $i <= $cap; $i++) {
                $stmt = $pdo->prepare("INSERT IGNORE INTO StorageSlot (ServerID, SlotID, IsAllocated) VALUES (?, ?, FALSE)");
                $stmt->execute([$sid, $i]);
            }
        }
    }
    
    echo "All tables created and initial data inserted successfully!\n";
    // Create a default admin user for development if not present
    $adminUsername = 'admin';
    $adminEmail = 'admin@gmail.com';
    $adminPassword = '1234';
    $existing = $pdo->prepare("SELECT UserID FROM `User` WHERE Username = ? OR Email = ? LIMIT 1");
    $existing->execute([$adminUsername, $adminEmail]);
    $row = $existing->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        $passwordHash = password_hash($adminPassword, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO `User` (Username, Email, PasswordHash) VALUES (?, ?, ?)");
        $ok = $stmt->execute([$adminUsername, $adminEmail, $passwordHash]);
        if ($ok) {
            $adminId = $pdo->lastInsertId();
            // create root/home directory for admin.user
            $stmt2 = $pdo->prepare("INSERT INTO Item (OwnerID, ParentItemID, ItemType, Name) VALUES (?, NULL, 'Folder', 'Home')");
            $stmt2->execute([$adminId]);
            $rootId = $pdo->lastInsertId();
            $stmt3 = $pdo->prepare("INSERT INTO Folder (FolderID) VALUES (?)");
            $stmt3->execute([$rootId]);
            echo "Admin user created: {$adminUsername} ({$adminEmail}) with default password '{$adminPassword}'\n";
        } else {
            echo "Failed to create admin user\n";
        }
    } else {
        echo "Admin user already exists (skipping creation)\n";
        // Ensure the existing admin has a root directory
        if (isset($row['UserID'])) {
            $adminId = intval($row['UserID']);
            $hasRoot = $pdo->prepare("SELECT ItemID FROM Item WHERE OwnerID = ? AND ParentItemID IS NULL LIMIT 1");
            $hasRoot->execute([$adminId]);
            $rootRow = $hasRoot->fetch(PDO::FETCH_ASSOC);
            if (!$rootRow) {
                $stmt2 = $pdo->prepare("INSERT INTO Item (OwnerID, ParentItemID, ItemType, Name) VALUES (?, NULL, 'Folder', 'Home')");
                $stmt2->execute([$adminId]);
                $rootId = $pdo->lastInsertId();
                $stmt3 = $pdo->prepare("INSERT INTO Folder (FolderID) VALUES (?)");
                $stmt3->execute([$rootId]);
                echo "Admin user root directory created for existing admin (ID: {$adminId})\n";
            }
        }
    }
    
} catch(PDOException $e) {
    die("Database initialization failed: " . $e->getMessage());
}
?>