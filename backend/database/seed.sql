-- Optional: Seed a demo user for testing
-- Password: demo123 (bcrypt hashed)

USE photo_billing;

INSERT INTO users (name, email, password) VALUES
('Demo User', 'demo@example.com', '$2a$10$rQZ8K8K8K8K8K8K8K8K8KuK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K')
ON DUPLICATE KEY UPDATE name = name;

-- Note: Replace the password hash above with actual bcrypt hash of 'demo123'
-- You can generate one via: node -e "console.log(require('bcryptjs').hashSync('demo123', 10))"
