#!/bin/bash

# Sync lib files to all frameworks
# For Next.js, replace import.meta.dirname with __dirname (CommonJS compatibility)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Syncing lib files to frameworks..."

# Copy types.ts to all frameworks (no modifications needed)
cp "$SCRIPT_DIR/types.ts" "$ROOT_DIR/next/src/lib/types.ts"
cp "$SCRIPT_DIR/types.ts" "$ROOT_DIR/react-router/app/lib/types.ts"
cp "$SCRIPT_DIR/types.ts" "$ROOT_DIR/tanstack/src/lib/types.ts"
echo "  types.ts -> all frameworks"

# Copy db.ts to React Router and TanStack (ESM - no modifications)
cp "$SCRIPT_DIR/db.ts" "$ROOT_DIR/react-router/app/lib/db.ts"
cp "$SCRIPT_DIR/db.ts" "$ROOT_DIR/tanstack/src/lib/db.ts"
echo "  db.ts -> react-router, tanstack (ESM)"

# Copy db.ts to Next.js with import.meta.dirname -> __dirname replacement (CommonJS)
sed 's/import\.meta\.dirname/__dirname/g' "$SCRIPT_DIR/db.ts" > "$ROOT_DIR/next/src/lib/db.ts"
echo "  db.ts -> next (CommonJS, __dirname)"

echo "Done!"
