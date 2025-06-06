# -*- coding: utf-8 -*-
"""
命令终端
ADB命令执行和输出显示
"""

import re
import json
from typing import List, Dict
from datetime import datetime

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, QLineEdit,
    QPushButton, QComboBox, QLabel, QGroupBox, QSplitter,
    QCompleter, QMessageBox, QCheckBox
)
from PySide6.QtCore import Qt, QThread, Signal, QStringListModel
from PySide6.QtGui import QFont, QTextCursor, QColor, QTextCharFormat
import logging

from ..core.adb_manager import ADBManager

logger = logging.getLogger(__name__)


class CommandExecutorWorker(QThread):
    """命令执行工作线程"""
    
    command_output = Signal(str, str, str)  # command, output, error
    command_finished = Signal(bool)  # success
    
    def __init__(self, adb_manager: ADBManager, device_id: str, command: List[str]):
        super().__init__()
        self.adb_manager = adb_manager
        self.device_id = device_id
        self.command = command
    
    def run(self):
        """执行命令"""
        try:
            if self.device_id:
                # 设备相关命令，自动添加 -s device_id
                full_command = ["-s", self.device_id] + self.command
            else:
                # 全局命令
                full_command = self.command
            
            success, output, error = self.adb_manager.execute_command(full_command)
            
            self.command_output.emit(' '.join(full_command), output, error)
            self.command_finished.emit(success)
            
        except Exception as e:
            self.command_output.emit(' '.join(self.command), "", str(e))
            self.command_finished.emit(False)


class CommandTerminalWidget(QWidget):
    """命令终端组件"""
    
    def __init__(self, adb_manager: ADBManager):
        super().__init__()
        self.adb_manager = adb_manager
        self.current_device_id = None
        self.command_history = []
        self.history_index = -1
        self.executor_worker = None
        
        # 常用命令
        self.common_commands = {
            "设备信息": [
                ("查看设备列表", ["devices", "-l"]),
                ("查看设备信息", ["shell", "getprop"]),
                ("查看Android版本", ["shell", "getprop", "ro.build.version.release"]),
                ("查看设备型号", ["shell", "getprop", "ro.product.model"]),
                ("查看电池信息", ["shell", "dumpsys", "battery"]),
                ("查看内存信息", ["shell", "cat", "/proc/meminfo"]),
                ("查看CPU信息", ["shell", "cat", "/proc/cpuinfo"]),
            ],
            "应用管理": [
                ("查看已安装应用", ["shell", "pm", "list", "packages"]),
                ("查看系统应用", ["shell", "pm", "list", "packages", "-s"]),
                ("查看第三方应用", ["shell", "pm", "list", "packages", "-3"]),
                ("查看正在运行的应用", ["shell", "ps"]),
                ("强制停止应用", ["shell", "am", "force-stop", "包名"]),
                ("启动应用", ["shell", "monkey", "-p", "包名", "-c", "android.intent.category.LAUNCHER", "1"]),
                ("清除应用数据", ["shell", "pm", "clear", "包名"]),
            ],
            "文件操作": [
                ("列出文件", ["shell", "ls", "-la", "/sdcard"]),
                ("查看文件内容", ["shell", "cat", "文件路径"]),
                ("创建目录", ["shell", "mkdir", "-p", "目录路径"]),
                ("删除文件", ["shell", "rm", "-f", "文件路径"]),
                ("删除目录", ["shell", "rm", "-rf", "目录路径"]),
                ("查看磁盘空间", ["shell", "df", "-h"]),
                ("查找文件", ["shell", "find", "/sdcard", "-name", "文件名"]),
            ],
            "网络相关": [
                ("查看网络连接", ["shell", "netstat", "-an"]),
                ("查看WiFi信息", ["shell", "dumpsys", "wifi"]),
                ("ping测试", ["shell", "ping", "-c", "4", "www.baidu.com"]),
                ("查看IP地址", ["shell", "ip", "addr", "show"]),
                ("端口转发", ["forward", "tcp:本地端口", "tcp:设备端口"]),
                ("取消端口转发", ["forward", "--remove", "tcp:本地端口"]),
            ],
            "系统操作": [
                ("重启设备", ["reboot"]),
                ("重启到恢复模式", ["reboot", "recovery"]),
                ("重启到下载模式", ["reboot", "download"]),
                ("获取Root权限", ["root"]),
                ("取消Root权限", ["unroot"]),
                ("查看系统日志", ["logcat", "-d"]),
                ("清除日志缓冲区", ["logcat", "-c"]),
            ]
        }
        
        self.init_ui()
        self.connect_signals()
        self.setup_autocompletion()
    
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # 创建分割器
        splitter = QSplitter(Qt.Horizontal)
        
        # 左侧：常用命令
        self.create_command_panel(splitter)
        
        # 右侧：终端区域
        self.create_terminal_area(splitter)
        
        # 设置分割比例
        splitter.setSizes([300, 700])
        layout.addWidget(splitter)
    
    def create_command_panel(self, parent):
        """创建命令面板"""
        panel_widget = QWidget()
        panel_layout = QVBoxLayout(panel_widget)
        
        # 标题
        title_label = QLabel("常用命令")
        title_label.setStyleSheet("font-weight: bold; font-size: 14px;")
        panel_layout.addWidget(title_label)
        
        # 命令分类
        self.command_combo = QComboBox()
        self.command_combo.addItems(list(self.common_commands.keys()))
        self.command_combo.currentTextChanged.connect(self.on_category_changed)
        panel_layout.addWidget(self.command_combo)
        
        # 命令列表
        self.command_list = QTextEdit()
        self.command_list.setMaximumHeight(400)
        self.command_list.setReadOnly(True)
        self.command_list.setFont(QFont("Monaco, Menlo, 'SF Mono', Consolas, 'Liberation Mono', monospace", 11))
        self.command_list.setStyleSheet("""
            QTextEdit {
                background-color: #1a1a1a;
                color: #ffffff;
                border: 1px solid #404040;
                border-radius: 6px;
                padding: 8px;
                font-family: Monaco, Menlo, 'SF Mono', Consolas, 'Liberation Mono', monospace;
                line-height: 1.4;
            }
            QScrollBar:vertical {
                background-color: #2d2d2d;
                width: 10px;
                border-radius: 5px;
            }
            QScrollBar::handle:vertical {
                background-color: #555555;
                border-radius: 5px;
                min-height: 20px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #777777;
            }
        """)
        panel_layout.addWidget(self.command_list)
        
        # 执行按钮
        execute_btn = QPushButton("执行选中命令")
        execute_btn.clicked.connect(self.execute_selected_command)
        panel_layout.addWidget(execute_btn)
        
        panel_layout.addStretch()
        parent.addWidget(panel_widget)
        
        # 初始化显示第一个分类
        self.on_category_changed(self.command_combo.currentText())
    
    def create_terminal_area(self, parent):
        """创建终端区域"""
        terminal_widget = QWidget()
        terminal_layout = QVBoxLayout(terminal_widget)
        
        # 控制栏
        control_layout = QHBoxLayout()
        
        # 清屏按钮
        clear_btn = QPushButton("清屏")
        clear_btn.clicked.connect(self.clear_output)
        control_layout.addWidget(clear_btn)
        
        # 保存输出按钮
        save_btn = QPushButton("保存输出")
        save_btn.clicked.connect(self.save_output)
        control_layout.addWidget(save_btn)
        
        # 自动滚动选项
        self.auto_scroll_cb = QCheckBox("自动滚动")
        self.auto_scroll_cb.setChecked(True)
        control_layout.addWidget(self.auto_scroll_cb)
        
        control_layout.addStretch()
        
        # 设备状态
        self.device_status_label = QLabel("未选择设备")
        control_layout.addWidget(self.device_status_label)
        
        terminal_layout.addLayout(control_layout)
        
        # 输出区域
        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        self.output_text.setFont(QFont("Monaco, Menlo, 'SF Mono', Consolas, 'Liberation Mono', monospace", 11))
        self.output_text.setStyleSheet("""
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
        terminal_layout.addWidget(self.output_text, 1)
        
        # 命令输入区域
        input_layout = QHBoxLayout()
        
        input_layout.addWidget(QLabel("ADB >"))
        
        self.command_input = QLineEdit()
        self.command_input.setFont(QFont("Consolas", 10))
        self.command_input.returnPressed.connect(self.execute_command)
        input_layout.addWidget(self.command_input)
        
        execute_btn = QPushButton("执行")
        execute_btn.clicked.connect(self.execute_command)
        input_layout.addWidget(execute_btn)
        
        terminal_layout.addLayout(input_layout)
        
        parent.addWidget(terminal_widget)
    
    def connect_signals(self):
        """连接信号"""
        # 连接键盘事件
        self.command_input.keyPressEvent = self.on_key_press
    
    def setup_autocompletion(self):
        """设置自动补全"""
        commands = []
        for category in self.common_commands.values():
            for _, cmd in category:
                commands.append(' '.join(cmd))
        
        completer = QCompleter(commands)
        completer.setCompletionMode(QCompleter.PopupCompletion)
        completer.setCaseSensitivity(Qt.CaseInsensitive)
        self.command_input.setCompleter(completer)
    
    def set_current_device(self, device_id: str):
        """设置当前设备"""
        self.current_device_id = device_id
        
        if device_id:
            self.device_status_label.setText(f"设备: {device_id}")
            self.device_status_label.setStyleSheet("color: green; font-weight: bold;")
        else:
            self.device_status_label.setText("未选择设备")
            self.device_status_label.setStyleSheet("color: red;")
    
    def on_category_changed(self, category: str):
        """分类改变"""
        if category in self.common_commands:
            commands = self.common_commands[category]
            
            text = ""
            for i, (desc, cmd) in enumerate(commands):
                text += f"{i+1:2d}. {desc}\n"
                text += f"    {' '.join(cmd)}\n\n"
            
            self.command_list.setPlainText(text)
    
    def execute_selected_command(self):
        """执行选中的命令"""
        cursor = self.command_list.textCursor()
        if not cursor.hasSelection():
            QMessageBox.information(self, "提示", "请先在命令列表中选择一行命令")
            return
        
        selected_text = cursor.selectedText()
        
        # 从选中文本中提取命令
        lines = selected_text.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                # 这是命令行
                self.command_input.setText(line)
                self.execute_command()
                return
    
    def execute_command(self):
        """执行命令"""
        command_text = self.command_input.text().strip()
        if not command_text:
            return
        
        # 解析命令
        command_parts = command_text.split()
        if not command_parts:
            return
        
        # 添加到历史记录
        if command_text not in self.command_history:
            self.command_history.append(command_text)
        self.history_index = len(self.command_history)
        
        # 显示命令
        self.append_output(f"ADB > {command_text}", "#1a7f37")
        
        # 清空输入框
        self.command_input.clear()
        
        # 检查是否需要设备
        device_required_commands = [
            'shell', 'install', 'uninstall', 'push', 'pull', 
            'forward', 'reverse', 'logcat', 'bugreport'
        ]
        
        needs_device = any(cmd in command_parts[0] for cmd in device_required_commands)
        
        if needs_device and not self.current_device_id:
            self.append_output("错误: 此命令需要选择设备", "#cf222e")
            return
        
        # 启动执行线程
        self.executor_worker = CommandExecutorWorker(
            self.adb_manager,
            self.current_device_id if needs_device else None,
            command_parts
        )
        self.executor_worker.command_output.connect(self.on_command_output)
        self.executor_worker.command_finished.connect(self.on_command_finished)
        self.executor_worker.start()
        
        logger.info(f"执行ADB命令: {command_text}")
    
    def on_command_output(self, command: str, output: str, error: str):
        """命令输出"""
        if output:
            self.append_output(output, "#24292f")
        
        if error:
            self.append_output(f"错误: {error}", "#cf222e")
    
    def on_command_finished(self, success: bool):
        """命令完成"""
        if success:
            self.append_output("命令执行完成", "#1a7f37")
        else:
            self.append_output("命令执行失败", "#cf222e")
        
        self.append_output("", "#24292f")  # 空行分隔
    
    def append_output(self, text: str, color: str = "#24292f"):
        """添加输出文本"""
        cursor = self.output_text.textCursor()
        cursor.movePosition(QTextCursor.End)
        
        # 设置文本格式
        format = QTextCharFormat()
        
        # 将亮色风格的颜色映射
        color_map = {
            "#ffffff": "#24292f",      # 白色 -> 深灰色
            "#00ff00": "#1a7f37",      # 绿色 -> 深绿色
            "#ff0000": "#cf222e",      # 红色 -> 深红色
            "#ff4444": "#cf222e",      # 浅红色 -> 深红色
            "#888888": "#656d76"       # 灰色 -> 中灰色
        }
        
        # 使用映射的颜色，如果没有映射则使用原色
        mapped_color = color_map.get(color, color)
        format.setForeground(QColor(mapped_color))
        
        cursor.insertText(text + '\n', format)
        
        # 自动滚动
        if self.auto_scroll_cb.isChecked():
            self.output_text.setTextCursor(cursor)
    
    def on_key_press(self, event):
        """键盘事件处理"""
        # 调用原始的键盘事件处理
        QLineEdit.keyPressEvent(self.command_input, event)
        
        # 处理历史记录导航
        if event.key() == Qt.Key_Up:
            self.navigate_history(-1)
        elif event.key() == Qt.Key_Down:
            self.navigate_history(1)
    
    def navigate_history(self, direction: int):
        """导航命令历史"""
        if not self.command_history:
            return
        
        self.history_index = max(0, min(len(self.command_history), self.history_index + direction))
        
        if self.history_index < len(self.command_history):
            self.command_input.setText(self.command_history[self.history_index])
        else:
            self.command_input.clear()
    
    def clear_output(self):
        """清屏"""
        self.output_text.clear()
        self.append_output("终端已清屏", "#656d76")
        self.append_output("", "#24292f")
    
    def save_output(self):
        """保存输出"""
        from PySide6.QtWidgets import QFileDialog
        
        # 生成默认文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"adb_terminal_output_{timestamp}.txt"
        
        # 选择保存路径
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "保存终端输出",
            default_name,
            "文本文件 (*.txt);;所有文件 (*)"
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(self.output_text.toPlainText())
                
                QMessageBox.information(self, "成功", f"终端输出已保存到: {file_path}")
                logger.info(f"终端输出保存成功: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存输出失败: {str(e)}")
                logger.error(f"保存终端输出失败: {e}")
    
    def cleanup(self):
        """清理资源"""
        if self.executor_worker and self.executor_worker.isRunning():
            self.executor_worker.quit()
            self.executor_worker.wait() 