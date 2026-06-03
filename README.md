<div align="center">

```
 ██████╗ ████████╗████████╗    ███████╗██████╗ ██╗   ██╗
██╔═══██╗╚══██╔══╝╚══██╔══╝    ██╔════╝██╔══██╗██║   ██║
██║   ██║   ██║      ██║       █████╗  ██║  ██║██║   ██║
██║   ██║   ██║      ██║       ██╔══╝  ██║  ██║██║   ██║
╚██████╔╝   ██║      ██║       ███████╗██████╔╝╚██████╔╝
 ╚═════╝    ╚═╝      ╚═╝       ╚══════╝╚═════╝  ╚═════╝
```

# 🎓 OTT Education - Hệ thống nhắn tin thời gian thực cho giáo dục

**Đồ án môn học:** Công nghệ mới trong phát triển ứng dụng CNTT  
**Học kỳ:** HK2 - 2025-2026 | **Lớp:** DHKTPM18 | **Trường:** IUH

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.23-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cài đặt & Chạy thử](#-cài-đặt--chạy-thử)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Endpoints](#-api-endpoints)
- [Thành viên nhóm](#-thành-viên-nhóm)

---

## 🚀 Giới thiệu

**OTT Education** là hệ thống nhắn tin thời gian thực dành riêng cho môi trường giáo dục. Hệ thống hỗ trợ giao tiếp giữa giảng viên và sinh viên, quản lý nhóm lớp học, chia sẻ tài liệu, tích hợp chatbot AI và nhiều tính năng khác.

> 💡 Dự án được xây dựng với kiến trúc microservice-lite, sử dụng backend Node.js, frontend React TypeScript và ứng dụng mobile React Native.

---

## ✨ Tính năng

### 👤 Quản lý người dùng

- Đăng ký / Đăng nhập với JWT Authentication
- Quản lý hồ sơ cá nhân, avatar, ảnh bìa
- Xác thực OTP qua Email và SMS
- Danh sách bạn bè, gửi lời mời kết bạn
- Quản lý phiên đăng nhập đa thiết bị (Web/Mobile)
- Lịch sử đăng nhập

### 💬 Chat 1-1

- Chat cá nhân với bạn bè và người lạ
- Hỗ trợ đa dạng loại tin nhắn: `text` · `image` · `video` · `audio` · `file` · `emoji`
- Hiển thị trạng thái **đang gõ...**, **đã xem**
- Xóa lịch sử chat, thu hồi tin nhắn
- Tìm kiếm tin nhắn theo từ khóa, người gửi, thời gian
- Xem file media (ảnh, video, tài liệu)

### 👥 Chat nhóm

- Tạo nhóm (tối thiểu 3 thành viên)
- Phân quyền: Owner · Admin · Member
- Thêm/xóa thành viên, rời nhóm
- Chuyển quyền sở hữu nhóm
- Cài đặt nhóm chi tiết:
  - Yêu cầu phê duyệt khi tham gia
  - Cho phép tham gia qua QR/Link mời
  - Phân quyền thành viên (đổi tên nhóm, ghim tin nhắn, tạo poll)
- Ghi chú nhóm (Group Notes)
- Bình chọn (Polls) trong nhóm

### 🔔 Nhắc việc (Reminders)

- Tạo nhắc việc cá nhân trong chat 1-1
- Tạo nhắc việc nhóm với nhiều người tham gia
- Nhận thông báo real-time khi đến giờ
- Lặp lại: Hàng ngày, hàng tuần, hàng tháng
- Quản lý lịch sử nhắc việc

### 📞 Cuộc gọi (Voice/Video)

- Cuộc gọi 1-1 (voice & video) với WebRTC
- Cuộc gọi nhóm (voice & video)
- Theo dõi cuộc gọi đang diễn ra

### 🤖 Chatbot AI

- Tích hợp **Google Gemini AI** để trả lời tự động
- Các chức năng:
  - Tóm tắt cuộc trò chuyện
  - Gợi ý câu chuyện phá băng (icebreaker) cho người lạ
  - Trò chuyện và hỏi đáp bình thường
- Fallback tự động khi model quá tải

### 🔐 Bảo mật & Quản lý

- Khóa/mở khóa tài khoản (Admin)
- Chặn thành viên khỏi nhóm
- Quản lý session đa thiết bị
- Đăng xuất từ xa

---

## 🏗 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                       │
│   React Web (TypeScript)  │  React Native (Mobile)  │
└──────────────────┬──────────────────────────────────┘
                   │  HTTP / WebSocket
┌──────────────────▼──────────────────────────────────┐
│                   Backend API                        │
│          Node.js + Express + TypeScript              │
│                   Socket.IO                          │
└──┬───────────┬─────────────┬───────────┬────────────┘
   │           │             │           │
┌──▼──┐  ┌────▼────┐  ┌─────▼──┐  ┌────▼────┐
│Auth │  │  Chat   │  │ Group  │  │AI/Bot   │
│     │  │ Message │  │ Chat   │  │ Service │
└──┬──┘  └────┬────┘  └─────┬──┘  └────┬────┘
   │           │             │           │
┌──▼───────────▼─────────────▼───────────▼────────────┐
│                    DATA LAYER                        │
│     MongoDB  │  Redis  │  Cloudinary CDN            │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Công nghệ sử dụng

| Layer            | Công nghệ                                                |
| ---------------- | -------------------------------------------------------- |
| **Backend**      | Node.js · Express · TypeScript · Socket.IO               |
| **Frontend Web** | React 18 · TypeScript · Vite · Tailwind CSS · Zustand    |
| **Mobile**       | React Native 0.81 · Expo 54 · React Navigation · Zustand |
| **Database**     | MongoDB 8.23 (users, messages, groups)                   |
| **Cache**        | Redis 5 (session, real-time presence)                    |
| **Media**        | Cloudinary CDN                                           |
| **AI**           | Google Gemini AI                                         |
| **Auth**         | JWT · bcrypt                                             |
| **Email/SMS**    | Nodemailer · InfiniReach SMS Gateway                     |
| **DevOps**       | Docker · GitHub Actions                                  |

---

## ⚙️ Cài đặt & Chạy thử

### Yêu cầu hệ thống

- Node.js `>= 22.x`
- MongoDB `>= 7.x`
- Redis `>= 5.x`

### 1. Clone repository

```bash
git clone https://github.com/ThanhMinh2104/OTT_EducationProject.git
cd OTT_EducationProject
```

### 2. Cài đặt Backend

```bash
cd backend
npm install
```

Tạo file `.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/ott_education
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key_here
JWT_EXPIRES=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite

# Email (optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# SMS Gateway (optional)
INFINIREACH_API_KEY=your_sms_api_key
```

Chạy backend:

```bash
npm run dev
```

### 3. Cài đặt Web

```bash
cd web
npm install
```

Tạo file `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Chạy web:

```bash
npm run dev
```

### 4. Cài đặt Mobile

```bash
cd mobile
npm install
```

Tạo file `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

Chạy mobile:

```bash
npm start
# Sau đó chọn:
# - Nhấn 'a' để chạy trên Android
# - Nhấn 'i' để chạy trên iOS
# - Quét QR code bằng Expo Go app
```

---

## 📁 Cấu trúc thư mục

```
OTT_EducationProject/
│
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── config/           # Cloudinary config
│       ├── middleware/       # Auth, error handler
│       ├── models/           # MongoDB Mongoose models
│       │   ├── User.ts
│       │   ├── Chat.ts
│       │   ├── ChatMember.ts
│       │   ├── Messages.ts
│       │   ├── Group.ts
│       │   ├── GroupMember.ts
│       │   ├── GroupMessage.ts
│       │   ├── Reminder.ts
│       │   ├── GroupReminder.ts
│       │   ├── Poll.ts
│       │   └── ...
│       ├── routes/           # API routes
│       │   ├── userRoutes.ts
│       │   ├── sessionRoutes.ts
│       │   ├── chatRoutes.ts
│       │   ├── groupRoutes.ts
│       │   └── reminderRoutes.ts
│       ├── services/         # Business logic
│       │   ├── botService.ts
│       │   ├── emailService.ts
│       │   ├── smsService.ts
│       │   ├── uploadService.ts
│       │   └── reminderScheduler.ts
│       ├── socket/           # Socket.IO handlers
│       │   ├── messageEvents.ts
│       │   ├── groupChatEvents.ts
│       │   ├── notificationEvents.ts
│       │   ├── groupCallEvents.ts
│       │   └── index.ts
│       └── index.ts          # Entry point
│
├── web/                      # React TypeScript (Vite)
│   └── src/
│       ├── components/       # UI components
│       ├── pages/            # Các trang
│       ├── hooks/            # Custom hooks
│       ├── utils/            # Helper functions
│       └── App.tsx
│
├── mobile/                   # React Native (Expo)
│   └── src/
│       ├── components/       # Shared components
│       ├── screens/          # Các màn hình
│       ├── navigation/       # React Navigation
│       ├── hooks/            # Custom hooks
│       └── utils/            # Helper functions
│
└── README.md
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint              | Mô tả              |
| ------ | --------------------- | ------------------ |
| `POST` | `/api/registerUser`   | Đăng ký tài khoản  |
| `POST` | `/api/login`          | Đăng nhập          |
| `POST` | `/api/logout`         | Đăng xuất          |
| `POST` | `/api/send-otp`       | Gửi OTP qua email  |
| `POST` | `/api/send-otp-sms`   | Gửi OTP qua SMS    |
| `POST` | `/api/verify-otp`     | Xác thực OTP email |
| `POST` | `/api/verify-otp-sms` | Xác thực OTP SMS   |

### User Management

| Method | Endpoint                        | Mô tả                              |
| ------ | ------------------------------- | ---------------------------------- |
| `POST` | `/api/usersID`                  | Lấy thông tin user theo ID         |
| `POST` | `/api/users/batch`              | Lấy nhiều users cùng lúc           |
| `PUT`  | `/api/users/:userID`            | Cập nhật thông tin cá nhân         |
| `PUT`  | `/api/users/:userID/password`   | Đổi mật khẩu                       |
| `POST` | `/api/users/doimatkhau`         | Đặt lại mật khẩu (sau OTP)         |
| `GET`  | `/api/users/qr-profile/:userID` | Thông tin public (QR kết bạn)      |
| `POST` | `/api/updateStatus`             | Cập nhật trạng thái online/offline |

### Session Management

| Method   | Endpoint                   | Mô tả                             |
| -------- | -------------------------- | --------------------------------- |
| `GET`    | `/api/sessions`            | Danh sách thiết bị đang đăng nhập |
| `DELETE` | `/api/sessions/:sessionId` | Đăng xuất thiết bị từ xa          |
| `DELETE` | `/api/sessions/others/all` | Đăng xuất tất cả thiết bị khác    |
| `GET`    | `/api/login-history`       | Lịch sử đăng nhập                 |

### Chat 1-1

| Method   | Endpoint                       | Mô tả                       |
| -------- | ------------------------------ | --------------------------- |
| `POST`   | `/api/chats/userID`            | Lấy danh sách chat          |
| `POST`   | `/api/chats/strangers`         | Danh sách tin nhắn người lạ |
| `POST`   | `/api/chats/strangers/summary` | Tóm tắt tin nhắn người lạ   |
| `POST`   | `/api/chats1-1ByUserID`        | Lấy chat 1-1 giữa 2 người   |
| `POST`   | `/api/createChat1-1`           | Tạo chat 1-1 mới            |
| `POST`   | `/api/messages/id`             | Lấy tin nhắn theo chatID    |
| `GET`    | `/api/chat/:chatID`            | Thông tin 1 chat            |
| `GET`    | `/api/messages/search`         | Tìm kiếm tin nhắn           |
| `GET`    | `/api/chats/:chatID/media`     | Lấy media/file của chat     |
| `DELETE` | `/api/chats/:chatID/history`   | Xóa lịch sử trò chuyện      |

### Group Chat

| Method   | Endpoint                                    | Mô tả                     |
| -------- | ------------------------------------------- | ------------------------- |
| `POST`   | `/api/groups/create`                        | Tạo nhóm                  |
| `GET`    | `/api/groups`                               | Danh sách nhóm của user   |
| `GET`    | `/api/groups/:groupID`                      | Chi tiết nhóm             |
| `PUT`    | `/api/groups/:groupID`                      | Cập nhật thông tin nhóm   |
| `PUT`    | `/api/groups/:groupID/settings`             | Cập nhật cài đặt nhóm     |
| `POST`   | `/api/groups/:groupID/members`              | Thêm thành viên           |
| `DELETE` | `/api/groups/:groupID/members/:userID`      | Xóa thành viên            |
| `POST`   | `/api/groups/:groupID/leave`                | Rời nhóm                  |
| `PUT`    | `/api/groups/:groupID/members/:userID/role` | Phân quyền thành viên     |
| `GET`    | `/api/groups/join-info/:groupID`            | Thông tin nhóm (QR/Link)  |
| `POST`   | `/api/groups/join/:groupID`                 | Tham gia nhóm qua QR/Link |

### Reminders

| Method   | Endpoint                           | Mô tả                   |
| -------- | ---------------------------------- | ----------------------- |
| `POST`   | `/api/reminders`                   | Tạo nhắc việc cá nhân   |
| `GET`    | `/api/reminders/:chatID`           | Lấy danh sách nhắc việc |
| `DELETE` | `/api/reminders/:reminderID`       | Xóa nhắc việc           |
| `POST`   | `/api/group-reminders`             | Tạo nhắc việc nhóm      |
| `GET`    | `/api/group-reminders/:groupID`    | Lấy nhắc việc nhóm      |
| `DELETE` | `/api/group-reminders/:reminderID` | Xóa nhắc việc nhóm      |

### Upload

| Method | Endpoint               | Mô tả                              |
| ------ | ---------------------- | ---------------------------------- |
| `POST` | `/api/upload`          | Upload file/ảnh/video              |
| `POST` | `/api/upload/audio`    | Upload tin nhắn thoại              |
| `POST` | `/api/upload/document` | Upload tài liệu (PDF, Word, Excel) |

### Admin

| Method | Endpoint                 | Mô tả             |
| ------ | ------------------------ | ----------------- |
| `POST` | `/api/admin/lock-user`   | Khóa tài khoản    |
| `POST` | `/api/admin/unlock-user` | Mở khóa tài khoản |

> 📖 Chi tiết đầy đủ xem tại code trong `backend/src/routes/`

---

## 📅 Kế hoạch phát triển

| Tuần    | Nội dung                                       |
| ------- | ---------------------------------------------- |
| Tuần 2  | Đăng ký nhóm · Setup project · Database design |
| Tuần 4  | Auth API · User management                     |
| Tuần 6  | Chat 1-1 · Socket.IO                           |
| Tuần 8  | Group chat · Media upload                      |
| Tuần 9  | AI Chatbot · Mobile app                        |
| Tuần 10 | Reminders · Polls · Deploy                     |
| Tuần 11 | Hoàn thiện · Nộp báo cáo                       |

---

## 👥 Thành viên nhóm

| STT | Họ tên               | MSSV     |
| --- | -------------------- | -------- |
| 1   | Nguyễn Hồ Thanh Minh | 22633361 |
| 2   | Trần Công Minh       | 22638121 |
| 3   | Nguyễn Tấn Lợi       | 22635561 |
| 4   | Nguyễn Tấn Tài       | 22669451 |
| 5   | Nguyễn Thành Trung   | 22669481 |

---

## 📄 License

MIT © 2025-2026 - DHKTPM18, IUH

---

<div align="center">

Made with ❤️ by **DHKTPM18 - IUH**

</div>
