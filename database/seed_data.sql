-- ============================================================================
-- SEED DATA FOR ARON ERP PROJECT MANAGEMENT SYSTEM (ARON ERP-PM)
-- Target RDBMS: PostgreSQL 12+
-- ============================================================================

-- 1. Insert Master Roles
INSERT INTO Roles (RoleCode, RoleName, HierarchyLevel) VALUES
('SYSTEM_ADMIN', 'Quản trị viên hệ thống', 1),
('DIRECTOR', 'Giám đốc dự án', 2),
('PM', 'Quản trị dự án (PM)', 3),
('LEADER', 'Trưởng phân hệ (Leader)', 4),
('MEMBER', 'Thành viên đội dự án (Member)', 5);

-- 2. Insert Users
INSERT INTO Users (Username, PasswordHash, FullName, Title, Email, Phone, IsActive) VALUES
('admin', 'HASH_PLACEHOLDER_ADMIN', 'Nguyễn Văn Admin', 'System Administrator', 'admin@aron.vn', '0901234567', TRUE),
('director_aron', 'HASH_PLACEHOLDER_DIR', 'Trần Director', 'Giám đốc Dự án ARON', 'director@aron.vn', '0907654321', TRUE),
('pm_john', 'HASH_PLACEHOLDER_PM', 'John PM', 'Project Manager', 'john.pm@aron.vn', '0912345678', TRUE),
('lead_fin', 'HASH_PLACEHOLDER_LEAD_FIN', 'Lê Lead Finance', 'Fiancial Module Lead', 'lead.fin@aron.vn', '0987654321', TRUE),
('member_ap', 'HASH_PLACEHOLDER_AP', 'Nguyễn Member AP', 'Consultant AP', 'member.ap@aron.vn', '0977654321', TRUE),
('member_tech', 'HASH_PLACEHOLDER_TECH', 'Phạm Tech Developer', 'Technical Consultant', 'member.tech@aron.vn', '0967654321', TRUE),
('client_pm', 'HASH_PLACEHOLDER_CLIENT_PM', 'Phan Client PM', 'Project Manager Khách Hàng', 'pm@client.com', '0957654321', TRUE);

-- 3. Insert Sample Project
INSERT INTO Projects (ProjectCode, ProjectName, Address, SitesCount, ContactInfo, LogoPath) VALUES
('PRJ-ORACLE-ABC', 'Triển khai Oracle ERP Fusion Cloud - Tập đoàn ABC', '72 Lê Thánh Tôn, Quận 1, TP. HCM', 2, 'Mr. Phan Client PM - pm@client.com - 0957654321', '/assets/logos/abc_corp.png');

-- 4. Insert Project Sites
INSERT INTO ProjectSites (ProjectId, SiteName, Address, ContactName, Phone, Email) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'Trụ sở chính TP.HCM', '72 Lê Thánh Tôn, Quận 1, TP. HCM', 'Phan Client PM', '0957654321', 'pm@client.com'),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'Nhà máy Bình Dương', 'KCN VSIP II, Thủ Dầu Một, Bình Dương', 'Nguyễn Quản Lý Kho', '0947654321', 'warehouse@client.com');

-- 5. Insert Teams for the Project
INSERT INTO Teams (ProjectId, TeamName, ParentTeamId) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'Đội dự án ARON (Nhà cung cấp)', NULL),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'Đội dự án Khách hàng (ABC Group)', NULL);

-- 6. Insert Functional Sub-teams
INSERT INTO FunctionalTeams (TeamId, FunctionalTeamName) VALUES
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án ARON (Nhà cung cấp)'), 'Team FIN (Tài chính)'),
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án ARON (Nhà cung cấp)'), 'Team SCM (Chuỗi cung ứng)'),
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án ARON (Nhà cung cấp)'), 'Team Tech (Kỹ thuật & DBA)'),
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án Khách hàng (ABC Group)'), 'Ban Chỉ Đạo & PMO'),
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án Khách hàng (ABC Group)'), 'Key User FIN'),
((SELECT TeamId FROM Teams WHERE ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC') AND TeamName = 'Đội dự án Khách hàng (ABC Group)'), 'Key User SCM');

-- 8. Assign Users to Project Members (Project Membership & Role Mapping)
INSERT INTO ProjectMembers (ProjectId, UserId, FunctionalTeamId, RoleId, DailyRate, IsActive) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'director_aron'), NULL, (SELECT RoleId FROM Roles WHERE RoleCode = 'DIRECTOR'), 500.00, TRUE),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'pm_john'), NULL, (SELECT RoleId FROM Roles WHERE RoleCode = 'PM'), 350.00, TRUE),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'lead_fin'), (SELECT FunctionalTeamId FROM FunctionalTeams WHERE FunctionalTeamName = 'Team FIN (Tài chính)' AND TeamId = (SELECT TeamId FROM Teams WHERE TeamName = 'Đội dự án ARON (Nhà cung cấp)' LIMIT 1)), (SELECT RoleId FROM Roles WHERE RoleCode = 'LEADER'), 250.00, TRUE),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'member_ap'), (SELECT FunctionalTeamId FROM FunctionalTeams WHERE FunctionalTeamName = 'Team FIN (Tài chính)' AND TeamId = (SELECT TeamId FROM Teams WHERE TeamName = 'Đội dự án ARON (Nhà cung cấp)' LIMIT 1)), (SELECT RoleId FROM Roles WHERE RoleCode = 'MEMBER'), 150.00, TRUE),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'member_tech'), (SELECT FunctionalTeamId FROM FunctionalTeams WHERE FunctionalTeamName = 'Team Tech (Kỹ thuật & DBA)' AND TeamId = (SELECT TeamId FROM Teams WHERE TeamName = 'Đội dự án ARON (Nhà cung cấp)' LIMIT 1)), (SELECT RoleId FROM Roles WHERE RoleCode = 'MEMBER'), 180.00, TRUE),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), (SELECT UserId FROM Users WHERE Username = 'client_pm'), (SELECT FunctionalTeamId FROM FunctionalTeams WHERE FunctionalTeamName = 'Ban Chỉ Đạo & PMO' AND TeamId = (SELECT TeamId FROM Teams WHERE TeamName = 'Đội dự án Khách hàng (ABC Group)' LIMIT 1)), (SELECT RoleId FROM Roles WHERE RoleCode = 'PM'), 0.00, TRUE);

-- 9. TASK LIST IMPLEMENTATION (3-LEVEL HIERARCHY)
-- LEVEL 1: Phase 1 - Analyze & Design (Khảo sát & Thiết kế giải pháp)
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1', 'Khảo sát & Thiết kế giải pháp (Analyze & Design)', 'Khảo sát quy trình nghiệp vụ hiện tại (As-is) và thiết kế giải pháp tương lai (To-be) trên Oracle Fusion Cloud', 1, NULL, 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 '2026-08-01', '2026-09-15', 45, 15.00, 'IN_PROGRESS');

-- LEVEL 2: Under Phase 1 - Finance Module (Phân hệ Tài chính)
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1.1', 'Phân hệ Tài chính (Finance Module)', 'Khảo sát nghiệp vụ và xây dựng tài liệu giải pháp cho GL, AP, AR, FA', 2, 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'lead_fin')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 '2026-08-01', '2026-08-30', 30, 20.00, 'IN_PROGRESS');

-- LEVEL 3: Under Finance Module - Detailed Tasks
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1.1.1', 'Khảo sát Quy trình Tài khoản Phải trả (AP)', 'Họp Key User để khảo sát quy trình hóa đơn, thanh toán nhà cung cấp', 3, 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'lead_fin')), 
 '2026-08-02', '2026-08-10', 8, 100.00, 'COMPLETED'),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1.1.2', 'Viết tài liệu thiết kế giải pháp chức năng AP (RD030 / MD050)', 'Biên soạn tài liệu giải pháp tương lai (To-be Process Setup) cho Phải trả (AP)', 3, 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'lead_fin')), 
 '2026-08-11', '2026-08-25', 14, 25.00, 'IN_PROGRESS');

-- LEVEL 2: Under Phase 1 - Technical & Integrations (Kỹ thuật & Tích hợp)
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1.2', 'Kỹ thuật & Tích hợp (Technical & Integration Design)', 'Thiết kế giao diện tích hợp hệ thống (RICEFW) và chuyển đổi dữ liệu', 2, 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_tech')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 '2026-08-15', '2026-09-15', 31, 0.00, 'NOT_STARTED');

-- LEVEL 3: Under Technical - Detailed Tasks
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '1.2.1', 'Thiết kế giải pháp tích hợp hóa đơn điện tử (RICEFW-I01)', 'Viết tài liệu đặc tả chức năng (MD050) cho tích hợp Hóa đơn điện tử với Oracle Fusion AP', 3, 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.2' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_tech')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 '2026-08-15', '2026-08-30', 15, 0.00, 'NOT_STARTED');

-- LEVEL 1: Phase 2 - System Build (Xây dựng hệ thống)
INSERT INTO Tasks (ProjectId, TaskCode, TaskName, Description, TaskLevel, ParentTaskId, AssigneeMemberId, ApproverMemberId, StartDatePlanned, EndDatePlanned, DurationPlanned, ProgressPercent, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), '2', 'Xây dựng hệ thống (System Build)', 'Cấu hình tham số trên môi trường Oracle và lập trình các đối tượng RICEFW', 1, NULL, 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'pm_john')), 
 '2026-09-16', '2026-11-15', 60, 0.00, 'NOT_STARTED');

-- Task Dependencies
INSERT INTO TaskDependencies (PredecessorTaskId, SuccessorTaskId, DependencyType, LagDays) VALUES
((SELECT TaskId FROM Tasks WHERE TaskCode = '1.1.2' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.2.1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 'FS', 0);

-- ============================================================================
-- 10. INSERT SPECIALIZED ERP REGISTRIES (RICEFW & INSTANCES)
-- ============================================================================

INSERT INTO RicefwRegistry (ProjectId, RicefwCode, RicefwName, ModuleCode, ObjectType, Complexity, FunctionalSpecStatus, TechnicalSpecStatus, CodingStatus, UnitTestingStatus, SitStatus, UatStatus, ResponsibleMemberId, SharepointFolderLink) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'I-AP-EINV-01', 'Tích hợp hóa đơn điện tử (E-Invoice Integration)', 'AP', 'INTERFACE', 'HIGH', 'IN_PROGRESS', 'PENDING', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_tech')), 
 'https://aron.sharepoint.com/teams/ABC-ERP/Shared%20Documents/03.%20Tech/I-AP-EINV-01');

INSERT INTO OracleInstances (ProjectId, InstanceName, OracleVersion, InstanceStatus, LastRefreshDate, Description) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'DEV1', 'Fusion Cloud 24C', 'ACTIVE', '2026-07-01', 'Môi trường cấu hình & test nội bộ của ARON Tech Team'),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'TEST1', 'Fusion Cloud 24C', 'ACTIVE', '2026-07-10', 'Môi trường kiểm thử tích hợp (CRP / SIT)'),
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'UAT', 'Fusion Cloud 24C', 'ACTIVE', NULL, 'Môi trường kiểm thử chấp nhận người dùng (UAT) - Dự kiến refresh sau SIT');

-- ============================================================================
-- 11. SAMPLE TIMESHEET & BUSINESS TRIP EXPENSES
-- ============================================================================

-- Member AP logs a timesheet for Task 1.1.1
INSERT INTO Timesheets (ProjectId, MemberId, TaskId, WorkDate, HoursWorked, Description, Status, ApprovedByMemberId, ApprovalDate) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')), 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.1.1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 '2026-08-03', 8.00, 'Tham gia họp khảo sát quy trình AP Invoice với chị Linh Keyuser Client', 'APPROVED', 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'lead_fin')), 
 CURRENT_TIMESTAMP);

-- Leader logs timesheet that requires PM approval
INSERT INTO Timesheets (ProjectId, MemberId, TaskId, WorkDate, HoursWorked, Description, Status) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'lead_fin')), 
 (SELECT TaskId FROM Tasks WHERE TaskCode = '1.1' AND ProjectId = (SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC')), 
 '2026-08-04', 8.00, 'Họp Review giải pháp tổng thể FIN và chuẩn bị template MD050', 'SUBMITTED');

-- Business Trip for Survey
INSERT INTO BusinessTrips (ProjectId, TripCode, Title, Destination, StartDate, EndDate, AdvanceAmount, Status, CreatedByMemberId) VALUES
((SELECT ProjectId FROM Projects WHERE ProjectCode = 'PRJ-ORACLE-ABC'), 'TRIP-ABC-AP-01', 'Khảo sát quy trình nghiệp vụ kho tại nhà máy Bình Dương', 'Bình Dương', '2026-08-05', '2026-08-07', 2000000.00, 'APPROVED', 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')));

INSERT INTO BusinessTripMembers (TripId, ProjectMemberId) VALUES
((SELECT TripId FROM BusinessTrips WHERE TripCode = 'TRIP-ABC-AP-01'), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')));

-- Expense Claims
INSERT INTO Expenses (TripId, ClaimantMemberId, ExpenseType, AmountPlanned, AmountActual, ReceiptPath, Status, Notes) VALUES
((SELECT TripId FROM BusinessTrips WHERE TripCode = 'TRIP-ABC-AP-01'), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')), 
 'TRANSPORT', 1000000.00, 1100000.00, '/receipts/trip-01-taxi.png', 'SUBMITTED', 'Tiền taxi khứ hồi HCM - Bình Dương'),
((SELECT TripId FROM BusinessTrips WHERE TripCode = 'TRIP-ABC-AP-01'), 
 (SELECT ProjectMemberId FROM ProjectMembers WHERE UserId = (SELECT UserId FROM Users WHERE Username = 'member_ap')), 
 'HOTEL', 800000.00, 800000.00, '/receipts/trip-01-hotel.png', 'SUBMITTED', 'Khách sạn Becamex Bình Dương (2 đêm)');
