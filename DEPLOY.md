# Deploying FlashForge to Vercel

This guide walks you through deploying FlashForge to Vercel in under 5 minutes.

## Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free tier is perfect)
- Your FlashForge code pushed to a GitHub repository

## Method 1: Deploy via Vercel Dashboard (Recommended)

This is the easiest method - no CLI required.

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/your-username/flashforge.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your FlashForge repository
5. Vercel will automatically detect it's a Vite project
6. Click **"Deploy"**

That's it! Your app will be live at `your-project-name.vercel.app` in about 60 seconds.

### Step 3: Configure Custom Domain (Optional)

1. In your Vercel project dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Follow the DNS configuration instructions
4. Wait for DNS propagation (usually 5-30 minutes)

## Method 2: Deploy via Vercel CLI

If you prefer the command line:

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Deploy

```bash
# Login to Vercel
vercel login

# Deploy (follow the prompts)
vercel

# Or deploy directly to production
vercel --prod
```

## Method 3: Deploy Button

Add this to your GitHub README to let others deploy with one click:

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/flashforge)
```

## Configuration

### Build Settings (Auto-Detected)

Vercel will automatically use these settings:

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables

FlashForge doesn't need any environment variables for basic functionality. Everything runs client-side with localStorage.

If you add authentication or cloud features later, you can add environment variables in:
**Project Settings** → **Environment Variables**

## Automatic Deployments

Once connected to GitHub, Vercel will:

- ✅ Deploy every push to `main` branch (production)
- ✅ Create preview deployments for pull requests
- ✅ Run build checks before deploying
- ✅ Provide deployment URLs for testing

## Vercel Edge Network

Your app will be served from Vercel's global Edge Network, providing:

- 🌍 Fast loading worldwide
- 🔒 Automatic HTTPS
- 💨 Compressed assets
- 🔄 Instant cache invalidation

## Monitoring & Analytics

Enable Vercel Analytics for insights:

1. Go to your project dashboard
2. Click **"Analytics"** tab
3. Enable Vercel Analytics
4. Get insights on page views, performance, and Web Vitals

## Troubleshooting

### Build Failed

If the build fails on Vercel:

1. Check that `npm run build` works locally
2. Ensure all dependencies are in `package.json` (not just `devDependencies`)
3. Check the build logs in Vercel dashboard for specific errors

### 404 on Routes

If you see 404 errors:
- This shouldn't happen with FlashForge since it's a single-page app
- If you add routing later, create a `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Fonts Not Loading

If custom fonts aren't loading:
- Ensure font files are in the `public` folder or loaded from Google Fonts
- Check that paths are relative (not absolute)
- Verify CORS headers if loading from external source

## Performance Tips

### Optimize Images

Before deploying, optimize any images:
- Use WebP format for photos
- Compress to 80% quality
- Resize to max display dimensions

### Enable Compression

Vercel automatically compresses assets, but you can optimize further:
- Remove unused dependencies
- Code-split large libraries
- Use dynamic imports for heavy components

## Custom Configuration (Optional)

Create `vercel.json` in your project root for advanced configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## Cost

**FlashForge on Vercel is FREE** for:
- Unlimited personal projects
- 100 GB bandwidth per month
- 100 build hours per month
- Automatic HTTPS
- Global CDN

This is more than enough for classroom use.

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Vercel Support](https://vercel.com/support)

---

**🎉 Your flashcard app is now live and accessible to anyone!**

Share the URL with fellow teachers or use it for your own classroom materials.
