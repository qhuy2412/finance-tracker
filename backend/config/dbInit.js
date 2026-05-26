const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * Automatically initializes the database schema and default categories seed.
 * Executed once during backend application startup.
 */
const initDatabase = async () => {
    try {
        console.log('[DB_INIT] Starting automatic database schema verification/migration...');
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (!fs.existsSync(schemaPath)) {
            console.warn(`[DB_INIT] WARNING: Schema file not found at ${schemaPath}. Skipping automatic migration.`);
            return;
        }

        // Read the schema.sql file content
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split queries by semicolon ';', clean whitespaces, and ignore empty/comment lines
        const queries = schemaSql
            .split(';')
            .map(query => query.trim())
            .filter(query => query.length > 0 && !query.startsWith('--') && !query.startsWith('/*'));

        const connection = await db.getConnection();
        try {
            // Execute each SQL query sequentially inside a transaction-safe flow
            for (let query of queries) {
                const upperQuery = query.toUpperCase();

                // Skip database creation or selection queries because Node connection pool
                // is already established and targeted to process.env.DB_NAME.
                if (upperQuery.startsWith('CREATE DATABASE') || upperQuery.startsWith('USE')) {
                    continue;
                }

                // Execute the SQL statement
                await connection.query(query);
            }
            console.log('[DB_INIT] Database migration completed successfully! All tables verified/created.');
        } catch (queryError) {
            console.error('[DB_INIT] Database migration failed during query execution.');
            console.error('[DB_INIT] Failed Query:', queryError.sql || 'Unknown Query');
            console.error('[DB_INIT] Error Message:', queryError.message);
            throw queryError;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[DB_INIT] Database migration aborted due to connection or file error:', error.message || error);
    }
};

module.exports = initDatabase;
