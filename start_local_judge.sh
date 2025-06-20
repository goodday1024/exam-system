#!/bin/bash

# 本地代码测评工具启动脚本

echo "=== 本地代码测评工具启动脚本 ==="
echo

# 检查Python版本
echo "检查Python环境..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "✓ 找到Python: $PYTHON_VERSION"
else
    echo "✗ 错误: 未找到python3命令"
    echo "请安装Python 3.7或更高版本"
    exit 1
fi

echo

# 检查依赖包
echo "检查依赖包..."
if python3 -c "import requests, tkinter" 2>/dev/null; then
    echo "✓ 依赖包检查通过"
else
    echo "⚠ 警告: 某些依赖包可能缺失"
    echo "尝试安装依赖包..."
    if [ -f "requirements_local_judge.txt" ]; then
        pip3 install -r requirements_local_judge.txt
    else
        pip3 install requests
    fi
fi

echo

# 检查编程语言环境
echo "检查编程语言环境..."

# 检查Java
if command -v javac &> /dev/null && command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    echo "✓ Java环境: $JAVA_VERSION"
else
    echo "⚠ Java环境未找到 (如需测评Java代码请安装JDK)"
fi

# 检查GCC
if command -v gcc &> /dev/null; then
    GCC_VERSION=$(gcc --version | head -n 1)
    echo "✓ GCC编译器: $GCC_VERSION"
else
    echo "⚠ GCC编译器未找到 (如需测评C代码请安装GCC)"
fi

# 检查G++
if command -v g++ &> /dev/null; then
    GPP_VERSION=$(g++ --version | head -n 1)
    echo "✓ G++编译器: $GPP_VERSION"
else
    echo "⚠ G++编译器未找到 (如需测评C++代码请安装G++)"
fi

echo
echo "=== 启动本地测评工具 ==="
echo

# 启动程序
if [ -f "local_judge_tool.py" ]; then
    python3 local_judge_tool.py
else
    echo "✗ 错误: 未找到local_judge_tool.py文件"
    echo "请确保在正确的目录中运行此脚本"
    exit 1
fi