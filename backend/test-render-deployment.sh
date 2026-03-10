#!/bin/bash

# Test Render Backend Deployment
# This script tests if your Render backend is working correctly

RENDER_URL="https://srv-d6o6nji4d50c73fdl27g.onrender.com"

echo "======================================"
echo "  Testing Render Backend Deployment   "
echo "======================================"
echo ""
echo "Backend URL: $RENDER_URL"
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
echo "GET $RENDER_URL/health"
echo ""

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$RENDER_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed!"
    echo "Response: $RESPONSE_BODY"
else
    echo "❌ Health check failed!"
    echo "HTTP Code: $HTTP_CODE"
    echo "Response: $RESPONSE_BODY"
fi

echo ""
echo "======================================"
echo ""

# Test 2: CORS Headers
echo "Test 2: CORS Configuration"
echo "-------------------------"
echo "Checking CORS headers..."
echo ""

CORS_RESPONSE=$(curl -s -I -H "Origin: https://spllit.app" "$RENDER_URL/health")

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
    echo "✅ CORS headers present!"
    echo "$CORS_RESPONSE" | grep -i "access-control"
else
    echo "⚠️  CORS headers not found (may be configured differently)"
fi

echo ""
echo "======================================"
echo ""

# Test 3: API Endpoint
echo "Test 3: API Endpoint Test"
echo "------------------------"
echo "Testing auth endpoint..."
echo ""

API_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://spllit.app" \
  "$RENDER_URL/api/auth/login" \
  -d '{"email":"test@example.com","password":"test"}')

API_HTTP_CODE=$(echo "$API_RESPONSE" | tail -n1)
API_RESPONSE_BODY=$(echo "$API_RESPONSE" | sed '$d')

if [ "$API_HTTP_CODE" = "200" ] || [ "$API_HTTP_CODE" = "400" ] || [ "$API_HTTP_CODE" = "401" ]; then
    echo "✅ API endpoint responding!"
    echo "HTTP Code: $API_HTTP_CODE"
    echo "Response: $API_RESPONSE_BODY"
else
    echo "❌ API endpoint not responding correctly"
    echo "HTTP Code: $API_HTTP_CODE"
    echo "Response: $API_RESPONSE_BODY"
fi

echo ""
echo "======================================"
echo ""

# Summary
echo "Summary:"
echo "--------"
echo ""
echo "Backend URL: $RENDER_URL"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Your backend is deployed and running!"
    echo ""
    echo "Next steps:"
    echo "1. Update frontend environment variables:"
    echo "   VITE_API_URL=$RENDER_URL/api"
    echo "   VITE_SOCKET_URL=$RENDER_URL"
    echo ""
    echo "2. Test Socket.IO connection from your frontend"
    echo ""
    echo "3. Monitor logs in Render Dashboard"
else
    echo "❌ Backend not responding correctly"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check Render Dashboard for deployment status"
    echo "2. Review build and runtime logs"
    echo "3. Verify environment variables are set"
    echo "4. Ensure DATABASE_URL is configured"
fi

echo ""
echo "======================================"
echo ""
