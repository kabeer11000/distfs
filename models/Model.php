<?php
/**
 * @file Model.php
 * @brief Base model class providing database connection and common operations
 *
 * This file implements a simple base class `Model` that other data models
 * extend. It centralizes common database operations such as finding rows by
 * primary key, executing custom queries and retrieving all rows with an
 * optional WHERE condition.
 *
 * @note This is intentionally lightweight and designed for demo/educational
 * use; production code may prefer a more robust ORM layer with query
 * builders, parameterized validation, and more advanced error handling.
 */

require_once __DIR__ . '/../config/database.php';

/**
 * @class Model
 * @brief Simple base model for database interaction
 *
 * Provides a PDO connection via the shared Database instance and small
 * helper methods used by the concrete models (User, Item, File, Chunk etc.).
 */
class Model {
    protected $db;
    protected $table;
    protected $primaryKey = 'id';
    
    /**
     * Constructor
     *
     * Initializes the PDO database connection from the central Database class
     * and stores it in $this->db.
     */
    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }
    
    /**
     * Find a record by primary key
     *
     * @param mixed $id Primary key value
     * @return array|false The fetched row as an assoc array or false on no result
     */
    public function find($id) {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$this->primaryKey} = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
    
    /**
     * Execute a parameterized SQL query and return the prepared statement.
     *
     * Use this method when a model requires a more complex query not provided
     * by the convenience methods on this class.
     *
     * @param string $sql Parameterized SQL statement
     * @param array $params Parameters for the prepared statement
     * @return PDOStatement The executed prepared statement
     */
    public function query($sql, $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
    
    /**
     * Retrieve all records from the model's table with an optional WHERE clause.
     *
     * @param string $where SQL WHERE clause (without the WHERE keyword); defaults to '1' (all rows)
     * @param array $params Parameters for the WHERE clause
     * @return array[] Array of associative arrays for each row
     */
    public function all($where = '1', $params = []) {
        $sql = "SELECT * FROM {$this->table} WHERE {$where}";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Return the underlying PDO connection used by the model.
     *
     * This is primarily intended for models that need to call stored
     * procedures or perform direct transactions.
     *
     * @return PDO The underlying PDO instance
     */
    public function getDb() {
        return $this->db;
    }
}
?>