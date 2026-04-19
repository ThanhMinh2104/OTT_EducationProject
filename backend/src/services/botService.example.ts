/**
 * File example để test bot service
 * Chạy: npx ts-node src/services/botService.example.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { processBotAction } from './botService';

async function testBot() {
  console.log('🧪 Testing Bot Service...\n');
  
  // Kiểm tra API key
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.error('❌ GEMINI_API_KEY not configured in .env');
    console.log('Please add your Gemini API key to .env file');
    console.log('Get your key at: https://makersuite.google.com/app/apikey');
    return;
  }
  
  console.log('✅ API key found:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
  console.log('');

  // Test 1: Summary intent
  console.log('📝 Test 1: Summary Intent');
  const summaryResult = await processBotAction(
    'group',
    `Alice: Chào mọi người!
Bob: Hi Alice, hôm nay làm gì?
Alice: Mình đang học React Native
Bob: Hay đấy, mình cũng đang học
Charlie: Các bạn học ở đâu vậy?
Alice: Mình học online trên Udemy
Bob: Mình học trên Youtube`,
    '@bot tóm tắt cuộc trò chuyện'
  );
  console.log('Intent:', summaryResult.intent);
  console.log('Content:', summaryResult.content);
  console.log('\n---\n');

  // Test 2: Icebreaker intent
  console.log('🎯 Test 2: Icebreaker Intent');
  const icebreakerResult = await processBotAction(
    'stranger',
    'Chưa có tin nhắn nào trong cuộc trò chuyện này.',
    '@bot gợi ý câu chuyện đi'
  );
  console.log('Intent:', icebreakerResult.intent);
  console.log('Content:', icebreakerResult.content);
  console.log('\n---\n');

  // Test 3: Chat intent
  console.log('💬 Test 3: Chat Intent');
  const chatResult = await processBotAction(
    'individual',
    `User: Xin chào bot
Bot: Chào bạn! Tôi có thể giúp gì cho bạn?`,
    '@bot React Native là gì?'
  );
  console.log('Intent:', chatResult.intent);
  console.log('Content:', chatResult.content);
  console.log('\n---\n');

  console.log('✅ All tests completed!');
}

// Chạy test
testBot().catch(console.error);
