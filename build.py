#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Tools 打包脚本
使用PyInstaller打包为可执行文件
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

def check_requirements():
    """检查打包要求"""
    try:
        import PyInstaller
        print("✓ PyInstaller 已安装")
    except ImportError:
        print("❌ PyInstaller 未安装，正在安装...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✓ PyInstaller 安装完成")

def clean_build():
    """清理构建文件"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    files_to_clean = ['*.spec']
    
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"✓ 清理目录: {dir_name}")
    
    # 清理spec文件
    for spec_file in Path('.').glob('*.spec'):
        spec_file.unlink()
        print(f"✓ 清理文件: {spec_file}")

def create_spec_file():
    """创建PyInstaller spec文件"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('resources', 'resources'),
    ],
    hiddenimports=[
        'PySide6.QtCore',
        'PySide6.QtGui', 
        'PySide6.QtWidgets',
        'src.main_window',
        'src.core.adb_manager',
        'src.widgets.device_manager',
        'src.widgets.logcat_viewer',
        'src.widgets.app_manager',
        'src.widgets.file_manager',
        'src.widgets.screenshot_tool',
        'src.widgets.command_terminal',
        'src.dialogs.wifi_connect_dialog',
        'src.dialogs.settings_dialog',
        'src.utils.config',
        'src.utils.logger',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ADBTools',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='resources/icons/app_icon.png' if os.path.exists('resources/icons/app_icon.png') else None,
)

# macOS应用包
if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='ADB Tools.app',
        icon='resources/icons/app_icon.png' if os.path.exists('resources/icons/app_icon.png') else None,
        bundle_identifier='com.adbtools.app',
        info_plist={
            'NSPrincipalClass': 'NSApplication',
            'NSAppleScriptEnabled': False,
            'CFBundleDocumentTypes': [
                {
                    'CFBundleTypeName': 'APK Files',
                    'CFBundleTypeExtensions': ['apk'],
                    'CFBundleTypeRole': 'Viewer'
                }
            ]
        },
    )
'''
    
    with open('adb_tools.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    print("✓ 创建spec文件")

def build_app():
    """构建应用"""
    print("开始构建应用...")
    
    # 运行PyInstaller
    cmd = [sys.executable, "-m", "PyInstaller", "adb_tools.spec"]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✓ 构建成功！")
        
        # 显示输出文件位置
        if sys.platform == 'darwin':
            print("📦 应用包位置: dist/ADB Tools.app")
        elif sys.platform == 'win32':
            print("📦 可执行文件位置: dist/ADBTools.exe")
        else:
            print("📦 可执行文件位置: dist/ADBTools")
            
    else:
        print("❌ 构建失败！")
        print("错误输出:")
        print(result.stderr)
        return False
    
    return True

def create_resources():
    """创建必要的资源目录"""
    resources_dir = Path('resources')
    resources_dir.mkdir(exist_ok=True)
    
    icons_dir = resources_dir / 'icons'
    icons_dir.mkdir(exist_ok=True)
    
    adb_dir = resources_dir / 'adb'
    adb_dir.mkdir(exist_ok=True)
    
    print("✓ 创建资源目录")

def main():
    """主函数"""
    print("🔨 ADB Tools 打包工具")
    print("=" * 40)
    
    # 检查要求
    check_requirements()
    
    # 创建资源目录
    create_resources()
    
    # 清理旧的构建文件
    clean_build()
    
    # 创建spec文件
    create_spec_file()
    
    # 构建应用
    if build_app():
        print("\n🎉 打包完成！")
        print("\n使用说明:")
        if sys.platform == 'darwin':
            print("1. 在Finder中打开 dist/ADB Tools.app")
            print("2. 双击运行应用")
            print("3. 如需分发，可压缩为zip文件")
        elif sys.platform == 'win32':
            print("1. 运行 dist/ADBTools.exe")
            print("2. 首次运行可能需要允许防火墙访问")
        else:
            print("1. 运行 dist/ADBTools")
            print("2. 可能需要添加执行权限: chmod +x dist/ADBTools")
    else:
        print("\n❌ 打包失败！")
        sys.exit(1)

if __name__ == "__main__":
    main() 