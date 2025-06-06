# -*- coding: utf-8 -*-
"""
配置管理
负责应用配置的读取和保存
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
from PySide6.QtCore import QSettings


class Config:
    """配置管理器"""
    
    def __init__(self):
        self.settings = QSettings("ADBTools", "ADBTools")
        self.config_dir = Path.home() / ".adb-tools"
        self.config_dir.mkdir(exist_ok=True)
        
        # 默认配置
        self.defaults = {
            "adb": {
                "path": "",
                "timeout": 30,
                "monitoring_interval": 2000
            },
            "logcat": {
                "max_lines": 10000,
                "auto_scroll": True,
                "save_location": str(self.config_dir / "logs")
            },
            "file_manager": {
                "default_path": "/sdcard",
                "show_hidden": False,
                "download_location": str(Path.home() / "Downloads")
            },
            "app_manager": {
                "show_system_apps": False,
                "install_timeout": 300
            },
            "ui": {
                "theme": "default",
                "language": "zh_CN"
            }
        }
        
        # 确保必要的目录存在
        self._ensure_directories()
    
    def _ensure_directories(self):
        """确保必要的目录存在"""
        logs_dir = Path(self.get_value("logcat/save_location", self.defaults["logcat"]["save_location"]))
        logs_dir.mkdir(parents=True, exist_ok=True)
        
        downloads_dir = Path(self.get_value("file_manager/download_location", self.defaults["file_manager"]["download_location"]))
        downloads_dir.mkdir(parents=True, exist_ok=True)
    
    def get_value(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        # 先尝试从QSettings获取
        value = self.settings.value(key)
        if value is not None:
            return value
        
        # 如果没有找到，使用默认值
        if default is not None:
            return default
        
        # 从默认配置中查找
        keys = key.split('/')
        current = self.defaults
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return None
        
        return current
    
    def set_value(self, key: str, value: Any):
        """设置配置值"""
        self.settings.setValue(key, value)
        self.settings.sync()
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """获取配置段"""
        if section in self.defaults:
            result = self.defaults[section].copy()
            
            # 覆盖已保存的值
            self.settings.beginGroup(section)
            for key in self.settings.allKeys():
                result[key] = self.settings.value(key)
            self.settings.endGroup()
            
            return result
        
        return {}
    
    def set_section(self, section: str, values: Dict[str, Any]):
        """设置配置段"""
        self.settings.beginGroup(section)
        for key, value in values.items():
            self.settings.setValue(key, value)
        self.settings.endGroup()
        self.settings.sync()
    
    def reset_to_defaults(self):
        """重置为默认配置"""
        self.settings.clear()
        self.settings.sync()
    
    def export_config(self, file_path: str):
        """导出配置"""
        config_data = {}
        
        for section in self.defaults.keys():
            config_data[section] = self.get_section(section)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
    
    def import_config(self, file_path: str):
        """导入配置"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            for section, values in config_data.items():
                if section in self.defaults:
                    self.set_section(section, values)
            
            return True
        except Exception:
            return False 