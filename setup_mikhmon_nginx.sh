
#!/bin/bash

# Define the Nginx config file path
NGINX_CONF="/etc/nginx/sites-enabled/default"

# Backup the original config
cp $NGINX_CONF "$NGINX_CONF.bak"

# 1. Detect PHP-FPM Version (needed for fastcgi_pass)
PHP_SOCK=$(ls /run/php/php*-fpm.sock | head -n 1)
PHP_SOCK_NAME=$(basename $PHP_SOCK)

echo "Detected PHP Socket: $PHP_SOCK_NAME"

# 2. Prepare the location block to insert
# We use a temporary file to hold the block content
cat <<EOF > /tmp/mikhmon_nginx_block
    # --- Mikhmon Configuration ---
    location /mikhmon {
        alias /var/www/wipay-client/mikhmon;
        index index.php;
        try_files \$uri \$uri/ /mikhmon/index.php;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/$PHP_SOCK_NAME;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
        }
    }
    # -----------------------------
EOF

# 3. Inject the block into the Nginx config
# We look for the closing brace '}' of the server block.
# Assuming the file ends with '}',/ we insert before the last line.
# A safer bet is to insert before "location /uploads" if it exists, or just before the last line.

# Strategy: Read file, remove last line (closing brace of server block), append new block, add closing brace.
# Note: This assumes simplified default config structure.

# Let's try inserting after "location /uploads { ... }" block ends.
# Searching for the line 'location /uploads' is risky if indentation varies.
# BETTER: Insert before the LAST line of the file (which is usually the closing '}' of the server block).
# BUT, we need to be inside the server block.

# Simpler approach for user: Just append it ? No, must be inside server {}.

# Let's try sed to insert before the last line (which should be '}')
sed -i '$d' $NGINX_CONF
cat /tmp/mikhmon_nginx_block >> $NGINX_CONF
echo "}" >> $NGINX_CONF

# 4. Cleanup and Restart
rm /tmp/mikhmon_nginx_block
echo "Nginx configuration updated."

echo "Testing Nginx config..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Reloading Nginx..."
    systemctl reload nginx
    echo "✅ Success! Mikhmon should be accessible."
else
    echo "❌ Config check failed. Restoring backup..."
    cp "$NGINX_CONF.bak" $NGINX_CONF
    echo "Backup restored. Please check configuration manually."
fi
