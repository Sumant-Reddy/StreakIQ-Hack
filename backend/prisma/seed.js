const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding YAMI Learn AI...');

  const adminHash = await bcrypt.hash('admin@123', 12);
  const managerHash = await bcrypt.hash('manager@123', 12);
  const learnerHash = await bcrypt.hash('learner123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@caratlane.com' },
    update: {},
    create: { email: 'admin@caratlane.com', passwordHash: adminHash, name: 'Admin User', role: 'ADMIN', department: 'Training' },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@caratlane.com' },
    update: {},
    create: { email: 'manager@caratlane.com', passwordHash: managerHash, name: 'Priya Sharma', role: 'MANAGER', department: 'Retail', designation: 'Store Manager' },
  });

  const learners = await Promise.all([
    { email: 'rahul@caratlane.com', name: 'Rahul Gupta', designation: 'Jewelry Consultant' },
    { email: 'anita@caratlane.com', name: 'Anita Verma', designation: 'Senior Consultant' },
    { email: 'vikram@caratlane.com', name: 'Vikram Patel', designation: 'Junior Consultant' },
    { email: 'sneha@caratlane.com', name: 'Sneha Reddy', designation: 'Jewelry Consultant' },
    { email: 'arjun@caratlane.com', name: 'Arjun Singh', designation: 'Trainee Consultant' },
  ].map(l => prisma.user.upsert({
    where: { email: l.email },
    update: {},
    create: { ...l, passwordHash: learnerHash, role: 'LEARNER', department: 'Retail', managerId: manager.id },
  })));

  const courses = await Promise.all([
    {
      title: 'Diamond Fundamentals',
      description: 'Master the 4Cs: Cut, Color, Clarity, and Carat weight. Essential knowledge for every CaratLane consultant.',
      department: 'Retail',
      tags: 'diamond,fundamentals,4c',
      estimatedHours: 4,
      isPublished: true,
    },
    {
      title: 'Consultative Selling Techniques',
      description: 'Advanced sales techniques for jewelry consultants. Learn to identify customer needs and close sales effectively.',
      department: 'Retail',
      tags: 'sales,communication,consultative-selling',
      estimatedHours: 3,
      isPublished: true,
    },
    {
      title: 'Customer Experience Excellence',
      description: 'Deliver world-class customer experiences. Handle objections, complaints, and build lasting relationships.',
      department: 'Retail',
      tags: 'customer-handling,communication,cx',
      estimatedHours: 2.5,
      isPublished: true,
    },
    {
      title: 'Gemstone Knowledge',
      description: 'Comprehensive guide to precious and semi-precious gemstones. Ruby, Emerald, Sapphire, and more.',
      department: 'Retail',
      tags: 'gemstone,knowledge',
      estimatedHours: 3.5,
      isPublished: true,
    },
    {
      title: 'CaratLane SOP & Compliance',
      description: 'Standard Operating Procedures, billing, return policy, and compliance guidelines.',
      department: 'Operations',
      tags: 'sop,compliance,refresher',
      estimatedHours: 2,
      isPublished: true,
    },
  ].map(c => prisma.course.create({ data: { ...c, createdById: admin.id } })));

  for (const course of courses) {
    await prisma.module.createMany({
      data: [
        { courseId: course.id, title: `${course.title} - Introduction`, contentType: 'VIDEO', contentUrl: 'https://example.com/video1.mp4', duration: 900, order: 1 },
        { courseId: course.id, title: `${course.title} - Core Concepts`, contentType: 'PDF', contentUrl: 'https://example.com/doc1.pdf', duration: 1200, order: 2 },
        { courseId: course.id, title: `${course.title} - Practical Application`, contentType: 'VIDEO', contentUrl: 'https://example.com/video2.mp4', duration: 1500, order: 3 },
      ],
    });

    const quiz = await prisma.quiz.create({
      data: {
        courseId: course.id,
        title: `${course.title} - Assessment`,
        passingScore: 70,
        timeLimit: 1800,
        isAIGenerated: false,
      },
    });

    await prisma.question.createMany({
      data: [
        { quizId: quiz.id, text: 'What does the 4C framework stand for in diamond grading?', type: 'MCQ', difficulty: 'EASY', options: JSON.stringify(['Cut, Color, Clarity, Carat', 'Cost, Color, Cut, Carat', 'Color, Clarity, Cost, Carat', 'Cut, Clarity, Cost, Color']), correctAnswer: 'Cut, Color, Clarity, Carat', explanation: 'The 4Cs are the universal standard for diamond quality.', points: 10, order: 1 },
        { quizId: quiz.id, text: 'A diamond with no visible inclusions under 10x magnification is graded as Flawless.', type: 'TRUE_FALSE', difficulty: 'MEDIUM', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', explanation: 'Flawless diamonds show no inclusions or blemishes under 10x magnification.', points: 10, order: 2 },
        { quizId: quiz.id, text: 'A customer asks why a 1-carat diamond costs more than a 0.9-carat diamond of similar quality. How do you explain?', type: 'SCENARIO', difficulty: 'HARD', options: JSON.stringify(['Simply say it is worth more', 'Explain the exponential rarity of larger diamonds and the carat weight premium', 'Tell them to check online prices', 'Offer a discount on the larger stone']), correctAnswer: 'Explain the exponential rarity of larger diamonds and the carat weight premium', explanation: 'Larger diamonds are exponentially rarer, and price jumps at key carat weights (0.5, 1.0, 1.5) due to supply-demand dynamics.', points: 15, order: 3 },
      ],
    });
  }

  for (const learner of learners) {
    await prisma.enrollment.create({ data: { userId: learner.id, courseId: courses[0].id, progressPercent: Math.random() * 100 } });
    await prisma.enrollment.create({ data: { userId: learner.id, courseId: courses[1].id, progressPercent: Math.random() * 80 } });

    await prisma.streak.create({ data: { userId: learner.id, currentStreak: Math.floor(Math.random() * 15), longestStreak: Math.floor(Math.random() * 30) } });
    await prisma.userPoints.create({ data: { userId: learner.id, totalPoints: Math.floor(Math.random() * 1000), weeklyPoints: Math.floor(Math.random() * 200), monthlyPoints: Math.floor(Math.random() * 500) } });
    await prisma.retentionScore.create({ data: { userId: learner.id, score: 40 + Math.random() * 60, quizAccuracy: 40 + Math.random() * 60, watchCompletion: 40 + Math.random() * 60, revisionFreq: 30 + Math.random() * 50, streakBonus: 20 + Math.random() * 60, aiInteraction: 20 + Math.random() * 60 } });
  }

  const badges = [
    { name: 'Fast Learner', description: 'Complete 5 courses', category: 'achievement', criteria: { type: 'courses_completed', threshold: 5 } },
    { name: 'Quiz Master', description: 'Score 90%+ on 10 quizzes', category: 'quiz', criteria: { type: 'high_score_quizzes', threshold: 10 } },
    { name: 'Diamond Expert', description: 'Complete Diamond Knowledge course', category: 'expertise', criteria: { type: 'course_mastery', tag: 'diamond' } },
    { name: 'Communication Star', description: 'Complete all communication courses', category: 'expertise', criteria: { type: 'category_complete', tag: 'communication' } },
    { name: 'AI Champion', description: '100+ AI companion interactions', category: 'engagement', criteria: { type: 'ai_interactions', threshold: 100 } },
    { name: 'Elite Learner', description: 'Maintain 30-day streak', category: 'streak', criteria: { type: 'streak', threshold: 30 } },
    { name: '7-Day Streak', description: 'Learn 7 days in a row', category: 'streak', criteria: { type: 'streak', threshold: 7 } },
    { name: '15-Day Streak', description: 'Learn 15 days in a row', category: 'streak', criteria: { type: 'streak', threshold: 15 } },
    { name: '90-Day Champion', description: 'Maintain 90-day learning streak', category: 'streak', criteria: { type: 'streak', threshold: 90 } },
    { name: 'Roleplay Pro', description: 'Complete 5 AI roleplays with 80%+', category: 'skill', criteria: { type: 'roleplay_score', threshold: 5 } },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({ where: { name: badge.name }, create: badge, update: badge });
  }

  console.log('Seed complete!');
  console.log('Admin: admin@caratlane.com / admin@123');
  console.log('Manager: manager@caratlane.com / manager@123');
  console.log('Learner: rahul@caratlane.com / learner@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
