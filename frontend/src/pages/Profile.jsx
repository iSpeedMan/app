import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, User, Mail, Shield, Lock, ArrowLeft, HardDrive, File, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile({ user, setUser }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ storage_used: 0, file_count: 0, folder_count: 0 });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    loadStats();
  }, []);

  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/user/stats`, getAuthHeader());
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Minimum 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      errors.push('At least one special character');
    }
    
    return errors;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordErrors({});
    
    // Validate current password
    if (!passwordData.current_password) {
      setPasswordErrors({ current: 'Current password is required' });
      return;
    }
    
    // Validate new password
    const validationErrors = validatePassword(passwordData.new_password);
    if (validationErrors.length > 0) {
      setPasswordErrors({ new: validationErrors.join(', ') });
      return;
    }
    
    // Check if passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordErrors({ confirm: 'Passwords do not match' });
      return;
    }
    
    // Check if new password is different from current
    if (passwordData.current_password === passwordData.new_password) {
      setPasswordErrors({ new: 'New password must be different from current password' });
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, getAuthHeader());
      toast.success('Password changed successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to change password';
      if (errorMsg.includes('incorrect')) {
        setPasswordErrors({ current: 'Current password is incorrect' });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-md">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* User Info Card */}
          <Card className="animate-fade-in" data-testid="user-info-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-sky-500" />
                User Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Username</Label>
                  <div className="flex items-center gap-2 p-3 bg-background-secondary rounded-lg">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium" data-testid="username-display">{user?.username}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 p-3 bg-background-secondary rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium" data-testid="email-display">{user?.email}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Role</Label>
                  <div className="flex items-center gap-2 p-3 bg-background-secondary rounded-lg">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium capitalize" data-testid="role-display">
                      {user?.is_super_admin ? 'Super Admin' : user?.role}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="animate-fade-in" data-testid="stats-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-500" />
                Storage Statistics
              </CardTitle>
              <CardDescription>Your usage overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                    <span className="text-sm text-muted-foreground">Storage Used</span>
                  </div>
                  <p className="text-2xl font-bold text-sky-600 dark:text-sky-400" data-testid="storage-used">
                    {formatSize(stats.storage_used)}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-2">
                    <File className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-muted-foreground">Total Files</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="file-count">
                    {stats.file_count}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Folder className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm text-muted-foreground">Total Folders</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" data-testid="folder-count">
                    {stats.folder_count}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change Card */}
          <Card className="animate-fade-in" data-testid="password-change-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-500" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    data-testid="current-password-input"
                    type="password"
                    placeholder="Enter current password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    data-testid="new-password-input"
                    type="password"
                    placeholder="Enter new password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters with uppercase, lowercase, and special character
                  </p>
                </div>
                <Button type="submit" disabled={loading} data-testid="change-password-submit" className="bg-sky-500 hover:bg-sky-600">
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
