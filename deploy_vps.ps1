param(
    [string]$User = "root",
    [string]$Ip,
    [string]$KeyPath
)

if (-not $Ip) {
    Write-Error "Usage: .\deploy_vps.ps1 -User <user> -Ip <ip_address> -KeyPath <path_to_private_key>"
    exit 1
}

$ErrorActionPreference = "Stop"

Write-Host "📦 Packaging files..." -ForegroundColor Cyan
# Create tarball using standard Windows tar (bsdtar)
# Excludes node_modules, .env, .git
tar -czf deploy.tar.gz client server --exclude "node_modules" --exclude ".env" --exclude ".git"

if (-not (Test-Path "deploy.tar.gz")) {
    Write-Error "Failed to create deploy.tar.gz"
    exit 1
}

Write-Host "🚀 Uploading to $Ip..." -ForegroundColor Cyan
scp -i $KeyPath deploy.tar.gz "$User@$Ip:/tmp/deploy.tar.gz"

Write-Host "🛠️  Deploying on Remote Server..." -ForegroundColor Cyan
$remoteCommands = @"
    echo '1. Extracting Update...'
    mkdir -p /tmp/wipay_update
    tar -xzf /tmp/deploy.tar.gz -C /tmp/wipay_update

    echo '2. Copying Files...'
    # Use rsync if available for safety, or cp
    cp -r /tmp/wipay_update/client/* /var/www/wipay-client/
    cp -r /tmp/wipay_update/server/* /var/www/wipay-server/

    echo '3. Running Database Migration...'
    cd /var/www/wipay-server
    # Run the isolation migration script
    node src/utils/migrate_routers_isolation.js

    echo '4. Restarting Backend...'
    pm2 restart wipay-backend

    echo '5. Cleanup...'
    rm -rf /tmp/deploy.tar.gz /tmp/wipay_update

    echo '✅ Deployment Complete!'
"@

ssh -i $KeyPath "$User@$Ip" $remoteCommands

Write-Host "🎉 Done!" -ForegroundColor Green
Remove-Item "deploy.tar.gz" -ErrorAction SilentlyContinue
