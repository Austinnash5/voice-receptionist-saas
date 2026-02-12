# Docker VPS Deployment Guide

Complete guide for deploying AI Voice Receptionist on a VPS using Docker.

## Prerequisites

- Ubuntu VPS (minimum 2GB RAM, 2 CPU cores recommended)
- Docker and Docker Compose installed
- Domain name pointed to your VPS IP
- SSH access to the VPS
- GitHub account (for deployment via git)
- Twilio account with phone number
- OpenAI API key
- SMTP email credentials

## Initial VPS Setup

### 1. Connect to Your VPS

```bash
ssh root@your-vps-ip
```

### 2. Install Docker

```bash
# Update package index
apt update && apt upgrade -y

# Install prerequisites
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 3. Install Additional Tools

```bash
# Install git, ufw (firewall), and other utilities
apt install -y git ufw fail2ban

# Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 4. Create Non-Root User (Recommended)

```bash
# Create user
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Switch to new user
su - deploy
```

## Application Deployment

### 1. Clone Repository from GitHub

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/yourusername/ai-voice-receptionist.git
cd ai-voice-receptionist
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit environment file
nano .env
```

Fill in all required values:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Database - Docker will use these
POSTGRES_USER=voiceuser
POSTGRES_PASSWORD=your_secure_db_password_here
POSTGRES_DB=voice_receptionist
DATABASE_URL=postgresql://voiceuser:your_secure_db_password_here@postgres:5432/voice_receptionist

# Redis - for session storage
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_URL=redis://:your_secure_redis_password_here@redis:6379

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notifications@yourdomain.com
EMAIL_PASSWORD=your_email_app_password
EMAIL_FROM=AI Receptionist <notifications@yourdomain.com>

# Session Secret (generate a random 64-character string)
SESSION_SECRET=your_random_64_character_string_here

# Admin Account
DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=change_this_secure_password
```

**Important Security Notes:**
- Generate strong passwords for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- Use `openssl rand -hex 32` to generate `SESSION_SECRET`
- Change `DEFAULT_ADMIN_PASSWORD` after first login

### 3. Configure Nginx (Optional but Recommended)

Update [nginx/conf.d/voice-receptionist.conf](nginx/conf.d/voice-receptionist.conf):

```nginx
upstream app {
    server app:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL is configured)
    # return 301 https://$server_name$request_uri;

    # Temporary HTTP access (remove after SSL setup)
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

### 4. Build and Start Containers

```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f app
```

### 5. Run Database Migrations

```bash
# Run Prisma migrations
docker compose exec app npx prisma migrate deploy

# (Optional) Seed the database
docker compose exec app npx prisma db seed
```

### 6. Verify Deployment

```bash
# Check container status
docker compose ps

# Check application health
curl http://localhost:3000/health

# View application logs
docker compose logs -f app

# View all logs
docker compose logs -f
```

## SSL/HTTPS Configuration with Let's Encrypt

### 1. Install Certbot

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Or use Docker version
docker pull certbot/certbot
```

### 2. Obtain SSL Certificate

```bash
# Stop nginx temporarily
docker compose stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/
```

### 3. Configure Nginx for SSL

Update [nginx/conf.d/voice-receptionist.conf](nginx/conf.d/voice-receptionist.conf):

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy to application
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Twilio webhook endpoints - increase timeout
    location /api/twilio/ {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_connect_timeout 75s;
    }
}
```

Copy certificates to nginx volume:

```bash
# Create SSL directory
sudo mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Set permissions
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 600 nginx/ssl/privkey.pem
```

Update docker-compose.yml volumes section for nginx to include:

```yaml
volumes:
  - ./nginx/ssl:/etc/nginx/ssl:ro
```

### 4. Restart Nginx

```bash
docker compose restart nginx
```

### 5. Auto-Renew SSL Certificates

Create renewal script:

```bash
# Create script
sudo nano /usr/local/bin/renew-ssl.sh
```

Add content:

```bash
#!/bin/bash
certbot renew --quiet
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /home/deploy/ai-voice-receptionist/nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /home/deploy/ai-voice-receptionist/nginx/ssl/
docker compose -f /home/deploy/ai-voice-receptionist/docker-compose.yml restart nginx
```

Make executable and add to cron:

```bash
sudo chmod +x /usr/local/bin/renew-ssl.sh
sudo crontab -e
```

Add line:

```cron
0 3 * * * /usr/local/bin/renew-ssl.sh
```

## Updating the Application

### Pull Latest Changes from GitHub

```bash
cd ~/ai-voice-receptionist

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose build app
docker compose up -d app

# Run any new migrations
docker compose exec app npx prisma migrate deploy
```

## Maintenance Commands

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f redis
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart app
```

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U voiceuser voice_receptionist > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker compose exec -T postgres psql -U voiceuser voice_receptionist < backup_file.sql
```

### Access Database

```bash
# PostgreSQL
docker compose exec postgres psql -U voiceuser voice_receptionist

# Redis
docker compose exec redis redis-cli -a your_redis_password
```

### View Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Monitoring and Health Checks

### Application Health Endpoint

Check application health:

```bash
curl https://yourdomain.com/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Monitor Container Health

```bash
# Check health status
docker compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' voice-receptionist-app | jq
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs app

# Check if ports are in use
sudo netstat -tulpn | grep :3000
```

### Database connection issues

```bash
# Verify postgres is running
docker compose exec postgres pg_isready -U voiceuser

# Check connection string in .env file
# Ensure DATABASE_URL matches POSTGRES_* variables
```

### Redis connection issues

```bash
# Test Redis connection
docker compose exec redis redis-cli -a your_redis_password ping

# Should respond with: PONG
```

### Application errors

```bash
# View detailed logs
docker compose logs -f app

# Restart application
docker compose restart app

# Rebuild if code changed
docker compose build app
docker compose up -d app
```

### Out of memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Security Best Practices

1. **Keep software updated:**
   ```bash
   apt update && apt upgrade -y
   docker compose pull
   docker compose up -d
   ```

2. **Configure firewall properly:**
   ```bash
   ufw status
   ```

3. **Regular backups:**
   - Automate database backups
   - Store backups off-server

4. **Monitor logs:**
   - Set up log rotation
   - Monitor for suspicious activity

5. **Use strong passwords:**
   - Database passwords
   - Redis passwords
   - Admin passwords

6. **Enable fail2ban:**
   ```bash
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

## Performance Optimization

### For production with high traffic:

1. **Increase container resources** in docker-compose.yml:
   ```yaml
   app:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 2G
         reservations:
           cpus: '1'
           memory: 1G
   ```

2. **Add Redis memory limits:**
   ```yaml
   redis:
     command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
   ```

3. **Enable connection pooling** (already configured in Prisma)

4. **Monitor and scale:**
   - Use `docker stats` to monitor resource usage
   - Consider horizontal scaling if needed

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Review ARCHITECTURE.md for system design
- Test with local Docker setup first

---

**Next Steps After Deployment:**
1. Test the application at your domain
2. Configure Twilio webhook URLs to point to your domain
3. Create your first tenant via the admin dashboard
4. Set up monitoring and alerts
5. Configure regular backup automation
