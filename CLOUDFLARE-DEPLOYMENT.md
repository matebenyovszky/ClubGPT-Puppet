# Cloudflare Pages Deployment Guide for Puppet Avatar

This guide explains how to deploy your 3D avatar puppet application to Cloudflare Pages with GitHub integration.

## Prerequisites

1. **GitHub Repository**: Push your code to a GitHub repository
2. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
3. **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com)

## Step 1: Set up Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `.` (leave empty)

## Step 2: Configure Environment Variables

In your Cloudflare Pages dashboard, go to **Settings** → **Environment variables** and add:

### Required Variables:
```
OPENAI_API_KEY=your-openai-api-key-here
```

### Optional Variables:
```
# Mode (sound or text)
MODE=sound

# Development settings
DEV_MODE=false

# Features
MEMORY_ENABLED=true
LIPSYNC_ENABLED=false

# Avatar settings
AVATAR_URL=/models/avatar.glb
AVATAR_SCALE=1.8

# Theme
THEME_NAME=neon_purple

# OpenAI Realtime settings
REALTIME_MODEL=gpt-realtime
REALTIME_VOICE=shimmer

# Web mode - enable contact/waitlist button for production
WEB_MODE=true

# Web3Forms API key (get free at https://web3forms.com)
# Any of these will be detected:
WEB3FORMS_KEY=your-web3forms-access-key
# WEB3FORMS.ACCESS_KEY=your-web3forms-access-key
# WEB3FORMS_KEY_PUBLIC=your-web3forms-access-key
```

## Step 3: Deploy

The deployment will happen automatically when you push to the `main` branch. Cloudflare Pages will detect changes and rebuild your site automatically.

You can also trigger a manual deployment from the Cloudflare Pages dashboard if needed.

## Step 4: Access Your Application

Once deployed, you'll get a URL like `https://your-project.pages.dev`

## Important Notes

### WASM Support
The application uses WebAssembly (WASM) for HavokPhysics. Cloudflare Pages automatically handles the required COEP/COOP headers for SharedArrayBuffer support.

### API Routes
The application includes API routes (`/api/*`) that proxy requests to OpenAI. These are configured with proper CORS headers for browser compatibility.

### Environment Variables
- Environment variables are available at build time and runtime
- The `OPENAI_API_KEY` is required for the avatar to function
- All other variables are optional and have sensible defaults

### Web Mode & Contact Widget
When `WEB_MODE=true`, a beautiful contact/waitlist button appears at the bottom of the screen. This is perfect for:
- Collecting beta tester emails
- Building a waitlist for your product
- Getting feedback from users

**Setup:**
1. Get a free API key from [Web3Forms](https://web3forms.com)
2. Set `WEB_MODE=true` and `WEB3FORMS_KEY=your-key` in environment variables
3. The contact button will appear automatically
4. Submissions are sent to your email via Web3Forms

### Troubleshooting

**WASM/SharedArrayBuffer Issues:**
- Ensure your domain uses HTTPS (Cloudflare Pages provides this automatically)
- The COEP/COOP headers are automatically configured

**OpenAI API Issues:**
- Verify your API key is correct and has sufficient credits
- Check that the key has access to the Realtime API (beta feature)

**Build Issues:**
- Make sure all dependencies are installed: `npm install`
- The build process compiles TypeScript and bundles with Vite

## File Structure

Key files for deployment:
- `wrangler.toml` - Cloudflare Pages configuration
- `public/_headers` - HTTP headers for WASM support
- `dist/` - Build output (auto-generated)

## Support

For issues specific to Cloudflare Pages deployment:
1. Check the [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)
2. Review the build logs in your Cloudflare Pages dashboard
3. Test locally first: `npm run dev` and `npm run build`
