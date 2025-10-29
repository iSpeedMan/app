import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Cloud, Upload, FolderPlus, Download, Trash2, Move, Home, User, Shield, Moon, Sun, LogOut, Folder, File, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [stats, setStats] = useState({ storage_used: 0, file_count: 0, folder_count: 0 });
  const [loading, setLoading] = useState(false);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveDestination, setMoveDestination] = useState(null);
  
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    loadFiles();
    loadFolders();
    loadStats();
    loadBreadcrumb();
  }, [currentFolder]);

  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const loadFiles = async () => {
    try {
      const response = await axios.get(`${API}/files/list?folder_id=${currentFolder || ''}`, getAuthHeader());
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await axios.get(`${API}/folders/tree`, getAuthHeader());
      const allFolders = response.data;
      const currentLevelFolders = allFolders.filter(f => f.parent_id === currentFolder);
      setFolders(currentLevelFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/user/stats`, getAuthHeader());
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadBreadcrumb = async () => {
    if (!currentFolder) {
      setBreadcrumb([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/folders/breadcrumb/${currentFolder}`, getAuthHeader());
      setBreadcrumb(response.data);
    } catch (error) {
      console.error('Failed to load breadcrumb:', error);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setLoading(true);
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) formData.append('folder_id', currentFolder);
        
        await axios.post(`${API}/files/upload`, formData, getAuthHeader());
        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        toast.error(error.response?.data?.detail || `Failed to upload ${file.name}`);
      }
    }
    
    setLoading(false);
    loadFiles();
    loadStats();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      await axios.post(`${API}/folders/create`, {
        name: newFolderName,
        parent_id: currentFolder
      }, getAuthHeader());
      
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowFolderDialog(false);
      loadFolders();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create folder');
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await axios.get(`${API}/files/download/${file.id}`, {
        ...getAuthHeader(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      if (deleteTarget.type === 'file') {
        await axios.delete(`${API}/files/delete/${deleteTarget.id}`, getAuthHeader());
      } else {
        await axios.delete(`${API}/folders/delete/${deleteTarget.id}`, getAuthHeader());
      }
      
      toast.success('Deleted successfully');
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      loadFiles();
      loadFolders();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    
    try {
      if (moveTarget.type === 'file') {
        await axios.post(`${API}/files/move`, {
          file_id: moveTarget.id,
          target_folder_id: moveDestination
        }, getAuthHeader());
      } else {
        await axios.post(`${API}/folders/move`, {
          folder_id: moveTarget.id,
          target_parent_id: moveDestination
        }, getAuthHeader());
      }
      
      toast.success('Moved successfully');
      setShowMoveDialog(false);
      setMoveTarget(null);
      setMoveDestination(null);
      loadFiles();
      loadFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(Array.from(e.dataTransfer.files));
  };

  const handleThemeToggle = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
    const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
    
    document.documentElement.style.setProperty('--ripple-x', `${x}%`);
    document.documentElement.style.setProperty('--ripple-y', `${y}%`);
    document.documentElement.classList.add('theme-transition');
    
    setTimeout(() => {
      setTheme(theme === 'light' ? 'dark' : 'light');
      document.documentElement.classList.remove('theme-transition');
    }, 50);
  };

  const handleDragStart = (item, type) => {
    setDraggedItem({ ...item, type });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOverItem = (e, item, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'folder' && draggedItem && draggedItem.id !== item.id) {
      setDropTarget(item.id);
    }
  };

  const handleDragLeaveItem = () => {
    setDropTarget(null);
  };

  const handleDropOnFolder = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    
    if (!draggedItem || draggedItem.id === targetFolder.id) return;
    
    try {
      if (draggedItem.type === 'file') {
        await axios.post(`${API}/files/move`, {
          file_id: draggedItem.id,
          target_folder_id: targetFolder.id
        }, getAuthHeader());
        toast.success('File moved successfully');
      } else if (draggedItem.type === 'folder') {
        await axios.post(`${API}/folders/move`, {
          folder_id: draggedItem.id,
          target_parent_id: targetFolder.id
        }, getAuthHeader());
        toast.success('Folder moved successfully');
      }
      loadFiles();
      loadFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move');
    }
    
    setDraggedItem(null);
  };

  const handleDropOnRoot = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    
    if (!draggedItem) return;
    
    try {
      if (draggedItem.type === 'file') {
        await axios.post(`${API}/files/move`, {
          file_id: draggedItem.id,
          target_folder_id: null
        }, getAuthHeader());
        toast.success('File moved to root');
      } else if (draggedItem.type === 'folder') {
        await axios.post(`${API}/folders/move`, {
          folder_id: draggedItem.id,
          target_parent_id: null
        }, getAuthHeader());
        toast.success('Folder moved to root');
      }
      loadFiles();
      loadFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move');
    }
    
    setDraggedItem(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-md">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Mini Cloud</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleThemeToggle}
                data-testid="theme-toggle"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="home-button">
                <Home className="w-5 h-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} data-testid="profile-button">
                <User className="w-5 h-5" />
              </Button>
              
              {user?.role === 'admin' && (
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} data-testid="admin-button">
                  <Shield className="w-5 h-5" />
                </Button>
              )}
              
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="logout-button">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 hover-lift" data-testid="storage-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{formatSize(stats.storage_used)}</p>
              </div>
              <Cloud className="w-8 h-8 text-sky-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-6 hover-lift" data-testid="files-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Files</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.file_count}</p>
              </div>
              <File className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>
          
          <Card className="p-6 hover-lift" data-testid="folders-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Folders</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.folder_count}</p>
              </div>
              <Folder className="w-8 h-8 text-indigo-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="actions-bar flex flex-wrap gap-3 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(Array.from(e.target.files))}
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            data-testid="upload-button"
            className="bg-sky-500 hover:bg-sky-600 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
          
          <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="new-folder-button">
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-folder-dialog">
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>Enter a name for your new folder</DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                data-testid="folder-name-input"
              />
              <DialogFooter>
                <Button 
                  onClick={handleCreateFolder} 
                  data-testid="create-folder-submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentFolder(null)}
            className="p-1"
            data-testid="breadcrumb-home"
          >
            <Home className="w-4 h-4" />
          </Button>
          {breadcrumb.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolder(item.id)}
                className="p-1"
                data-testid={`breadcrumb-${item.id}`}
              >
                {item.name}
              </Button>
            </div>
          ))}
        </div>

        {/* File Manager */}
        <Card
          className={`p-6 min-h-[400px] ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            handleDragOver(e);
            if (draggedItem) {
              e.preventDefault();
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            if (e.dataTransfer.files.length > 0) {
              handleDrop(e);
            } else {
              handleDropOnRoot(e);
            }
          }}
          data-testid="file-manager"
        >
          {folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Cloud className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg mb-2">No files or folders</p>
              <p className="text-sm">Drag and drop files here or click Upload</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  draggable
                  onDragStart={() => handleDragStart(folder, 'folder')}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOverItem(e, folder, 'folder')}
                  onDragLeave={handleDragLeaveItem}
                  onDrop={(e) => handleDropOnFolder(e, folder)}
                  className={`p-4 border border-border rounded-lg hover:bg-background-secondary cursor-pointer transition-all group ${
                    dropTarget === folder.id ? 'bg-sky-100 dark:bg-sky-900/20 border-sky-500' : ''
                  } ${draggedItem?.id === folder.id ? 'opacity-50' : ''}`}
                  data-testid={`folder-${folder.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      onClick={() => setCurrentFolder(folder.id)}
                    >
                      <Folder className="w-6 h-6 text-sky-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate" data-testid={`folder-name-${folder.id}`}>{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(folder.size)}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Folder
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveTarget({ ...folder, type: 'folder' });
                          setShowMoveDialog(true);
                        }}
                        data-testid={`folder-move-${folder.id}`}
                      >
                        <Move className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ ...folder, type: 'folder' });
                          setShowDeleteDialog(true);
                        }}
                        data-testid={`folder-delete-${folder.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Files */}
              {files.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={() => handleDragStart(file, 'file')}
                  onDragEnd={handleDragEnd}
                  className={`p-4 border border-border rounded-lg hover:bg-background-secondary transition-all group ${
                    draggedItem?.id === file.id ? 'opacity-50' : ''
                  }`}
                  data-testid={`file-${file.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <File className="w-6 h-6 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate" data-testid={`file-name-${file.id}`}>{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(file)}
                        data-testid={`file-download-${file.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setMoveTarget({ ...file, type: 'file' });
                          setShowMoveDialog(true);
                        }}
                        data-testid={`file-move-${file.id}`}
                      >
                        <Move className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => {
                          setDeleteTarget({ ...file, type: 'file' });
                          setShowDeleteDialog(true);
                        }}
                        data-testid={`file-delete-${file.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {deleteTarget?.type}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600" data-testid="delete-confirm">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent data-testid="move-dialog">
          <DialogHeader>
            <DialogTitle>Move {moveTarget?.type}</DialogTitle>
            <DialogDescription>Select destination folder</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            <Button
              variant={moveDestination === null ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setMoveDestination(null)}
              data-testid="move-to-root"
            >
              <Home className="w-4 h-4 mr-2" />
              Root
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant={moveDestination === folder.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setMoveDestination(folder.id)}
                disabled={moveTarget?.id === folder.id}
                data-testid={`move-to-${folder.id}`}
              >
                <Folder className="w-4 h-4 mr-2" />
                {folder.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleMove} data-testid="move-confirm">Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
