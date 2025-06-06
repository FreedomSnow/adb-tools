# -*- coding: utf-8 -*-
"""
应用管理器
应用安装、卸载、启动、停止等功能
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QFileDialog, QMessageBox, QProgressBar, QLabel,
    QComboBox, QLineEdit, QCheckBox, QGroupBox, QSplitter,
    QHeaderView, QAbstractItemView, QMenu, QDialog, QTextEdit
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer
from PySide6.QtGui import QIcon, QPixmap, QDragEnterEvent, QDropEvent
import logging

from ..core.adb_manager import ADBManager

logger = logging.getLogger(__name__)


class AppInstallWorker(QThread):
    """APK安装工作线程"""
    
    progress_updated = Signal(int)  # 进度更新
    installation_finished = Signal(bool, str)  # 安装完成
    
    def __init__(self, adb_manager: ADBManager, device_id: str, apk_path: str):
        super().__init__()
        self.adb_manager = adb_manager
        self.device_id = device_id
        self.apk_path = apk_path
    
    def run(self):
        """执行APK安装"""
        try:
            # 模拟进度更新
            for i in range(0, 101, 10):
                self.progress_updated.emit(i)
                self.msleep(100)
            
            # 执行实际安装
            success = self.adb_manager.install_apk(self.device_id, self.apk_path)
            
            if success:
                self.installation_finished.emit(True, "安装成功")
            else:
                self.installation_finished.emit(False, "安装失败")
                
        except Exception as e:
            self.installation_finished.emit(False, f"安装错误: {str(e)}")


class AppInfoDialog(QDialog):
    """应用信息对话框"""
    
    def __init__(self, app_info: Dict, parent=None):
        super().__init__(parent)
        self.app_info = app_info
        
        self.init_ui()
    
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("应用信息")
        self.setModal(True)
        self.resize(500, 400)
        
        # 设置深色主题样式
        self.setStyleSheet("""
            QDialog {
                background-color: #1a1a1a;
                color: #ffffff;
            }
            QGroupBox {
                background-color: #2d2d2d;
                border: 1px solid #404040;
                border-radius: 6px;
                margin-top: 6px;
                padding-top: 10px;
                color: #ffffff;
                font-weight: 600;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                background-color: #2d2d2d;
                color: #ffffff;
            }
            QLabel {
                color: #ffffff;
                background-color: transparent;
            }
            QTextEdit {
                background-color: #1a1a1a;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 4px;
                padding: 8px;
            }
            QPushButton {
                background-color: #f8f9fa;
                color: #212529;
                border: 1px solid #d0d7de;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 500;
                min-width: 80px;
            }
            QPushButton:hover {
                background-color: #f3f4f6;
                border-color: #d0d7de;
            }
        """)
        
        layout = QVBoxLayout(self)
        
        # 应用基本信息
        info_group = QGroupBox("基本信息")
        info_layout = QVBoxLayout(info_group)
        
        info_items = [
            ("包名", self.app_info.get('package_name', 'N/A')),
            ("应用名", self.app_info.get('app_name', 'N/A')),
            ("版本", self.app_info.get('version', 'N/A')),
            ("版本代码", self.app_info.get('version_code', 'N/A')),
            ("大小", self.app_info.get('size', 'N/A')),
            ("安装时间", self.app_info.get('install_time', 'N/A')),
            ("更新时间", self.app_info.get('update_time', 'N/A')),
            ("类型", "系统应用" if self.app_info.get('is_system', False) else "用户应用"),
        ]
        
        for label, value in info_items:
            item_layout = QHBoxLayout()
            item_layout.addWidget(QLabel(f"{label}:"))
            item_layout.addWidget(QLabel(str(value)))
            item_layout.addStretch()
            info_layout.addLayout(item_layout)
        
        layout.addWidget(info_group)
        
        # 权限信息
        permissions_group = QGroupBox("权限信息")
        permissions_layout = QVBoxLayout(permissions_group)
        
        permissions_text = QTextEdit()
        permissions_text.setReadOnly(True)
        permissions_text.setMaximumHeight(150)
        
        permissions = self.app_info.get('permissions', [])
        if permissions:
            permissions_text.setPlainText('\n'.join(permissions))
        else:
            permissions_text.setPlainText("未获取到权限信息")
        
        permissions_layout.addWidget(permissions_text)
        layout.addWidget(permissions_group)
        
        # 按钮
        button_layout = QHBoxLayout()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addStretch()
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)


class AppManagerWidget(QWidget):
    """应用管理器组件"""
    
    def __init__(self, adb_manager: ADBManager):
        super().__init__()
        self.adb_manager = adb_manager
        self.current_device_id = None
        self.apps_data = []
        self.install_worker = None
        
        self.init_ui()
        self.connect_signals()
        
        # 启用拖拽
        self.setAcceptDrops(True)
    
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # 控制面板
        self.create_control_panel(layout)
        
        # 应用列表
        self.create_app_list(layout)
        
        # 状态栏
        self.create_status_bar(layout)
    
    def create_control_panel(self, parent_layout):
        """创建控制面板"""
        control_group = QGroupBox("应用操作")
        control_group.setStyleSheet("""
            QGroupBox {
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 6px;
                margin-top: 6px;
                padding-top: 10px;
                background-color: #2d2d2d;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
                background-color: #2d2d2d;
                color: #ffffff;
            }
            QPushButton {
                background-color: #f6f8fa;
                color: #24292f;
                border: 1px solid #d0d7de;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 500;
                min-width: 80px;
            }
            QPushButton:hover {
                background-color: #f3f4f6;
                border-color: #d0d7de;
            }
            QPushButton:pressed {
                background-color: #ebecf0;
            }
            QPushButton[style="primary"] {
                background-color: #0969da;
                color: white;
                border-color: #0969da;
            }
            QPushButton[style="primary"]:hover {
                background-color: #0860ca;
                border-color: #0860ca;
            }
            QComboBox, QLineEdit {
                padding: 6px 8px;
                border: 1px solid #555555;
                border-radius: 6px;
                background-color: #3d3d3d;
                color: #ffffff;
                font-size: 13px;
            }
            QComboBox:focus, QLineEdit:focus {
                border-color: #0969da;
                outline: none;
            }
            QComboBox QAbstractItemView {
                background-color: #3d3d3d;
                color: #ffffff;
                border: 1px solid #555555;
                border-radius: 6px;
                selection-background-color: #0969da;
                selection-color: #ffffff;
                outline: none;
                padding: 4px;
            }
            QComboBox QAbstractItemView::item {
                padding: 6px 8px;
                border: none;
                background-color: transparent;
                color: #ffffff;
                min-height: 18px;
            }
            QComboBox QAbstractItemView::item:selected {
                background-color: #0969da;
                color: #ffffff;
            }
            QComboBox QAbstractItemView::item:hover {
                background-color: #555555;
                color: #ffffff;
            }
            QCheckBox {
                font-size: 13px;
                color: #ffffff;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
                border: 1px solid #555555;
                border-radius: 3px;
                background-color: #3d3d3d;
            }
            QCheckBox::indicator:checked {
                background-color: #0969da;
                border-color: #0969da;
            }
            QProgressBar {
                border: 1px solid #404040;
                border-radius: 6px;
                text-align: center;
                background-color: #3d3d3d;
                color: #ffffff;
            }
            QProgressBar::chunk {
                background-color: #0969da;
                border-radius: 5px;
            }
            QLabel {
                color: #ffffff;
                font-size: 13px;
                background-color: transparent;
            }
        """)
        
        control_layout = QVBoxLayout(control_group)
        control_layout.setSpacing(12)
        control_layout.setContentsMargins(16, 16, 16, 16)
        
        # 第一行：安装和刷新
        row1_layout = QHBoxLayout()
        row1_layout.setSpacing(8)
        
        # 安装APK按钮
        install_btn = QPushButton("📦 安装APK")
        install_btn.setProperty("style", "primary")
        install_btn.clicked.connect(self.install_apk)
        row1_layout.addWidget(install_btn)
        
        # 刷新按钮
        refresh_btn = QPushButton("🔄 刷新列表")
        refresh_btn.clicked.connect(self.refresh_apps)
        row1_layout.addWidget(refresh_btn)
        
        row1_layout.addStretch()
        
        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setMaximumWidth(200)
        row1_layout.addWidget(self.progress_bar)
        
        control_layout.addLayout(row1_layout)
        
        # 第二行：过滤选项
        row2_layout = QHBoxLayout()
        
        # 应用类型过滤
        row2_layout.addWidget(QLabel("类型:"))
        self.app_type_combo = QComboBox()
        self.app_type_combo.addItems(["全部", "用户应用", "系统应用"])
        self.app_type_combo.currentTextChanged.connect(self.filter_apps)
        row2_layout.addWidget(self.app_type_combo)
        
        # 搜索框
        row2_layout.addWidget(QLabel("搜索:"))
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("搜索应用名或包名")
        self.search_box.textChanged.connect(self.filter_apps)
        row2_layout.addWidget(self.search_box)
        
        # 显示系统应用选项
        self.show_system_cb = QCheckBox("显示系统应用")
        self.show_system_cb.toggled.connect(self.filter_apps)
        row2_layout.addWidget(self.show_system_cb)
        
        row2_layout.addStretch()
        control_layout.addLayout(row2_layout)
        
        parent_layout.addWidget(control_group)
    
    def create_app_list(self, parent_layout):
        """创建应用列表"""
        # 应用表格
        self.app_table = QTableWidget()
        self.app_table.setColumnCount(6)
        self.app_table.setHorizontalHeaderLabels([
            "应用名", "包名", "版本", "大小", "类型", "操作"
        ])
        
        # 设置深色主题表格样式
        self.app_table.setStyleSheet("""
            QTableWidget {
                background-color: #1a1a1a;
                border: 1px solid #404040;
                border-radius: 6px;
                gridline-color: #404040;
                font-size: 13px;
                selection-background-color: #0969da;
                color: #ffffff;
            }
            QTableWidget::item {
                padding: 8px 12px;
                border-bottom: 1px solid #2d2d2d;
                background-color: transparent;
                color: #ffffff;
            }
            QTableWidget::item:selected {
                background-color: #0969da;
                color: white;
            }
            QTableWidget::item:alternate {
                background-color: #202020;
            }
            QHeaderView::section {
                background-color: #2d2d2d;
                color: #ffffff;
                padding: 8px 12px;
                border: 1px solid #404040;
                border-left: none;
                font-weight: 600;
                font-size: 12px;
            }
            QHeaderView::section:first {
                border-left: 1px solid #404040;
                border-top-left-radius: 6px;
            }
            QHeaderView::section:last {
                border-top-right-radius: 6px;
            }
            QScrollBar:vertical {
                background-color: #2d2d2d;
                width: 12px;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical {
                background-color: #555555;
                border-radius: 6px;
                min-height: 20px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #777777;
            }
        """)
        
        # 设置表格属性
        self.app_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.app_table.setAlternatingRowColors(True)
        self.app_table.setSortingEnabled(True)
        
        # 设置列宽
        header = self.app_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # 应用名
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # 包名
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # 版本
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # 大小
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # 类型
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # 操作
        
        # 右键菜单
        self.app_table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.app_table.customContextMenuRequested.connect(self.show_context_menu)
        
        parent_layout.addWidget(self.app_table, 1)  # 占用剩余空间
    
    def create_status_bar(self, parent_layout):
        """创建状态栏"""
        status_layout = QHBoxLayout()
        
        self.status_label = QLabel("就绪")
        status_layout.addWidget(self.status_label)
        
        status_layout.addStretch()
        
        self.app_count_label = QLabel("应用数: 0")
        status_layout.addWidget(self.app_count_label)
        
        parent_layout.addLayout(status_layout)
    
    def connect_signals(self):
        """连接信号"""
        pass
    
    def set_current_device(self, device_id: str):
        """设置当前设备"""
        if device_id != self.current_device_id:
            self.current_device_id = device_id
            
            if device_id:
                self.status_label.setText(f"设备: {device_id}")
                self.refresh_apps()
            else:
                self.status_label.setText("未选择设备")
                self.clear_apps()
    
    def install_apk(self):
        """安装APK"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        # 选择APK文件
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "选择APK文件",
            "",
            "APK文件 (*.apk);;所有文件 (*)"
        )
        
        if file_path:
            self.install_apk_file(file_path)
    
    def install_apk_file(self, apk_path: str):
        """安装指定的APK文件"""
        if not os.path.exists(apk_path):
            QMessageBox.critical(self, "错误", "APK文件不存在")
            return
        
        # 显示进度条
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        # 启动安装线程
        self.install_worker = AppInstallWorker(
            self.adb_manager, 
            self.current_device_id, 
            apk_path
        )
        self.install_worker.progress_updated.connect(self.progress_bar.setValue)
        self.install_worker.installation_finished.connect(self.on_installation_finished)
        self.install_worker.start()
        
        self.status_label.setText(f"正在安装: {os.path.basename(apk_path)}")
        logger.info(f"开始安装APK: {apk_path}")
    
    def on_installation_finished(self, success: bool, message: str):
        """安装完成处理"""
        self.progress_bar.setVisible(False)
        
        if success:
            QMessageBox.information(self, "成功", message)
            self.refresh_apps()  # 刷新应用列表
            self.status_label.setText("安装完成")
        else:
            QMessageBox.critical(self, "失败", message)
            self.status_label.setText("安装失败")
        
        logger.info(f"APK安装完成: {message}")
    
    def refresh_apps(self):
        """刷新应用列表"""
        if not self.current_device_id:
            return
        
        self.status_label.setText("正在加载应用列表...")
        
        try:
            # 获取应用列表
            apps = self.adb_manager.get_installed_apps(self.current_device_id)
            
            # 处理应用数据
            self.apps_data = []
            for app in apps:
                app_info = {
                    'app_name': app.get('app_name', app.get('package_name', '').split('.')[-1]),
                    'package_name': app.get('package_name', ''),
                    'version': 'Unknown',
                    'size': 'Unknown',
                    'is_system': app.get('is_system', False),
                    'permissions': []
                }
                self.apps_data.append(app_info)
            
            # 更新表格显示
            self.filter_apps()
            
            self.status_label.setText(f"已加载 {len(self.apps_data)} 个应用")
            logger.info(f"应用列表刷新完成: {len(self.apps_data)} 个应用")
            
        except Exception as e:
            self.status_label.setText("加载失败")
            QMessageBox.critical(self, "错误", f"加载应用列表失败:\n{str(e)}")
            logger.error(f"刷新应用列表失败: {e}")
    
    def filter_apps(self):
        """过滤应用"""
        if not self.apps_data:
            return
        
        # 获取过滤条件
        app_type = self.app_type_combo.currentText()
        search_text = self.search_box.text().lower()
        show_system = self.show_system_cb.isChecked()
        
        # 过滤应用
        filtered_apps = []
        for app in self.apps_data:
            # 类型过滤
            if app_type == "用户应用" and app['is_system']:
                continue
            elif app_type == "系统应用" and not app['is_system']:
                continue
            
            # 系统应用显示过滤
            if app['is_system'] and not show_system:
                continue
            
            # 搜索过滤
            if search_text:
                if (search_text not in app['app_name'].lower() and 
                    search_text not in app['package_name'].lower()):
                    continue
            
            filtered_apps.append(app)
        
        # 更新表格
        self.update_app_table(filtered_apps)
        self.app_count_label.setText(f"应用数: {len(filtered_apps)}")
    
    def update_app_table(self, apps: List[Dict]):
        """更新应用表格"""
        self.app_table.setRowCount(len(apps))
        
        for row, app in enumerate(apps):
            # 应用名
            self.app_table.setItem(row, 0, QTableWidgetItem(app['app_name']))
            
            # 包名
            self.app_table.setItem(row, 1, QTableWidgetItem(app['package_name']))
            
            # 版本
            self.app_table.setItem(row, 2, QTableWidgetItem(app['version']))
            
            # 大小
            self.app_table.setItem(row, 3, QTableWidgetItem(app['size']))
            
            # 类型
            app_type = "系统" if app['is_system'] else "用户"
            self.app_table.setItem(row, 4, QTableWidgetItem(app_type))
            
            # 操作按钮
            self.create_action_buttons(row, app)
    
    def create_action_buttons(self, row: int, app: Dict):
        """创建操作按钮"""
        button_widget = QWidget()
        button_layout = QHBoxLayout(button_widget)
        button_layout.setContentsMargins(2, 2, 2, 2)
        
        # 启动按钮
        start_btn = QPushButton("启动")
        start_btn.setMaximumWidth(50)
        start_btn.clicked.connect(lambda: self.start_app(app['package_name']))
        button_layout.addWidget(start_btn)
        
        # 停止按钮
        stop_btn = QPushButton("停止")
        stop_btn.setMaximumWidth(50)
        stop_btn.clicked.connect(lambda: self.stop_app(app['package_name']))
        button_layout.addWidget(stop_btn)
        
        # 卸载按钮（系统应用不显示）
        if not app['is_system']:
            uninstall_btn = QPushButton("卸载")
            uninstall_btn.setMaximumWidth(50)
            uninstall_btn.clicked.connect(lambda: self.uninstall_app(app['package_name']))
            button_layout.addWidget(uninstall_btn)
        
        self.app_table.setCellWidget(row, 5, button_widget)
    
    def show_context_menu(self, position):
        """显示右键菜单"""
        if not self.app_table.itemAt(position):
            return
        
        row = self.app_table.rowAt(position.y())
        if row < 0:
            return
        
        package_name = self.app_table.item(row, 1).text()
        app_info = next((app for app in self.apps_data if app['package_name'] == package_name), None)
        
        if not app_info:
            return
        
        menu = QMenu(self)
        
        # 应用信息
        info_action = menu.addAction("应用信息")
        info_action.triggered.connect(lambda: self.show_app_info(app_info))
        
        menu.addSeparator()
        
        # 启动应用
        start_action = menu.addAction("启动应用")
        start_action.triggered.connect(lambda: self.start_app(package_name))
        
        # 停止应用
        stop_action = menu.addAction("停止应用")
        stop_action.triggered.connect(lambda: self.stop_app(package_name))
        
        # 卸载应用（系统应用不显示）
        if not app_info['is_system']:
            menu.addSeparator()
            uninstall_action = menu.addAction("卸载应用")
            uninstall_action.triggered.connect(lambda: self.uninstall_app(package_name))
        
        menu.exec(self.app_table.mapToGlobal(position))
    
    def show_app_info(self, app_info: Dict):
        """显示应用信息"""
        dialog = AppInfoDialog(app_info, self)
        dialog.exec()
    
    def start_app(self, package_name: str):
        """启动应用"""
        if not self.current_device_id:
            return
        
        try:
            success = self.adb_manager.start_app(self.current_device_id, package_name)
            if success:
                self.status_label.setText(f"已启动: {package_name}")
                QMessageBox.information(self, "成功", "应用启动成功")
            else:
                QMessageBox.critical(self, "失败", "应用启动失败")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"启动应用失败:\n{str(e)}")
    
    def stop_app(self, package_name: str):
        """停止应用"""
        if not self.current_device_id:
            return
        
        try:
            success = self.adb_manager.stop_app(self.current_device_id, package_name)
            if success:
                self.status_label.setText(f"已停止: {package_name}")
                QMessageBox.information(self, "成功", "应用停止成功")
            else:
                QMessageBox.critical(self, "失败", "应用停止失败")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"停止应用失败:\n{str(e)}")
    
    def uninstall_app(self, package_name: str):
        """卸载应用"""
        if not self.current_device_id:
            return
        
        # 确认对话框
        reply = QMessageBox.question(
            self,
            "确认卸载",
            f"确定要卸载应用 {package_name} 吗？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            try:
                success = self.adb_manager.uninstall_app(self.current_device_id, package_name)
                if success:
                    self.status_label.setText(f"已卸载: {package_name}")
                    QMessageBox.information(self, "成功", "应用卸载成功")
                    self.refresh_apps()  # 刷新列表
                else:
                    QMessageBox.critical(self, "失败", "应用卸载失败")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"卸载应用失败:\n{str(e)}")
    
    def clear_apps(self):
        """清空应用列表"""
        self.apps_data.clear()
        self.app_table.setRowCount(0)
        self.app_count_label.setText("应用数: 0")
    
    def dragEnterEvent(self, event: QDragEnterEvent):
        """拖拽进入事件"""
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if len(urls) == 1 and urls[0].toLocalFile().endswith('.apk'):
                event.acceptProposedAction()
    
    def dropEvent(self, event: QDropEvent):
        """拖拽放置事件"""
        urls = event.mimeData().urls()
        if urls:
            apk_path = urls[0].toLocalFile()
            if apk_path.endswith('.apk'):
                self.install_apk_file(apk_path)
    
    def cleanup(self):
        """清理资源"""
        if self.install_worker and self.install_worker.isRunning():
            self.install_worker.quit()
            self.install_worker.wait() 