# -*- coding: utf-8 -*-
"""
日志系统
应用日志配置和管理
"""

import logging
import logging.handlers
import os
from pathlib import Path
from datetime import datetime


def setup_logger(level=logging.INFO):
    """设置日志系统"""
    
    # 创建日志目录
    log_dir = Path.home() / ".adb-tools" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 日志文件路径
    log_file = log_dir / f"adb_tools_{datetime.now().strftime('%Y%m%d')}.log"
    
    # 配置根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # 清除现有处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 文件处理器 - 按日期轮转
    file_handler = logging.handlers.TimedRotatingFileHandler(
        str(log_file),
        when='midnight',
        interval=1,
        backupCount=7,  # 保留7天的日志
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    
    # 日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # 添加处理器
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # 设置第三方库的日志级别
    logging.getLogger('PySide6').setLevel(logging.WARNING)
    
    logger = logging.getLogger(__name__)
    logger.info("日志系统初始化完成")
    logger.info(f"日志文件: {log_file}")


class LogFilter:
    """日志过滤器"""
    
    def __init__(self):
        self.levels = {
            'DEBUG': logging.DEBUG,
            'INFO': logging.INFO,
            'WARNING': logging.WARNING,
            'ERROR': logging.ERROR,
            'CRITICAL': logging.CRITICAL
        }
    
    def filter_by_level(self, record, min_level: str) -> bool:
        """按级别过滤"""
        if min_level not in self.levels:
            return True
        
        return record.levelno >= self.levels[min_level]
    
    def filter_by_module(self, record, modules: list) -> bool:
        """按模块过滤"""
        if not modules:
            return True
        
        return any(module in record.name for module in modules)


def get_logger(name: str) -> logging.Logger:
    """获取指定名称的日志器"""
    return logging.getLogger(name) 