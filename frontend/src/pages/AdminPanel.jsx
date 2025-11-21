import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Cloud, ArrowLeft, Shield, Users, Trash2, Key, UserCog, HardDrive, File, Folder, Puzzle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users`, getAuthHeader());
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId, currentRole) => {
    try {
      await axios.post(`${API}/admin/change-role`, {
        user_id: userId,
        role: currentRole,
        make_admin: currentRole !== 'admin'
      }, getAuthHeader());
      
      toast.success(`User role updated successfully`);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change role');
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;
    
    try {
      await axios.post(`${API}/admin/change-password`, {
        user_id: selectedUser.id,
        new_password: newPassword
      }, getAuthHeader());
      
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await axios.delete(`${API}/admin/delete-user/${selectedUser.id}`, getAuthHeader());
      toast.success('User deleted successfully');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalStats = users.reduce((acc, u) => ({
    storage: acc.storage + (u.storage_used || 0),
    files: acc.files + (u.file_count || 0),
    folders: acc.folders + (u.folder_count || 0)
  }), { storage: 0, files: 0, folders: 0 });

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
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 hover-lift" data-testid="total-users-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-sky-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-6 hover-lift" data-testid="total-storage-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Storage</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatSize(totalStats.storage)}</p>
              </div>
              <HardDrive className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-6 hover-lift" data-testid="total-files-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Files</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalStats.files}</p>
              </div>
              <File className="w-8 h-8 text-indigo-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-6 hover-lift" data-testid="total-folders-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Folders</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalStats.folders}</p>
              </div>
              <Folder className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-500" />
              User Management
            </CardTitle>
            <CardDescription>Manage users, roles, and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Folders</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                        <TableCell className="font-medium" data-testid={`user-username-${u.id}`}>{u.username}</TableCell>
                        <TableCell data-testid={`user-email-${u.id}`}>{u.email}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={u.is_super_admin ? 'destructive' : u.role === 'admin' ? 'default' : 'secondary'}
                            data-testid={`user-role-${u.id}`}
                          >
                            {u.is_super_admin ? 'Super Admin' : u.role}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`user-storage-${u.id}`}>{formatSize(u.storage_used || 0)}</TableCell>
                        <TableCell data-testid={`user-files-${u.id}`}>{u.file_count || 0}</TableCell>
                        <TableCell data-testid={`user-folders-${u.id}`}>{u.folder_count || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {!u.is_super_admin && (u.role !== 'admin' || user.is_super_admin) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleAdmin(u.id, u.role)}
                                data-testid={`toggle-admin-${u.id}`}
                              >
                                <UserCog className="w-4 h-4 mr-1" />
                                {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                              </Button>
                            )}
                            {!u.is_super_admin && (u.role !== 'admin' || user.is_super_admin) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowPasswordDialog(true);
                                }}
                                data-testid={`change-password-${u.id}`}
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                            )}
                            {!u.is_super_admin && u.id !== user.id && (u.role !== 'admin' || user.is_super_admin) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowDeleteDialog(true);
                                }}
                                data-testid={`delete-user-${u.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent data-testid="change-password-dialog">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                data-testid="admin-new-password-input"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleChangePassword} 
              data-testid="admin-change-password-submit"
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-user-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user <strong>{selectedUser?.username}</strong>? 
              This will permanently delete all their files and folders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-user-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-red-500 hover:bg-red-600"
              data-testid="delete-user-confirm"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
