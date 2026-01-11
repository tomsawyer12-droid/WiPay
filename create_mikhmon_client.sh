
#!/bin/bash

# Configuration
MASTER_MIKHMON_DIR='/var/www/wipay-client/mikhmon'
CLIENT_NAME=$1

if [ -z "$CLIENT_NAME" ]; then
  echo "Usage: $0 <client_name>"
  exit 1
fi

DEST_DIR="$MASTER_MIKHMON_DIR/$CLIENT_NAME"

echo "Checking for Master Mikhmon at $MASTER_MIKHMON_DIR..."
if [ ! -d "$MASTER_MIKHMON_DIR" ]; then
  echo "❌ Error: Master Mikhmon folder not found at $MASTER_MIKHMON_DIR"
  echo "Please run install_mikhmon.sh first."
  exit 1
fi

echo "Creating Mikhmon client: $CLIENT_NAME..."
if [ -d "$DEST_DIR" ]; then
  echo "⚠️ Client folder already exists: $DEST_DIR"
else
  # Use rsync to avoid copying the destination into itself if destination is inside source
  # Note: rsync might not be installed, so we check or install it.
  if ! command -v rsync &> /dev/null; then
      echo "Installing rsync..."
      apt-get update && apt-get install -y rsync
  fi

  rsync -av --exclude="$CLIENT_NAME" "$MASTER_MIKHMON_DIR/" "$DEST_DIR/"
  echo "✅ Created client folder: $DEST_DIR"
fi

# Set permissions
chown -R www-data:www-data "$DEST_DIR"
chmod -R 755 "$DEST_DIR"
echo "✅ Setup Complete for $CLIENT_NAME"
