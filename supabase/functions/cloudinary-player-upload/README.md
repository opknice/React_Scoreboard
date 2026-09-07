# Cloudinary player image upload

Deploy with:

```bash
npx supabase functions deploy cloudinary-player-upload
npx supabase functions deploy cloudinary-player-delete
```

The function uses `CLOUDINARY_PLAYER_UPLOAD_PRESET` when present and falls
back to `CLOUDINARY_UPLOAD_PRESET`. Both functions require the Cloudinary
secrets already used by the logo uploader:

```bash
npx supabase secrets set --env-file supabase/.env.cloudinary
```

Player images are limited to 500KB and the database RPC records a successful
upload against the Free Trial limit of 20. Whitelisted users receive an
unlimited result.
