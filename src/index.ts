import { createServer } from './server';
import { env } from './config/env';
import prisma from './db/prisma';
import { jobProcessor } from './services/jobs/jobProcessor';
import { emailService } from './services/jobs/emailService';
import { hashPassword } from './middleware/auth';

async function start() {
  try {
    console.log('🚀 Starting AI Voice Receptionist SaaS...');
    console.log(`📍 Environment: ${env.NODE_ENV}`);
    console.log(`📍 Base URL: ${env.BASE_URL}`);

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Test email service (skip to reduce startup memory)
    // await emailService.verifyConnection();
    console.log('⚠️  Email verification skipped (reduce memory usage)');

    // Create default super admin if doesn't exist
    if (env.DEFAULT_ADMIN_EMAIL && env.DEFAULT_ADMIN_PASSWORD) {
      const existingAdmin = await prisma.user.findUnique({
        where: { email: env.DEFAULT_ADMIN_EMAIL },
      });

      if (!existingAdmin) {
        const hashedPassword = await hashPassword(env.DEFAULT_ADMIN_PASSWORD);
        
        await prisma.user.create({
          data: {
            email: env.DEFAULT_ADMIN_EMAIL,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            firstName: 'Super',
            lastName: 'Admin',
          },
        });

        console.log(`✅ Created default super admin: ${env.DEFAULT_ADMIN_EMAIL}`);
      }
    }

    // Start job processor
    jobProcessor.start();

    // Create Express server
    const app = createServer();

    // Start listening
    const port = parseInt(env.PORT) || 3000;
    
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`✅ Server listening on http://0.0.0.0:${port}`);
      console.log(`📞 Twilio webhook URL: ${env.BASE_URL}/twilio/voice`);
      console.log('');
      console.log('🎉 AI Voice Receptionist is ready!');
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      
      jobProcessor.stop();
      
      server.close(() => {
        console.log('✅ HTTP server closed');
      });

      await prisma.$disconnect();
      console.log('✅ Database disconnected');
      
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Startup error:', error);
    process.exit(1);
  }
}

// Start the application
start();
