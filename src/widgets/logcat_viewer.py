# -*- coding: utf-8 -*-
"""
Logcat查看器
实时查看Android设备日志
"""

import re
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTextEdit,
    QPushButton, QComboBox, QLineEdit, QLabel,
    QCheckBox, QFileDialog, QMessageBox, QSpinBox,
    QProgressBar, QGroupBox, QSplitter
)
from PySide6.QtCore import Qt, QTimer, QThread, Signal, QProcess
from PySide6.QtGui import QFont, QTextCursor, QColor, QTextCharFormat
import logging

from ..core.adb_manager import ADBManager

logger = logging.getLogger(__name__)


class LogcatWorker(QThread):
    """Logcat工作线程"""
    
    log_received = Signal(str)
    error_occurred = Signal(str)
    
    def __init__(self, adb_manager: ADBManager, device_id: str):
        super().__init__()
        self.adb_manager = adb_manager
        self.device_id = device_id
        self.running = False
        self.process = None
        
    def run(self):
        """运行Logcat"""
        self.running = True
        
        try:
            # 启动logcat进程
            command = [self.adb_manager.adb_path, "-s", self.device_id, "logcat"]
            
            import subprocess
            self.process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # 读取输出
            while self.running and self.process:
                line = self.process.stdout.readline()
                if line:
                    self.log_received.emit(line.rstrip())
                elif self.process.poll() is not None:
                    break
                    
        except Exception as e:
            self.error_occurred.emit(str(e))
        finally:
            if self.process:
                self.process.terminate()
                self.process = None
    
    def stop(self):
        """停止Logcat"""
        self.running = False
        if self.process:
            self.process.terminate()
            self.process = None
        self.quit()
        self.wait()


class LogcatViewerWidget(QWidget):
    """Logcat查看器组件"""
    
    def __init__(self, adb_manager: ADBManager):
        super().__init__()
        self.adb_manager = adb_manager
        self.current_device_id = None
        self.logcat_worker = None
        self.log_lines = []
        self.max_lines = 10000
        self.auto_scroll = True
        self.is_recording = False
        
        self.init_ui()
        self.connect_signals()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # 控制面板
        self.create_control_panel(layout)
        
        # 日志显示区域
        self.create_log_display(layout)
        
        # 状态栏
        self.create_status_bar(layout)
        
    def create_control_panel(self, parent_layout):
        """创建控制面板"""
        control_group = QGroupBox("日志控制")
        control_group.setStyleSheet("""
            QGroupBox {
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
                border: 2px solid #404040;
                border-radius: 8px;
                margin-top: 8px;
                padding-top: 12px;
                background-color: #2d2d2d;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 8px 0 8px;
                background-color: #2d2d2d;
                color: #ffffff;
            }
            QPushButton {
                background-color: #f8f9fa;
                color: #212529;
                border: 2px solid #ced4da;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 500;
                min-width: 70px;
                min-height: 32px;
            }
            QPushButton:hover {
                background-color: #e9ecef;
                border-color: #adb5bd;
                color: #212529;
            }
            QPushButton:pressed {
                background-color: #dee2e6;
            }
            QPushButton:disabled {
                background-color: #f8f9fa;
                color: #6c757d;
                border-color: #dee2e6;
            }
            QPushButton[style="success"] {
                background-color: #198754;
                color: #ffffff;
                border-color: #198754;
            }
            QPushButton[style="success"]:hover {
                background-color: #157347;
                border-color: #146c43;
                color: #ffffff;
            }
            QPushButton[style="danger"] {
                background-color: #dc3545;
                color: #ffffff;
                border-color: #dc3545;
            }
            QPushButton[style="danger"]:hover {
                background-color: #bb2d3b;
                border-color: #b02a37;
                color: #ffffff;
            }
            QComboBox, QLineEdit, QSpinBox {
                padding: 8px 12px;
                border: 2px solid #555555;
                border-radius: 6px;
                background-color: #3d3d3d;
                color: #ffffff;
                font-size: 13px;
                min-height: 20px;
            }
            QComboBox:focus, QLineEdit:focus, QSpinBox:focus {
                border-color: #0d6efd;
                outline: none;
            }
            QComboBox QAbstractItemView {
                background-color: #3d3d3d;
                color: #ffffff;
                border: 2px solid #555555;
                border-radius: 6px;
                selection-background-color: #0d6efd;
                selection-color: #ffffff;
                outline: none;
                padding: 4px;
            }
            QComboBox QAbstractItemView::item {
                padding: 8px 12px;
                border: none;
                background-color: transparent;
                color: #ffffff;
                min-height: 18px;
            }
            QComboBox QAbstractItemView::item:selected {
                background-color: #0d6efd;
                color: #ffffff;
            }
            QComboBox QAbstractItemView::item:hover {
                background-color: #555555;
                color: #ffffff;
            }
            QCheckBox {
                font-size: 13px;
                color: #ffffff;
                padding: 4px;
            }
            QCheckBox::indicator {
                width: 18px;
                height: 18px;
                border: 2px solid #555555;
                border-radius: 4px;
                background-color: #3d3d3d;
            }
            QCheckBox::indicator:checked {
                background-color: #0d6efd;
                border-color: #0d6efd;
            }
            QLabel {
                color: #ffffff;
                font-size: 13px;
                padding: 2px;
                background-color: transparent;
            }
        """)
        
        control_layout = QVBoxLayout(control_group)
        control_layout.setSpacing(12)
        control_layout.setContentsMargins(16, 16, 16, 16)
        
        # 第一行：基本控制
        row1_layout = QHBoxLayout()
        
        # 开始/停止按钮
        self.start_btn = QPushButton("开始")
        self.start_btn.setProperty("style", "success")
        self.start_btn.clicked.connect(self.start_logcat)
        row1_layout.addWidget(self.start_btn)
        
        self.stop_btn = QPushButton("停止")
        self.stop_btn.setProperty("style", "danger")
        self.stop_btn.clicked.connect(self.stop_logcat)
        self.stop_btn.setEnabled(False)
        row1_layout.addWidget(self.stop_btn)
        
        # 清空按钮
        clear_btn = QPushButton("清空")
        clear_btn.clicked.connect(self.clear_logs)
        row1_layout.addWidget(clear_btn)
        
        # 保存按钮
        save_btn = QPushButton("保存日志")
        save_btn.clicked.connect(self.save_logs)
        row1_layout.addWidget(save_btn)
        
        row1_layout.addStretch()
        control_layout.addLayout(row1_layout)
        
        # 第二行：过滤控制
        row2_layout = QHBoxLayout()
        
        # 日志级别过滤
        row2_layout.addWidget(QLabel("级别:"))
        self.level_combo = QComboBox()
        self.level_combo.addItems(["全部", "V", "D", "I", "W", "E", "F"])
        self.level_combo.currentTextChanged.connect(self.apply_filters)
        row2_layout.addWidget(self.level_combo)
        
        # 标签过滤
        row2_layout.addWidget(QLabel("标签:"))
        self.tag_filter = QLineEdit()
        self.tag_filter.setPlaceholderText("过滤标签")
        self.tag_filter.textChanged.connect(self.apply_filters)
        row2_layout.addWidget(self.tag_filter)
        
        # 内容搜索
        row2_layout.addWidget(QLabel("搜索:"))
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("搜索内容")
        self.search_box.textChanged.connect(self.apply_filters)
        row2_layout.addWidget(self.search_box)
        
        # 自动滚动
        self.auto_scroll_cb = QCheckBox("自动滚动")
        self.auto_scroll_cb.setChecked(True)
        self.auto_scroll_cb.toggled.connect(self.toggle_auto_scroll)
        row2_layout.addWidget(self.auto_scroll_cb)
        
        control_layout.addLayout(row2_layout)
        
        # 第三行：高级选项
        row3_layout = QHBoxLayout()
        
        # 最大行数
        row3_layout.addWidget(QLabel("最大行数:"))
        self.max_lines_spin = QSpinBox()
        self.max_lines_spin.setRange(1000, 100000)
        self.max_lines_spin.setValue(10000)
        self.max_lines_spin.setSuffix(" 行")
        self.max_lines_spin.valueChanged.connect(self.set_max_lines)
        row3_layout.addWidget(self.max_lines_spin)
        
        row3_layout.addStretch()
        control_layout.addLayout(row3_layout)
        
        parent_layout.addWidget(control_group)
    
    def create_log_display(self, parent_layout):
        """创建日志显示区域"""
        # 日志文本编辑器
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setFont(QFont("Monaco, Menlo, 'SF Mono', Consolas, 'Liberation Mono', monospace", 11))
        self.log_text.setStyleSheet("""
            QTextEdit {
                background-color: #1a1a1a;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                font-family: Monaco, Menlo, 'SF Mono', Consolas, 'Liberation Mono', monospace;
                line-height: 1.45;
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
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
        """)
        
        parent_layout.addWidget(self.log_text, 1)  # 占用剩余空间
    
    def create_status_bar(self, parent_layout):
        """创建状态栏"""
        status_layout = QHBoxLayout()
        
        self.status_label = QLabel("就绪")
        status_layout.addWidget(self.status_label)
        
        status_layout.addStretch()
        
        self.line_count_label = QLabel("行数: 0")
        status_layout.addWidget(self.line_count_label)
        
        parent_layout.addLayout(status_layout)
    
    def connect_signals(self):
        """连接信号"""
        pass
    
    def set_current_device(self, device_id: str):
        """设置当前设备"""
        if device_id != self.current_device_id:
            # 停止当前的logcat
            self.stop_logcat()
            
            self.current_device_id = device_id
            
            if device_id:
                self.start_btn.setEnabled(True)
                self.status_label.setText(f"设备: {device_id}")
            else:
                self.start_btn.setEnabled(False)
                self.status_label.setText("未选择设备")
    
    def start_logcat(self):
        """开始Logcat"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        if self.logcat_worker and self.logcat_worker.isRunning():
            return
        
        # 清空现有日志
        self.clear_logs()
        
        # 启动工作线程
        self.logcat_worker = LogcatWorker(self.adb_manager, self.current_device_id)
        self.logcat_worker.log_received.connect(self.append_log)
        self.logcat_worker.error_occurred.connect(self.on_logcat_error)
        self.logcat_worker.start()
        
        self.start_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.is_recording = True
        self.status_label.setText(f"正在监控设备: {self.current_device_id}")
        
        logger.info(f"开始监控设备日志: {self.current_device_id}")
    
    def stop_logcat(self):
        """停止Logcat"""
        if self.logcat_worker:
            self.logcat_worker.stop()
            self.logcat_worker = None
        
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.is_recording = False
        
        if self.current_device_id:
            self.status_label.setText(f"已停止监控设备: {self.current_device_id}")
        else:
            self.status_label.setText("就绪")
        
        logger.info("停止监控设备日志")
    
    def append_log(self, line: str):
        """添加日志行"""
        self.log_lines.append(line)
        
        # 限制行数
        if len(self.log_lines) > self.max_lines:
            self.log_lines = self.log_lines[-self.max_lines:]
            self.apply_filters()  # 重新应用过滤器
        else:
            # 检查是否通过过滤器
            if self.should_show_line(line):
                self.add_formatted_line(line)
        
        # 更新行数显示
        self.line_count_label.setText(f"行数: {len(self.log_lines)}")
        
        # 自动滚动
        if self.auto_scroll:
            cursor = self.log_text.textCursor()
            cursor.movePosition(QTextCursor.End)
            self.log_text.setTextCursor(cursor)
    
    def should_show_line(self, line: str) -> bool:
        """检查行是否应该显示"""
        # 解析日志行
        log_parts = self.parse_log_line(line)
        if not log_parts:
            return True  # 如果无法解析，默认显示
        
        # 级别过滤
        level_filter = self.level_combo.currentText()
        if level_filter != "全部" and log_parts.get('level') != level_filter:
            return False
        
        # 标签过滤
        tag_filter = self.tag_filter.text().strip()
        if tag_filter and tag_filter.lower() not in log_parts.get('tag', '').lower():
            return False
        
        # 内容搜索
        search_text = self.search_box.text().strip()
        if search_text and search_text.lower() not in log_parts.get('message', '').lower():
            return False
        
        return True
    
    def parse_log_line(self, line: str) -> dict:
        """解析日志行"""
        # Android logcat格式: MM-DD HH:MM:SS.mmm PID/TAG: LEVEL MESSAGE
        pattern = r'(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s*(.*)'
        match = re.match(pattern, line)
        
        if match:
            return {
                'timestamp': match.group(1),
                'pid': match.group(2),
                'tid': match.group(3),
                'level': match.group(4),
                'tag': match.group(5).strip(),
                'message': match.group(6)
            }
        
        return {'level': '', 'tag': '', 'message': line}
    
    def add_formatted_line(self, line: str):
        """添加格式化的日志行"""
        log_parts = self.parse_log_line(line)
        level = log_parts.get('level', '')
        
        # 设置颜色
        cursor = self.log_text.textCursor()
        cursor.movePosition(QTextCursor.End)
        
        format = QTextCharFormat()
        
        if level == 'E':  # Error - 红色
            format.setForeground(QColor("#ff6b6b"))
        elif level == 'W':  # Warning - 橙色
            format.setForeground(QColor("#ffa726"))
        elif level == 'I':  # Info - 蓝色
            format.setForeground(QColor("#42a5f5"))
        elif level == 'D':  # Debug - 紫色
            format.setForeground(QColor("#ab47bc"))
        elif level == 'V':  # Verbose - 灰色
            format.setForeground(QColor("#90a4ae"))
        else:  # 默认白色文字
            format.setForeground(QColor("#ffffff"))
        
        cursor.insertText(line + '\n', format)
        
        # 更新文本编辑器
        self.log_text.setTextCursor(cursor)
    
    def apply_filters(self):
        """应用过滤器"""
        self.log_text.clear()
        
        for line in self.log_lines:
            if self.should_show_line(line):
                self.add_formatted_line(line)
    
    def clear_logs(self):
        """清空日志"""
        self.log_lines.clear()
        self.log_text.clear()
        self.line_count_label.setText("行数: 0")
    
    def save_logs(self):
        """保存日志"""
        if not self.log_lines:
            QMessageBox.information(self, "提示", "没有日志可保存")
            return
        
        # 生成默认文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        device_name = self.current_device_id or "unknown"
        default_name = f"logcat_{device_name}_{timestamp}.txt"
        
        # 选择保存路径
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "保存日志文件",
            default_name,
            "文本文件 (*.txt);;所有文件 (*)"
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    for line in self.log_lines:
                        f.write(line + '\n')
                
                QMessageBox.information(self, "成功", f"日志已保存到: {file_path}")
                logger.info(f"日志保存成功: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存日志失败: {str(e)}")
                logger.error(f"保存日志失败: {e}")
    
    def toggle_auto_scroll(self, enabled: bool):
        """切换自动滚动"""
        self.auto_scroll = enabled
    
    def set_max_lines(self, value: int):
        """设置最大行数"""
        self.max_lines = value
        
        # 如果当前行数超过限制，截断
        if len(self.log_lines) > self.max_lines:
            self.log_lines = self.log_lines[-self.max_lines:]
            self.apply_filters()
    
    def on_logcat_error(self, error_msg: str):
        """Logcat错误处理"""
        logger.error(f"Logcat错误: {error_msg}")
        self.status_label.setText(f"错误: {error_msg}")
        self.stop_logcat()
        
        QMessageBox.critical(self, "Logcat错误", f"日志监控发生错误:\n{error_msg}")
    
    def cleanup(self):
        """清理资源"""
        self.stop_logcat() 