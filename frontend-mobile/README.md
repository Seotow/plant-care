# Frontend Mobile Skeleton

## Tổng quan

Ứng dụng được dựng bằng Expo React Native (JavaScript) để chạy trên iOS, Android, web.

Đã có sẵn:

- Dashboard chính với fake data
- Quản lý danh sách vườn
- Màn hình quét bệnh (khung)
- Lịch sử nhận diện (fake)
- Thông tin cá nhân

## Cấu trúc nhanh

- App.js: entry point
- src/navigation: bottom tab navigator
- src/screens: các màn hình
- src/components: UI reusable
- src/data/mockData.js: dữ liệu fake
- src/services/mockApi.js: fake API có delay

## Chạy trên mobile

1. Cài Node.js LTS (khuyến nghị 20.x)
2. Cài Expo Go trên điện thoại
3. Chạy lệnh:

   npm install
   npm run start

4. Mở Expo Go trên điện thoại và quét QR code trong terminal

## Chạy trên web

npm run web

## Kết nối backend thật

Khi co backend FastAPI:

1. Tạo file src/config.js
2. Thêm API_BASE_URL
3. Thay các hàm trong src/services/mockApi.js bằng axios call thật
