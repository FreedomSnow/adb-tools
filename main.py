#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Tools - Android调试工具集成平台 (Qt版本)
主入口文件
"""

import sys
import os
from pathlib import Path
from PySide6.QtWidgets import QApplication, QMessageBox
from PySide6.QtCore import Qt, QDir
from PySide6.QtGui import QIcon

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.main_window import MainWindow
from src.core.adb_manager import ADBManager
from src.utils.config import Config
from src.utils.logger import setup_logger
from src import DARK_THEME_STYLESHEET


def setup_application():
    """设置应用程序"""
    app = QApplication(sys.argv)
    
    # 设置应用信息
    app.setApplicationName("ADB Tools")
    app.setApplicationDisplayName("ADB Tools - Android调试工具")
    app.setApplicationVersion("2.0.0")
    app.setOrganizationName("ADB Tools")
    
    # 应用全局深色主题
    app.setStyleSheet(DARK_THEME_STYLESHEET)
    
    # 设置应用图标
    icon_path = project_root / "resources" / "icons" / "app_icon.png"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))
    
    return app


def check_dependencies():
    """检查依赖项"""
    try:
        # 检查ADB是否可用
        adb_manager = ADBManager()
        if not adb_manager.is_adb_available():
            QMessageBox.warning(
                None,
                "依赖检查",
                "ADB工具未找到或不可用。\n"
                "请确保已安装Android SDK Platform Tools，\n"
                "或者应用将自动下载ADB工具。"
            )
        return True
    except Exception as e:
        QMessageBox.critical(
            None,
            "启动错误",
            f"检查依赖项时发生错误：\n{str(e)}"
        )
        return False


def main():
    """主函数"""
    try:
        # 设置日志
        setup_logger()
        
        # 创建应用
        app = setup_application()
        
        # 检查依赖
        if not check_dependencies():
            return 1
        
        # 创建主窗口
        main_window = MainWindow()
        main_window.show()
        
        # 运行应用
        return app.exec()
        
    except Exception as e:
        print(f"启动应用时发生错误: {e}")
        if 'app' in locals():
            QMessageBox.critical(
                None,
                "致命错误",
                f"应用启动失败：\n{str(e)}"
            )
        return 1


if __name__ == "__main__":
    sys.exit(main()) 