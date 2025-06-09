#!/bin/bash

echo "🔧 ADB WiFi 调试修复脚本"
echo "========================="

# 检查ADB是否安装
if ! command -v adb &> /dev/null; then
    echo "❌ 未找到 adb 命令，请先安装 Android SDK Platform Tools"
    exit 1
fi

echo "✅ ADB 已安装"

# 重启ADB服务器
echo "🔄 重启 ADB 服务器..."
adb kill-server
sleep 2
adb start-server

echo "✅ ADB 服务器已重启"

# 检查USB连接的设备
echo "🔍 检查 USB 连接的设备..."
USB_DEVICES=$(adb devices | grep -E "device$" | wc -l)

if [ $USB_DEVICES -eq 0 ]; then
    echo "⚠️  未检测到通过USB连接的设备"
    echo "请确保："
    echo "  1. 设备已通过USB连接到电脑"
    echo "  2. 设备已开启USB调试"
    echo "  3. 已在设备上授权此电脑的调试权限"
    echo ""
    echo "如果设备已连接，请运行: adb devices"
    exit 1
fi

echo "✅ 检测到 $USB_DEVICES 个USB连接的设备"

# 获取设备列表
echo "📱 当前连接的设备："
adb devices -l

# 启用WiFi调试
echo ""
read -p "🌐 是否要启用WiFi调试？(y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 启用WiFi调试（端口5555）..."
    adb tcpip 5555
    
    echo "✅ WiFi调试已启用"
    echo ""
    echo "📝 下一步操作："
    echo "  1. 在设备的 设置 → 关于手机 → 状态 中查看IP地址"
    echo "  2. 运行: adb connect <设备IP>:5555"
    echo "  3. 例如: adb connect 192.168.1.100:5555"
    echo ""
    
    # 询问是否要连接
    read -p "💡 是否现在就连接WiFi设备？请输入设备IP地址 (直接回车跳过): " DEVICE_IP
    
    if [ ! -z "$DEVICE_IP" ]; then
        echo "🔗 尝试连接到 $DEVICE_IP:5555..."
        adb connect $DEVICE_IP:5555
        
        echo ""
        echo "📱 更新后的设备列表："
        adb devices -l
    fi
fi

echo ""
echo "✨ 修复完成！"
echo ""
echo "💡 常见问题解决方案："
echo "  • 连接被拒绝: 确保已执行 'adb tcpip 5555'"
echo "  • 无法找到设备: 检查IP地址和网络连接"
echo "  • 授权失败: 重新插拔USB并授权调试权限"
echo "  • 防火墙问题: 确保5555端口未被阻止" 