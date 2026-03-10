#!/bin/bash

# Quick Render Deployment Script
# This script helps you deploy your backend to Render

echo "======================================"
echo "  Spllit Backend - Render Deployment  "
echo "======================================"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

echo "✅ Backend directory detected"
echo ""

# Generate JWT secrets
echo "📝 Generating JWT Secrets..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

echo ""
echo "🔑 Your JWT Secrets (copy these to Render):"
echo "============================================"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""
echo "============================================"
echo ""

# Create a .env.render file with all required variables
cat > .env.render << EOF
# Render Environment Variables
# Copy these to your Render Dashboard > Environment tab

NODE_ENV=production
PORT=10000
DATABASE_URL=<REPLACE_WITH_YOUR_POSTGRESQL_URL>
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://spllit.app

# Optional - add if you have these services
# GOOGLE_MAPS_API_KEY=<your_google_maps_key>
# TWILIO_ACCOUNT_SID=<your_twilio_sid>
# TWILIO_AUTH_TOKEN=<your_twilio_token>
# TWILIO_PHONE_NUMBER=<your_twilio_number>
# SENDGRID_API_KEY=<your_sendgrid_key>
# SENDGRID_FROM_EMAIL=noreply@spllit.app
EOF

echo "✅ Created .env.render file with all variables"
echo ""

echo "📋 Next Steps:"
echo "============================================"
echo ""
echo "1. Go to your Render Dashboard:"
echo "   https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g"
echo ""
echo "2. Click 'Environment' tab"
echo ""
echo "3. Add all variables from .env.render file"
echo "   (The file has been created in this directory)"
echo ""
echo "4. Make sure to replace <REPLACE_WITH_YOUR_POSTGRESQL_URL>"
echo "   with your actual database URL"
echo ""
echo "5. Go to 'Settings' tab and verify:"
echo "   - Build Command: npm install && npx prisma generate && npm run build"
echo "   - Start Command: npx prisma migrate deploy && npm start"
echo "   - Health Check Path: /health"
echo ""
echo "6. Click 'Manual Deploy' → 'Deploy latest commit'"
echo ""
echo "7. Update your frontend to use:"
echo "   VITE_API_URL=https://srv-d6o6nji4d50c73fdl27g.onrender.com"
echo ""
echo "============================================"
echo ""
echo "📖 For detailed instructions, see RENDER_SETUP.md"
echo ""
echo "✨ Deployment preparation complete!"
echo ""
