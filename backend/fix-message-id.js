// Script để xóa message có messageID lỗi
// Chạy: node fix-message-id.js

require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  }
};

const fixMessageIDs = async () => {
  await connectDB();

  const GroupMessage = mongoose.model('GroupMessages', new mongoose.Schema({
    messageID: String,
    groupID: String,
    senderID: String,
    content: String,
    type: String,
    media_url: [String],
    timestamp: Date,
  }), 'GroupMessages');

  try {
    // 1. Tìm và xóa message có messageID = "gmsgNaN"
    console.log('\n🔍 Tìm message có messageID lỗi...');
    const badMessages = await GroupMessage.find({ 
      messageID: { $regex: /gmsgNaN|gmsgundefined|gmsg[^0-9]/ } 
    });
    
    console.log(`📊 Tìm thấy ${badMessages.length} message lỗi`);
    
    if (badMessages.length > 0) {
      console.log('🗑️  Đang xóa message lỗi...');
      const result = await GroupMessage.deleteMany({ 
        messageID: { $regex: /gmsgNaN|gmsgundefined|gmsg[^0-9]/ } 
      });
      console.log(`✅ Đã xóa ${result.deletedCount} message lỗi`);
    }

    // 2. Kiểm tra message cuối cùng
    console.log('\n🔍 Kiểm tra message cuối cùng...');
    const lastMessage = await GroupMessage.findOne().sort({ messageID: -1 }).limit(1);
    
    if (lastMessage) {
      console.log(`📝 Message cuối cùng: ${lastMessage.messageID}`);
      
      // Verify format
      const numStr = lastMessage.messageID.replace('gmsg', '');
      const num = parseInt(numStr, 10);
      
      if (isNaN(num)) {
        console.log('⚠️  MessageID cuối cùng có format không đúng!');
        console.log('💡 Bạn có thể cần reset lại tất cả messageID');
      } else {
        console.log(`✅ Format đúng. Message tiếp theo sẽ là: gmsg${(num + 1).toString().padStart(3, '0')}`);
      }
    } else {
      console.log('📝 Không có message nào. Message đầu tiên sẽ là: gmsg001');
    }

    // 3. Tìm duplicate messageID
    console.log('\n🔍 Tìm messageID duplicate...');
    const duplicates = await GroupMessage.aggregate([
      { $group: { _id: "$messageID", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicates.length > 0) {
      console.log(`⚠️  Tìm thấy ${duplicates.length} messageID bị duplicate:`);
      duplicates.forEach(dup => {
        console.log(`   - ${dup._id}: ${dup.count} lần`);
      });
      console.log('💡 Bạn cần xóa các message duplicate này');
    } else {
      console.log('✅ Không có messageID duplicate');
    }

    // 4. Thống kê
    console.log('\n📊 Thống kê:');
    const totalMessages = await GroupMessage.countDocuments();
    console.log(`   - Tổng số message: ${totalMessages}`);
    
    const messagesByGroup = await GroupMessage.aggregate([
      { $group: { _id: "$groupID", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(`   - Số group có message: ${messagesByGroup.length}`);
    messagesByGroup.forEach(group => {
      console.log(`     + ${group._id}: ${group.count} message`);
    });

    console.log('\n✅ Hoàn thành! Bây giờ bạn có thể restart backend và thử lại.');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Đã đóng kết nối database');
    process.exit(0);
  }
};

fixMessageIDs();
