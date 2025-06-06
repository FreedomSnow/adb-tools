# ADB Tools Qt版本 - 样式指南

## 🎨 设计理念

ADB Tools Qt版本采用现代化的GitHub风格设计，提供清爽、专业的用户界面体验。

## 🎯 设计原则

### 1. 简洁明了
- 使用扁平化设计，避免过度装饰
- 突出重要功能，隐藏次要信息
- 保持界面元素的一致性

### 2. 用户友好
- 提供清晰的视觉反馈
- 使用直观的图标和标签
- 合理的间距和布局

### 3. 现代化
- 使用GitHub风格的颜色方案
- 圆角设计增加亲和力
- 平滑的过渡动画

## 🎨 色彩方案

### 主色调
```css
/* 主要蓝色 */
--color-primary: #0969da;
--color-primary-hover: #0860ca;
--color-primary-active: #0757ba;

/* 背景色 */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f6f8fa;
--color-bg-tertiary: #f3f4f6;

/* 边框色 */
--color-border-default: #d0d7de;
--color-border-muted: #eaeef2;

/* 文字色 */
--color-text-primary: #24292f;
--color-text-secondary: #656d76;
--color-text-muted: #8c959f;
```

### 状态色
```css
/* 成功状态 */
--color-success: #1a7f37;
--color-success-bg: #d1e7dd;
--color-success-border: #a3cfbb;

/* 警告状态 */
--color-warning: #664d03;
--color-warning-bg: #fff3cd;
--color-warning-border: #ffecb5;

/* 错误状态 */
--color-danger: #cf222e;
--color-danger-bg: #f8d7da;
--color-danger-border: #f1aeb5;
```

## 🧩 组件样式

### 按钮
- **主要按钮**: 蓝色背景，白色文字
- **次要按钮**: 灰色背景，深色文字
- **成功按钮**: 绿色背景，白色文字
- **危险按钮**: 红色背景，白色文字

### 输入框
- 白色背景，圆角边框
- 聚焦时蓝色边框
- 统一的内边距和字体

### 表格
- 交替行颜色
- 圆角边框
- 自定义滚动条
- 悬浮效果

### 标签页
- 圆角设计
- 选中状态高亮
- 图标 + 文字标签

## 📐 布局规范

### 间距
- **小间距**: 4px, 8px
- **中等间距**: 12px, 16px
- **大间距**: 20px, 24px

### 圆角
- **小圆角**: 3px
- **标准圆角**: 6px
- **大圆角**: 8px

### 字体
- **主要字体**: 13px
- **标题字体**: 14px-16px
- **小字体**: 12px

## 🚀 实现示例

### 按钮样式
```css
QPushButton {
    background-color: #f6f8fa;
    color: #24292f;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
}

QPushButton:hover {
    background-color: #f3f4f6;
}

QPushButton[style="primary"] {
    background-color: #0969da;
    color: white;
    border-color: #0969da;
}
```

### 输入框样式
```css
QLineEdit {
    padding: 6px 8px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background-color: #ffffff;
    font-size: 13px;
}

QLineEdit:focus {
    border-color: #0969da;
    outline: none;
}
```

## 🎯 最佳实践

### 1. 样式继承
- 创建基础样式类
- 使用样式属性区分不同状态
- 避免重复的样式代码

### 2. 响应式设计
- 合理使用弹性布局
- 设置最小尺寸限制
- 处理不同屏幕分辨率

### 3. 交互反馈
- 提供悬浮状态
- 明确的点击反馈
- 合适的禁用状态

### 4. 可访问性
- 确保足够的对比度
- 提供键盘导航支持
- 使用语义化的颜色

## 🔧 开发工具

### QSS调试
- 使用Qt Designer预览样式
- 在代码中动态调试
- 使用浏览器开发者工具作为参考

### 资源管理
- 将图标存储为SVG格式
- 使用数据URI嵌入小图标
- 优化样式表文件结构

## 📱 移动端适配

虽然主要面向桌面端，但考虑以下因素：
- 合适的触摸目标大小
- 清晰的视觉层次
- 响应式的布局设计

---

**保持界面的现代化和专业性，为用户提供最佳的使用体验！** ✨ 