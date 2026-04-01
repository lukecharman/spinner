#!/bin/bash
set -e

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to load.rman.io..."
SFTP_PASS=$(security find-generic-password -s "ionos-sftp" -a "u53673156" -w 2>/dev/null)

if [ -z "$SFTP_PASS" ]; then
  echo "❌ Password not found in Keychain. Run:"
  echo '   security add-generic-password -s "ionos-sftp" -a "u53673156" -w'
  exit 1
fi

lftp -u u53673156,"$SFTP_PASS" sftp://home288482204.1and1-data.host -e "
  mirror --reverse --delete --verbose --parallel=4 dist/ /load.rman.io/
  quit
"

echo "✅ Live at https://load.rman.io"
