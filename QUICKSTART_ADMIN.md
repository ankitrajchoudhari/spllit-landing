# 🚀 QUICK START - Run This SQL Now!

## Step 1: Copy This SQL

```sql
-- Add new columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminStatus" TEXT DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_adminStatus_idx" ON "User"("adminStatus");

-- Set master admin
UPDATE "User" SET 
    role = 'admin',
    "isAdmin" = true,
    "adminStatus" = 'active'
WHERE email = 'ankit@spllit.app';
```

## Step 2: Go to Supabase
https://supabase.com/dashboard → Your Project → SQL Editor → Paste SQL → Run

## Step 3: Build Backend
```bash
cd backend
npx prisma generate
npm run build
```

## Step 4: Deploy
```bash
git add .
git commit -m "Add admin system"
git push origin main
```

## Step 5: Test
1. Go to https://spllit.app
2. Login: ankit@spllit.app / Kurkure123@
3. See "Subadmin Management" section
4. Click "Add Subadmin"
5. Create one with Gmail/Yahoo/Outlook email
6. Done! 🎉

---

**Need help?** Check `SUBADMIN_IMPLEMENTATION_COMPLETE.md` for full details.
