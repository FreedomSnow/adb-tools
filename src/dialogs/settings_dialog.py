# -*- coding: utf-8 -*-
"""
设置对话框
应用配置设置
"""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, 
    QLabel, QPushButton, QMessageBox, QTabWidget
)
from PySide6.QtCore import Qt
from ..utils.config import Config


class SettingsDialog(QDialog):
    """设置对话框"""
    
    def __init__(self, config: Config, parent=None):
        super().__init__(parent)
        self.config = config
        
        self.init_ui()
    
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("设置")
        self.setModal(True)
        self.resize(500, 400)
        
        layout = QVBoxLayout(self)
        
        # 标签页
        tab_widget = QTabWidget()
        
        # 通用设置页
        general_widget = QLabel("通用设置 - 待实现")
        general_widget.setAlignment(Qt.AlignCenter)
        tab_widget.addTab(general_widget, "通用")
        
        # ADB设置页
        adb_widget = QLabel("ADB设置 - 待实现")
        adb_widget.setAlignment(Qt.AlignCenter)
        tab_widget.addTab(adb_widget, "ADB")
        
        layout.addWidget(tab_widget)
        
        # 按钮
        button_layout = QHBoxLayout()
        
        ok_btn = QPushButton("确定")
        ok_btn.clicked.connect(self.accept)
        button_layout.addWidget(ok_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        layout.addLayout(button_layout) 