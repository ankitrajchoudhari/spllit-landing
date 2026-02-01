#!/bin/bash

echo "🔄 Setting up master admin (with retries)..."
echo ""

MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    PGPASSWORD='Kurkure123@' psql -h aws-1-ap-south-1.pooler.supabase.com \
        -U postgres.yocsvbxahwccuhydvxiv \
        -d postgres \
        -p 5432 \
        -c "CREATE INDEX IF NOT EXISTS \"User_role_idx\" ON \"User\"(\"role\"); 
            CREATE INDEX IF NOT EXISTS \"User_adminStatus_idx\" ON \"User\"(\"adminStatus\");
            UPDATE \"User\" SET role = 'admin', \"isAdmin\" = true, \"adminStatus\" = 'active' 
            WHERE email = 'ankit@spllit.app';
            SELECT name, email, role, \"isAdmin\", \"adminStatus\" FROM \"User\" 
            WHERE email = 'ankit@spllit.app';"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Master admin setup complete!"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        WAIT_TIME=$((10 + RETRY_COUNT * 5))
        echo "⏳ Waiting ${WAIT_TIME} seconds before retry..."
        sleep $WAIT_TIME
    fi
done

echo ""
echo "❌ Failed after $MAX_RETRIES attempts."
echo "📝 You can run this script again later: ./backend/setup-master-admin.sh"
echo ""
echo "Or run manually in Supabase SQL Editor:"
echo "UPDATE \"User\" SET role = 'admin', \"isAdmin\" = true, \"adminStatus\" = 'active' WHERE email = 'ankit@spllit.app';"
exit 1
