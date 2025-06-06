# -*- coding: utf-8 -*-
"""
主窗口
ADB Tools的主界面，包含所有功能模块
"""

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QTabWidget, QStatusBar, QMenuBar, QToolBar,
    QLabel, QComboBox, QPushButton, QMessageBox,
    QProgressBar, QSplitter, QDialog
)
from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QAction, QIcon
import logging

from .core.adb_manager import ADBManager, Device
from .widgets.logcat_viewer import LogcatViewerWidget
from .widgets.app_manager import AppManagerWidget
from .widgets.file_manager import FileManagerWidget
from .widgets.screenshot_tool import ScreenshotToolWidget
from .widgets.command_terminal import CommandTerminalWidget
from .utils.config import Config

logger = logging.getLogger(__name__)


class MainWindow(QMainWindow):
    """主窗口"""
    
    # 信号定义
    device_selected = Signal(str)  # device_id
    
    def __init__(self):
        super().__init__()
        self.adb_manager = ADBManager()
        self.config = Config()
        self.current_device_id = None
        
        self.init_ui()
        self.connect_signals()
        self.setup_adb_monitoring()
        
        # 恢复窗口状态
        self.restore_window_state()
        
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("ADB Tools - Android调试工具")
        self.setMinimumSize(1000, 700)
        self.resize(1200, 800)
        
        # 设置深色主题样式 - 黑底白字，按钮保持原色
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1a1a1a;
                color: #ffffff;
            }
            QWidget {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 13px;
                background-color: #1a1a1a;
                color: #ffffff;
            }
            QMenuBar {
                background-color: #2d2d2d;
                border-bottom: 1px solid #404040;
                padding: 4px 8px;
                color: #ffffff;
            }
            QMenuBar::item {
                background-color: transparent;
                padding: 8px 12px;
                margin: 0px 2px;
                border-radius: 4px;
                color: #ffffff;
            }
            QMenuBar::item:selected {
                background-color: #404040;
                color: #ffffff;
            }
            QStatusBar {
                background-color: #2d2d2d;
                border-top: 1px solid #404040;
                padding: 6px 12px;
                color: #cccccc;
            }
            QLabel {
                background-color: transparent;
                color: #ffffff;
            }
        """)
        
        # 创建中央部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # 设备选择工具栏
        self.create_device_toolbar(main_layout)
        
        # 创建标签页
        self.create_tab_widget(main_layout)
        
        # 创建菜单栏
        self.create_menu_bar()
        
        # 创建状态栏
        self.create_status_bar()
        
    def create_device_toolbar(self, parent_layout):
        """创建设备选择工具栏"""
        # 工具栏容器
        toolbar_widget = QWidget()
        toolbar_widget.setStyleSheet("""
            QWidget {
                background-color: #2d2d2d;
                border-bottom: 1px solid #404040;
            }
            QLabel {
                color: #ffffff;
                font-size: 14px;
                font-weight: 600;
                padding: 4px 8px;
                background-color: transparent;
            }
            QComboBox {
                padding: 8px 12px;
                border: 2px solid #555555;
                border-radius: 6px;
                background-color: #3d3d3d;
                color: #ffffff;
                font-size: 13px;
                min-width: 200px;
                min-height: 20px;
            }
            QComboBox:hover {
                border-color: #777777;
            }
            QComboBox:focus {
                border-color: #0d6efd;
                outline: none;
            }
            QComboBox::drop-down {
                border: none;
                width: 25px;
                background-color: transparent;
            }
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #cccccc;
                margin-right: 8px;
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
                padding: 10px 12px;
                border: none;
                background-color: transparent;
                color: #ffffff;
                min-height: 20px;
            }
            QComboBox QAbstractItemView::item:selected {
                background-color: #0d6efd;
                color: #ffffff;
            }
            QComboBox QAbstractItemView::item:hover {
                background-color: #555555;
                color: #ffffff;
            }
            QPushButton {
                background-color: #f8f9fa;
                color: #212529;
                border: 2px solid #ced4da;
                border-radius: 6px;
                padding: 10px 16px;
                font-size: 13px;
                font-weight: 500;
                min-height: 20px;
            }
            QPushButton:hover {
                background-color: #e9ecef;
                border-color: #adb5bd;
                color: #212529;
            }
            QPushButton:pressed {
                background-color: #dee2e6;
                border-color: #adb5bd;
            }
            QPushButton[style="primary"] {
                background-color: #0d6efd;
                color: #ffffff;
                border-color: #0d6efd;
            }
            QPushButton[style="primary"]:hover {
                background-color: #0b5ed7;
                border-color: #0a58ca;
                color: #ffffff;
            }
        """)
        
        toolbar_layout = QHBoxLayout(toolbar_widget)
        toolbar_layout.setSpacing(12)
        toolbar_layout.setContentsMargins(16, 12, 16, 12)
        
        # 设备选择标签
        device_label = QLabel("当前设备:")
        toolbar_layout.addWidget(device_label)
        
        # 设备选择下拉框
        self.device_combo = QComboBox()
        self.device_combo.setPlaceholderText("请选择设备")
        self.device_combo.currentTextChanged.connect(self.on_device_selected)
        toolbar_layout.addWidget(self.device_combo)
        
        # 刷新按钮
        refresh_btn = QPushButton("🔄 刷新设备")
        refresh_btn.clicked.connect(self.refresh_devices)
        toolbar_layout.addWidget(refresh_btn)
        
        # WiFi连接按钮
        wifi_btn = QPushButton("📶 WiFi连接")
        wifi_btn.setProperty("style", "primary")
        wifi_btn.clicked.connect(self.show_wifi_connect_dialog)
        toolbar_layout.addWidget(wifi_btn)
        
        toolbar_layout.addStretch()
        
        # 设备状态指示器
        self.device_status_label = QLabel("未连接设备")
        self.device_status_label.setStyleSheet("""
            QLabel {
                background-color: #fff8c5;
                border: 1px solid #d1cc00;
                border-radius: 6px;
                padding: 6px 12px;
                color: #7d4e00;
                font-size: 12px;
                font-weight: 500;
            }
        """)
        toolbar_layout.addWidget(self.device_status_label)
        
        parent_layout.addWidget(toolbar_widget)
        
    def create_tab_widget(self, parent_layout):
        """创建标签页部件"""
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.North)
        
        # 设置深色主题的标签页样式
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 2px solid #404040;
                background-color: #1a1a1a;
                border-radius: 8px;
                top: -2px;
            }
            QTabWidget::tab-bar {
                left: 5px;
            }
            QTabBar::tab {
                background-color: #2d2d2d;
                color: #cccccc;
                padding: 12px 20px;
                margin-right: 3px;
                border: 2px solid #404040;
                border-bottom: none;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                min-width: 80px;
            }
            QTabBar::tab:selected {
                background-color: #1a1a1a;
                color: #ffffff;
                border-color: #404040;
                border-bottom: 2px solid #1a1a1a;
                font-weight: 600;
            }
            QTabBar::tab:hover:!selected {
                background-color: #404040;
                color: #ffffff;
            }
        """)
        
        # 日志查看页
        self.logcat_viewer = LogcatViewerWidget(self.adb_manager)
        self.tab_widget.addTab(self.logcat_viewer, "📋 日志查看")
        
        # 应用管理页
        self.app_manager = AppManagerWidget(self.adb_manager)
        self.tab_widget.addTab(self.app_manager, "📦 应用管理")
        
        # 文件管理页
        self.file_manager = FileManagerWidget(self.adb_manager)
        self.tab_widget.addTab(self.file_manager, "📁 文件管理")
        
        # 屏幕截图页
        self.screenshot_tool = ScreenshotToolWidget(self.adb_manager)
        self.tab_widget.addTab(self.screenshot_tool, "📸 屏幕截图")
        
        # 命令终端页
        self.command_terminal = CommandTerminalWidget(self.adb_manager)
        self.tab_widget.addTab(self.command_terminal, "💻 命令终端")
        
        parent_layout.addWidget(self.tab_widget)
        
    def create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu("文件")
        
        exit_action = QAction("退出", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 设备菜单
        device_menu = menubar.addMenu("设备")
        
        refresh_action = QAction("刷新设备列表", self)
        refresh_action.setShortcut("F5")
        refresh_action.triggered.connect(self.refresh_devices)
        device_menu.addAction(refresh_action)
        
        wifi_action = QAction("WiFi连接设备", self)
        wifi_action.triggered.connect(self.show_wifi_connect_dialog)
        device_menu.addAction(wifi_action)
        
        # 工具菜单
        tools_menu = menubar.addMenu("工具")
        
        settings_action = QAction("设置", self)
        settings_action.triggered.connect(self.show_settings_dialog)
        tools_menu.addAction(settings_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu("帮助")
        
        about_action = QAction("关于", self)
        about_action.triggered.connect(self.show_about_dialog)
        help_menu.addAction(about_action)
        
    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        # ADB状态标签
        self.adb_status_label = QLabel("ADB: 未连接")
        self.status_bar.addWidget(self.adb_status_label)
        
        self.status_bar.addPermanentWidget(QLabel("就绪"))
        
    def connect_signals(self):
        """连接信号"""
        # ADB管理器信号
        self.adb_manager.device_connected.connect(self.on_device_connected)
        self.adb_manager.device_disconnected.connect(self.on_device_disconnected)
        self.adb_manager.device_updated.connect(self.on_device_updated)
        self.adb_manager.error_occurred.connect(self.on_adb_error)
        
        # 设备选择信号
        self.device_selected.connect(self.on_device_change)
        
    def setup_adb_monitoring(self):
        """设置ADB监控"""
        # 检查ADB状态
        if self.adb_manager.is_adb_available():
            self.adb_status_label.setText("ADB: 已连接")
            self.adb_status_label.setStyleSheet("color: green;")
            
            # 开始监控设备
            self.adb_manager.start_monitoring()
            
            # 初始加载设备列表
            self.refresh_devices()
        else:
            self.adb_status_label.setText("ADB: 不可用")
            self.adb_status_label.setStyleSheet("color: red;")
            QMessageBox.warning(
                self,
                "ADB不可用",
                "未找到ADB工具。请确保已安装Android SDK Platform Tools，\n"
                "或者将ADB工具路径添加到系统PATH中。"
            )
    
    def refresh_devices(self):
        """刷新设备列表"""
        self.device_combo.clear()
        devices = self.adb_manager.get_devices()
        
        for device in devices:
            display_text = f"{device.id} ({device.status})"
            if device.model:
                display_text += f" - {device.model}"
            
            self.device_combo.addItem(display_text, device.id)
        
        if devices:
            self.device_combo.setCurrentIndex(0)
        else:
            self.device_combo.setPlaceholderText("未找到设备")
        
        self.update_device_status()
        
    def on_device_selected(self, text: str):
        """设备选择改变"""
        if not text:
            return
            
        device_id = self.device_combo.currentData()
        if device_id and device_id != self.current_device_id:
            self.current_device_id = device_id
            self.device_selected.emit(device_id)
            self.update_device_status()
    
    def on_device_change(self, device_id: str):
        """设备改变处理"""
        logger.info(f"切换到设备: {device_id}")
        
        # 通知所有子组件设备改变
        for i in range(self.tab_widget.count()):
            widget = self.tab_widget.widget(i)
            if hasattr(widget, 'set_current_device'):
                widget.set_current_device(device_id)
    
    def on_device_connected(self, device: Device):
        """设备连接"""
        logger.info(f"设备连接: {device.id}")
        self.refresh_devices()
        
    def on_device_disconnected(self, device_id: str):
        """设备断开"""
        logger.info(f"设备断开: {device_id}")
        self.refresh_devices()
        
        if device_id == self.current_device_id:
            self.current_device_id = None
            self.device_selected.emit("")
    
    def on_device_updated(self, device: Device):
        """设备状态更新"""
        self.update_device_status()
    
    def on_adb_error(self, error_msg: str):
        """ADB错误处理"""
        logger.error(f"ADB错误: {error_msg}")
        self.status_bar.showMessage(f"错误: {error_msg}", 5000)
    
    def update_device_status(self):
        """更新设备状态显示"""
        if self.current_device_id and self.current_device_id in self.adb_manager.devices:
            device = self.adb_manager.devices[self.current_device_id]
            status_text = f"{device.id}"
            
            if device.status == "device":
                # 设备正常连接
                if device.model:
                    status_text += f" ({device.model})"
                else:
                    status_text += " - 已连接"
                    
                self.device_status_label.setText(f"✅ {status_text}")
                self.device_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #d1edff;
                        border: 2px solid #0d6efd;
                        border-radius: 6px;
                        padding: 8px 12px;
                        color: #052c65;
                        font-size: 12px;
                        font-weight: 600;
                    }
                """)
            elif device.status == "offline":
                # 设备离线
                self.device_status_label.setText(f"⚠️ {status_text} - 离线")
                self.device_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #fff3cd;
                        border: 2px solid #ffc107;
                        border-radius: 6px;
                        padding: 8px 12px;
                        color: #664d03;
                        font-size: 12px;
                        font-weight: 600;
                    }
                """)
            else:
                # 其他状态（unauthorized等）
                self.device_status_label.setText(f"❌ {status_text} - {device.status}")
                self.device_status_label.setStyleSheet("""
                    QLabel {
                        background-color: #f8d7da;
                        border: 2px solid #dc3545;
                        border-radius: 6px;
                        padding: 8px 12px;
                        color: #721c24;
                        font-size: 12px;
                        font-weight: 600;
                    }
                """)
        else:
            self.device_status_label.setText("📱 未连接设备")
            self.device_status_label.setStyleSheet("""
                QLabel {
                    background-color: #f8f9fa;
                    border: 2px solid #6c757d;
                    border-radius: 6px;
                    padding: 8px 12px;
                    color: #495057;
                    font-size: 12px;
                    font-weight: 600;
                }
            """)
    
    def show_wifi_connect_dialog(self):
        """显示WiFi连接对话框"""
        from .dialogs.wifi_connect_dialog import WiFiConnectDialog
        
        dialog = WiFiConnectDialog(self.adb_manager, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.refresh_devices()
    
    def show_settings_dialog(self):
        """显示设置对话框"""
        from .dialogs.settings_dialog import SettingsDialog
        
        dialog = SettingsDialog(self.config, self)
        dialog.exec()
    
    def show_about_dialog(self):
        """显示关于对话框"""
        QMessageBox.about(
            self,
            "关于 ADB Tools",
            """
            <h3>ADB Tools v2.0.0</h3>
            <p>Android调试工具集成平台</p>
            <p>基于 Qt 6 + Python 开发</p>
            <br>
            <p><b>主要功能:</b></p>
            <ul>
                <li>设备连接管理 (USB/WiFi)</li>
                <li>实时日志查看</li>
                <li>应用管理 (安装/卸载/启动/停止)</li>
                <li>文件管理 (浏览/上传/下载)</li>
                <li>屏幕截图</li>
                <li>ADB命令终端</li>
            </ul>
            """
        )
    
    def save_window_state(self):
        """保存窗口状态"""
        self.config.set_value("window/geometry", self.saveGeometry())
        self.config.set_value("window/state", self.saveState())
        self.config.set_value("window/current_tab", self.tab_widget.currentIndex())
    
    def restore_window_state(self):
        """恢复窗口状态"""
        geometry = self.config.get_value("window/geometry")
        if geometry:
            self.restoreGeometry(geometry)
        
        state = self.config.get_value("window/state")
        if state:
            self.restoreState(state)
        
        current_tab = self.config.get_value("window/current_tab", 0)
        if isinstance(current_tab, int) and 0 <= current_tab < self.tab_widget.count():
            self.tab_widget.setCurrentIndex(current_tab)
    
    def closeEvent(self, event):
        """关闭事件"""
        self.save_window_state()
        
        # 停止ADB监控
        self.adb_manager.stop_monitoring()
        
        # 停止所有子组件
        for i in range(self.tab_widget.count()):
            widget = self.tab_widget.widget(i)
            if hasattr(widget, 'cleanup'):
                widget.cleanup()
        
        event.accept() 