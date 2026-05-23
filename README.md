# Plant Care – Hệ thống nhận diện bệnh cây trồng

Ứng dụng nhận diện bệnh lúa bằng AI (YOLOv11 + Swin Transformer), gồm backend FastAPI, mobile app Expo React Native và triển khai qua Docker.

---

## Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| Docker Desktop | 24+ |
| Git LFS | 3.0+ |
| PostgreSQL | 16 (qua Docker) |

---

## 1. Clone dự án và lấy model

Dự án dùng **Git LFS** để lưu file model lớn. Cần cài Git LFS trước khi clone:

```bash
# Cài Git LFS (một lần duy nhất)
git lfs install

# Clone repo (model sẽ tự tải về qua LFS)
git clone <repo-url> plant-care
cd plant-care
```

Nếu đã clone rồi mà chưa có model:

```bash
git lfs pull
```

Sau bước này, thư mục `models/` sẽ có:
- `best.pt` – model YOLOv11 phát hiện bệnh
- `swin_classifier.pth` – Swin Transformer phân loại
- `swin_embedding.pth` – Swin Transformer trích xuất đặc trưng
- `prototypes.npz` – prototype embeddings

---

## 2. Chạy bằng Docker (khuyến nghị)

### 2a. Chế độ phát triển

```bash
docker compose up --build
```

Truy cập:
- Backend API: `http://localhost:8000/docs`
- Frontend (web): `http://localhost:8081`

### 2b. Chế độ demo (production-like)

```bash
docker compose -f docker-compose.demo.yml up --build
```

Thêm vào file `hosts` (`C:\Windows\System32\drivers\etc\hosts` trên Windows):

```
127.0.0.1  plantcare.local
```

Truy cập: `http://plantcare.local`

---

## 3. Chạy thủ công (không Docker)

### 3a. Backend

```bash
cd backend

# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

# Cài dependencies
pip install -r requirements.txt

# Tạo file .env
cp .env.example .env            # hoặc tạo tay (xem bên dưới)

# Chạy server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Nội dung file `backend/.env`:

```env
DATABASE_URL=postgresql://plantcare:plantcare@localhost:5432/plantcare
MODEL_DIR=../models
SECRET_KEY=your-secret-key-here
```

### 3b. Frontend Mobile

```bash
cd frontend-mobile

# Cài dependencies
npm install

# Chạy Expo
npx expo start
```

Quét QR bằng **Expo Go** (iOS/Android) hoặc nhấn `w` để mở trên trình duyệt.

---

## 4. Khởi tạo database

Sau khi backend đang chạy, chạy migration để tạo bảng và seed dữ liệu:

```bash
cd backend
python migrate.py
```

---

## 5. Tài khoản mặc định

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@plantcare.com` | `admin123` |
| User | `user@plantcare.com` | `user123` |

---

## Cấu trúc dự án

```
plant-care/
├── backend/            # FastAPI + SQLAlchemy
│   ├── main.py
│   ├── models.py       # DB models
│   ├── predictor.py    # AI inference
│   ├── routers/        # API endpoints
│   └── requirements.txt
├── frontend-mobile/    # Expo React Native
│   ├── App.js
│   └── src/
│       ├── screens/
│       ├── navigation/
│       └── services/
├── models/             # ML model weights (Git LFS)
├── docker/             # Nginx config
├── docker-compose.yml
└── docker-compose.demo.yml
```
