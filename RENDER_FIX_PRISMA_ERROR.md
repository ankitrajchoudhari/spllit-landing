# 🔧 Fixing Prisma Schema Not Found Error

## Problem

Your Render deployment failed with:
```
Error: Could not find Prisma Schema that is required for this command.
```

## Root Cause

Your repository has a monorepo structure:
- Repository root: `/`
- Backend code: `/backend/`
- Prisma schema: `/backend/prisma/schema.prisma`

Render is looking in the repository root, but your backend code is in the `backend/` folder.

## Solution: Set Root Directory

### Method 1: Render Dashboard (Quickest - 2 minutes)

1. **Go to:** https://dashboard.render.com/web/srv-d6o6nji4d50c73fdl27g

2. **Click "Settings" tab** (left sidebar)

3. **Scroll to "Build & Deploy"**

4. **Find "Root Directory"** field

5. **Enter:** `backend`
   
   ⚠️ Type exactly: `backend` (no slashes, lowercase)

6. **Click "Save Changes"** button at bottom

7. **Verify these settings while you're there:**
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm start`
   - Node Version: 20 (or leave default)

8. **Important:** After saving, go to "Manual Deploy" tab

9. **Click "Clear build cache & deploy"** (not just "Deploy latest commit")
   - This ensures a clean build with new settings

10. **Watch the logs** - you should now see:
    ```
    ==> Cloning from https://github.com/...
    ==> Checking out commit 0b06acc...
    ==> Using root directory: backend  ← Should see this!
    ==> Running build command: npm install && npx prisma generate...
    ✓ Prisma schema loaded from prisma/schema.prisma
    ```

---

### Method 2: Use render.yaml (If creating new service)

The `render.yaml` file has been updated with `rootDir: backend`.

If you were creating a NEW service, you could use the Blueprint feature:
1. Dashboard → New → Blueprint
2. Select your repository
3. Render auto-detects `render.yaml`
4. Click "Apply"

But since your service already exists, **use Method 1 above**.

---

## After Fixing

Once you set the Root Directory and redeploy, the build should succeed:

```
✅ Installing dependencies...
✅ Generating Prisma Client...
✅ Building TypeScript...
✅ Running migrations...
✅ Starting server...
✅ Health check passed!
==> Deploy live!
```

Test with:
```bash
curl https://srv-d6o6nji4d50c73fdl27g.onrender.com/health
```

---

## Still Having Issues?

### Issue: "prisma: command not found"

**Solution:** Ensure `prisma` is in `devDependencies` (already correct in your package.json)

### Issue: "Cannot find module '@prisma/client'"

**Solution:** Run `npx prisma generate` is in build command (already correct)

### Issue: Build command runs but schema still not found

**Solution:** 
1. Double-check Root Directory is exactly: `backend`
2. Make sure you clicked "Clear build cache & deploy"
3. Check the logs for "Using root directory: backend"

### Issue: Different error now

**Common next error:** "DATABASE_URL environment variable not set"

**Solution:** You need to add DATABASE_URL environment variable
- Go to Environment tab
- Add `DATABASE_URL` with your PostgreSQL connection string
- See [CONNECT_TO_RENDER.md](../CONNECT_TO_RENDER.md) Phase 3 for database setup

---

## Quick Checklist

Before redeploying:
- [x] Code pushed to GitHub (commit 0b06acc)
- [ ] Root Directory set to `backend` in Render Settings
- [ ] Build command correct
- [ ] Start command correct
- [ ] Environment variables added (especially DATABASE_URL)
- [ ] Deploy with "Clear build cache"

---

**This should fix your Prisma schema error!** Follow the steps above and redeploy. 🚀
