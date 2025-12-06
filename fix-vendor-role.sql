-- Fix old "vendor" role values to "vendor_admin"
UPDATE users SET role = 'vendor_admin' WHERE role = 'vendor';
