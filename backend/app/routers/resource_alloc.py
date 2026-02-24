from fastapi import APIRouter, HTTPException
import psutil
import os
from typing import Dict, List
from datetime import datetime
import pathlib

router = APIRouter(
    prefix="/api/resources",
    tags=["resources"],
    responses={404: {"description": "Not found"}},
)

def get_size(bytes: int) -> str:
    """Convert bytes to human readable format"""
    for unit in ['', 'K', 'M', 'G', 'T', 'P']:
        if bytes < 1024:
            return f"{bytes:.2f}{unit}B"
        bytes /= 1024

def get_directory_size(directory: str) -> int:
    """Calculate total size of a directory in bytes"""
    total_size = 0
    try:
        for path in pathlib.Path(directory).rglob('*'):
            if path.is_file():
                total_size += path.stat().st_size
    except Exception:
        pass
    return total_size

def get_firestore_status() -> Dict:
    """Get Firestore connection status for the project"""
    try:
        return {
            "status": "configured"
        }
    except Exception:
        return {"status": "error"}

@router.get("/project")
async def get_project_resources() -> Dict:
    """Get resource usage specific to this project"""
    try:
        # Get project root directory
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Calculate project directory sizes
        project_size = get_directory_size(current_dir)
        backend_size = get_directory_size(os.path.join(current_dir, 'backend'))
        
        # Get Firestore related info
        firestore_info = get_firestore_status()
        
        # Get all Python processes related to this project
        python_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
            try:
                if proc.info['name'] == 'python' and any(
                    current_dir in cmd for cmd in proc.info['cmdline'] if cmd
                ):
                    python_processes.append({
                        "pid": proc.info['pid'],
                        "memory_usage": get_size(proc.info['memory_info'].rss),
                        "command": " ".join(proc.info['cmdline'])
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return {
            "project_storage": {
                "total_size": get_size(project_size),
                "backend_size": get_size(backend_size),
                "raw": {
                    "total_size": project_size,
                    "backend_size": backend_size
                }
            },
            "project_processes": {
                "count": len(python_processes),
                "processes": python_processes
            },
            "database": firestore_info,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project resources: {str(e)}")

@router.get("/memory")
async def get_memory_usage() -> Dict:
    """Get detailed memory usage statistics"""
    try:
        memory = psutil.virtual_memory()
        return {
            "total": get_size(memory.total),
            "available": get_size(memory.available),
            "used": get_size(memory.used),
            "percentage": memory.percent,
            "raw": {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "percentage": memory.percent
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get memory usage: {str(e)}")

@router.get("/storage")
async def get_storage_usage() -> Dict:
    """Get storage usage for all mounted disks"""
    try:
        storage_info = {}
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                storage_info[partition.mountpoint] = {
                    "device": partition.device,
                    "fstype": partition.fstype,
                    "total": get_size(usage.total),
                    "used": get_size(usage.used),
                    "free": get_size(usage.free),
                    "percentage": usage.percent,
                    "raw": {
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percentage": usage.percent
                    }
                }
            except Exception:
                # Skip partitions that can't be accessed
                continue
        return storage_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get storage usage: {str(e)}")

@router.get("/process")
async def get_process_info() -> Dict:
    """Get information about the current process"""
    try:
        process = psutil.Process(os.getpid())
        with process.oneshot():  # Improve performance by getting all info at once
            return {
                "pid": process.pid,
                "memory_usage": get_size(process.memory_info().rss),
                "cpu_percent": process.cpu_percent(),
                "threads": process.num_threads(),
                "status": process.status(),
                "created_time": datetime.fromtimestamp(process.create_time()).strftime('%Y-%m-%d %H:%M:%S'),
                "raw": {
                    "memory_usage": process.memory_info().rss,
                    "cpu_percent": process.cpu_percent(),
                    "threads": process.num_threads()
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get process info: {str(e)}")

@router.get("/summary")
async def get_resource_summary() -> Dict:
    """Get a summary of all system resources including project-specific resources"""
    try:
        memory = await get_memory_usage()
        storage = await get_storage_usage()
        process = await get_process_info()
        project = await get_project_resources()
        
        return {
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "memory": memory,
            "storage": storage,
            "process": process,
            "project_specific": project,
            "cpu": {
                "total_usage": psutil.cpu_percent(interval=1),
                "per_cpu": psutil.cpu_percent(interval=1, percpu=True)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get resource summary: {str(e)}")

@router.get("/alerts")
async def get_resource_alerts() -> List[Dict]:
    """Get alerts for resource usage exceeding thresholds"""
    alerts = []
    
    # Check memory usage
    memory = psutil.virtual_memory()
    if memory.percent > 80:
        alerts.append({
            "type": "memory",
            "level": "warning" if memory.percent < 90 else "critical",
            "message": f"Memory usage is at {memory.percent}%"
        })
    
    # Check storage usage
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            if usage.percent > 80:
                alerts.append({
                    "type": "storage",
                    "level": "warning" if usage.percent < 90 else "critical",
                    "message": f"Storage usage at {partition.mountpoint} is {usage.percent}%"
                })
        except:
            continue
    
    # Check CPU usage
    cpu_percent = psutil.cpu_percent(interval=1)
    if cpu_percent > 70:
        alerts.append({
            "type": "cpu",
            "level": "warning" if cpu_percent < 85 else "critical",
            "message": f"CPU usage is at {cpu_percent}%"
        })
    
    return alerts

@router.get("/project/storage/breakdown")
async def get_project_storage_breakdown() -> Dict:
    """Get detailed breakdown of project storage usage"""
    try:
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Track specific directories and file types
        storage_breakdown = {
            "by_directory": {},
            "by_file_type": {},
            "large_files": []
        }
        
        # Track files over 1MB
        LARGE_FILE_THRESHOLD = 1024 * 1024  # 1MB
        
        for path in pathlib.Path(current_dir).rglob('*'):
            if path.is_file():
                # Get relative path from project root
                rel_path = str(path.relative_to(current_dir))
                size = path.stat().st_size
                
                # Track by directory
                directory = os.path.dirname(rel_path) or "root"
                if directory not in storage_breakdown["by_directory"]:
                    storage_breakdown["by_directory"][directory] = 0
                storage_breakdown["by_directory"][directory] += size
                
                # Track by file type
                file_type = path.suffix or "no_extension"
                if file_type not in storage_breakdown["by_file_type"]:
                    storage_breakdown["by_file_type"][file_type] = 0
                storage_breakdown["by_file_type"][file_type] += size
                
                # Track large files
                if size > LARGE_FILE_THRESHOLD:
                    storage_breakdown["large_files"].append({
                        "path": rel_path,
                        "size": get_size(size)
                    })
        
        # Convert sizes to human-readable format
        for directory in storage_breakdown["by_directory"]:
            size = storage_breakdown["by_directory"][directory]
            storage_breakdown["by_directory"][directory] = get_size(size)
            
        for file_type in storage_breakdown["by_file_type"]:
            size = storage_breakdown["by_file_type"][file_type]
            storage_breakdown["by_file_type"][file_type] = get_size(size)
        
        # Sort large files by size
        storage_breakdown["large_files"].sort(key=lambda x: float(x["size"][:-2]), reverse=True)
        
        return storage_breakdown
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get storage breakdown: {str(e)}")
