# -*- coding: utf-8 -*-
"""
屏幕截图工具
设备屏幕截图和录屏功能
"""

import os
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFileDialog, QMessageBox, QGroupBox, QScrollArea,
    QSlider, QSpinBox, QComboBox, QCheckBox, QProgressBar
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer, QSize
from PySide6.QtGui import QPixmap, QImage, QPainter, QPen
import logging

from ..core.adb_manager import ADBManager

logger = logging.getLogger(__name__)


class ScreenshotWorker(QThread):
    """截图工作线程"""
    
    screenshot_ready = Signal(str)  # 截图文件路径
    error_occurred = Signal(str)
    
    def __init__(self, adb_manager: ADBManager, device_id: str):
        super().__init__()
        self.adb_manager = adb_manager
        self.device_id = device_id
    
    def run(self):
        """执行截图"""
        try:
            # 创建临时文件
            temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            temp_path = temp_file.name
            temp_file.close()
            
            # 执行截图命令
            success, output, error = self.adb_manager.execute_command([
                "-s", self.device_id, "exec-out", "screencap", "-p"
            ])
            
            if success:
                # 保存截图数据到临时文件
                if isinstance(output, bytes):
                    # 二进制数据
                    with open(temp_path, 'wb') as f:
                        f.write(output)
                else:
                    # 文本数据（兼容性处理）
                    with open(temp_path, 'wb') as f:
                        f.write(output.encode('latin1'))
                
                self.screenshot_ready.emit(temp_path)
            else:
                self.error_occurred.emit(f"截图失败: {error}")
                
        except Exception as e:
            self.error_occurred.emit(f"截图错误: {str(e)}")


class ImageLabel(QLabel):
    """自定义图片标签，支持缩放"""
    
    def __init__(self):
        super().__init__()
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet("border: 1px solid #ccc;")
        self.setMinimumSize(400, 600)
        self.original_pixmap = None
        self.scale_factor = 1.0
        
    def set_pixmap(self, pixmap: QPixmap):
        """设置图片"""
        self.original_pixmap = pixmap
        self.update_display()
    
    def set_scale_factor(self, factor: float):
        """设置缩放因子"""
        self.scale_factor = factor
        self.update_display()
    
    def update_display(self):
        """更新显示"""
        if self.original_pixmap:
            scaled_pixmap = self.original_pixmap.scaled(
                self.original_pixmap.size() * self.scale_factor,
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            )
            super().setPixmap(scaled_pixmap)
        else:
            self.setText("暂无截图")


class ScreenshotToolWidget(QWidget):
    """屏幕截图工具组件"""
    
    def __init__(self, adb_manager: ADBManager):
        super().__init__()
        self.adb_manager = adb_manager
        self.current_device_id = None
        self.screenshot_worker = None
        self.current_screenshot_path = None
        self.auto_screenshot_timer = None
        
        self.init_ui()
        self.connect_signals()
    
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # 控制面板
        self.create_control_panel(layout)
        
        # 图片显示区域
        self.create_image_display(layout)
        
        # 状态栏
        self.create_status_bar(layout)
    
    def create_control_panel(self, parent_layout):
        """创建控制面板"""
        control_group = QGroupBox("截图控制")
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
            QPushButton[style="success"] {
                background-color: #1a7f37;
                color: white;
                border-color: #1a7f37;
            }
            QPushButton[style="success"]:hover {
                background-color: #2da44e;
                border-color: #2da44e;
            }
            QSpinBox, QSlider {
                font-size: 13px;
                color: #ffffff;
            }
            QSpinBox {
                padding: 4px 8px;
                border: 1px solid #555555;
                border-radius: 6px;
                background-color: #3d3d3d;
                color: #ffffff;
            }
            QSpinBox:focus {
                border-color: #0969da;
                outline: none;
            }
            QSlider::groove:horizontal {
                border: 1px solid #555555;
                height: 6px;
                background: #3d3d3d;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #0969da;
                border: 1px solid #0969da;
                width: 16px;
                margin: -6px 0;
                border-radius: 8px;
            }
            QSlider::handle:horizontal:hover {
                background: #0860ca;
                border-color: #0860ca;
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
            QLabel {
                color: #ffffff;
                font-size: 13px;
                background-color: transparent;
            }
        """)
        
        control_layout = QVBoxLayout(control_group)
        control_layout.setSpacing(12)
        control_layout.setContentsMargins(16, 16, 16, 16)
        
        # 第一行：基本操作
        row1_layout = QHBoxLayout()
        row1_layout.setSpacing(8)
        
        # 截图按钮
        self.capture_btn = QPushButton("📸 截图")
        self.capture_btn.setProperty("style", "primary")
        self.capture_btn.clicked.connect(self.take_screenshot)
        self.capture_btn.setMinimumHeight(35)
        row1_layout.addWidget(self.capture_btn)
        
        # 保存按钮
        self.save_btn = QPushButton("💾 保存截图")
        self.save_btn.setProperty("style", "success")
        self.save_btn.clicked.connect(self.save_screenshot)
        self.save_btn.setEnabled(False)
        row1_layout.addWidget(self.save_btn)
        
        # 自动截图
        self.auto_screenshot_cb = QCheckBox("自动截图")
        self.auto_screenshot_cb.toggled.connect(self.toggle_auto_screenshot)
        row1_layout.addWidget(self.auto_screenshot_cb)
        
        # 自动截图间隔
        row1_layout.addWidget(QLabel("间隔(秒):"))
        self.interval_spin = QSpinBox()
        self.interval_spin.setRange(1, 60)
        self.interval_spin.setValue(5)
        row1_layout.addWidget(self.interval_spin)
        
        row1_layout.addStretch()
        control_layout.addLayout(row1_layout)
        
        # 第二行：显示设置
        row2_layout = QHBoxLayout()
        
        # 缩放控制
        row2_layout.addWidget(QLabel("缩放:"))
        
        self.scale_slider = QSlider(Qt.Horizontal)
        self.scale_slider.setRange(10, 200)  # 10% - 200%
        self.scale_slider.setValue(100)
        self.scale_slider.valueChanged.connect(self.on_scale_changed)
        row2_layout.addWidget(self.scale_slider)
        
        self.scale_label = QLabel("100%")
        self.scale_label.setMinimumWidth(50)
        row2_layout.addWidget(self.scale_label)
        
        # 适应窗口按钮
        fit_btn = QPushButton("适应窗口")
        fit_btn.clicked.connect(self.fit_to_window)
        row2_layout.addWidget(fit_btn)
        
        # 实际大小按钮
        actual_btn = QPushButton("实际大小")
        actual_btn.clicked.connect(self.actual_size)
        row2_layout.addWidget(actual_btn)
        
        row2_layout.addStretch()
        control_layout.addLayout(row2_layout)
        
        parent_layout.addWidget(control_group)
    
    def create_image_display(self, parent_layout):
        """创建图片显示区域"""
        # 滚动区域
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setAlignment(Qt.AlignCenter)
        scroll_area.setStyleSheet("""
            QScrollArea {
                background-color: #1a1a1a;
                border: 1px solid #404040;
                border-radius: 6px;
            }
            QScrollBar:vertical, QScrollBar:horizontal {
                background-color: #2d2d2d;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical, QScrollBar::handle:horizontal {
                background-color: #555555;
                border-radius: 6px;
                min-height: 20px;
                min-width: 20px;
            }
            QScrollBar::handle:hover {
                background-color: #777777;
            }
        """)
        
        # 图片标签
        self.image_label = ImageLabel()
        self.image_label.setStyleSheet("""
            QLabel {
                background-color: #1a1a1a;
                color: #ffffff;
            }
        """)
        scroll_area.setWidget(self.image_label)
        
        parent_layout.addWidget(scroll_area, 1)  # 占用剩余空间
    
    def create_status_bar(self, parent_layout):
        """创建状态栏"""
        status_layout = QHBoxLayout()
        
        self.status_label = QLabel("就绪")
        status_layout.addWidget(self.status_label)
        
        status_layout.addStretch()
        
        self.image_info_label = QLabel("无图片")
        status_layout.addWidget(self.image_info_label)
        
        parent_layout.addLayout(status_layout)
    
    def connect_signals(self):
        """连接信号"""
        pass
    
    def set_current_device(self, device_id: str):
        """设置当前设备"""
        if device_id != self.current_device_id:
            # 停止自动截图
            self.auto_screenshot_cb.setChecked(False)
            
            self.current_device_id = device_id
            
            if device_id:
                self.capture_btn.setEnabled(True)
                self.status_label.setText(f"设备: {device_id}")
            else:
                self.capture_btn.setEnabled(False)
                self.status_label.setText("未选择设备")
                self.clear_screenshot()
    
    def take_screenshot(self):
        """截图"""
        if not self.current_device_id:
            QMessageBox.warning(self, "警告", "请先选择设备")
            return
        
        if self.screenshot_worker and self.screenshot_worker.isRunning():
            return  # 正在截图，避免重复
        
        self.capture_btn.setEnabled(False)
        self.status_label.setText("正在截图...")
        
        # 启动截图线程
        self.screenshot_worker = ScreenshotWorker(self.adb_manager, self.current_device_id)
        self.screenshot_worker.screenshot_ready.connect(self.on_screenshot_ready)
        self.screenshot_worker.error_occurred.connect(self.on_screenshot_error)
        self.screenshot_worker.start()
        
        logger.info(f"开始截图: {self.current_device_id}")
    
    def on_screenshot_ready(self, screenshot_path: str):
        """截图完成"""
        self.capture_btn.setEnabled(True)
        
        try:
            # 加载图片
            pixmap = QPixmap(screenshot_path)
            if not pixmap.isNull():
                self.image_label.set_pixmap(pixmap)
                self.current_screenshot_path = screenshot_path
                self.save_btn.setEnabled(True)
                
                # 更新图片信息
                size = pixmap.size()
                self.image_info_label.setText(f"尺寸: {size.width()}x{size.height()}")
                
                self.status_label.setText("截图完成")
                logger.info(f"截图完成: {size.width()}x{size.height()}")
            else:
                self.on_screenshot_error("无法加载截图")
                
        except Exception as e:
            self.on_screenshot_error(f"加载截图失败: {str(e)}")
    
    def on_screenshot_error(self, error_msg: str):
        """截图错误"""
        self.capture_btn.setEnabled(True)
        self.status_label.setText("截图失败")
        
        QMessageBox.critical(self, "截图失败", error_msg)
        logger.error(f"截图失败: {error_msg}")
    
    def save_screenshot(self):
        """保存截图"""
        if not self.current_screenshot_path:
            return
        
        # 生成默认文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        device_name = self.current_device_id.replace(":", "_") if self.current_device_id else "unknown"
        default_name = f"screenshot_{device_name}_{timestamp}.png"
        
        # 选择保存路径
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "保存截图",
            default_name,
            "PNG图片 (*.png);;JPEG图片 (*.jpg);;所有文件 (*)"
        )
        
        if file_path:
            try:
                # 复制文件
                import shutil
                shutil.copy2(self.current_screenshot_path, file_path)
                
                QMessageBox.information(self, "成功", f"截图已保存到: {file_path}")
                logger.info(f"截图保存成功: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存截图失败: {str(e)}")
                logger.error(f"保存截图失败: {e}")
    
    def toggle_auto_screenshot(self, enabled: bool):
        """切换自动截图"""
        if enabled:
            if not self.current_device_id:
                QMessageBox.warning(self, "警告", "请先选择设备")
                self.auto_screenshot_cb.setChecked(False)
                return
            
            # 启动自动截图
            if not self.auto_screenshot_timer:
                self.auto_screenshot_timer = QTimer()
                self.auto_screenshot_timer.timeout.connect(self.take_screenshot)
            
            interval = self.interval_spin.value() * 1000  # 转换为毫秒
            self.auto_screenshot_timer.start(interval)
            
            self.status_label.setText(f"自动截图已启动 (间隔: {self.interval_spin.value()}秒)")
            logger.info(f"自动截图启动，间隔: {self.interval_spin.value()}秒")
        else:
            # 停止自动截图
            if self.auto_screenshot_timer:
                self.auto_screenshot_timer.stop()
            
            self.status_label.setText("自动截图已停止")
            logger.info("自动截图停止")
    
    def on_scale_changed(self, value: int):
        """缩放改变"""
        scale_factor = value / 100.0
        self.scale_label.setText(f"{value}%")
        self.image_label.set_scale_factor(scale_factor)
    
    def fit_to_window(self):
        """适应窗口"""
        if not self.image_label.original_pixmap:
            return
        
        # 计算适合窗口的缩放比例
        image_size = self.image_label.original_pixmap.size()
        widget_size = self.image_label.size()
        
        scale_x = widget_size.width() / image_size.width()
        scale_y = widget_size.height() / image_size.height()
        scale_factor = min(scale_x, scale_y, 1.0)  # 不放大，只缩小
        
        scale_percent = int(scale_factor * 100)
        self.scale_slider.setValue(scale_percent)
    
    def actual_size(self):
        """实际大小"""
        self.scale_slider.setValue(100)
    
    def clear_screenshot(self):
        """清空截图"""
        self.image_label.clear()
        self.image_label.setText("暂无截图")
        self.current_screenshot_path = None
        self.save_btn.setEnabled(False)
        self.image_info_label.setText("无图片")
    
    def cleanup(self):
        """清理资源"""
        # 停止自动截图
        self.auto_screenshot_cb.setChecked(False)
        
        # 停止截图线程
        if self.screenshot_worker and self.screenshot_worker.isRunning():
            self.screenshot_worker.quit()
            self.screenshot_worker.wait()
        
        # 清理临时文件
        if self.current_screenshot_path and os.path.exists(self.current_screenshot_path):
            try:
                os.unlink(self.current_screenshot_path)
            except:
                pass 