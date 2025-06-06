# -*- coding: utf-8 -*-
"""
文件管理器
设备文件系统浏览和文件操作
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QFileDialog, QMessageBox, QProgressBar, QLabel,
    QLineEdit, QCheckBox, QGroupBox, QSplitter, QToolBar,
    QHeaderView, QAbstractItemView, QMenu, QDialog, QInputDialog
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer
from PySide6.QtGui import QIcon, QPixmap, QDragEnterEvent, QDropEvent, QAction, QFont, QColor
import logging

from ..core.adb_manager import ADBManager

logger = logging.getLogger(__name__)


class FileTransferWorker(QThread):
    """文件传输工作线程"""
    
    progress_updated = Signal(int)  # 进度更新
    transfer_finished = Signal(bool, str)  # 传输完成
    
    def __init__(self, adb_manager: ADBManager, device_id: str, 
                 operation: str, local_path: str, remote_path: str):
        super().__init__()
        self.adb_manager = adb_manager
        self.device_id = device_id
        self.operation = operation  # 'upload' or 'download'
        self.local_path = local_path
        self.remote_path = remote_path
    
    def run(self):
        """执行文件传输"""
        try:
            # 模拟进度更新
            for i in range(0, 101, 20):
                self.progress_updated.emit(i)
                self.msleep(100)
            
            # 执行实际传输
            if self.operation == 'upload':
                success = self.adb_manager.upload_file(
                    self.device_id, self.local_path, self.remote_path
                )
                message = "上传成功" if success else "上传失败"
            else:  # download
                success = self.adb_manager.download_file(
                    self.device_id, self.remote_path, self.local_path
                )
                message = "下载成功" if success else "下载失败"
            
            self.transfer_finished.emit(success, message)
            
        except Exception as e:
            self.transfer_finished.emit(False, f"传输错误: {str(e)}")


class FileManagerWidget(QWidget):
    """文件管理器组件"""
    
    def __init__(self, adb_manager: ADBManager):
        super().__init__()
        self.adb_manager = adb_manager
        self.current_device_id = None
        self.current_path = "/sdcard"
        self.files_data = []
        self.transfer_worker = None
        
        self.init_ui()
        self.connect_signals()
        
        # 启用拖拽
        self.setAcceptDrops(True)
    
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # 工具栏
        self.create_toolbar(layout)
        
        # 路径导航
        self.create_navigation(layout)
        
        # 文件列表
        self.create_file_list(layout)
        
        # 状态栏
        self.create_status_bar(layout)
    
    def create_toolbar(self, parent_layout):
        """创建工具栏"""
        toolbar_group = QGroupBox("文件操作")
        toolbar_group.setStyleSheet("""
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
            QPushButton[style="success"] {
                background-color: #1a7f37;
                color: white;
                border-color: #1a7f37;
            }
            QPushButton[style="success"]:hover {
                background-color: #2da44e;
                border-color: #2da44e;
            }
            QPushButton[style="danger"] {
                background-color: #cf222e;
                color: white;
                border-color: #cf222e;
            }
            QPushButton[style="danger"]:hover {
                background-color: #a40e26;
                border-color: #a40e26;
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
        """)
        
        toolbar_layout = QHBoxLayout(toolbar_group)
        toolbar_layout.setSpacing(8)
        toolbar_layout.setContentsMargins(16, 16, 16, 16)
        
        # 刷新按钮
        refresh_btn = QPushButton("🔄 刷新")
        refresh_btn.clicked.connect(self.refresh_files)
        toolbar_layout.addWidget(refresh_btn)
        
        # 上传文件按钮
        upload_btn = QPushButton("⬆️ 上传文件")
        upload_btn.setProperty("style", "primary")
        upload_btn.clicked.connect(self.upload_file)
        toolbar_layout.addWidget(upload_btn)
        
        # 下载按钮
        download_btn = QPushButton("⬇️ 下载选中")
        download_btn.setProperty("style", "success")
        download_btn.clicked.connect(self.download_selected)
        toolbar_layout.addWidget(download_btn)
        
        # 创建文件夹按钮
        mkdir_btn = QPushButton("📁 新建文件夹")
        mkdir_btn.clicked.connect(self.create_folder)
        toolbar_layout.addWidget(mkdir_btn)
        
        # 删除按钮
        delete_btn = QPushButton("🗑️ 删除选中")
        delete_btn.setProperty("style", "danger")
        delete_btn.clicked.connect(self.delete_selected)
        toolbar_layout.addWidget(delete_btn)
        
        toolbar_layout.addStretch()
        
        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setMaximumWidth(200)
        toolbar_layout.addWidget(self.progress_bar)
        
        parent_layout.addWidget(toolbar_group)
    
    def create_navigation(self, parent_layout):
        """创建导航栏"""
        nav_group = QGroupBox("路径导航")
        nav_layout = QVBoxLayout(nav_group)
        
        # 第一行：快捷按钮
        quick_layout = QHBoxLayout()
        
        quick_paths = [
            ("根目录", "/"),
            ("内部存储", "/sdcard"),
            ("下载", "/sdcard/Download"),
            ("相册", "/sdcard/DCIM"),
            ("音乐", "/sdcard/Music"),
            ("文档", "/sdcard/Documents")
        ]
        
        for name, path in quick_paths:
            btn = QPushButton(name)
            btn.clicked.connect(lambda checked, p=path: self.navigate_to(p))
            quick_layout.addWidget(btn)
        
        quick_layout.addStretch()
        nav_layout.addLayout(quick_layout)
        
        # 第二行：路径编辑
        path_layout = QHBoxLayout()
        
        path_layout.addWidget(QLabel("当前路径:"))
        
        self.path_edit = QLineEdit()
        self.path_edit.setText(self.current_path)
        self.path_edit.returnPressed.connect(self.navigate_to_path)
        path_layout.addWidget(self.path_edit)
        
        go_btn = QPushButton("转到")
        go_btn.clicked.connect(self.navigate_to_path)
        path_layout.addWidget(go_btn)
        
        # 返回上级按钮
        back_btn = QPushButton("上级目录")
        back_btn.clicked.connect(self.go_parent)
        path_layout.addWidget(back_btn)
        
        nav_layout.addLayout(path_layout)
        parent_layout.addWidget(nav_group)
    
    def create_file_list(self, parent_layout):
        """创建文件列表"""
        # 文件表格
        self.file_table = QTableWidget()
        self.file_table.setColumnCount(5)
        self.file_table.setHorizontalHeaderLabels([
            "名称", "类型", "大小", "修改时间", "权限"
        ])
        
        # 设置深色主题表格样式
        self.file_table.setStyleSheet("""
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
        self.file_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.file_table.setAlternatingRowColors(True)
        self.file_table.setSortingEnabled(True)
        
        # 设置列宽
        header = self.file_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Stretch)  # 名称
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # 类型
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # 大小
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # 修改时间
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # 权限
        
        # 双击事件
        self.file_table.itemDoubleClicked.connect(self.on_item_double_clicked)
        
        # 右键菜单
        self.file_table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.file_table.customContextMenuRequested.connect(self.show_context_menu)
        
        parent_layout.addWidget(self.file_table, 1)  # 占用剩余空间
    
    def create_status_bar(self, parent_layout):
        """创建状态栏"""
        status_layout = QHBoxLayout()
        
        self.status_label = QLabel("就绪")
        status_layout.addWidget(self.status_label)
        
        status_layout.addStretch()
        
        self.file_count_label = QLabel("文件数: 0")
        status_layout.addWidget(self.file_count_label)
        
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
                self.navigate_to("/sdcard")  # 默认到内部存储
            else:
                self.status_label.setText("未选择设备")
                self.clear_files()
    
    def navigate_to(self, path: str):
        """导航到指定路径"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        self.current_path = path
        self.path_edit.setText(path)
        self.refresh_files()
    
    def navigate_to_path(self):
        """导航到路径编辑框中的路径"""
        path = self.path_edit.text().strip()
        if path:
            self.navigate_to(path)
    
    def go_parent(self):
        """返回上级目录"""
        if self.current_path == "/":
            return
        
        parent_path = str(Path(self.current_path).parent)
        if parent_path == ".":
            parent_path = "/"
        
        self.navigate_to(parent_path)
    
    def refresh_files(self):
        """刷新文件列表"""
        if not self.current_device_id:
            return
        
        self.status_label.setText("正在加载文件列表...")
        
        try:
            # 获取文件列表
            files = self.adb_manager.list_files(self.current_device_id, self.current_path)
            
            # 处理文件数据
            self.files_data = files
            
            # 更新表格显示
            self.update_file_table(files)
            
            self.status_label.setText(f"已加载 {len(files)} 个文件/文件夹")
            logger.info(f"文件列表刷新完成: {len(files)} 个项目")
            
        except Exception as e:
            self.status_label.setText("加载失败")
            QMessageBox.critical(self, "错误", f"加载文件列表失败:\n{str(e)}")
            logger.error(f"刷新文件列表失败: {e}")
    
    def update_file_table(self, files: List[Dict]):
        """更新文件表格"""
        self.file_table.setRowCount(len(files))
        
        for row, file_info in enumerate(files):
            # 名称
            name_item = QTableWidgetItem(file_info['name'])
            if file_info['type'] == 'directory':
                # 设置文件夹样式 - 使用粗体字和蓝色
                font = QFont()
                font.setBold(True)
                name_item.setFont(font)
                name_item.setForeground(QColor("#0969da"))
            else:
                # 普通文件使用白色文字
                name_item.setForeground(QColor("#ffffff"))
            self.file_table.setItem(row, 0, name_item)
            
            # 类型
            file_type = "文件夹" if file_info['type'] == 'directory' else "文件"
            type_item = QTableWidgetItem(file_type)
            type_item.setForeground(QColor("#cccccc"))
            self.file_table.setItem(row, 1, type_item)
            
            # 大小
            size = file_info.get('size', '-')
            if file_info['type'] == 'directory':
                size = '-'
            size_item = QTableWidgetItem(str(size))
            size_item.setForeground(QColor("#cccccc"))
            self.file_table.setItem(row, 2, size_item)
            
            # 修改时间
            mtime = file_info.get('mtime', '-')
            mtime_item = QTableWidgetItem(str(mtime))
            mtime_item.setForeground(QColor("#cccccc"))
            self.file_table.setItem(row, 3, mtime_item)
            
            # 权限
            permissions = file_info.get('permissions', '-')
            perm_item = QTableWidgetItem(permissions)
            perm_item.setForeground(QColor("#6c757d"))
            self.file_table.setItem(row, 4, perm_item)
        
        self.file_count_label.setText(f"文件数: {len(files)}")
    
    def on_item_double_clicked(self, item):
        """表格项双击事件"""
        row = item.row()
        if row < len(self.files_data):
            file_info = self.files_data[row]
            
            if file_info['type'] == 'directory':
                # 进入目录
                new_path = file_info['path']
                self.navigate_to(new_path)
    
    def show_context_menu(self, position):
        """显示右键菜单"""
        item = self.file_table.itemAt(position)
        if not item:
            return
        
        row = item.row()
        if row >= len(self.files_data):
            return
        
        file_info = self.files_data[row]
        
        menu = QMenu(self)
        
        if file_info['type'] == 'directory':
            # 文件夹菜单
            open_action = menu.addAction("打开")
            open_action.triggered.connect(lambda: self.navigate_to(file_info['path']))
        else:
            # 文件菜单
            download_action = menu.addAction("下载")
            download_action.triggered.connect(lambda: self.download_file(file_info))
        
        menu.addSeparator()
        
        # 通用菜单
        delete_action = menu.addAction("删除")
        delete_action.triggered.connect(lambda: self.delete_file(file_info))
        
        menu.exec(self.file_table.mapToGlobal(position))
    
    def upload_file(self):
        """上传文件"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        # 选择本地文件
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "选择要上传的文件",
            "",
            "所有文件 (*)"
        )
        
        if file_path:
            file_name = os.path.basename(file_path)
            remote_path = f"{self.current_path}/{file_name}".replace("//", "/")
            
            self.start_transfer('upload', file_path, remote_path)
    
    def download_selected(self):
        """下载选中的文件"""
        selected_rows = set()
        for item in self.file_table.selectedItems():
            selected_rows.add(item.row())
        
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择要下载的文件")
            return
        
        # 选择下载目录
        download_dir = QFileDialog.getExistingDirectory(
            self,
            "选择下载目录"
        )
        
        if download_dir:
            for row in selected_rows:
                if row < len(self.files_data):
                    file_info = self.files_data[row]
                    if file_info['type'] == 'file':
                        local_path = os.path.join(download_dir, file_info['name'])
                        self.start_transfer('download', local_path, file_info['path'])
    
    def download_file(self, file_info: Dict):
        """下载单个文件"""
        if file_info['type'] != 'file':
            return
        
        # 选择保存位置
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "保存文件",
            file_info['name'],
            "所有文件 (*)"
        )
        
        if file_path:
            self.start_transfer('download', file_path, file_info['path'])
    
    def start_transfer(self, operation: str, local_path: str, remote_path: str):
        """开始文件传输"""
        # 显示进度条
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        # 启动传输线程
        self.transfer_worker = FileTransferWorker(
            self.adb_manager,
            self.current_device_id,
            operation,
            local_path,
            remote_path
        )
        self.transfer_worker.progress_updated.connect(self.progress_bar.setValue)
        self.transfer_worker.transfer_finished.connect(self.on_transfer_finished)
        self.transfer_worker.start()
        
        operation_text = "上传" if operation == 'upload' else "下载"
        self.status_label.setText(f"正在{operation_text}: {os.path.basename(local_path)}")
        logger.info(f"开始{operation_text}文件: {local_path} -> {remote_path}")
    
    def on_transfer_finished(self, success: bool, message: str):
        """传输完成处理"""
        self.progress_bar.setVisible(False)
        
        if success:
            QMessageBox.information(self, "成功", message)
            self.refresh_files()  # 刷新文件列表
            self.status_label.setText("传输完成")
        else:
            QMessageBox.critical(self, "失败", message)
            self.status_label.setText("传输失败")
        
        logger.info(f"文件传输完成: {message}")
    
    def create_folder(self):
        """创建文件夹"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        # 输入文件夹名称
        folder_name, ok = QInputDialog.getText(
            self,
            "新建文件夹",
            "请输入文件夹名称:"
        )
        
        if ok and folder_name.strip():
            folder_name = folder_name.strip()
            folder_path = f"{self.current_path}/{folder_name}".replace("//", "/")
            
            try:
                # 执行创建文件夹命令
                success, output, error = self.adb_manager.execute_command([
                    "-s", self.current_device_id, "shell", "mkdir", "-p", folder_path
                ])
                
                if success:
                    QMessageBox.information(self, "成功", "文件夹创建成功")
                    self.refresh_files()
                else:
                    QMessageBox.critical(self, "失败", f"文件夹创建失败:\n{error}")
                    
            except Exception as e:
                QMessageBox.critical(self, "错误", f"创建文件夹失败:\n{str(e)}")
    
    def delete_selected(self):
        """删除选中的文件/文件夹"""
        selected_rows = set()
        for item in self.file_table.selectedItems():
            selected_rows.add(item.row())
        
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择要删除的文件/文件夹")
            return
        
        # 确认删除
        reply = QMessageBox.question(
            self,
            "确认删除",
            f"确定要删除选中的 {len(selected_rows)} 个项目吗？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            for row in selected_rows:
                if row < len(self.files_data):
                    file_info = self.files_data[row]
                    self.delete_file(file_info, show_message=False)
            
            QMessageBox.information(self, "完成", "删除操作完成")
            self.refresh_files()
    
    def delete_file(self, file_info: Dict, show_message: bool = True):
        """删除单个文件/文件夹"""
        if not self.current_device_id:
            return
        
        try:
            if file_info['type'] == 'directory':
                # 删除文件夹
                success, output, error = self.adb_manager.execute_command([
                    "-s", self.current_device_id, "shell", "rm", "-rf", file_info['path']
                ])
            else:
                # 删除文件
                success, output, error = self.adb_manager.execute_command([
                    "-s", self.current_device_id, "shell", "rm", "-f", file_info['path']
                ])
            
            if success:
                if show_message:
                    QMessageBox.information(self, "成功", "删除成功")
                    self.refresh_files()
            else:
                if show_message:
                    QMessageBox.critical(self, "失败", f"删除失败:\n{error}")
                    
        except Exception as e:
            if show_message:
                QMessageBox.critical(self, "错误", f"删除失败:\n{str(e)}")
    
    def clear_files(self):
        """清空文件列表"""
        self.files_data.clear()
        self.file_table.setRowCount(0)
        self.file_count_label.setText("文件数: 0")
    
    def dragEnterEvent(self, event: QDragEnterEvent):
        """拖拽进入事件"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
    
    def dropEvent(self, event: QDropEvent):
        """拖拽放置事件"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        urls = event.mimeData().urls()
        for url in urls:
            local_path = url.toLocalFile()
            if os.path.isfile(local_path):
                file_name = os.path.basename(local_path)
                remote_path = f"{self.current_path}/{file_name}".replace("//", "/")
                self.start_transfer('upload', local_path, remote_path)
    
    def cleanup(self):
        """清理资源"""
        if self.transfer_worker and self.transfer_worker.isRunning():
            self.transfer_worker.quit()
            self.transfer_worker.wait() 