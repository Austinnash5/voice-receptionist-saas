# Pre-Deployment Checklist

Complete this checklist before deploying to your VPS.

## ✅ Code Preparation

- [ ] All code changes committed to GitHub
- [ ] `.env` file is **NOT** committed (check `.gitignore`)
- [ ] `.env.docker` template is ready for production setup
- [ ] Database migrations are up to date
- [ ] TypeScript compiles without errors (`npm run build`)

## ✅ VPS Setup

- [ ] VPS provisioned with Ubuntu
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 80, 443, 22 open)
- [ ] Domain DNS A record points to VPS IP
- [ ] SSH access configured
- [ ] Non-root user created (recommended)

## ✅ Environment Configuration

Prepare these values before deployment:

### Database
- [ ] Strong PostgreSQL password generated
- [ ] Database name decided

### Redis
- [ ] Strong Redis password generated

### Twilio
- [ ] Twilio Account SID obtained
- [ ] Twilio Auth Token obtained
- [ ] Phone number purchased or available

### OpenAI
- [ ] OpenAI API key obtained
- [ ] Sufficient API credits available
- [ ] Model selection confirmed (gpt-4-turbo-preview recommended)

### Email/SMTP
- [ ] SMTP host configured
- [ ] SMTP credentials obtained
- [ ] From address configured
- [ ] Test email sent successfully

### Security
- [ ] Session secret generated (`openssl rand -hex 32`)
- [ ] Admin email decided
- [ ] Strong admin password generated

### Application
- [ ] BASE_URL configured with your domain (https://yourdomain.com)
- [ ] NODE_ENV set to production

## ✅ Pre-Deployment Actions

- [ ] Push all code to GitHub main branch
- [ ] Backup any existing data (if applicable)
- [ ] Review DOCKER_DEPLOYMENT.md documentation
- [ ] Test Docker build locally (optional)
  ```bash
  docker compose build
  docker compose up
  ```

## ✅ Deployment Steps

Follow the steps in [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md):

1. [ ] SSH into VPS
2. [ ] Install Docker and dependencies
3. [ ] Clone repository from GitHub
4. [ ] Create and configure .env file
5. [ ] Build Docker images
6. [ ] Start containers
7. [ ] Run database migrations
8. [ ] Verify health check
9. [ ] Configure SSL certificates
10. [ ] Update nginx with SSL configuration
11. [ ] Test application access

## ✅ Post-Deployment Verification

- [ ] Application accessible at domain
- [ ] Health endpoint responding: `https://yourdomain.com/health`
- [ ] Admin login works
- [ ] Create test tenant
- [ ] Configure test Twilio phone number
- [ ] Make test call to verify AI receptionist works
- [ ] Check logs for errors: `docker compose logs -f app`
- [ ] Verify database connections
- [ ] Verify Redis session storage
- [ ] Test email notifications

## ✅ Twilio Configuration

After deployment:

- [ ] Update Twilio webhook URLs to point to your domain:
  - Voice URL: `https://yourdomain.com/twilio/voice`
  - Status Callback: `https://yourdomain.com/twilio/status`
- [ ] Test webhooks from Twilio console
- [ ] Verify incoming calls are handled correctly

## ✅ Security Hardening

- [ ] Change default admin password
- [ ] Enable fail2ban
- [ ] Configure automatic security updates
- [ ] Set up SSL certificate auto-renewal
- [ ] Review nginx security headers
- [ ] Implement rate limiting (if needed)
- [ ] Configure backup strategy

## ✅ Monitoring Setup

- [ ] Set up log rotation
- [ ] Configure database backups (automated)
- [ ] Monitor disk space usage
- [ ] Monitor container resource usage
- [ ] Set up uptime monitoring (optional)
- [ ] Configure error alerts (optional)

## 🚨 Common Issues & Solutions

### Issue: Application won't start
**Check:**
- Environment variables in `.env`
- Database connection string
- Container logs: `docker compose logs app`

### Issue: Database connection failed
**Check:**
- PostgreSQL container is running: `docker compose ps`
- Database credentials match in `.env`
- Run: `docker compose exec postgres pg_isready -U voiceuser`

### Issue: Redis connection failed
**Check:**
- Redis container is running
- Redis password matches in `.env`
- Test: `docker compose exec redis redis-cli -a your_password ping`

### Issue: SSL certificate errors
**Check:**
- Domain DNS is properly configured
- Certbot ran successfully
- Certificate files copied to nginx/ssl/
- Nginx configuration is correct

### Issue: Twilio webhooks not working
**Check:**
- Webhook URLs configured correctly in Twilio
- Domain is accessible from public internet
- SSL is properly configured (Twilio requires HTTPS)
- Check app logs for incoming requests

## 📚 Important Files

- `DOCKER_DEPLOYMENT.md` - Complete deployment guide
- `.env.docker` - Environment template
- `docker-compose.yml` - Container orchestration
- `Dockerfile` - Application container
- `deploy-github.sh` - Automated deployment script
- `.github/workflows/build.yml` - CI/CD pipeline

## 🆘 Need Help?

1. Review logs: `docker compose logs -f app`
2. Check container status: `docker compose ps`
3. Verify health: `curl https://yourdomain.com/health`
4. Review DOCKER_DEPLOYMENT.md Troubleshooting section

---

**Ready to deploy?** Follow the complete guide in [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
