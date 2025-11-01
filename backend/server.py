from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Response, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import shutil
import mimetypes
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# File upload configuration
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Blocked file extensions for security
BLOCKED_EXTENSIONS = ['.php', '.exe', '.bat', '.cmd', '.sh', '.js', '.html', '.htm', '.jsp', '.asp', '.aspx']

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    password_hash: str
    role: str = "user"  # user, admin
    is_super_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    storage_used: int = 0  # in bytes
    language: str = "ru"  # ru, en

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None

class FolderMove(BaseModel):
    folder_id: str
    target_parent_id: Optional[str] = None

class FileMove(BaseModel):
    file_id: str
    target_folder_id: Optional[str] = None

class AdminPasswordChange(BaseModel):
    user_id: str
    new_password: str

class AdminRoleChange(BaseModel):
    user_id: str
    role: str
    make_admin: bool

class LanguageUpdate(BaseModel):
    language: str

class PluginSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    enabled: bool
    settings: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PluginUpdate(BaseModel):
    enabled: bool
    settings: Optional[Dict[str, Any]] = None

class FileInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    size: int
    mime_type: str
    created_at: str
    folder_id: Optional[str] = None

class FolderInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    parent_id: Optional[str] = None
    created_at: str
    size: int = 0

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str, role: str, is_super_admin: bool) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "is_super_admin": is_super_admin,
        "exp": expires
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_rate_limit(username: str):
    now = datetime.now(timezone.utc)
    fifteen_min_ago = now - timedelta(minutes=15)
    
    attempts = await db.login_attempts.count_documents({
        "username": username,
        "timestamp": {"$gte": fifteen_min_ago.isoformat()}
    })
    
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 15 minutes.")

async def log_login_attempt(username: str):
    await db.login_attempts.insert_one({
        "username": username,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

async def log_security_event(event_type: str, user_id: str, details: str):
    await db.security_logs.insert_one({
        "event_type": event_type,
        "user_id": user_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

async def is_blocked_file(filename: str) -> bool:
    """Check if file is blocked based on plugin settings"""
    # Get file type filter plugin
    plugin = await db.plugins.find_one({"name": "file_type_filter"})
    
    # If plugin doesn't exist or is disabled, allow all files
    if not plugin or not plugin.get('enabled', False):
        return False
    
    # Check against blocked extensions from plugin settings
    blocked_extensions = plugin.get('settings', {}).get('blocked_extensions', [])
    ext = Path(filename).suffix.lower()
    return ext in blocked_extensions

async def calculate_folder_size(folder_id: str, user_id: str) -> int:
    """Recursively calculate folder size including all nested files and folders"""
    total_size = 0
    
    # Get all files in this folder
    files = await db.files.find({"owner_id": user_id, "folder_id": folder_id}).to_list(None)
    for file in files:
        total_size += file.get("size", 0)
    
    # Get all subfolders
    subfolders = await db.folders.find({"owner_id": user_id, "parent_id": folder_id}).to_list(None)
    for subfolder in subfolders:
        total_size += await calculate_folder_size(subfolder["id"], user_id)
    
    return total_size

async def get_folder_path(folder_id: Optional[str], user_id: str) -> str:
    """Get full path of a folder"""
    if not folder_id:
        return ""
    
    folder = await db.folders.find_one({"id": folder_id, "owner_id": user_id})
    if not folder:
        return ""
    
    parent_path = await get_folder_path(folder.get("parent_id"), user_id)
    return f"{parent_path}/{folder['name']}" if parent_path else folder['name']

# Initialize super admin on startup
@app.on_event("startup")
async def startup_event():
    # Check if super admin exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_user = User(
            username="admin",
            email="admin@minicloud.com",
            password_hash=hash_password("admin"),
            role="admin",
            is_super_admin=True
        )
        doc = admin_user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
        logger.info("Super admin created: admin/admin")

# Auth endpoints
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password)
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    # Create user upload directory
    user_dir = UPLOAD_DIR / user.id
    user_dir.mkdir(exist_ok=True)
    
    await log_security_event("user_registered", user.id, f"User {user.username} registered")
    
    return {"message": "Registration successful", "user_id": user.id}

@api_router.post("/auth/login")
async def login(login_data: UserLogin, response: Response):
    # Rate limiting
    await check_rate_limit(login_data.username)
    
    # Find user
    user = await db.users.find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user['password_hash']):
        await log_login_attempt(login_data.username)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create token
    token = create_token(user['id'], user['username'], user['role'], user.get('is_super_admin', False))
    
    await log_security_event("user_login", user['id'], f"User {user['username']} logged in")
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "role": user['role'],
            "is_super_admin": user.get('is_super_admin', False)
        }
    }

@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    # Get user
    user = await db.users.find_one({"id": current_user['user_id']})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    new_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": current_user['user_id']},
        {"$set": {"password_hash": new_hash}}
    )
    
    await log_security_event("password_changed", user['id'], f"User {user['username']} changed password")
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# File endpoints
@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    # Check file extension
    if is_blocked_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed for security reasons")
    
    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024)}MB")
    
    # Verify folder belongs to user if specified
    if folder_id:
        folder = await db.folders.find_one({"id": folder_id, "owner_id": current_user['user_id']})
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
    
    # Create file record
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / current_user['user_id'] / file_id
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save file
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Detect mime type
    mime_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    
    # Store in database
    file_doc = {
        "id": file_id,
        "name": file.filename,
        "size": file_size,
        "mime_type": mime_type,
        "owner_id": current_user['user_id'],
        "folder_id": folder_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.files.insert_one(file_doc)
    
    # Update user storage
    await db.users.update_one(
        {"id": current_user['user_id']},
        {"$inc": {"storage_used": file_size}}
    )
    
    await log_security_event("file_uploaded", current_user['user_id'], f"Uploaded {file.filename} ({file_size} bytes)")
    
    return {"message": "File uploaded successfully", "file_id": file_id}

@api_router.get("/files/download/{file_id}")
async def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get file record
    file_doc = await db.files.find_one({"id": file_id, "owner_id": current_user['user_id']})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = UPLOAD_DIR / current_user['user_id'] / file_id
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    await log_security_event("file_downloaded", current_user['user_id'], f"Downloaded {file_doc['name']}")
    
    return FileResponse(file_path, filename=file_doc['name'], media_type=file_doc['mime_type'])

@api_router.delete("/files/delete/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    # Get file record
    file_doc = await db.files.find_one({"id": file_id, "owner_id": current_user['user_id']})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete from disk
    file_path = UPLOAD_DIR / current_user['user_id'] / file_id
    if file_path.exists():
        file_path.unlink()
    
    # Delete from database
    await db.files.delete_one({"id": file_id})
    
    # Update user storage
    await db.users.update_one(
        {"id": current_user['user_id']},
        {"$inc": {"storage_used": -file_doc['size']}}
    )
    
    await log_security_event("file_deleted", current_user['user_id'], f"Deleted {file_doc['name']}")
    
    return {"message": "File deleted successfully"}

@api_router.post("/files/move")
async def move_file(move_data: FileMove, current_user: dict = Depends(get_current_user)):
    # Verify file belongs to user
    file_doc = await db.files.find_one({"id": move_data.file_id, "owner_id": current_user['user_id']})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify target folder belongs to user if specified
    if move_data.target_folder_id:
        folder = await db.folders.find_one({"id": move_data.target_folder_id, "owner_id": current_user['user_id']})
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found")
    
    # Update file
    await db.files.update_one(
        {"id": move_data.file_id},
        {"$set": {"folder_id": move_data.target_folder_id}}
    )
    
    return {"message": "File moved successfully"}

@api_router.get("/files/list")
async def list_files(folder_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    # Get files
    query = {"owner_id": current_user['user_id']}
    if folder_id:
        query["folder_id"] = folder_id
    else:
        query["folder_id"] = None
    
    files = await db.files.find(query, {"_id": 0}).to_list(None)
    return files

# Folder endpoints
@api_router.post("/folders/create")
async def create_folder(folder_data: FolderCreate, current_user: dict = Depends(get_current_user)):
    # Verify parent folder belongs to user if specified
    if folder_data.parent_id:
        parent = await db.folders.find_one({"id": folder_data.parent_id, "owner_id": current_user['user_id']})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
    
    # Check if folder with same name exists in parent
    existing = await db.folders.find_one({
        "name": folder_data.name,
        "parent_id": folder_data.parent_id,
        "owner_id": current_user['user_id']
    })
    if existing:
        raise HTTPException(status_code=400, detail="Folder with this name already exists")
    
    # Create folder
    folder_id = str(uuid.uuid4())
    folder_doc = {
        "id": folder_id,
        "name": folder_data.name,
        "parent_id": folder_data.parent_id,
        "owner_id": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.folders.insert_one(folder_doc)
    
    return {"message": "Folder created successfully", "folder_id": folder_id}

@api_router.delete("/folders/delete/{folder_id}")
async def delete_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    # Get folder
    folder = await db.folders.find_one({"id": folder_id, "owner_id": current_user['user_id']})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Check if folder has subfolders or files
    subfolders = await db.folders.count_documents({"parent_id": folder_id, "owner_id": current_user['user_id']})
    files = await db.files.count_documents({"folder_id": folder_id, "owner_id": current_user['user_id']})
    
    if subfolders > 0 or files > 0:
        raise HTTPException(status_code=400, detail="Folder is not empty. Delete all contents first.")
    
    # Delete folder
    await db.folders.delete_one({"id": folder_id})
    
    return {"message": "Folder deleted successfully"}

@api_router.post("/folders/move")
async def move_folder(move_data: FolderMove, current_user: dict = Depends(get_current_user)):
    # Verify folder belongs to user
    folder = await db.folders.find_one({"id": move_data.folder_id, "owner_id": current_user['user_id']})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Verify target parent belongs to user if specified
    if move_data.target_parent_id:
        parent = await db.folders.find_one({"id": move_data.target_parent_id, "owner_id": current_user['user_id']})
        if not parent:
            raise HTTPException(status_code=404, detail="Target parent folder not found")
        
        # Prevent moving folder into itself or its descendants
        async def is_descendant(potential_parent_id, ancestor_id):
            if potential_parent_id == ancestor_id:
                return True
            parent = await db.folders.find_one({"id": potential_parent_id})
            if parent and parent.get('parent_id'):
                return await is_descendant(parent['parent_id'], ancestor_id)
            return False
        
        if await is_descendant(move_data.target_parent_id, move_data.folder_id):
            raise HTTPException(status_code=400, detail="Cannot move folder into itself or its descendants")
    
    # Update folder
    await db.folders.update_one(
        {"id": move_data.folder_id},
        {"$set": {"parent_id": move_data.target_parent_id}}
    )
    
    return {"message": "Folder moved successfully"}

@api_router.get("/folders/tree")
async def get_folder_tree(current_user: dict = Depends(get_current_user)):
    # Get all folders
    folders = await db.folders.find({"owner_id": current_user['user_id']}, {"_id": 0}).to_list(None)
    
    # Calculate sizes for all folders
    for folder in folders:
        folder['size'] = await calculate_folder_size(folder['id'], current_user['user_id'])
    
    return folders

@api_router.get("/folders/breadcrumb/{folder_id}")
async def get_breadcrumb(folder_id: str, current_user: dict = Depends(get_current_user)):
    breadcrumb = []
    current_id = folder_id
    
    while current_id:
        folder = await db.folders.find_one({"id": current_id, "owner_id": current_user['user_id']})
        if not folder:
            break
        breadcrumb.insert(0, {"id": folder['id'], "name": folder['name']})
        current_id = folder.get('parent_id')
    
    return breadcrumb

# User stats
@api_router.get("/user/stats")
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    # Get user
    user = await db.users.find_one({"id": current_user['user_id']})
    
    # Count files and folders
    file_count = await db.files.count_documents({"owner_id": current_user['user_id']})
    folder_count = await db.folders.count_documents({"owner_id": current_user['user_id']})
    
    return {
        "storage_used": user.get('storage_used', 0),
        "file_count": file_count,
        "folder_count": folder_count
    }

# Admin endpoints
@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    # Check if user is admin
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
    
    # Add stats for each user
    for user in users:
        file_count = await db.files.count_documents({"owner_id": user['id']})
        folder_count = await db.folders.count_documents({"owner_id": user['id']})
        user['file_count'] = file_count
        user['folder_count'] = folder_count
    
    return users

@api_router.post("/admin/change-role")
async def change_user_role(role_data: AdminRoleChange, current_user: dict = Depends(get_current_user)):
    # Check if user is admin
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get target user
    target_user = await db.users.find_one({"id": role_data.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent non-super-admin from modifying other admins
    if not current_user['is_super_admin'] and target_user.get('role') == 'admin':
        raise HTTPException(status_code=403, detail="Only super admin can modify admin users")
    
    # Prevent modifying super admin
    if target_user.get('is_super_admin'):
        raise HTTPException(status_code=403, detail="Cannot modify super admin")
    
    # Update role
    new_role = "admin" if role_data.make_admin else "user"
    await db.users.update_one(
        {"id": role_data.user_id},
        {"$set": {"role": new_role}}
    )
    
    await log_security_event("role_changed", current_user['user_id'], 
                           f"Changed role of user {target_user['username']} to {new_role}")
    
    return {"message": "Role updated successfully"}

@api_router.delete("/admin/delete-user/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    # Check if user is admin
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get target user
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent non-super-admin from deleting admins
    if not current_user['is_super_admin'] and target_user.get('role') == 'admin':
        raise HTTPException(status_code=403, detail="Only super admin can delete admin users")
    
    # Prevent deleting super admin
    if target_user.get('is_super_admin'):
        raise HTTPException(status_code=403, detail="Cannot delete super admin")
    
    # Prevent self-deletion
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Delete user's files from disk
    user_dir = UPLOAD_DIR / user_id
    if user_dir.exists():
        shutil.rmtree(user_dir)
    
    # Delete user's files from database
    await db.files.delete_many({"owner_id": user_id})
    
    # Delete user's folders
    await db.folders.delete_many({"owner_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    await log_security_event("user_deleted", current_user['user_id'], 
                           f"Deleted user {target_user['username']}")
    
    return {"message": "User deleted successfully"}

@api_router.post("/admin/change-password")
async def admin_change_password(password_data: AdminPasswordChange, current_user: dict = Depends(get_current_user)):
    # Check if user is admin
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get target user
    target_user = await db.users.find_one({"id": password_data.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent non-super-admin from modifying admin passwords
    if not current_user['is_super_admin'] and target_user.get('role') == 'admin':
        raise HTTPException(status_code=403, detail="Only super admin can modify admin passwords")
    
    # Prevent modifying super admin
    if target_user.get('is_super_admin'):
        raise HTTPException(status_code=403, detail="Cannot modify super admin password")
    
    # Update password
    new_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": password_data.user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    await log_security_event("admin_password_change", current_user['user_id'], 
                           f"Admin changed password for user {target_user['username']}")
    
    return {"message": "Password changed successfully"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
