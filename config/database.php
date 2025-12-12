<?php
// Database configuration file
// config/database.php

class Database {
    private static $instance = null;
    private $connection;

    // Database configuration
    private $host = 'localhost';
    private $port = 3306; // Default MySQL port
    private $dbname = 'FileStorageSystem';
    private $username = 'root'; // Default for local installation
    private $password = ''; // Default for local installation

    private function __construct() {
        try {
            // Create PDO connection
            $this->connection = new PDO(
                "mysql:host={$this->host};port={$this->port};dbname={$this->dbname}",
                $this->username,
                $this->password,
                array(
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"
                )
            );
        } catch(PDOException $e) {
            die("Connection failed: " . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->connection;
    }

    // Prevent cloning
    private function __clone() {}

    // Prevent unserialization - make it public as required by PHP
    public function __wakeup() {}
}
?>