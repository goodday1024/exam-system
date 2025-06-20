@echo off
chcp 65001 >nul
echo === 本地代码测评工具启动脚本 ===
echo.

REM 检查Python环境
echo 检查Python环境...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo ✓ 找到Python: %%i
) else (
    python3 --version >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do echo ✓ 找到Python: %%i
        set PYTHON_CMD=python3
    ) else (
        echo ✗ 错误: 未找到python或python3命令
        echo 请安装Python 3.7或更高版本
        pause
        exit /b 1
    )
)

if not defined PYTHON_CMD set PYTHON_CMD=python

echo.

REM 检查依赖包
echo 检查依赖包...
%PYTHON_CMD% -c "import requests, tkinter" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 依赖包检查通过
) else (
    echo ⚠ 警告: 某些依赖包可能缺失
    echo 尝试安装依赖包...
    if exist "requirements_local_judge.txt" (
        pip install -r requirements_local_judge.txt
    ) else (
        pip install requests
    )
)

echo.

REM 检查编程语言环境
echo 检查编程语言环境...

REM 检查Java
javac -version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr "version"') do echo ✓ Java环境: %%i
) else (
    echo ⚠ Java环境未找到 (如需测评Java代码请安装JDK)
)

REM 检查GCC (通过MinGW或其他方式)
gcc --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('gcc --version 2^>^&1 ^| findstr "gcc"') do echo ✓ GCC编译器: %%i
) else (
    echo ⚠ GCC编译器未找到 (如需测评C代码请安装MinGW或其他C编译器)
)

REM 检查G++
g++ --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('g++ --version 2^>^&1 ^| findstr "g++"') do echo ✓ G++编译器: %%i
) else (
    echo ⚠ G++编译器未找到 (如需测评C++代码请安装MinGW或其他C++编译器)
)

echo.
echo === 启动本地测评工具 ===
echo.

REM 启动程序
if exist "local_judge_tool.py" (
    %PYTHON_CMD% local_judge_tool.py
) else (
    echo ✗ 错误: 未找到local_judge_tool.py文件
    echo 请确保在正确的目录中运行此脚本
    pause
    exit /b 1
)

pause