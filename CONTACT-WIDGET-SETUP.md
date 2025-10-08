# Contact Widget Setup Guide

## What Changed

The contact widget has been enhanced with:

1. **Headline text** above the buttons:
   > "Do you want an online representative,  
   > a charming character for your AI agent  
   > with 3D interactive companion?"

2. **"Watch in action" button** (red gradient) that opens a video link in a new tab
3. **"Contact / Waitlist" button** (purple gradient) that opens the email form

## Configuration Required

### 1. Local Development (.env.local)

Create a `.env.local` file in the project root:

```bash
# Enable web mode to show the contact widget
WEB_MODE=true

# Get a free API key from https://web3forms.com
WEB3FORMS_KEY=your-web3forms-key-here

# Other settings...
MODE=sound
DEV_MODE=false
MEMORY_ENABLED=true
```

### 2. Cloudflare Pages (Production)

Set environment variables in your Cloudflare Pages dashboard:

1. Go to **Settings** → **Environment variables**
2. Add these variables:
   - `WEB_MODE` = `true`
   - `WEB3FORMS_KEY` = `your-actual-key-here`

**Note:** Both `WEB3FORMS_KEY` and `WEBFORMS_KEY` are supported for backwards compatibility.

### 3. Video URL

The "Watch in action" button currently points to a placeholder URL. Update it in `src/contactWidget.ts` around line 52:

```typescript
const videoUrl = 'https://example.com/watch-video';
```

Replace with your actual video URL (YouTube, Vimeo, etc.):

```typescript
const videoUrl = 'https://www.youtube.com/playlist?list=PLAKNcEe8hRMllqKaLAeT6KAO-U4WntnCR';
```

## How It Works

The contact widget only appears when **BOTH** of these conditions are met:
- `WEB_MODE` is set to `true`
- `WEB3FORMS_KEY` is provided

If either is missing, the widget will not be shown.

## Debugging

Console logs have been added to help debug configuration issues:

- `[getRuntimeConfig]` - Shows config loaded from `/api/config`
- `[App]` - Shows runtime config and widget initialization
- `[contactWidget]` - Shows button creation and DOM insertion
- `[vite.config /api/config]` - Shows config in dev mode
- `[Cloudflare /api/config]` - Shows config in production

Check the browser console (F12) to see what values are being loaded.

## Testing Locally

1. Create `.env.local` with the config above
2. Run `npm run dev`
3. Open the browser console (F12)
4. Look for the contact widget buttons in the center of the screen
5. Check console logs for any configuration issues

## Troubleshooting

### Widget Not Showing?

Check console logs:
```
[ContactWidget] Config check: { webMode: true, hasWeb3FormsKey: true, ... }
```

If `webMode` is `false` or `hasWeb3FormsKey` is `false`, check your environment variables.

### Can't See the Puppet?

The contact widget appears in the center of the screen on top of the avatar. If the avatar doesn't load, check:
- Avatar model is available at `/models/avatar.glb`
- Browser console for any loading errors
- OpenAI API key is configured (for AI features)

## Environment Variable Names

The config API accepts multiple variants for convenience:
- `WEB_MODE` or `WEB` 
- `WEB3FORMS_KEY` or `WEBFORMS_KEY` or `WEB3FORMS.ACCESS_KEY` or `WEB3FORMS_KEY_PUBLIC`

Use any of these names in your `.env.local` or Cloudflare environment variables.

## Get a Free Web3Forms Key

1. Go to https://web3forms.com
2. Sign up for free
3. Create a new form
4. Copy the access key
5. Add it to your environment variables

The key is free for up to 250 submissions per month.

