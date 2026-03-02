# GitHub Export - Quick Start Guide

Get started with GitHub export in 5 minutes!

## Prerequisites

- A GitHub account
- Your FPStudio project ready to export

## Setup Steps

### 1. Create GitHub OAuth App (5 minutes)

1. Visit [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   ```
   Application name: FPStudio
   Homepage URL: http://localhost:8000
   Callback URL: http://localhost:8000/api/github-oauth.php
   ```
4. Click **"Register application"**
5. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to your `.env` file:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:8000/api/github-oauth.php
```

**That's it for setup!** 🎉

## Using GitHub Export

### Export Your First Project

1. **Open your project** in FPStudio editor

2. **Click the Download/Export button** (usually at the top right)

3. **Select "GitHub"** from the three export options:
   - HTML + CSS
   - React + Vite  
   - **GitHub** ← Choose this

4. **Connect your GitHub account**:
   - Click "Connect GitHub"
   - Authorize FPStudio in the popup
   - Popup closes automatically

5. **Configure your export**:
   - **Format**: Choose HTML or React
   - **Repository**: Enter `your-username/your-repo-name`
   - **Branch**: Select main, master, or gh-pages

6. **Push to GitHub**:
   - Click "Push to GitHub"
   - Wait for the magic ✨
   - Success! Click the link to view your repo

## Example Export

Let's say your GitHub username is `johndoe` and you want to create a website called `my-portfolio`:

1. Format: **HTML + CSS** (for a simple static site)
2. Repository: `johndoe/my-portfolio`
3. Branch: `gh-pages` (for GitHub Pages)
4. Click **"Push to GitHub"**

Your website will be live at: `https://johndoe.github.io/my-portfolio`

## Tips & Tricks

### 🚀 Deploy to GitHub Pages

Use the `gh-pages` branch to automatically deploy your site:

1. Export format: HTML + CSS
2. Branch: gh-pages
3. After export, go to repository Settings > Pages
4. Source: gh-pages branch
5. Your site is live! 🎉

### 🔄 Update Your Site

Just export again! The changes will be committed and pushed automatically.

### 🎨 Try Both Formats

- **HTML + CSS**: Best for simple static sites, fastest deployment
- **React + Vite**: Best for interactive sites, requires build step

### 📝 Repository Naming

Good repository names:
- `portfolio`
- `my-business-website`
- `landing-page`

Repository format:
- Must be: `username/repo-name`
- Example: `johndoe/portfolio`

## Common Questions

**Q: Do I need to create the repository first?**  
A: No! FPStudio creates it automatically if it doesn't exist.

**Q: Can I export to an existing repository?**  
A: Yes! FPStudio will add/update files in the repository.

**Q: What if I make a mistake?**  
A: Just export again, or manually edit on GitHub.

**Q: Is my GitHub token safe?**  
A: Yes! It's stored securely in your PHP session (server-side only).

**Q: Can I disconnect GitHub?**  
A: Yes, click "Disconnect" in the GitHub export modal.

**Q: Do I need to authenticate every time?**  
A: No, your session persists until you disconnect or it expires.

## Troubleshooting

**Problem**: Popup is blocked  
**Solution**: Allow popups for your domain

**Problem**: "Not authenticated"  
**Solution**: Click "Connect GitHub" again

**Problem**: "Invalid repository name"  
**Solution**: Use format `username/repo-name`

**Problem**: Export failed  
**Solution**: Check repository permissions and try again

## Next Steps

- ✅ Export your first project
- 📚 Read the [full documentation](GITHUB_EXPORT_FEATURE.md)
- 🚀 Deploy to GitHub Pages
- 🎨 Customize your exported code

## Production Setup

For production, update your OAuth app:

1. Add production callback URL to GitHub OAuth app
2. Update `.env` with production URL:
   ```env
   GITHUB_REDIRECT_URI=https://yourdomain.com/api/github-oauth.php
   ```

## Need Help?

- Check the [full documentation](GITHUB_EXPORT_FEATURE.md)
- Review [troubleshooting section](#troubleshooting)
- Test with a simple project first

Happy exporting! 🚀


