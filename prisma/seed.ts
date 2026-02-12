import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-business' },
    update: {},
    create: {
      name: 'Demo Business',
      slug: 'demo-business',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created demo tenant');

  // Create receptionist config for demo tenant
  await prisma.receptionistConfig.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      greetingMessage: 'Thank you for calling Demo Business. This call may be recorded for quality assurance. You are speaking with an automated assistant. How can I help you today?',
      personality: 'professional, friendly, and helpful',
      transferPrompt: 'Let me connect you with our team. Please hold for a moment.',
      leadCapturePrompt: 'I would be happy to have someone call you back. Can I please get your name and phone number?',
      fallbackMessage: 'I apologize, I did not quite catch that. Could you please repeat?',
      endCallMessage: 'Thank you for calling Demo Business. Have a great day!',
    },
  });

  console.log('✅ Created receptionist config');

  // Create business hours (Mon-Fri, 9am-5pm)
  const businessHours = [
    { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Monday
    { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Tuesday
    { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Wednesday
    { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Thursday
    { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Friday
    { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00', isOpen: false }, // Saturday
    { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isOpen: false }, // Sunday
  ];

  for (const hours of businessHours) {
    await prisma.businessHours.upsert({
      where: {
        tenantId_dayOfWeek: {
          tenantId: demoTenant.id,
          dayOfWeek: hours.dayOfWeek,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        ...hours,
        timezone: 'America/Los_Angeles',
      },
    });
  }

  console.log('✅ Created business hours');

  // Create knowledge base entries
  const knowledgeEntries = [
    {
      category: 'hours',
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday from 9 AM to 5 PM Pacific Time. We are closed on weekends and major holidays.',
      keywords: ['hours', 'open', 'closed', 'time', 'schedule', 'when'],
    },
    {
      category: 'location',
      question: 'Where are you located?',
      answer: 'We are located in San Francisco, California. You can reach us by phone or visit our website for more information.',
      keywords: ['location', 'address', 'where', 'find', 'directions'],
    },
    {
      category: 'services',
      question: 'What services do you offer?',
      answer: 'We offer a wide range of professional services including consulting, implementation, and ongoing support. Please let me know what specific service you are interested in.',
      keywords: ['services', 'offer', 'provide', 'do', 'help'],
    },
    {
      category: 'pricing',
      question: 'How much do your services cost?',
      answer: 'Our pricing varies depending on your specific needs. I would be happy to connect you with our sales team who can provide a customized quote.',
      keywords: ['pricing', 'cost', 'price', 'how much', 'fee', 'rate'],
    },
    {
      category: 'contact',
      question: 'How can I contact you?',
      answer: 'You can reach us by phone at this number, or visit our website to send us a message. We typically respond within one business day.',
      keywords: ['contact', 'reach', 'email', 'phone', 'call', 'message'],
    },
  ];

  for (const entry of knowledgeEntries) {
    await prisma.knowledgeBaseEntry.create({
      data: {
        tenantId: demoTenant.id,
        ...entry,
        isActive: true,
        priority: 0,
      },
    });
  }

  console.log('✅ Created knowledge base entries');

  // Create departments
  const salesDept = await prisma.department.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Sales',
      description: 'Sales inquiries and new customer onboarding',
    },
  });

  const supportDept = await prisma.department.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Support',
      description: 'Technical support and customer assistance',
    },
  });

  console.log('✅ Created departments');

  // Create transfer targets (example - update with real numbers)
  await prisma.transferTarget.create({
    data: {
      tenantId: demoTenant.id,
      departmentId: salesDept.id,
      name: 'Sales Team',
      phoneNumber: '+15551234567', // Replace with real number
      priority: 1,
      isActive: true,
    },
  });

  await prisma.transferTarget.create({
    data: {
      tenantId: demoTenant.id,
      departmentId: supportDept.id,
      name: 'Support Team',
      phoneNumber: '+15559876543', // Replace with real number
      priority: 2,
      isActive: true,
    },
  });

  console.log('✅ Created transfer targets');

  // Create demo tenant admin user
  const hashedPassword = await bcrypt.hash('demo123', 10);

  await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'TENANT_ADMIN',
      tenantId: demoTenant.id,
    },
  });

  console.log('✅ Created demo admin user');
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('Demo tenant login:');
  console.log('  Email: demo@example.com');
  console.log('  Password: demo123');
  console.log('');
  console.log('⚠️  Remember to update transfer target phone numbers with real numbers!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
