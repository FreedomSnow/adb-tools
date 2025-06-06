# -*- coding: utf-8 -*-
"""
WiFi连接对话框
通过WiFi连接Android设备
"""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, 
    QLabel, QLineEdit, QPushButton, QMessageBox
)
from PySide6.QtCore import Qt
from ..core.adb_manager import ADBManager


class WiFiConnectDialog(QDialog):
    """WiFi连接对话框"""
    
    def __init__(self, adb_manager: ADBManager, parent=None):
        super().__init__(parent)
        self.adb_manager = adb_manager
        
        self.init_ui()
    
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("WiFi连接设备")
        self.setModal(True)
        self.resize(350, 160)
        
        # 设置深色主题对话框样式
        self.setStyleSheet("""
            QDialog {
                background-color: #1a1a1a;
                border: 2px solid #404040;
                border-radius: 8px;
            }
            QLabel {
                color: #ffffff;
                font-size: 13px;
                font-weight: 500;
                padding: 4px;
                background-color: transparent;
            }
            QLineEdit {
                padding: 10px 12px;
                border: 2px solid #555555;
                border-radius: 6px;
                font-size: 13px;
                background-color: #2d2d2d;
                color: #ffffff;
                min-height: 20px;
            }
            QLineEdit:focus {
                border-color: #0d6efd;
                outline: none;
            }
            QPushButton {
                background-color: #0d6efd;
                color: #ffffff;
                border: 2px solid #0d6efd;
                border-radius: 6px;
                padding: 10px 16px;
                font-size: 13px;
                font-weight: 500;
                min-width: 80px;
                min-height: 20px;
            }
            QPushButton:hover {
                background-color: #0b5ed7;
                border-color: #0a58ca;
                color: #ffffff;
            }
            QPushButton:pressed {
                background-color: #0a58ca;
                border-color: #0a53be;
            }
            QPushButton[style="secondary"] {
                background-color: #f8f9fa;
                color: #212529;
                border-color: #ced4da;
            }
            QPushButton[style="secondary"]:hover {
                background-color: #e9ecef;
                border-color: #adb5bd;
                color: #212529;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)
        
        # 标题
        title_label = QLabel("连接WiFi设备")
        title_label.setStyleSheet("font-size: 16px; font-weight: 600; color: #24292f; margin-bottom: 8px;")
        layout.addWidget(title_label)
        
        # IP地址输入
        ip_layout = QHBoxLayout()
        ip_layout.setSpacing(12)
        ip_label = QLabel("IP地址:")
        ip_label.setMinimumWidth(60)
        ip_layout.addWidget(ip_label)
        
        self.ip_edit = QLineEdit()
        self.ip_edit.setPlaceholderText("192.168.1.100")
        ip_layout.addWidget(self.ip_edit)
        layout.addLayout(ip_layout)
        
        # 端口输入
        port_layout = QHBoxLayout()
        port_layout.setSpacing(12)
        port_label = QLabel("端口:")
        port_label.setMinimumWidth(60)
        port_layout.addWidget(port_label)
        
        self.port_edit = QLineEdit()
        self.port_edit.setText("5555")
        port_layout.addWidget(self.port_edit)
        layout.addLayout(port_layout)
        
        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        cancel_btn = QPushButton("取消")
        cancel_btn.setProperty("style", "secondary")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        connect_btn = QPushButton("连接")
        connect_btn.clicked.connect(self.connect_device)
        connect_btn.setDefault(True)
        button_layout.addWidget(connect_btn)
        
        layout.addLayout(button_layout)
    
    def connect_device(self):
        """连接设备"""
        ip = self.ip_edit.text().strip()
        port = self.port_edit.text().strip()
        
        if not ip:
            QMessageBox.warning(self, "警告", "请输入IP地址")
            return
        
        try:
            port_num = int(port) if port else 5555
        except ValueError:
            QMessageBox.warning(self, "警告", "端口必须是数字")
            return
        
        # 尝试连接
        if self.adb_manager.connect_wifi_device(ip, port_num):
            QMessageBox.information(self, "成功", f"已连接到 {ip}:{port_num}")
            self.accept()
        else:
            QMessageBox.critical(self, "失败", f"连接失败 {ip}:{port_num}") 