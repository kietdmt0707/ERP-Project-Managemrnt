# HỆ THỐNG QUẢN LÝ DỰ ÁN ORACLE ERP (ARON ERP-PM) - POSTGRESQL VERSION

Thư mục này chứa bản thiết kế cơ sở dữ liệu và tài liệu kỹ thuật của phần mềm Quản lý Dự án Triển khai Oracle ERP, được tối ưu hóa cho **PostgreSQL** để triển khai miễn phí trên Render, Vercel, và Neon/Supabase.

## 📁 Cấu trúc thư mục hiện tại
- [`database/schema.sql`](file:///Users/kietdmt/Build%20Project/database/schema.sql): Script tạo cấu trúc database PostgreSQL cho toàn hệ thống (Dự án, Sites, Phân hệ, Phân quyền, Task 3 cấp, Phê duyệt 3 cấp, RICEFW, Môi trường và chính sách bảo mật Row-Level Security bản địa).
- [`database/seed_data.sql`](file:///Users/kietdmt/Build%20Project/database/seed_data.sql): Script tạo dữ liệu mẫu hoàn chỉnh theo chuẩn PostgreSQL.

---

## 🛠️ Hướng dẫn Kỹ thuật & Hiện thực hóa Kiến trúc

### 1. Cách truy vấn hiển thị cây thư mục Task 3 Cấp (WBS Hierarchy Query)
Để vẽ sơ đồ Gantt hoặc hiển thị danh sách dạng cây trong PostgreSQL, sử dụng truy vấn đệ quy **Recursive CTE**:

```sql
WITH RECURSIVE TaskTree AS (
    -- Anchor member: Lấy các Task cấp 1 (ParentTaskId IS NULL)
    SELECT 
        TaskId, TaskCode, TaskName, TaskLevel, ParentTaskId, ProgressPercent, Status,
        TaskName::TEXT AS Path
    FROM Tasks
    WHERE ParentTaskId IS NULL AND ProjectId = 1
    
    UNION ALL
    
    -- Recursive member: Kết nối các Task cấp con
    SELECT 
        t.TaskId, t.TaskCode, t.TaskName, t.TaskLevel, t.ParentTaskId, t.ProgressPercent, t.Status,
        (tt.Path || ' > ' || t.TaskName)::TEXT
    FROM Tasks t
    INNER JOIN TaskTree tt ON t.ParentTaskId = tt.TaskId
)
SELECT TaskId, TaskCode, TaskName, TaskLevel, ProgressPercent, Status, Path
FROM TaskTree
ORDER BY TaskCode;
```

---

### 2. Hiện thực Row-Level Security (RLS) trên PostgreSQL
PostgreSQL hỗ trợ bảo mật mức hàng (RLS) trực tiếp bằng cách áp dụng chính sách (`POLICY`) lên bảng:

1.  **Hàm kiểm tra quyền thành viên (defined in schema.sql)**:
    ```sql
    CREATE OR REPLACE FUNCTION check_project_membership(proj_id INT)
    RETURNS BOOLEAN AS $$
    BEGIN
        RETURN (
            -- Hệ thống Admin được quyền xem hết
            current_setting('app.current_user_role', true) = 'SYSTEM_ADMIN'
            -- Hoặc người dùng là thành viên hoạt động trong dự án này
            OR EXISTS (
                SELECT 1 
                FROM ProjectMembers pm
                JOIN Users u ON pm.UserId = u.UserId
                WHERE pm.ProjectId = proj_id 
                  AND u.Username = current_setting('app.current_username', true)
                  AND pm.IsActive = TRUE
            )
        );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```

2.  **Kích hoạt và tạo Policy cho các bảng (ví dụ bảng Tasks)**:
    ```sql
    ALTER TABLE Tasks ENABLE ROW LEVEL SECURITY;

    CREATE POLICY task_rls_policy ON Tasks 
        FOR ALL USING (check_project_membership(ProjectId));
    ```

3.  **Cách Backend (.NET Core) kích hoạt Context kết nối**:
    Mỗi khi thực hiện một Request từ người dùng, Backend API sẽ gán thông tin đăng nhập vào session của PostgreSQL trước khi thực thi truy vấn:
    ```csharp
    using (var command = connection.CreateCommand())
    {
        command.CommandText = @"
            SELECT set_config('app.current_username', @username, true);
            SELECT set_config('app.current_user_role', @role, true);
        ";
        command.Parameters.AddWithValue("@username", currentUser.Username);
        command.Parameters.AddWithValue("@role", currentUser.RoleCode);
        command.ExecuteNonQuery();
    }
    ```
    *Lưu ý: Tham số thứ 3 `true` trong hàm `set_config` chỉ ra rằng cấu hình này chỉ có giá trị trong Transaction hiện tại (Local Session), tự động biến mất khi đóng hoặc trả kết nối về pool.*

---

### 3. Cơ chế Phê duyệt Nhanh qua Email (One-click Approval Token)
*   **Tạo Token**: Khi gửi yêu cầu phê duyệt, Backend tạo một chuỗi token ngẫu nhiên bảo mật cao và lưu vào cột `SecureToken` của bảng `ApprovalSteps`.
*   **Duyệt nhanh**: Khi nhấp vào các nút **[Phê duyệt Nhanh]** hoặc **[Từ chối Nhanh]** trong email, trình duyệt sẽ gửi yêu cầu trực tiếp đến endpoint API `/api/approvals/quick-action?token=...&action=...`. API xác thực token, thực hiện cập nhật bước duyệt hiện tại, di chuyển sang bước tiếp theo, và cập nhật trạng thái mục tiêu (Timesheet/Trip/Expense) mà không yêu cầu đăng nhập.

---

### 4. Đưa ứng dụng lên Cloud miễn phí (Render + Vercel + Neon)
*   **Database**: Đăng ký một tài khoản PostgreSQL miễn phí tại **Neon.tech** hoặc **Supabase.com**, copy chuỗi kết nối (Connection String).
*   **Backend (Web API)**: Tạo tài khoản tại **Render.com**, liên kết kho lưu trữ GitHub chứa thư mục `backend/` và cấu hình biến môi trường `ConnectionStrings__DefaultConnection` trỏ đến Neon/Supabase DB.
*   **Frontend (React)**: Tạo tài khoản tại **Vercel.com**, liên kết kho lưu trữ GitHub chứa thư mục `frontend/` để tự động build và chạy trực tuyến.
