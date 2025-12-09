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
    
    // Create User table
    $pdo->exec("CREATE TABLE IF NOT EXISTS User (
        UserID INT AUTO_INCREMENT PRIMARY KEY,
        Username VARCHAR(50) NOT NULL,
        Email VARCHAR(100) NOT NULL UNIQUE,
        PasswordHash VARCHAR(255) NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Create StorageServer table
    $pdo->exec("CREATE TABLE IF NOT EXISTS StorageServer (
        ServerID INT AUTO_INCREMENT PRIMARY KEY,
        Hostname VARCHAR(255) NOT NULL,
        IPAddress VARCHAR(45) NOT NULL,
        Capacity BIGINT NOT NULL,
        AvailableSpace BIGINT NOT NULL
    )");
    
    // Create StorageSlot table
    $pdo->exec("CREATE TABLE IF NOT EXISTS StorageSlot (
        ServerID INT,
        SlotID INT,
        IsAllocated BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (ServerID, SlotID),
        FOREIGN KEY (ServerID) REFERENCES StorageServer(ServerID) ON DELETE CASCADE
    )");
    
    // Create Item table
    $pdo->exec("CREATE TABLE IF NOT EXISTS Item (
        ItemID INT AUTO_INCREMENT PRIMARY KEY,
        OwnerID INT NOT NULL,
        ParentItemID INT NULL,
        ItemType ENUM('Folder', 'File') NOT NULL,
        Name VARCHAR(255) NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        ModifiedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (OwnerID) REFERENCES User(UserID),
        FOREIGN KEY (ParentItemID) REFERENCES Item(ItemID) ON DELETE CASCADE
    )");
    
    // Create Folder table
    $pdo->exec("CREATE TABLE IF NOT EXISTS Folder (
        FolderID INT PRIMARY KEY,
        FOREIGN KEY (FolderID) REFERENCES Item(ItemID) ON DELETE CASCADE
    )");
    
    // Create File table
    $pdo->exec("CREATE TABLE IF NOT EXISTS File (
        FileID INT PRIMARY KEY,
        Size BIGINT DEFAULT 0,
        Extension VARCHAR(20),
        ChunkCount INT DEFAULT 0,
        FOREIGN KEY (FileID) REFERENCES Item(ItemID) ON DELETE CASCADE
    )");
    
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
    )");
    
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
    )");
    
    // Insert a default storage server for development
    $stmt = $pdo->prepare("INSERT IGNORE INTO StorageServer (Hostname, IPAddress, Capacity, AvailableSpace) VALUES (?, ?, ?, ?)");
    $stmt->execute(['localhost', '127.0.0.1', 1073741824, 1073741824]); // 1GB capacity
    
    // Insert slots for the default server
    for ($i = 1; $i <= 1000; $i++) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO StorageSlot (ServerID, SlotID, IsAllocated) VALUES (?, ?, FALSE)");
        $stmt->execute([1, $i]);
    }
    
    echo "All tables created and initial data inserted successfully!\n";
    
} catch(PDOException $e) {
    die("Database initialization failed: " . $e->getMessage());
}
?>