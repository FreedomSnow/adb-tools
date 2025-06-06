# -*- coding: utf-8 -*-
"""
ADB Tools - Android调试工具集成平台
"""

__version__ = "2.0.0"
__author__ = "ADB Tools Team"

# 全局深色主题样式表
DARK_THEME_STYLESHEET = """
/* 全局深色主题 - 黑底白字，按钮保持原色 */
QWidget {
    background-color: #1a1a1a;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* 输入框样式 */
QLineEdit, QTextEdit, QPlainTextEdit {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    border-radius: 4px;
    padding: 8px;
    color: #ffffff;
    selection-background-color: #0969da;
}

QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {
    border-color: #0969da;
}

/* 分组框样式 */
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

/* 对话框样式 */
QDialog {
    background-color: #1a1a1a;
    color: #ffffff;
}

QMessageBox {
    background-color: #1a1a1a;
    color: #ffffff;
}

QMessageBox QPushButton {
    min-width: 80px;
    padding: 8px 16px;
}

/* 菜单样式 */
QMenu {
    background-color: #2d2d2d;
    border: 1px solid #404040;
    color: #ffffff;
    border-radius: 4px;
}

QMenu::item {
    padding: 8px 16px;
    background-color: transparent;
}

QMenu::item:selected {
    background-color: #0969da;
    color: #ffffff;
}

/* 滚动条通用样式 */
QScrollBar:horizontal, QScrollBar:vertical {
    background-color: #2d2d2d;
    border-radius: 6px;
}

QScrollBar::handle:horizontal, QScrollBar::handle:vertical {
    background-color: #555555;
    border-radius: 6px;
    min-height: 20px;
    min-width: 20px;
}

QScrollBar::handle:hover {
    background-color: #777777;
}

/* 分割器样式 */
QSplitter::handle {
    background-color: #404040;
}

QSplitter::handle:horizontal {
    width: 3px;
}

QSplitter::handle:vertical {
    height: 3px;
}
""" 