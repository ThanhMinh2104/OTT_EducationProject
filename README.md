<div align="center">

```
 ██████╗ ████████╗████████╗    ███████╗██████╗ ██╗   ██╗
██╔═══██╗╚══██╔══╝╚══██╔══╝    ██╔════╝██╔══██╗██║   ██║
██║   ██║   ██║      ██║       █████╗  ██║  ██║██║   ██║
██║   ██║   ██║      ██║       ██╔══╝  ██║  ██║██║   ██║
╚██████╔╝   ██║      ██║       ███████╗██████╔╝╚██████╔╝
 ╚═════╝    ╚═╝      ╚═╝       ╚══════╝╚═════╝  ╚═════╝
```

# 🎓 OTT Education — Hệ thống nhắn tin thời gian thực cho giáo dục

**Đồ án môn học:** Công nghệ mới trong phát triển ứng dụng CNTT  
**Học kỳ:** HK2 — 2025–2026 | **Lớp:** DHKTPM18 | **Trường:** IUH

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.79-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://mysql.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
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

**OTT Education** là hệ thống nhắn tin thời gian thực dành riêng cho môi trường giáo dục, mô phỏng các tính năng cốt lõi của Zalo. Hệ thống hỗ trợ giao tiếp giữa giảng viên và sinh viên, quản lý nhóm lớp học, chia sẻ tài liệu và tích hợp chatbot AI.

> 💡 Dự án được xây dựng theo quy trình **Requirement → Design → Code → Test → Deploy**, sử dụng kiến trúc microservice-lite với backend Node.js, frontend React TypeScript và ứng dụng mobile React Native.

---

## ✨ Tính năng

### 👤 Quản lý người dùng
- Đăng ký / Đăng nhập với JWT Authentication
- Quản lý hồ sơ cá nhân, avatar
- Danh sách bạn bè, gửi lời mời kết bạn

### 💬 Chat thời gian thực
- Chat **1-1** và **nhóm** (Group chat)
- Hỗ trợ đa dạng loại tin nhắn: `text` · `image` · `video` · `document` · `emoji`
- Hiển thị trạng thái **đang gõ...**, **đã xem**, **online/offline**
- Lưu lịch sử chat đầy đủ

### 🤖 Chatbot & AI
- Tích hợp **Claude AI** (Anthropic) để trả lời tự động
- Chatbot hỗ trợ giải đáp câu hỏi học tập
- Ghi log lịch sử hội thoại với bot

### 📊 Thống kê & Phân tích
- Thống kê số lượng tin nhắn theo ngày/tuần/tháng
- Phân tích mức độ hoạt động người dùng
- Báo cáo hoạt động nhóm chat

---

## 🏗 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                       │
│   React Web (TypeScript)  │  React Native (Mobile)  │
└──────────────────┬──────────────────────────────────┘
                   │  HTTP / WebSocket
┌──────────────────▼──────────────────────────────────┐
│              API Gateway / Nginx                     │
│         Load Balancing · SSL · Rate Limit            │
└──┬───────────┬─────────────┬───────────┬────────────┘
   │           │             │           │
┌──▼──┐  ┌────▼────┐  ┌─────▼──┐  ┌────▼────┐
│Auth │  │  Chat   │  │ Media  │  │AI/Bot   │
│Svc  │  │  Svc    │  │  Svc   │  │  Svc    │
└──┬──┘  └────┬────┘  └─────┬──┘  └────┬────┘
   │           │             │           │
┌──▼───────────▼─────────────▼───────────▼────────────┐
│                    DATA LAYER                        │
│   MySQL  │  MongoDB  │  Redis  │  Cloudinary CDN    │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Công nghệ sử dụng

| Layer | Công nghệ |
|---|---|
| **Backend** | Node.js · Express · TypeScript · Socket.IO |
| **Frontend Web** | React 19 · TypeScript · Vite · Tailwind CSS · Zustand |
| **Mobile** | React Native · React Navigation · Reanimated |
| **Database** | MySQL 8 (users/groups) · MongoDB 7 (messages) |
| **Cache** | Redis (presence · session · rate limit) |
| **Media** | Cloudinary CDN |
| **AI** | Anthropic Claude API |
| **Auth** | JWT · bcrypt |
| **DevOps** | Docker · GitHub Actions · Railway / Render |

---

## ⚙️ Cài đặt & Chạy thử

### Yêu cầu hệ thống

- Node.js `>= 22.x`
- MySQL `8.x`
- MongoDB `7.x`
- Redis `7.x`

### 1. Clone repository

```bash
git clone https://github.com/ThanhMinh2104/OTT_EducationProject.git
cd OTT_EducationProject
```

### 2. Cài đặt Backend

```bash
cd backend
npm install
cp .env.example .env   # Điền các biến môi trường
npm run dev
```

### 3. Cài đặt Web

```bash
cd web
npm install
npm run dev
```

### 4. Cài đặt Mobile

```bash
cd mobile
npm install
cd ios && pod install && cd ..   # iOS only
npm run android   # hoặc npm run ios
```

### 5. Biến môi trường (backend/.env)

```env
PORT=5000
MYSQL_HOST=localhost
MYSQL_DB=ott_education
MYSQL_USER=root
MYSQL_PASS=your_password
MONGO_URI=mongodb://localhost:27017/ott_messages
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 📁 Cấu trúc thư mục

```
OTT_EducationProject/
│
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── config/           # Database, Redis config
│       ├── middlewares/      # Auth, upload, error handler
│       ├── modules/
│       │   ├── auth/         # Đăng ký, đăng nhập
│       │   ├── user/         # Hồ sơ, danh bạ
│       │   ├── group/        # Quản lý nhóm
│       │   ├── message/      # Gửi/nhận tin nhắn
│       │   ├── media/        # Upload file
│       │   ├── chatbot/      # AI integration
│       │   └── stats/        # Thống kê
│       ├── sockets/          # Socket.IO handlers
│       └── index.ts
│
├── web/                      # React TypeScript (Vite)
│   └── src/
│       ├── components/       # UI components
│       ├── pages/            # Các trang
│       ├── stores/           # Zustand stores
│       ├── hooks/            # Custom hooks
│       └── services/         # API calls
│
├── mobile/                   # React Native
│   └── src/
│       ├── screens/          # Màn hình
│       ├── navigation/       # React Navigation
│       ├── components/       # Shared components
│       └── stores/           # Zustand stores
│
└── shared/                   # Types dùng chung
    ├── types/
    └── constants/
```

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản |
| `POST` | `/api/auth/login` | Đăng nhập |
| `GET` | `/api/users/me` | Thông tin cá nhân |
| `GET` | `/api/conversations` | Danh sách cuộc trò chuyện |
| `GET` | `/api/messages/:convId` | Lịch sử tin nhắn |
| `POST` | `/api/messages` | Gửi tin nhắn |
| `GET` | `/api/groups` | Danh sách nhóm |
| `POST` | `/api/groups` | Tạo nhóm mới |
| `POST` | `/api/chatbot/message` | Gửi tin nhắn cho bot |
| `GET` | `/api/stats/overview` | Thống kê tổng quan |

> 📖 Chi tiết API xem tại [docs/API.md](docs/API.md)

---

## 🐛 Debug & Troubleshooting

### Debug Endpoints (Development only)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/debug/fix-all-alias` | Fix tất cả alias sai trong database |
| `POST` | `/api/debug/fix-alias` | Fix alias của user hiện tại |
| `POST` | `/api/debug/delete-my-contacts` | Xóa tất cả contacts của user |
| `POST` | `/api/debug/create-test-chat` | Tạo chat test |

### Hướng dẫn Fix lỗi

- **Fix lỗi Alias trong Contacts**: Xem [FIX_ALIAS_GUIDE.md](./FIX_ALIAS_GUIDE.md)
- **Tối ưu hiệu suất**: Xem [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)
- **Hướng dẫn commit**: Xem [COMMIT_GUIDE.md](./COMMIT_GUIDE.md)

### Scripts hữu ích

```bash
# Windows PowerShell - Fix alias
.\test_fix_alias.ps1 YOUR_TOKEN_HERE

# Linux/Mac - Fix alias
bash test_fix_alias.sh YOUR_TOKEN_HERE

# MongoDB Script (trong MongoDB Compass)
# Mở file: fix_alias.mongodb.js
```

---

## 👥 Thành viên nhóm

| STT | Họ tên | MSSV | Vai trò |
|---|---|---|---|
| 1 | Nguyễn Hồ Thành Minh | 22xxxxxx | Nhóm trưởng · Backend · DevOps |
| 2 | *(Thành viên 2)* | 22xxxxxx | Frontend Web |
| 3 | *(Thành viên 3)* | 22xxxxxx | Mobile |
| 4 | *(Thành viên 4)* | 22xxxxxx | Database · Backend |
| 5 | *(Thành viên 5)* | 22xxxxxx | UI/UX · Testing |

---

## 📅 Kế hoạch release

| Tuần | Nội dung |
|---|---|
| Tuần 2 | Đăng ký nhóm · Setup project · Database design |
| Tuần 4 | Auth API · User management |
| Tuần 6 | Chat 1-1 · Socket.IO |
| Tuần 8 | Group chat · Media upload |
| Tuần 9 | AI Chatbot · Mobile app |
| Tuần 10 | Thống kê · Deploy lên Cloud |
| Tuần 11 | Hoàn thiện · Nộp báo cáo |

---

## 📄 License

MIT © 2025–2026 — DHKTPM18, IUH

---

<div align="center">

Made with ❤️ by **DHKTPM18 — IUH**

</div>
