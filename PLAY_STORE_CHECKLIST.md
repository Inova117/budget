# Google Play Store Submission Checklist

## ✅ Pre-Submission Requirements

### 1. App Configuration
- [x] App name: "Centurio"
- [x] Package name: `com.zerion.centurio`
- [x] Version: 1.0.0
- [x] Version code: 1
- [x] Permissions properly declared in app.json
- [x] Privacy-sensitive permissions have usage descriptions

### 2. Build Configuration
- [x] Production build profile configured in eas.json
- [x] Environment variables set for production
- [x] Build type set to "app-bundle" (AAB)
- [x] Auto-increment enabled for version codes

### 3. Required Assets
- [x] App icon (512x512): `assets/icon.png`
- [x] Adaptive icon: `assets/adaptive-icon.png`
- [ ] Feature graphic (1024x500) - **NEEDS CREATION**
- [ ] Screenshots (minimum 2) - **NEEDS CREATION**
- [ ] Promotional graphic (optional, 180x120)

### 4. Legal & Policy Documents
- [x] Privacy Policy created: `PRIVACY_POLICY.md`
- [ ] Privacy Policy uploaded to public URL (GitHub, website, etc.)
- [x] Store listing content prepared: `PLAY_STORE_LISTING.md`

### 5. Google Play Console Setup
- [ ] Create Google Play Console account ($25 one-time fee)
- [ ] Create app in Play Console
- [ ] Fill out store listing (use PLAY_STORE_LISTING.md)
- [ ] Set content rating (complete questionnaire)
- [ ] Add privacy policy URL
- [ ] Upload feature graphic and screenshots
- [ ] Set app category: Finance
- [ ] Add contact email: support@centurio-app.com (or your email)

### 6. Build & Upload
- [ ] Build production AAB: `eas build --platform android --profile production`
- [ ] Upload AAB to Play Console (Production track or Internal testing)
- [ ] Fill out release notes
- [ ] Set countries/regions for distribution
- [ ] Set pricing (Free)

### 7. Testing (Recommended)
- [ ] Internal testing track (test with real users)
- [ ] Closed testing (optional, for beta testers)
- [ ] Review all app permissions and features work correctly

### 8. Final Review
- [ ] Review all store listing information
- [ ] Check all screenshots and graphics
- [ ] Verify privacy policy is accessible
- [ ] Test app on multiple devices if possible
- [ ] Submit for review

## 📋 Next Steps

1. **Create Feature Graphic** (1024x500 PNG)
   - Include app name "Centurio"
   - Show key features: voice, receipt scanning, insights
   - Use brand colors (dark theme: #0a0a0a, accent colors)

2. **Take Screenshots** (1080x1920 or 1080x2340)
   - Install the app on a device
   - Take screenshots of key screens
   - Recommended: 4-8 screenshots showing main features

3. **Upload Privacy Policy**
   - Option 1: Create a GitHub repository and upload PRIVACY_POLICY.md
   - Option 2: Host on your website
   - Option 3: Use a free hosting service (GitHub Pages, etc.)
   - Update the URL in Play Console

4. **Build Production AAB**
   ```bash
   eas build --platform android --profile production
   ```
   This will create an Android App Bundle (.aab) file for Play Store submission.

5. **Create Play Console Account**
   - Go to: https://play.google.com/console
   - Pay $25 one-time registration fee
   - Complete developer profile

6. **Submit App**
   - Upload AAB to Play Console
   - Fill in all required information
   - Submit for review (typically 1-3 days)

## ⚠️ Important Notes

- **API Keys**: The Gemini API key is embedded in the app. Consider implementing a backend proxy for production to protect the key.
- **Supabase**: Ensure your Supabase project has proper Row Level Security (RLS) policies enabled.
- **Testing**: Test the production build thoroughly before submitting.
- **Contact Email**: Replace `support@centurio-app.com` with your actual support email.
- **Privacy Policy URL**: Must be publicly accessible before submission.

## 🚀 Post-Launch

- Monitor crash reports in Play Console
- Respond to user reviews
- Plan updates and new features
- Monitor API usage (Gemini, Supabase)
- Consider implementing analytics (optional)

## 📞 Support

If you encounter issues during submission:
- Check Play Console help docs
- Review Google Play policies: https://play.google.com/about/developer-content-policy/
- Ensure all permissions are justified and explained
