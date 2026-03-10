#!/bin/bash

# Script to generate JWT secrets for Render deployment

echo "==================================="
echo "Generating JWT Secrets for Render"
echo "==================================="
echo ""

echo "Copy these values to your Render Environment Variables:"
echo ""

echo "JWT_SECRET="
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo ""

echo "JWT_REFRESH_SECRET="
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
