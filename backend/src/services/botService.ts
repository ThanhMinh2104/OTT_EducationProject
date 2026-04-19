import { GoogleGenerativeAI } from '@google/generative-ai';
import Message from '../models/Messages';
import Users from '../models/User';

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface BotResponse {
  intent: 'summary' | 'icebreaker' | 'chat' | 'error';
  content: string;
}

interface ChatHistoryItem {
  senderName: string;
  content: string;
  type: string;
  timestamp: Date;
}

/**
 * Xử lý bot action với Gemini AI
 * @param chatType - Loại chat: "group", "individual", "stranger"
 * @param chatHistory - Lịch sử chat gần đây
 * @param currentMessage - Tin nhắn hiện tại từ user
 * @returns BotResponse với intent và content
 */
export async function processBotAction(
  chatType: string,
  chatHistory: string,
  currentMessage: string
): Promise<BotResponse> {
  const systemPrompt = `Bạn là trợ lý AI thông minh bên trong một ứng dụng nhắn tin.
Nhiệm vụ của bạn là đọc thông tin ngữ cảnh, tin nhắn hiện tại và quyết định hành động phù hợp.

BẮT BUỘC TRẢ VỀ CHUẨN JSON. KHÔNG dùng markdown (như \`\`\`json). KHÔNG giải thích gì thêm.

[QUY TẮC PHÂN LOẠI - INTENT]
1. "summary": Kích hoạt khi người dùng muốn tóm tắt lại các tin nhắn cũ.
   - Ví dụ: "tóm tắt đi", "tóm tắt cuộc trò chuyện", "recap lại", "tổng hợp nội dung"
   
2. "icebreaker": Kích hoạt khi phòng chat thuộc loại "stranger" (người lạ) và tin nhắn yêu cầu gợi ý làm quen, phá băng.
   - Ví dụ: "gợi ý câu chuyện", "nói gì đây", "chủ đề gì hay"
   
3. "chat": Kích hoạt cho các cuộc trò chuyện, hỏi đáp bình thường với bot.
   - Ví dụ: hỏi đáp thông thường, tư vấn, giải trí

[THÔNG TIN NGỮ CẢNH]
- Loại phòng chat: ${chatType}
- Lịch sử gần đây:
${chatHistory}
- Tin nhắn user vừa gửi: "${currentMessage}"

[CẤU TRÚC JSON ĐẦU RA]
{
  "intent": "tên_intent",
  "content": "Nội dung phản hồi chi tiết (bản tóm tắt, câu phá băng, hoặc câu trả lời bình thường) để hiển thị lên UI"
}

Hãy phân tích và trả về JSON thuần túy, không có ký tự thừa.`;

  try {
    // Kiểm tra API key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.error('❌ GEMINI_API_KEY not configured in .env');
      return {
        intent: 'error',
        content: 'Bot chưa được cấu hình. Vui lòng liên hệ admin! 🔧',
      };
    }

    // Sử dụng gemini-flash-latest (stable và ít bị quá tải)
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text().trim();

    // Loại bỏ markdown nếu có
    let cleanText = text;
    if (text.startsWith('```json')) {
      cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      cleanText = text.replace(/```\n?/g, '').trim();
    }

    // Parse JSON
    const botResponse: BotResponse = JSON.parse(cleanText);
    
    // Validate intent
    if (!['summary', 'icebreaker', 'chat', 'error'].includes(botResponse.intent)) {
      throw new Error('Invalid intent from bot');
    }

    return botResponse;
  } catch (error: any) {
    console.error('❌ Bot processing error:', error);
    
    // Log chi tiết để debug
    if (error.status === 404) {
      console.error('Model not found. Available models: gemini-1.5-flash-latest, gemini-1.5-pro-latest');
    } else if (error.message?.includes('API key')) {
      console.error('Invalid API key. Please check GEMINI_API_KEY in .env');
    }
    
    return {
      intent: 'error',
      content: 'Xin lỗi, bot đang bận. Vui lòng thử lại sau! 🤖',
    };
  }
}

/**
 * Lấy lịch sử chat gần đây và format thành string
 * @param chatID - ID của chat
 * @param limit - Số lượng tin nhắn tối đa (mặc định 50)
 * @returns Chuỗi lịch sử chat đã format
 */
export async function getChatHistory(chatID: string, limit: number = 50): Promise<string> {
  try {
    const messages = await Message.find({ chatID })
      .sort({ timestamp: -1 })
      .limit(limit);

    if (messages.length === 0) {
      return 'Chưa có tin nhắn nào trong cuộc trò chuyện này.';
    }

    // Reverse để có thứ tự từ cũ đến mới
    messages.reverse();

    const formattedHistory: string[] = [];

    for (const msg of messages) {
      // Bỏ qua tin nhắn notification và unsend
      if (msg.type === 'notification' || msg.type === 'unsend') {
        continue;
      }

      // Lấy thông tin người gửi
      let senderName = 'Người dùng';
      if (msg.senderID !== 'system') {
        const user = await Users.findOne({ userID: msg.senderID });
        senderName = user?.name || 'Người dùng';
      }

      // Format nội dung
      let content = msg.content;
      if (!content || content.trim() === '') {
        // Nếu không có text, mô tả loại media
        const mediaTypes: Record<string, string> = {
          image: '[Hình ảnh]',
          video: '[Video]',
          audio: '[Tin nhắn thoại]',
          file: '[File]',
          sticker: '[Sticker]',
          gif: '[GIF]',
        };
        content = mediaTypes[msg.type] || '[Media]';
      }

      formattedHistory.push(`${senderName}: ${content}`);
    }

    return formattedHistory.join('\n');
  } catch (error) {
    console.error('❌ Error getting chat history:', error);
    return 'Không thể lấy lịch sử chat.';
  }
}

/**
 * Kiểm tra xem tin nhắn có gọi bot không
 * @param message - Nội dung tin nhắn
 * @returns true nếu có gọi bot
 */
export function isBotMention(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // Các pattern gọi bot
  const botPatterns = [
    '@bot',
    '/bot',
    'bot ',
    'hey bot',
    'hi bot',
    'hello bot',
  ];

  return botPatterns.some(pattern => lowerMessage.includes(pattern));
}

/**
 * Tạo tin nhắn bot và lưu vào database
 * @param chatID - ID của chat
 * @param content - Nội dung tin nhắn
 * @param intent - Intent của bot response
 * @returns Message object đã lưu
 */
export async function createBotMessage(
  chatID: string,
  content: string,
  intent: string
): Promise<any> {
  try {
    // Tạo messageID tự động
    const last = await Message.findOne().sort({ messageID: -1 }).limit(1);
    let messageID = 'msg001';
    if (last) {
      const n = parseInt(last.messageID.replace('msg', ''), 10);
      messageID = `msg${(n + 1).toString().padStart(3, '0')}`;
    }

    const botMessage = new Message({
      messageID,
      chatID,
      senderID: 'bot',
      content,
      type: 'text',
      timestamp: new Date(),
      media_url: [],
      status: 'sent',
      metadata: { intent }, // Lưu intent để frontend có thể render khác nhau
    });

    const saved = await botMessage.save();
    return saved;
  } catch (error) {
    console.error('❌ Error creating bot message:', error);
    throw error;
  }
}
