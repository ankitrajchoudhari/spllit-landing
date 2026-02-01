# Admin System Setup Guide

## Current Status
The backend code for the subadmin management system is complete, but the database migration is blocked by Supabase connection pool limits.

## Manual Database Migration Required

Please run this SQL directly in Supabase SQL Editor:

```sql
-- Add new columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminStatus" TEXT DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_adminStatus_idx" ON "User"("adminStatus");

-- Set master admin (replace with your actual admin user ID)
UPDATE "User" SET 
    role = 'admin',
    "isAdmin" = true,
    "adminStatus" = 'active'
WHERE email = 'ankit@spllit.app';
```

## After Running SQL

1. **Regenerate Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   npm run build
   ```

2. **Deploy Backend:**
   ```bash
   git add .
   git commit -m "Add subadmin management system"
   git push origin main
   ```

3. **Access Admin Dashboard:**
   - Login as ankit@spllit.app
   - Navigate to Dashboard
   - You'll see the "Subadmin Management" section

## Features Implemented

### Backend API (`/api/subadmin/*`)
- ✅ **POST /create** - Create new subadmin with email validation
- ✅ **GET /list** - List all subadmins (excludes deleted)
- ✅ **PUT /:id/activate** - Activate inactive subadmin
- ✅ **PUT /:id/deactivate** - Deactivate active subadmin
- ✅ **DELETE /:id** - Soft delete (allows email reuse)
- ✅ **PUT /:id/update** - Update subadmin details

### Security Features
- ✅ Email domain validation (Gmail, Yahoo, Outlook, Zoho, Protonmail, iCloud, AOL, Mail.com, .edu domains)
- ✅ Master admin authentication required
- ✅ Password hashing with bcrypt
- ✅ Soft delete mechanism for email reuse
- ✅ Role-based access control
- ✅ Status management (active, inactive, deleted)

### Email Reuse Logic
When a subadmin is deleted:
1. Email is changed to `deleted_{timestamp}_{original_email}`
2. Status set to 'deleted'
3. Original email becomes available for new subadmin
4. Deleted admin can be found but email can be reused

### Frontend UI
- ✅ SubadminManagement component created
- ✅ Create subadmin modal with validation
- ✅ List view with status badges
- ✅ Activate/Deactivate toggle buttons
- ✅ Delete button (only shows for inactive admins)
- ✅ Real-time updates after actions

## Allowed Email Domains
- gmail.com
- yahoo.com / yahoo.co.in
- outlook.com / hotmail.com
- zoho.com
- protonmail.com
- icloud.com
- aol.com
- mail.com
- .edu (educational institutions)
- .ac.in (Indian academic institutions)

## Testing Checklist
- [ ] Run SQL migration in Supabase
- [ ] Regenerate Prisma client
- [ ] Build backend successfully
- [ ] Deploy to Railway
- [ ] Login as master admin
- [ ] Create test subadmin with Gmail
- [ ] Verify subadmin can login
- [ ] Deactivate subadmin
- [ ] Verify login blocked for deactivated
- [ ] Delete subadmin
- [ ] Create new subadmin with same email (should work)
- [ ] Test invalid email domain (should reject)

## Files Modified/Created

### Backend
- `backend/prisma/schema.prisma` - Added role, isAdmin, adminStatus, createdBy fields
- `backend/src/routes/subadmin.ts` - Complete subadmin management API (452 lines)
- `backend/src/server.ts` - Registered subadmin routes
- `backend/prisma/migrations/20260201102703_add_admin_system/migration.sql` - Migration file

### Frontend
- `src/components/SubadminManagement.jsx` - Full admin UI component

## Next Steps
1. Run the SQL migration above in Supabase SQL Editor
2. Run `cd backend && npx prisma generate && npm run build`
3. Deploy backend to Railway
4. Integrate SubadminManagement component into Dashboard
5. Test the complete workflow
