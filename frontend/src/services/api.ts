// Services to call .NET 8 Core Backend Web API

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Helper to get authorization headers
function getHeaders(): HeadersInit {
  const token = localStorage.getItem('aron_pm_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export interface UserRole {
  projectId: number;
  projectCode: string;
  projectName: string;
  roleCode: string;
  roleName: string;
  hierarchyLevel: number;
  functionalTeamName: string | null;
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarPath?: string;
  annualLeaveDays?: number;
  carryOverDays?: number;
  globalRole: string;
  permissionsJson?: string;
  projectRoles: UserRole[];
}

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Đăng nhập thất bại.');
    }

    const data: AuthResponse = await response.json();
    localStorage.setItem('aron_pm_token', data.token);
    localStorage.setItem('aron_pm_user', JSON.stringify(data));
    return data;
  },
  async loginMicrosoftSSO(email: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Đăng nhập SSO Microsoft thất bại.');
    }

    const data: AuthResponse = await response.json();
    localStorage.setItem('aron_pm_token', data.token);
    localStorage.setItem('aron_pm_user', JSON.stringify(data));
    return data;
  },

  logout() {
    localStorage.removeItem('aron_pm_token');
    localStorage.removeItem('aron_pm_user');
    localStorage.removeItem('aron_pm_active_project');
  },

  getCurrentUser(): AuthResponse | null {
    const user = localStorage.getItem('aron_pm_user');
    return user ? JSON.parse(user) : null;
  },

  async forgotPassword(email: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(txt || 'Yêu cầu khôi phục mật khẩu thất bại.');
    }
    return response.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(txt || 'Đặt lại mật khẩu thất bại.');
    }
    return response.json();
  }
};

export interface TaskNode {
  taskId: number;
  taskCode: string;
  taskName: string;
  description: string | null;
  taskLevel: number;
  parentTaskId: number | null;
  assigneeMemberId: number | null;
  assigneeName: string | null;
  assigneeTeam: string | null;
  approverMemberId: number | null;
  approverName: string | null;
  startDatePlanned: string;
  endDatePlanned: string;
  startDateActual: string | null;
  endDateActual: string | null;
  durationPlanned: number;
  progressPercent: number;
  status: string;
  isVisibleToAll: boolean;
  visibilityScope: string | null;
  aimCode: string | null;
  subTasks: TaskNode[];
  predecessorTaskIds: number[];
}

export const taskService = {
  async getTaskTree(projectId: number): Promise<TaskNode[]> {
    const response = await fetch(`${API_BASE_URL}/task/project/${projectId}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Không thể lấy cây công việc.');
    return response.json();
  },

  async saveTask(task: Partial<TaskNode> & { projectId: number }): Promise<{ message: string; taskId: number }> {
    const response = await fetch(`${API_BASE_URL}/task/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Lưu task thất bại.');
    }
    return response.json();
  }
};

export interface RicefwObject {
  ricefwId: number;
  projectId: number;
  ricefwCode: string;
  ricefwName: string;
  moduleCode: string;
  objectType: string;
  complexity: string;
  functionalSpecStatus: string;
  technicalSpecStatus: string;
  codingStatus: string;
  unitTestingStatus: string;
  sitStatus: string;
  uatStatus: string;
  responsibleMemberId: number | null;
  responsibleMemberName: string | null;
  sharepointFolderLink: string | null;
}

export const ricefwService = {
  async getProjectRicefws(projectId: number): Promise<RicefwObject[]> {
    const response = await fetch(`${API_BASE_URL}/ricefw/project/${projectId}`, {
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Không thể tải danh sách RICEFW.');
    return response.json();
  },

  async saveRicefw(ricefw: Partial<RicefwObject> & { projectId: number }): Promise<{ message: string; ricefwId: number; link: string | null }> {
    const response = await fetch(`${API_BASE_URL}/ricefw/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(ricefw)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Lưu đối tượng RICEFW thất bại.');
    }
    return response.json();
  }
};

export interface ApprovalSubmitRequest {
  projectId: number;
  targetType: 'TIMESHEET' | 'EXPENSE' | 'TRIP';
  targetId: number;
  description: string;
  amount: number;
}

export const approvalService = {
  async submitForApproval(req: ApprovalSubmitRequest): Promise<{ message: string; workflowId: number }> {
    const response = await fetch(`${API_BASE_URL}/approval/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(req)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Gửi phê duyệt thất bại.');
    }
    return response.json();
  }
};

// --- New Services for ARON Project Management ---

export interface SystemSetting {
  settingId?: number;
  appName: string;
  logoUrl?: string;
  bannerUrl?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSenderEmail?: string;
  smtpEnableSsl: boolean;
}

export interface ProjectDto {
  projectId?: number;
  projectCode: string;
  projectName: string;
  address?: string;
  sitesCount: number;
  contactInfo?: string;
  logoPath?: string;
  sharepointFolderLink?: string;
  isActive?: boolean;
  projectScope?: string;
  implementationWeeks?: number;
  kickOffDate?: string;
  targetGoLiveDate?: string;
  currentPhase?: string;
  modulesScope?: string;
  projectSites?: any[];
}

export interface TeamMemberDto {
  projectMemberId: number;
  userId: number;
  functionalTeamId?: number;
  functionalTeamName: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  title: string;
  avatarPath: string;
  dailyRate?: number;
  isActive: boolean;
}

export interface BusinessTripDto {
  tripId?: number;
  projectId: number;
  tripCode?: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  advanceAmount: number;
  status?: string;
  createdByName?: string;
  approvedByName?: string;
  members?: Array<{
    tripMemberId: number;
    projectMemberId: number;
    isGroupLeader: boolean;
    fullName: string;
    email: string;
    phone: string;
  }>;
  expenses?: Array<{
    expenseId: number;
    expenseType: string;
    amountPlanned: number;
    amountActual: number;
    notes?: string;
    status: string;
    claimantName: string;
  }>;
}

export const settingService = {
  async getSettings(): Promise<SystemSetting> {
    const response = await fetch(`${API_BASE_URL}/setting`);
    return response.json();
  },
  async updateSettings(settings: SystemSetting): Promise<SystemSetting> {
    const response = await fetch(`${API_BASE_URL}/setting`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Lưu cấu hình thất bại.');
    }
    return response.json();
  },
  async testEmail(payload: { smtpHost: string; smtpPort: number; smtpUsername: string; smtpPassword?: string; smtpSenderEmail?: string; smtpEnableSsl: boolean; destinationEmail: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/setting/test-email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Gửi email thử nghiệm thất bại.');
    }
    return response.json();
  }
};

export const projectService = {
  async getProjects(): Promise<ProjectDto[]> {
    const response = await fetch(`${API_BASE_URL}/project`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách dự án.');
    return response.json();
  },
  async createProject(project: ProjectDto): Promise<ProjectDto> {
    const response = await fetch(`${API_BASE_URL}/project`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(project)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Tạo dự án thất bại.');
    }
    return response.json();
  },
  async updateProject(projectId: number, project: ProjectDto): Promise<ProjectDto> {
    const response = await fetch(`${API_BASE_URL}/project/${projectId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(project)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Cập nhật cấu hình dự án thất bại.');
    }
    return response.json();
  },
  async assignPm(req: { projectId: number, username: string, fullName: string, email: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/project/assign-pm`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(req)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Phân công PM thất bại.');
    }
    return response.json();
  },
  async deleteProject(projectId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/project/${projectId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Xóa dự án thất bại.');
    }
    return response.json();
  }
};

export const teamService = {
  async getTeams(projectId: number): Promise<{ teams: any[], members: TeamMemberDto[], roles: any[], functionalTeams: any[] }> {
    const response = await fetch(`${API_BASE_URL}/team?projectId=${projectId}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải sơ đồ đội ngũ.');
    return response.json();
  },
  async createTeam(team: { projectId: number, teamName: string, parentTeamId?: number }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/team`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(team)
    });
    return response.json();
  },
  async createFunctionalTeam(ft: { teamId: number, functionalTeamName: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/team/functional`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(ft)
    });
    return response.json();
  },
  async assignMember(req: { projectId: number, username: string, fullName: string, email: string, phone?: string, title?: string, roleId: number, functionalTeamId?: number, dailyRate?: number }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/team/member`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(req)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Gán/tạo thành viên thất bại.');
    }
    return response.json();
  }
};

export const businessTripService = {
  async getTrips(projectId: number): Promise<BusinessTripDto[]> {
    const response = await fetch(`${API_BASE_URL}/businesstrip?projectId=${projectId}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải lịch công tác.');
    return response.json();
  },
  async createTrip(trip: BusinessTripDto): Promise<BusinessTripDto> {
    const response = await fetch(`${API_BASE_URL}/businesstrip`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(trip)
    });
    if (!response.ok) throw new Error('Tạo lịch công tác thất bại.');
    return response.json();
  },
  async addTripMember(tripId: number, payload: { projectMemberId: number, isGroupLeader: boolean }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/businesstrip/${tripId}/member`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Thêm thành viên thất bại.');
    return response.json();
  },
  async addTripExpense(tripId: number, expense: { expenseType: string, amountPlanned: number, amountActual: number, notes?: string, claimantMemberId?: number, justification?: string }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/businesstrip/${tripId}/expense`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(expense)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: errorData.message || 'Thêm chi phí thất bại.',
        isSoftWarning: errorData.isSoftWarning,
        limitAmount: errorData.limitAmount,
        overAmount: errorData.overAmount
      };
    }
    return response.json();
  }
};

export interface TravelRegion {
  regionId?: number;
  regionCode: string;
  regionName: string;
  provincesIncluded: string;
}

export interface TravelExpensePolicy {
  policyId: number;
  projectId?: number;
  regionCode: string;
  roleCode: string;
  perDiemAllowance: number;
  maxHotelRate: number;
  transportAllowance?: number;
  pocketAllowance?: number;
  currency: string;
  isActive: boolean;
  updatedAt: string;
}

export const travelPolicyService = {
  async getPolicies(projectId?: number): Promise<TravelExpensePolicy[]> {
    const url = projectId ? `${API_BASE_URL}/travelpolicy?projectId=${projectId}` : `${API_BASE_URL}/travelpolicy`;
    const response = await fetch(url, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải quy định công tác phí.');
    return response.json();
  },
  async getRegions(): Promise<TravelRegion[]> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy/regions`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách vùng địa lý.');
    return response.json();
  },
  async createRegion(region: TravelRegion): Promise<TravelRegion> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy/region`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(region)
    });
    if (!response.ok) throw new Error('Không thể lưu vùng địa lý.');
    return response.json();
  },
  async createPolicy(policy: Partial<TravelExpensePolicy>): Promise<TravelExpensePolicy> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(policy)
    });
    if (!response.ok) throw new Error('Không thể tạo quy định định mức.');
    return response.json();
  },
  async updatePolicy(id: number, policy: Partial<TravelExpensePolicy>): Promise<TravelExpensePolicy> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(policy)
    });
    if (!response.ok) throw new Error('Không thể cập nhật quy định công tác phí.');
    return response.json();
  },
  async deletePolicy(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể xóa quy định định mức.');
    return response.json();
  },
  async clonePolicies(inflationPercentage: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/travelpolicy/clone`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ inflationPercentage })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Không thể nhân bản quy định.');
    }
    return response.json();
  }
};

export interface OracleInstanceDto {
  instanceId?: number;
  projectId: number;
  instanceName: string;
  oracleVersion: string;
  instanceStatus: string;
  lastRefreshDate?: string;
  description?: string;
  updatedDate?: string;
}

export const oracleInstanceService = {
  async getInstances(projectId: number): Promise<OracleInstanceDto[]> {
    const response = await fetch(`${API_BASE_URL}/oracleinstance?projectId=${projectId}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách môi trường Oracle.');
    return response.json();
  },
  async createInstance(data: Partial<OracleInstanceDto>): Promise<OracleInstanceDto> {
    const response = await fetch(`${API_BASE_URL}/oracleinstance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Thêm môi trường thất bại.');
    return response.json();
  },
  async updateInstance(id: number, data: Partial<OracleInstanceDto>): Promise<OracleInstanceDto> {
    const response = await fetch(`${API_BASE_URL}/oracleinstance/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Cập nhật môi trường thất bại.');
    return response.json();
  },
  async deleteInstance(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/oracleinstance/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Xóa môi trường thất bại.');
    return response.json();
  }
};

export interface UserDto {
  userId?: number;
  username: string;
  password?: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarPath?: string;
  annualLeaveDays?: number;
  carryOverDays?: number;
  isActive: boolean;
  expiryDate?: string;
  globalRoleId?: number;
  globalRole?: any;
  projectNames?: string[];
}

export const userService = {
  async getUsers(): Promise<UserDto[]> {
    const response = await fetch(`${API_BASE_URL}/user`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách người dùng.');
    return response.json();
  },
  async createUser(user: UserDto): Promise<UserDto> {
    const response = await fetch(`${API_BASE_URL}/user`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Tạo người dùng thất bại.');
    }
    return response.json();
  },
  async updateUser(userId: number, user: UserDto): Promise<UserDto> {
    const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(user)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Cập nhật người dùng thất bại.');
    }
    return response.json();
  },
  async deleteUser(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Xóa người dùng thất bại.');
    }
    return response.json();
  },
  async getUserProjects(userId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/user/${userId}/projects`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách dự án tham gia.');
    return response.json();
  },
  async updateUserProjects(userId: number, memberships: any[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/user/${userId}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(memberships)
    });
    if (!response.ok) {
      try {
        const errJson = await response.json();
        throw new Error(errJson.detail || errJson.message || 'Cập nhật phân công dự án thất bại.');
      } catch {
        const errText = await response.text();
        throw new Error(errText || 'Cập nhật phân công dự án thất bại.');
      }
    }
    return response.json();
  }
};

export interface ProjectScopeOptionDto {
  optionId?: number;
  value: string;
  description: string;
  isActive: boolean;
}

export interface SystemRoleDto {
  roleId?: number;
  roleCode: string;
  roleName: string;
  description?: string;
  isActive: boolean;
  permissionsJson?: string;
  hierarchyLevel: number;
}

export const masterDataService = {
  async getScopes(): Promise<ProjectScopeOptionDto[]> {
    const response = await fetch(`${API_BASE_URL}/masterdata/scopes`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách phạm vi dự án.');
    return response.json();
  },
  async createScope(scope: ProjectScopeOptionDto): Promise<ProjectScopeOptionDto> {
    const response = await fetch(`${API_BASE_URL}/masterdata/scopes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(scope)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Tạo danh mục phạm vi thất bại.');
    }
    return response.json();
  },
  async updateScope(optionId: number, scope: ProjectScopeOptionDto): Promise<ProjectScopeOptionDto> {
    const response = await fetch(`${API_BASE_URL}/masterdata/scopes/${optionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(scope)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Cập nhật danh mục phạm vi thất bại.');
    }
    return response.json();
  },
  async getRoles(): Promise<SystemRoleDto[]> {
    const response = await fetch(`${API_BASE_URL}/masterdata/roles`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Không thể tải danh sách vai trò hệ thống.');
    return response.json();
  },
  async updateRole(roleId: number, role: SystemRoleDto): Promise<SystemRoleDto> {
    const response = await fetch(`${API_BASE_URL}/masterdata/roles/${roleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(role)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Cập nhật ma trận phân quyền vai trò thất bại.');
    }
    return response.json();
  }
};

export const hasPermission = (user: any, feature: string, action: string = 'View'): boolean => {
  if (!user) return false;
  if (user.globalRole === 'SYSTEM_ADMIN') return true; // SYSTEM_ADMIN has bypass access to all features and actions
  
  try {
    if (user.permissionsJson) {
      const matrix = JSON.parse(user.permissionsJson);
      return !!matrix[feature]?.[action];
    }
  } catch (e) {
    console.error('Error parsing permissionsJson', e);
  }
  return false;
};
