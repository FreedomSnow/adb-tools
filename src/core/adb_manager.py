# -*- coding: utf-8 -*-
"""
ADB管理器
负责所有ADB命令的执行和设备管理
"""

import subprocess
import json
import re
import time
import threading
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from PySide6.QtCore import QObject, Signal, QTimer, QThread, QProcess
import logging

logger = logging.getLogger(__name__)


class Device:
    """设备信息类"""
    def __init__(self, device_id: str, status: str = "unknown"):
        self.id = device_id
        self.status = status  # device, offline, unauthorized, etc.
        self.model = ""
        self.android_version = ""
        self.api_level = ""
        self.manufacturer = ""
        self.battery_level = 0
        self.wifi_enabled = False
        self.last_update = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'status': self.status,
            'model': self.model,
            'android_version': self.android_version,
            'api_level': self.api_level,
            'manufacturer': self.manufacturer,
            'battery_level': self.battery_level,
            'wifi_enabled': self.wifi_enabled,
            'last_update': self.last_update
        }


class ADBManager(QObject):
    """ADB管理器"""
    
    # 信号定义
    device_connected = Signal(Device)
    device_disconnected = Signal(str)  # device_id
    device_updated = Signal(Device)
    command_output = Signal(str, str)  # command, output
    error_occurred = Signal(str)
    
    def __init__(self):
        super().__init__()
        self.devices: Dict[str, Device] = {}
        self.adb_path = self._find_adb_path()
        self.monitoring = False
        self.monitor_timer = QTimer()
        self.monitor_timer.timeout.connect(self._monitor_devices)
        
    def _find_adb_path(self) -> str:
        """查找ADB路径"""
        # 尝试多个可能的ADB路径
        possible_paths = [
            "adb",  # 系统PATH中
            "resources/adb/adb",  # 项目资源目录
            "resources/adb/adb.exe",  # Windows
            str(Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"),  # Windows默认
            str(Path.home() / "Library/Android/sdk/platform-tools/adb"),  # macOS默认
            str(Path.home() / "Android/Sdk/platform-tools/adb"),  # Linux默认
        ]
        
        for path in possible_paths:
            try:
                result = subprocess.run([path, "version"], 
                                      capture_output=True, 
                                      text=True, 
                                      timeout=5)
                if result.returncode == 0:
                    logger.info(f"找到ADB: {path}")
                    return path
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                continue
        
        logger.warning("未找到ADB，将尝试自动下载")
        return "adb"  # 默认值，假设在PATH中
    
    def is_adb_available(self) -> bool:
        """检查ADB是否可用"""
        try:
            result = subprocess.run([self.adb_path, "version"], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            return result.returncode == 0
        except:
            return False
    
    def execute_command(self, command: List[str], timeout: int = 30) -> Tuple[bool, str, str]:
        """执行ADB命令"""
        try:
            full_command = [self.adb_path] + command
            logger.debug(f"执行命令: {' '.join(full_command)}")
            
            # 检查是否是二进制输出命令（如截图）
            is_binary_command = any(cmd in command for cmd in ['exec-out', 'screencap'])
            
            if is_binary_command:
                # 处理二进制输出
                result = subprocess.run(
                    full_command,
                    capture_output=True,
                    timeout=timeout
                )
                
                success = result.returncode == 0
                stdout = result.stdout  # 保持为bytes
                stderr = result.stderr.decode('utf-8', errors='replace').strip()
                
                if success:
                    logger.debug(f"二进制命令成功，数据长度: {len(stdout)}")
                else:
                    logger.warning(f"二进制命令失败: {stderr}")
                
                self.command_output.emit(' '.join(full_command), f"<二进制数据，长度: {len(stdout)}>")
                return success, stdout, stderr
            else:
                # 处理文本输出
                result = subprocess.run(
                    full_command,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    encoding='utf-8',
                    errors='replace'
                )
                
                success = result.returncode == 0
                stdout = result.stdout.strip()
                stderr = result.stderr.strip()
                
                if success:
                    logger.debug(f"命令成功: {stdout[:100]}...")
                else:
                    logger.warning(f"命令失败: {stderr}")
                
                self.command_output.emit(' '.join(full_command), stdout)
                return success, stdout, stderr
            
        except subprocess.TimeoutExpired:
            error_msg = f"命令超时: {' '.join(command)}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"执行命令失败: {str(e)}"
            logger.error(error_msg)
            self.error_occurred.emit(error_msg)
            return False, "", error_msg
    
    def get_devices(self) -> List[Device]:
        """获取设备列表"""
        success, output, error = self.execute_command(["devices", "-l"])
        if not success:
            return []
        
        devices = []
        lines = output.split('\n')[1:]  # 跳过第一行 "List of devices attached"
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            parts = line.split()
            if len(parts) >= 2:
                device_id = parts[0]
                status = parts[1]
                
                device = Device(device_id, status)
                
                # 解析额外信息
                if len(parts) > 2:
                    for part in parts[2:]:
                        if ':' in part:
                            key, value = part.split(':', 1)
                            if key == 'model':
                                device.model = value
                            elif key == 'device':
                                pass  # 设备代号，暂不使用
                
                devices.append(device)
        
        return devices
    
    def get_device_info(self, device_id: str) -> Optional[Device]:
        """获取详细设备信息"""
        if device_id not in self.devices:
            return None
        
        device = self.devices[device_id]
        
        # 获取设备属性
        props_to_get = {
            'ro.product.model': 'model',
            'ro.build.version.release': 'android_version',
            'ro.build.version.sdk': 'api_level',
            'ro.product.manufacturer': 'manufacturer'
        }
        
        for prop, attr in props_to_get.items():
            success, output, _ = self.execute_command(["-s", device_id, "shell", "getprop", prop])
            if success and output:
                setattr(device, attr, output.strip())
        
        # 获取电池信息
        success, output, _ = self.execute_command(["-s", device_id, "shell", "dumpsys", "battery"])
        if success:
            battery_match = re.search(r'level:\s*(\d+)', output)
            if battery_match:
                device.battery_level = int(battery_match.group(1))
        
        device.last_update = time.time()
        return device
    
    def start_monitoring(self, interval: int = 2000):
        """开始监控设备"""
        self.monitoring = True
        self.monitor_timer.start(interval)
        logger.info("开始监控设备")
    
    def stop_monitoring(self):
        """停止监控设备"""
        self.monitoring = False
        self.monitor_timer.stop()
        logger.info("停止监控设备")
    
    def _monitor_devices(self):
        """监控设备状态"""
        if not self.monitoring:
            return
        
        try:
            current_devices = {d.id: d for d in self.get_devices()}
            
            # 检查新连接的设备
            for device_id, device in current_devices.items():
                if device_id not in self.devices:
                    # 新设备连接
                    self.devices[device_id] = device
                    if device.status == "device":
                        # 获取详细信息
                        detailed_device = self.get_device_info(device_id)
                        if detailed_device:
                            self.devices[device_id] = detailed_device
                            self.device_connected.emit(detailed_device)
                    else:
                        self.device_connected.emit(device)
                elif self.devices[device_id].status != device.status:
                    # 设备状态变化
                    self.devices[device_id].status = device.status
                    self.device_updated.emit(self.devices[device_id])
            
            # 检查断开的设备
            disconnected = set(self.devices.keys()) - set(current_devices.keys())
            for device_id in disconnected:
                self.device_disconnected.emit(device_id)
                del self.devices[device_id]
                
        except Exception as e:
            logger.error(f"监控设备时发生错误: {e}")
    
    def connect_wifi_device(self, ip_address: str, port: int = 5555) -> bool:
        """通过WiFi连接设备"""
        success, output, error = self.execute_command(["connect", f"{ip_address}:{port}"])
        if success and "connected" in output.lower():
            logger.info(f"WiFi设备连接成功: {ip_address}:{port}")
            return True
        else:
            logger.error(f"WiFi设备连接失败: {error}")
            return False
    
    def disconnect_device(self, device_id: str) -> bool:
        """断开设备连接"""
        success, output, error = self.execute_command(["disconnect", device_id])
        if success:
            logger.info(f"设备断开成功: {device_id}")
            return True
        else:
            logger.error(f"设备断开失败: {error}")
            return False
    
    def install_apk(self, device_id: str, apk_path: str) -> bool:
        """安装APK"""
        success, output, error = self.execute_command(["-s", device_id, "install", "-r", apk_path], timeout=300)
        return success and "Success" in output
    
    def uninstall_app(self, device_id: str, package_name: str) -> bool:
        """卸载应用"""
        success, output, error = self.execute_command(["-s", device_id, "uninstall", package_name])
        return success and "Success" in output
    
    def start_app(self, device_id: str, package_name: str) -> bool:
        """启动应用"""
        success, output, error = self.execute_command([
            "-s", device_id, "shell", "monkey", "-p", package_name, 
            "-c", "android.intent.category.LAUNCHER", "1"
        ])
        return success
    
    def stop_app(self, device_id: str, package_name: str) -> bool:
        """停止应用"""
        success, output, error = self.execute_command([
            "-s", device_id, "shell", "am", "force-stop", package_name
        ])
        return success
    
    def get_installed_apps(self, device_id: str) -> List[Dict[str, str]]:
        """获取已安装应用列表"""
        success, output, error = self.execute_command(["-s", device_id, "shell", "pm", "list", "packages"])
        if not success:
            return []
        
        apps = []
        for line in output.split('\n'):
            if line.startswith('package:'):
                package_name = line.replace('package:', '').strip()
                apps.append({
                    'package_name': package_name,
                    'app_name': package_name.split('.')[-1],  # 简化的应用名
                    'is_system': False  # 需要进一步检查
                })
        
        return apps
    
    def list_files(self, device_id: str, path: str) -> List[Dict[str, Any]]:
        """列出文件"""
        success, output, error = self.execute_command(["-s", device_id, "shell", "ls", "-la", path])
        if not success:
            return []
        
        files = []
        lines = output.split('\n')[1:]  # 跳过第一行
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('total'):
                continue
            
            parts = line.split()
            if len(parts) >= 8:
                permissions = parts[0]
                size = parts[4]
                filename = ' '.join(parts[8:])
                
                if filename in ['.', '..']:
                    continue
                
                files.append({
                    'name': filename,
                    'type': 'directory' if permissions.startswith('d') else 'file',
                    'size': size,
                    'permissions': permissions,
                    'path': f"{path}/{filename}".replace('//', '/')
                })
        
        return files
    
    def download_file(self, device_id: str, remote_path: str, local_path: str) -> bool:
        """下载文件"""
        success, output, error = self.execute_command(["-s", device_id, "pull", remote_path, local_path])
        return success
    
    def upload_file(self, device_id: str, local_path: str, remote_path: str) -> bool:
        """上传文件"""
        success, output, error = self.execute_command(["-s", device_id, "push", local_path, remote_path])
        return success 