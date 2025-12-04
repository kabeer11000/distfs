<?php
/**
 * @file init_db.php
 * @brief Database initialization script for the DistFS demo environment.
 *
 * This script creates the database, tables, stored procedures, development
 * storage servers and slots, a default admin user, and a README file shared
 * with existing and future users.
 *
 * @warning This is intended for development/demo use only and will drop
 * and recreate tables — do NOT run in production without backups.
 */

require_once 'database.php';

/**
 * @brief Function to get the Project README content.
 * 
 * Returns the content of the README.md file as a string.
 * 
 * @return string README content
 */
function getReadmeContent() {
    return <<<README
# DistFS README

Welcome to the DistFS demo environment.

- This repository demonstrates a distributed chunk-backed filesystem.
- Files are split into 4KiB chunks and stored across emulated storage servers.
- Shared items are accessible under the '/shared' virtual folder.

Enjoy exploring!
README;
}



/**
 * @brief Clean up database objects before re-initializing the schema.
 *
 * Drops triggers, stored procedures and tables if they exist (development-only).
 * This keeps all DROP/cleanup logic centralized and avoids scattered DROP
 * statements throughout the script.
 *
 * @param PDO $pdo Active PDO connection (with or without FileStorageSystem selected)
 * @return void
 */
function cleanupDb(PDO $pdo)
{
    // Try to ensure we are using the proper database; ignore errors if the DB doesn't exist yet
    try {
        $pdo->exec("USE FileStorageSystem");
    } catch (PDOException $e) { /* ignore */ }

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Drop triggers
    $pdo->exec("DROP TRIGGER IF EXISTS after_user_insert_share_readme");

    // Drop procedures
    $procedures = ['AddStorageServer', 'HashPassword', 'RegisterUser', 'VerifyLogin', 'GetRandomUnallocatedSlots', 'CreateItem'];
    foreach ($procedures as $proc) {
        $pdo->exec("DROP PROCEDURE IF EXISTS ". $proc);
    }

    // Drop tables (order matters because of foreign keys)
    $tables = ['Chunk', '`File`', 'SharedItem', 'Folder', 'Item', 'StorageSlot', 'StorageServer', '`User`'];
    foreach ($tables as $t) {
        $pdo->exec("DROP TABLE IF EXISTS " . $t);
    }

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Also clean up storage directories
    $storagePath = __DIR__ . '/../storage/';
    if (is_dir($storagePath)) {
        $dirs = glob($storagePath . 'server*', GLOB_ONLYDIR);
        foreach ($dirs as $dir) {
            $files = glob($dir . '/*.chunk');
            foreach ($files as $file) {
                @unlink($file);
            }
            @rmdir($dir);
        }
    }
}

/**
 * @brief Run full initialization for the FileStorageSystem database.
 *
 * Performs the end-to-end initialization (development scenario):
 * - Creates the FileStorageSystem database (with utf8mb4/utf8mb4_unicode_ci defaults)
 * - Calls cleanupDb() to drop existing objects
 * - Creates tables and stored procedures
 * - Seeds development storage servers and slots
 * - Creates a default admin user and attaches a README shared with users
 *
 * @return void
 */
function runInitDb()
{
    try {
        // Connect to MySQL without specifying database (so we can create it)
        $pdo = new PDO(
            "mysql:host=localhost;port=3306",
            'root',
            '',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]
        );

        // Set server defaults for storage engine (attempt, may require privileges)
        try {
            $pdo->exec("SET GLOBAL default_storage_engine = 'InnoDB'");
        } catch (PDOException $e) {
            // Not critical in a shared environment; continue
        }

        // Create the database if it doesn't exist and switch to it
        $pdo->exec(<<<SQL
            CREATE DATABASE IF NOT EXISTS FileStorageSystem
            DEFAULT CHARACTER SET utf8mb4
            DEFAULT COLLATE utf8mb4_unicode_ci;
        SQL
        );
        echo "Database created successfully!\n";
        $pdo->exec("USE FileStorageSystem");

        // Clean up any existing DB objects (procedures, triggers, tables)
        cleanupDb($pdo);

        // All cleanup is handled by cleanupDb(), so no further DROP statements are needed here
    
        // Create User table

        /// @table User
        $pdo->exec(<<<SQL
            CREATE TABLE User (
                UserID       INT AUTO_INCREMENT PRIMARY KEY,
                Username     VARCHAR(50) NOT NULL,
                Email        VARCHAR(100) NOT NULL UNIQUE,
                PasswordHash VARCHAR(255) NOT NULL,
                CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_username (Username) -- Username must be unique (case-insensitive)
            );
        SQL
        );
    
        /// @table StorageServer
        $pdo->exec(<<<SQL
            CREATE TABLE StorageServer (
                ServerID        INT AUTO_INCREMENT PRIMARY KEY,
                Hostname        VARCHAR(255) NOT NULL,
                IPAddress       VARCHAR(45) NOT NULL,
                Capacity        INT NOT NULL,
                AvailableSpace  INT NOT NULL,

                UNIQUE KEY unique_hostname (Hostname) -- Each server must have a unique hostname
            );
        SQL
        );
    
        /// @table StorageSlot
        $pdo->exec(<<<SQL
            CREATE TABLE StorageSlot (
                ServerID    INT,
                SlotID      INT,
                IsAllocated BOOLEAN DEFAULT FALSE,

                PRIMARY KEY (ServerID, SlotID), -- a storage slot is uniquely identified by ServerID + SlotID
                FOREIGN KEY (ServerID) 
                    REFERENCES StorageServer(ServerID) 
                    ON DELETE CASCADE
            );
        SQL
        );
    
        /// @table Item
        $pdo->exec(<<<SQL
            CREATE TABLE Item (
                ItemID          INT AUTO_INCREMENT PRIMARY KEY,
                OwnerID         INT NOT NULL,
                ParentItemID    INT NULL,
                ItemType        ENUM('Folder', 'File') NOT NULL,
                Name            VARCHAR(255) NOT NULL,
                CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
                ModifiedAt      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                FOREIGN KEY (OwnerID) REFERENCES `User`(UserID),
                FOREIGN KEY (ParentItemID) 
                    REFERENCES Item(ItemID) 
                    ON DELETE CASCADE,

                UNIQUE KEY unique_parent_name (ParentItemID, Name) -- Unique names within the same folder
            );
        SQL
        );
    
        /// @table Folder
        /// Question: Is this really needed?
        /// @todo Consider removing Folder table if not needed
        $pdo->exec(<<<SQL
            CREATE TABLE Folder (
                FolderID INT PRIMARY KEY,

                FOREIGN KEY (FolderID) REFERENCES Item(ItemID) ON DELETE CASCADE
            );
        SQL
        );
    
        /// @table File
        $pdo->exec(<<<SQL
            CREATE TABLE File (
                FileID      INT PRIMARY KEY,
                Size        BIGINT DEFAULT 0,
                Extension   VARCHAR(20),
                ChunkCount  INT DEFAULT 0,

                FOREIGN KEY (FileID) 
                    REFERENCES Item(ItemID) 
                    ON DELETE CASCADE
            );
        SQL
        );
    
        /// @table Chunk
        $pdo->exec(<<<SQL
            CREATE TABLE Chunk (
                ChunkID     INT,
                FileID      INT,
                ServerID    INT,
                SlotID      INT,
                Checksum    VARCHAR(64),

                PRIMARY KEY (ChunkID, FileID), -- Chunks are uniquely identified by ChunkID + FileID
                FOREIGN KEY (FileID) 
                    REFERENCES File(FileID)
                    ON DELETE CASCADE,
                FOREIGN KEY (ServerID, SlotID) 
                    REFERENCES StorageSlot(ServerID, SlotID)
            );
        SQL
        );
    
        /// @table SharedItem
        $pdo->exec(<<<SQL
            CREATE TABLE SharedItem (
                ItemID          INT,
                OwnerID         INT,
                RecieverID      INT,
                AccessLevel     ENUM('Read', 'Write', 'Admin') NOT NULL,
                CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (ItemID, OwnerID, RecieverID), -- Unique share per item, owner, and receiver

                FOREIGN KEY (ItemID) 
                    REFERENCES Item(ItemID) 
                    ON DELETE CASCADE,
                FOREIGN KEY (OwnerID) 
                    REFERENCES User(UserID),
                FOREIGN KEY (RecieverID) 
                    REFERENCES User(UserID)
            );
        SQL
        );
    
        // Create an SQL stored procedure to add a storage server with a specified
        // number of slots (Capacity) and set its AvailableSpace equal to Capacity
        // measured in number of chunks/slots.
        // Also update the StorageSlot table to create the individual slots.
        // @procedure AddStorageServer
        $pdo->exec(<<<SQL
            CREATE PROCEDURE AddStorageServer(IN p_hostname VARCHAR(255), IN p_ip VARCHAR(45), IN p_capacity INT)
            BEGIN
                DECLARE v_serverID INT;
                DECLARE v_slotID INT DEFAULT 1;

                INSERT IGNORE INTO StorageServer (Hostname, IPAddress, Capacity, AvailableSpace)
                VALUES (p_hostname, p_ip, p_capacity, p_capacity);

                -- Update StorageSlot table to create individual slots 
                SELECT ServerID INTO v_serverID FROM StorageServer WHERE Hostname = p_hostname LIMIT 1;

                WHILE v_slotID <= p_capacity DO
                    INSERT IGNORE INTO StorageSlot (ServerID, SlotID, IsAllocated)
                    VALUES (v_serverID, v_slotID, FALSE);
                    SET v_slotID = v_slotID + 1;
                END WHILE;
            END
        SQL
        );

        // Create password hashing stored procedure using SHA2-256
        // @procedure HashPassword
        $pdo->exec(<<<SQL
            CREATE PROCEDURE HashPassword(
                IN p_password         VARCHAR(255),
                OUT p_hashed_password VARCHAR(64)
            )
            BEGIN
                SET p_hashed_password = SHA2(p_password, 256);
            END
        SQL
        );

        // Create user registration stored procedure
        // @procedure RegisterUser
        $pdo->exec(<<<SQL
            CREATE PROCEDURE RegisterUser(
                IN p_username   VARCHAR(50),
                IN p_email      VARCHAR(100),
                IN p_password   VARCHAR(255),
                OUT p_userID    INT,
                OUT p_error     VARCHAR(255)
            )
            BEGIN
                DECLARE v_passwordHash VARCHAR(64);
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    GET DIAGNOSTICS CONDITION 1 p_error = MESSAGE_TEXT;
                    SET p_userID = NULL;
                    ROLLBACK;
                END;

                START TRANSACTION;

                IF EXISTS(
                    -- Check for existing username or email (case-insensitive)
                    SELECT 1 FROM User WHERE Username  = p_username OR Email = p_email
                ) THEN
                    -- If they already exist, return an error message
                    SET p_error = 'Username or email already exists';
                    SET p_userID = NULL; -- Indicate failure
                    ROLLBACK; -- Abort transaction
                ELSE -- In case of no conflicts, create the user
                    -- Hash the password
                    CALL HashPassword(p_password, v_passwordHash);

                    -- Insert into the user table
                    INSERT INTO User (Username, Email, PasswordHash) VALUES (p_username, p_email, v_passwordHash);


                    SET p_userID = LAST_INSERT_ID();
                    SET p_error = NULL;

                    -- Create the user's root directory
                    INSERT INTO Item (OwnerID, ParentItemID, ItemType, Name) VALUES (p_userID, NULL, 'Folder', 'Home');
                    SET @rootID = LAST_INSERT_ID();
                    INSERT INTO Folder (FolderID) VALUES (@rootID);
                    COMMIT; -- Commit transaction
                END IF;
            END
        SQL
        );

        // Create login verification stored procedure
        // @procedure VerifyLogin
        $pdo->exec(<<<SQL
            CREATE PROCEDURE VerifyLogin(
                IN p_username VARCHAR(50),
                IN p_password VARCHAR(255),
                OUT p_userID  INT,
                OUT p_email   VARCHAR(100),
                OUT p_success BOOLEAN
            )
            BEGIN
                DECLARE v_storedHash VARCHAR(64);
                DECLARE v_providedHash VARCHAR(64);

                -- Select user info
                SELECT UserID, Email, PasswordHash INTO p_userID, p_email, v_storedHash 
                FROM User WHERE Username = p_username 
                LIMIT 1; -- Technically only one row should be fetched...

                -- If no such user, fail
                IF p_userID IS NULL THEN
                    SET p_success = FALSE;
                ELSE
                    -- Hash the provided password
                    CALL HashPassword(p_password, v_providedHash);

                    -- If the hashes match, login is successful
                    IF v_storedHash = v_providedHash THEN 
                        SET p_success = TRUE;
                    ELSE
                        -- Login failed
                        SET p_success = FALSE;
                        SET p_userID = NULL;
                        SET p_email = NULL;
                    END IF;
                END IF;
            END
        SQL
        );

        // Procedure to get N random unallocated slot
        // @procedure GetRandomUnallocatedSlots 
        $pdo->exec(<<<SQL
            CREATE PROCEDURE GetRandomUnallocatedSlots(
                IN p_count INT  
            )
            BEGIN
                SELECT ServerID, SlotID  FROM StorageSlot 
                WHERE IsAllocated = FALSE 
                ORDER BY RAND() LIMIT p_count;
            END
        SQL
        );

        // Procedure to create an Item and associated Folder or File record
        // @procedure CreateItem
        $pdo->exec(<<<SQL
            CREATE PROCEDURE CreateItem(
                IN p_ownerID INT,
                IN p_parentItemID INT,
                IN p_itemType ENUM('Folder', 'File'),
                IN p_name VARCHAR(255),
                OUT p_itemID INT
            )
            BEGIN
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    SET p_itemID = NULL;
                END;

                START TRANSACTION;
                
                -- Insert into Item
                INSERT INTO Item (OwnerID, ParentItemID, ItemType, Name)
                VALUES (p_ownerID, p_parentItemID, p_itemType, p_name);
                
                SET p_itemID = LAST_INSERT_ID();
                
                -- Insert into Folder or File
                IF p_itemType = 'Folder' THEN
                    INSERT INTO Folder (FolderID) VALUES (p_itemID);
                ELSEIF p_itemType = 'File' THEN
                    INSERT INTO File (FileID) VALUES (p_itemID);
                END IF;
                
                COMMIT;
            END
        SQL
        );



        // Create slots for each server by reading back their ServerID and Capacity via associative array
        $serverNames = [
            'server-A' => 20,
            'server-B' => 30,
            'server-C' => 50,
        ];

        $ipSuffixBase = 4; // Start from 127.0.0.4 for the first server
        $i = 0;
        foreach ($serverNames as $name => $capacity) {
            // Add storage server using stored procedure
            $ipSuffix = $ipSuffixBase + $i;
            $pdo->exec("CALL AddStorageServer('{$name}', '127.0.0." . $ipSuffix . "', {$capacity})");
            $i++;
        }
    
        echo "All tables created and initial data inserted successfully!\n";
        
        // Create a default admin user for development if not present using stored procedure
        $adminUsername = 'admin';
        $adminEmail = 'admin@gmail.com';
        $adminPassword = '1234';

        // Call the stored procedure
        $stmt = $pdo->prepare("CALL RegisterUser(?, ?, ?, @userID, @error)");
        $stmt->execute([$adminUsername, $adminEmail, $adminPassword]);

        // Read output parameters
        $result = $pdo->query("SELECT @userID AS userID, @error AS error")->fetch(PDO::FETCH_ASSOC);

        if ($result['userID']) {
            $adminId = intval($result['userID']);
            echo "Admin user created using stored procedure: {$adminUsername} ({$adminEmail}) with default password '{$adminPassword}'\n";
        } else {
            echo "Failed to create admin user: " . ($result['error'] ?? 'Unknown error') . "\n";
        }


        // Create a README.md owned by admin and share it with all users (read-only)
        try {
            // Admin user and root folder (assumed to exist)
            $adminID   = (int)$pdo->query("SELECT UserID FROM `User` WHERE Username='admin'")->fetchColumn();
            $adminRoot = (int)$pdo->query("SELECT ItemID FROM Item WHERE OwnerID={$adminID} AND ParentItemID IS NULL")->fetchColumn();

            // README content
            $readmeContent = getReadmeContent();
            $chunkSize     = 4096;
            $chunks        = str_split($readmeContent, $chunkSize);
            $chunkCount    = count($chunks);

            // Create README.md file entry
            $pdo->prepare(<<<SQL
                INSERT INTO Item (OwnerID, ParentItemID, ItemType, Name) VALUES (?, ?, 'File', 'README.md')
            SQL
            )->execute([$adminID, $adminRoot]);

            $readmeItemID = $pdo->lastInsertId();

            // File metadata
            $pdo->prepare(<<<SQL
                INSERT INTO `File` (FileID, Size, Extension, ChunkCount) VALUES (?, ?, 'md', ?)
            SQL
            )->execute([$readmeItemID, strlen($readmeContent), $chunkCount]);

            // Fetch random unallocated slots
            $stmt = $pdo->prepare("CALL GetRandomUnallocatedSlots(?)");
            $stmt->execute([$chunkCount]);
            $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $stmt->closeCursor();  // <-- important

            if (count($slots) < $chunkCount) throw new Exception("Not enough free slots to store README.md");

            // Prepare statements
            $allocateStmt     = $pdo->prepare("UPDATE StorageSlot SET IsAllocated = TRUE WHERE ServerID=? AND SlotID=?");
            $updateServerStmt = $pdo->prepare("UPDATE StorageServer SET AvailableSpace = AvailableSpace - 1 WHERE ServerID=?");
            $insertChunkStmt  = $pdo->prepare("INSERT INTO Chunk (ChunkID, FileID, ServerID, SlotID, Checksum) VALUES (?, ?, ?, ?, ?)");

            // Write chunks to storage servers
            foreach ($chunks as $i => $data) {
                $serverID = $slots[$i]['ServerID'];
                $slotID   = $slots[$i]['SlotID'];

                $allocateStmt->execute([$serverID, $slotID]);
                $updateServerStmt->execute([$serverID]);

                $storageDir  = __DIR__ . "/../storage/server{$serverID}";
                if (!is_dir($storageDir)) mkdir($storageDir, 0775, true);

                $storagePath = "{$storageDir}/{$slotID}.chunk";
                file_put_contents($storagePath, $data, LOCK_EX);

                $checksum = hash('sha256', $data);
                $insertChunkStmt->execute([$i + 1, $readmeItemID, $serverID, $slotID, $checksum]);
            }

            // Create trigger so README is shared with any future user automatically
            // @trigger after_user_insert_share_readme
            $pdo->exec(<<<SQL
                CREATE TRIGGER after_user_insert_share_readme
                AFTER INSERT ON User FOR EACH ROW
                BEGIN
                    INSERT IGNORE INTO SharedItem (ItemID, OwnerID, RecieverID, AccessLevel)
                    VALUES ({$readmeItemID}, {$adminID}, NEW.UserID, 'Read');
                END
            SQL
            );
        } catch (Exception $e) { echo "Warning: Failed to create README: " . $e->getMessage() . "\n"; }
    } catch(PDOException $e) { die("Database initialization failed: " . $e->getMessage()); }
}

// Execute the initialization when this script is executed directly
runInitDb();

?>