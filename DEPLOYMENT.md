# Railway Deployment Guide for SERunner

## Prerequisites
- Railway account (logged in at railway.app)
- GitHub repository pushed (✅ Done)
- Anthropic API key

## Deployment Steps

### 1. Create New Railway Project

1. Go to [Railway.app](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Select your `SERunner` repository
5. Railway will create a new project

### 2. Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"**
3. Choose **"Add PostgreSQL"**
4. Railway will provision the database automatically
5. Note: The DATABASE_URL will be automatically available to your services

### 3. Deploy Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `SERunner` repository again
3. Configure the service:
   - **Service Name**: `backend`
   - **Root Directory**: `backend`
   - **Start Command**: (leave empty, Dockerfile will be used)

4. Add environment variables (Settings → Variables):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ANTHROPIC_API_KEY=<your-anthropic-api-key>
   JWT_SECRET=<generate-random-secret-key>
   FRONTEND_URL=<will-add-after-frontend-deployment>
   CLAUDE_MODEL=claude-sonnet-4-5-20250929
   ```

   **Generate JWT_SECRET** with:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. **Deploy**: Railway will auto-detect the Dockerfile and deploy
6. **Get Backend URL**: After deployment, copy the public URL (e.g., `https://backend-production-xxxx.up.railway.app`)

### 4. Deploy Frontend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `SERunner` repository again
3. Configure the service:
   - **Service Name**: `frontend`
   - **Root Directory**: `frontend`
   - **Start Command**: (leave empty, Dockerfile will be used)

4. Add environment variable (Settings → Variables):
   ```
   VITE_API_URL=<your-backend-url-from-step-3>
   ```

5. **Deploy**: Railway will auto-detect the Dockerfile and deploy
6. **Get Frontend URL**: After deployment, copy the public URL (e.g., `https://frontend-production-xxxx.up.railway.app`)

### 5. Update Backend FRONTEND_URL

1. Go back to **backend service** → Settings → Variables
2. Update `FRONTEND_URL` with your frontend URL from step 4
3. Redeploy backend (click **"Deploy"** button)

### 6. Run Database Migrations

After backend is deployed successfully:

**Option A: Via Railway CLI (Recommended)**
```bash
railway link
# Select your project and backend service
railway run alembic upgrade head
```

**Option B: Via Railway Dashboard**
1. Go to backend service → **Deployments**
2. Click on the latest deployment → **View Logs**
3. Click **"Open Shell"**
4. Run: `alembic upgrade head`

### 7. Verify Deployment

1. **Check Backend Health**: Visit https://backend-production-e55b3.up.railway.app/health
   - Should return: `{"status": "healthy"}`

2. **Check Database Status**: Visit https://backend-production-e55b3.up.railway.app/admin/db-status
   - Should show connected status and 5 tables

3. **Check API Docs**: Visit https://backend-production-e55b3.up.railway.app/docs
   - You should see the Swagger UI with all endpoints

4. **Run First-Time Setup**: Visit https://frontend-production-821b.up.railway.app/setup
   - Initialize database if needed, then continue to login

5. **Check Frontend**: Visit https://frontend-production-821b.up.railway.app
   - You should see the login page

6. **Test Registration**: Create a new account and test the flow

### 8. Custom Domain (Optional)

1. Go to frontend service → Settings → **Networking**
2. Click **"Generate Domain"** or add your own custom domain
3. Update backend's `FRONTEND_URL` if you add a custom domain

## Environment Variables Summary

### Backend Service
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=<random-secret-32-chars>
FRONTEND_URL=https://frontend-production-821b.up.railway.app
CLAUDE_MODEL=claude-sonnet-4-5-20250929
DEBUG=False
```

### Frontend Service
```bash
VITE_API_URL=https://backend-production-e55b3.up.railway.app
```

## Troubleshooting

### Backend won't start
- Check logs: Railway Dashboard → Backend Service → Deployments → Latest → View Logs
- Common issues:
  - Missing environment variables
  - Database connection failed (check DATABASE_URL)
  - Invalid ANTHROPIC_API_KEY

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly
- Check CORS settings: `FRONTEND_URL` in backend must match frontend URL
- Check browser console for CORS errors

### Database migration failed
- Ensure DATABASE_URL is correct
- Check if PostgreSQL service is running
- Run `railway logs` to see error details

### Claude API errors
- Verify ANTHROPIC_API_KEY is valid
- Check you have API credits remaining
- Ensure CLAUDE_MODEL is a valid model ID

## Quick Commands

```bash
# View logs for backend
railway logs --service backend

# View logs for frontend
railway logs --service frontend

# Run migrations
railway run alembic upgrade head --service backend

# Open shell in backend
railway shell --service backend

# Check service status
railway status
```

## Post-Deployment

1. **Test the flow**:
   - Register a new account
   - Create a location
   - Add some gear (optional)
   - Generate a mixer setup
   - Rate the setup

2. **Monitor usage**:
   - Railway Dashboard shows resource usage
   - Check Anthropic Console for API usage

3. **Backups**:
   - Railway PostgreSQL includes automatic backups
   - Export important setups regularly

## Next Steps

- Configure custom domain
- Set up GitHub Actions for CI/CD (optional)
- Add monitoring/alerts
- Invite other users (when ready for Phase 2)

## Project URLs

Production URLs:
- **Frontend**: https://frontend-production-821b.up.railway.app
- **Backend API**: https://backend-production-e55b3.up.railway.app
- **API Docs**: https://backend-production-e55b3.up.railway.app/docs
- **Setup Page**: https://frontend-production-821b.up.railway.app/setup
- **Health Check**: https://backend-production-e55b3.up.railway.app/health
- **DB Status**: https://backend-production-e55b3.up.railway.app/admin/db-status

## Support

If you encounter issues:
1. Check Railway logs
2. Verify all environment variables
3. Check GitHub repo has latest code
4. Review DEPLOYMENT.md troubleshooting section
