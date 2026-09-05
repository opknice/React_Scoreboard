# Cloudinary signed upload setup

This Edge Function authenticates the current Supabase user, checks the shared
image-upload quota, and signs a direct browser upload to Cloudinary. The
Cloudinary API secret never reaches the React application.

## Cloudinary preset

In the existing Cloudinary account, edit the `logo_upload` preset:

- Signing mode: `Signed`
- Allowed formats: `png`, `jpg`, `jpeg`, `webp`, `gif`
- Maximum file size: `2097152` bytes
- Folder: `logos`
- Overwrite: disabled

## Secrets and deployment

Create `supabase/.env.cloudinary` (this path is ignored by Git):

```dotenv
CLOUDINARY_CLOUD_NAME=vayh51zb
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
CLOUDINARY_UPLOAD_PRESET=logo_upload
```

Then upload the secrets and deploy:

```powershell
npx supabase secrets set --env-file supabase/.env.cloudinary
npx supabase functions deploy cloudinary-sign-upload
```

Apply all database migrations before deploying the function because it calls
`public.can_upload_image()`.
