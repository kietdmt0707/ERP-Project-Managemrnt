# Quy Tắc Phát Triển Dự Án (Developer Rules)

Khi phát triển hoặc chỉnh sửa bất kỳ chức năng nào trong hệ thống, hãy tuân thủ nghiêm ngặt các quy tắc sau để đảm bảo độ tin cậy và tránh lỗi vặt:

## 1. Kiểm tra Imports & Khai báo biến
*   Sau khi thêm mã nguồn mới hoặc gọi các Service API mới (ví dụ: `userService`, `masterDataService`, `projectService`), luôn kiểm tra xem các đối tượng này đã được import chính xác ở đầu file chưa.
*   Tránh các lỗi thiếu import gây sập build TypeScript (`tsc`).

## 2. Rà soát tương thích hệ màu & PostCSS
*   Khi sử dụng hệ màu động thông qua CSS Variables (ví dụ: `var(--color-brand-500)`), **tuyệt đối không** sử dụng cú pháp chia độ trong suốt của Tailwind CSS như `@apply border-brand-500/30` vì PostCSS sẽ bị lỗi biên dịch tĩnh (Compile Error) tại build time.
*   Thay vào đó, hãy viết CSS tiêu chuẩn sử dụng hàm `color-mix(in srgb, var(--color-brand-500) 30%, transparent)` để đảm bảo độ tương thích và tốc độ biên dịch.

## 3. Rà soát Model Binding & JSON Cycles
*   Khi gửi payload từ Frontend lên Backend chứa các thực thể có mối quan hệ liên kết lồng nhau (Navigation Properties), luôn thực hiện lọc sạch dữ liệu (clean payload) để chỉ gửi các trường ID cơ bản (`projectId`, `userId`, v.v.).
*   Điều này giúp loại bỏ hoàn toàn lỗi vòng lặp tuần hoàn JSON (JsonException Cycle) trong lớp Model Binding của ASP.NET Core trước khi đi vào Controller.

## 4. Tự kiểm tra quyền hạn (Self-update & Security)
*   Khi cấu hình các endpoint bảo mật của User/Project, đảm bảo cho phép người dùng tự cập nhật thông tin cá nhân cơ bản của họ (Self-update) nhưng chặn quyền sửa đổi các trường phân quyền hệ thống (`GlobalRoleId`, `IsActive`, `ExpiryDate`).
