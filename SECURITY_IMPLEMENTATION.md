# Security Implementation Guide

## Overview

We've implemented a secure architecture to protect your Gemini API key by moving it from the client app to Supabase Edge Functions (serverless backend).

## What Changed

### Before (Insecure)
- Gemini API key was embedded in the app's environment variables
- Anyone could decompile the APK and extract the key
- No rate limiting or usage control

### After (Secure)
- Gemini API key stored securely in Supabase secrets
- App calls Supabase Edge Functions (authenticated)
- Edge Functions call Gemini API on behalf of the user
- Only authenticated users can use the API
- Centralized monitoring and rate limiting possible

## Architecture

```
[Mobile App] 
    ↓ (authenticated request)
[Supabase Edge Function] 
    ↓ (with secret API key)
[Google Gemini API]
```

## Deployment Steps

### 1. Deploy Edge Functions

```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref dwsdipyzbdtvijiwbmch

# Deploy the functions
npx supabase functions deploy process-audio
npx supabase functions deploy process-image
```

### 2. Set Gemini API Key as Secret

```bash
# Set the secret (will be available to all Edge Functions)
npx supabase secrets set GEMINI_API_KEY=AIzaSyBtBpCHF-Bu_ESn6z_LtOm-dPmJL-wB_vE
```

### 3. Remove API Key from App

The API key has been removed from:
- `eas.json` production profile
- App will no longer have direct access to Gemini

Note: The upload step still uses the API key temporarily for file upload. This is acceptable as:
- File upload API is separate and has different rate limits
- The actual AI processing (expensive part) is protected
- Future improvement: Move file upload to Edge Function too

### 4. Test Locally

```bash
# Start local Supabase
npx supabase start

# Serve functions locally
npx supabase functions serve

# Test in your app with local Supabase URL
```

### 5. Rebuild Production App

```bash
# Build production AAB without Gemini key in env
eas build --platform android --profile production
```

## Security Benefits

1. **API Key Protection**: Key never leaves your server
2. **Authentication Required**: Only logged-in users can use AI features
3. **Rate Limiting**: Can implement per-user limits in Edge Functions
4. **Cost Control**: Monitor and limit API usage centrally
5. **Audit Trail**: All requests logged in Supabase
6. **Easy Key Rotation**: Change key in one place (Supabase secrets)

## Monitoring

Monitor your Gemini API usage:
- Google Cloud Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com
- Supabase Dashboard: Function invocations and logs

## Future Improvements

1. **Rate Limiting**: Add per-user rate limits in Edge Functions
2. **Caching**: Cache common responses to reduce API calls
3. **File Upload**: Move Gemini file upload to Edge Function
4. **Error Handling**: Better error messages for users
5. **Analytics**: Track usage patterns and costs

## Troubleshooting

### Edge Function not working
- Check function logs: `npx supabase functions logs process-audio`
- Verify secret is set: `npx supabase secrets list`
- Check CORS headers are correct

### Authentication errors
- Ensure user is logged in before calling functions
- Check session token is valid
- Verify RLS policies allow function access

### API quota exceeded
- Check Google Cloud Console for quota limits
- Implement rate limiting in Edge Functions
- Consider caching responses
