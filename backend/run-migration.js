const pool = require('./src/config/db');

async function runMigration() {
    try {
        console.log('Running migration: Add user_id for multi-store data isolation');

        // Add user_id to products table
        console.log('1. Adding user_id column to products table...');
        await pool.query(`
      ALTER TABLE products 
        ADD COLUMN user_id INT NULL AFTER product_id,
        ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    `);

        // Add user_id to cashflow table
        console.log('2. Adding user_id column to cashflow table...');
        await pool.query(`
      ALTER TABLE cashflow 
        ADD COLUMN user_id INT NULL AFTER entry_id,
        ADD CONSTRAINT fk_cashflow_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    `);

        // Create indexes
        console.log('3. Creating index on products.user_id...');
        await pool.query('CREATE INDEX idx_products_user ON products(user_id)');

        console.log('4. Creating index on cashflow.user_id...');
        await pool.query('CREATE INDEX idx_cashflow_user ON cashflow(user_id)');

        console.log('✓ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

runMigration();
