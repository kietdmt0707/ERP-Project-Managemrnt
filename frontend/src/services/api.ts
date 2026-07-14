// Services to call .NET 8 Core Backend Web API

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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
  username: string;
  fullName: string;
  email: string;
  globalRole: string;
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

  logout() {
    localStorage.removeItem('aron_pm_token');
    localStorage.removeItem('aron_pm_user');
    localStorage.removeItem('aron_pm_active_project');
  },

  getCurrentUser(): AuthResponse | null {
    const user = localStorage.getItem('aron_pm_user');
    return user ? JSON.parse(user) : null;
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
