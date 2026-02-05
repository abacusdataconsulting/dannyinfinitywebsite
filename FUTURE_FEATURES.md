# Features & Roadmap

## Implemented Features

### User Logging & Tracking
- [x] **IP Address** - Collected via Cloudflare Workers (`CF-Connecting-IP`)
- [x] **Geolocation** - Country, city, region via Cloudflare's `request.cf` object
- [x] **User Agent** - Collected both client and server-side
- [x] **Timestamp** - Server-side timestamp for accuracy
- [x] **Screen/Window dimensions** - Client-side collection
- [x] **Timezone & Language** - Client-side collection
- [ ] **MAC Address** - Not possible from web browsers (OS-level security restriction)

### Database (Cloudflare D1)
- [x] Users table with password support
- [x] Visits table with full tracking data
- [x] Sessions table for authentication
- [x] Indexes for performance

### API Endpoints (Cloudflare Workers)
- [x] `POST /api/visit` - Log visitor data
- [x] `GET /api/user/check/:name` - Check if user is recognized
- [x] `POST /api/user/register` - Register new user
- [x] `POST /api/user/login` - Authenticate with password
- [x] `GET /api/visits` - View all visits (admin)
- [x] `GET /api/users` - View all users (admin)

### User Recognition Flow
- [x] User enters name on splash page
- [x] API checks if name exists in database
- [x] If recognized with password: prompt for password
- [x] If recognized without password: welcome back message
- [x] If new user: proceed to animation
- [x] Visit logged with user association

### ASCII Portal Animation
- [x] Multi-frame cyber portal animation
- [x] Dramatic timing variations
- [x] Smooth transition to home page

---

## Future Enhancements

### Security
- [ ] Upgrade to bcrypt password hashing (currently SHA-256)
- [ ] Rate limiting on API endpoints
- [ ] CAPTCHA for suspicious activity
- [ ] Admin authentication for protected routes
- [ ] CSRF protection

### Features
- [ ] Admin dashboard UI for viewing visitor logs
- [ ] User registration from splash page
- [ ] "Remember me" functionality
- [ ] Email notifications for new users
- [ ] Analytics integration (Cloudflare Analytics)

### Infrastructure
- [ ] Cloudflare Pages deployment for static files
- [ ] Custom domain setup
- [ ] Environment-specific configurations
- [ ] Automated backups for D1

### UI/UX
- [ ] Loading states during API calls
- [ ] Error message displays
- [ ] Password strength indicator
- [ ] Mobile-optimized animations
