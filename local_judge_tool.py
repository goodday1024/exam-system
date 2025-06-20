#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地代码测评工具
功能：
1. 同步网站的学生编程题数据和测试样例
2. 本地执行学生代码并进行测评
3. 提供图形化界面操作
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import requests
import json
import subprocess
import tempfile
import os
import threading
from datetime import datetime
import time
import re
import logging

class LocalJudgeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("本地代码测评工具")
        self.root.geometry("1200x800")
        
        # 配置变量
        self.server_url = tk.StringVar(value="https://exam.mymarkdown.fun")
        self.email = tk.StringVar()
        self.password = tk.StringVar()
        self.auth_token = ""  # 存储登录后的token
        
        # 数据存储
        self.exams_data = []
        self.current_exam = None
        self.student_results = []
        
        self.setup_ui()
        
    def setup_ui(self):
        """设置用户界面"""
        # 创建主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(3, weight=1)
        
        # 服务器配置区域
        config_frame = ttk.LabelFrame(main_frame, text="服务器配置", padding="5")
        config_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        config_frame.columnconfigure(1, weight=1)
        
        ttk.Label(config_frame, text="服务器地址:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        ttk.Entry(config_frame, textvariable=self.server_url, width=50).grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        ttk.Label(config_frame, text="邮箱:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5))
        ttk.Entry(config_frame, textvariable=self.email, width=50).grid(row=1, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        ttk.Label(config_frame, text="密码:").grid(row=2, column=0, sticky=tk.W, padx=(0, 5))
        ttk.Entry(config_frame, textvariable=self.password, width=50, show="*").grid(row=2, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        ttk.Button(config_frame, text="测试连接", command=self.test_connection).grid(row=0, column=2, padx=(5, 0))
        ttk.Button(config_frame, text="登录", command=self.login).grid(row=1, column=2, padx=(5, 0))
        ttk.Button(config_frame, text="同步数据", command=self.sync_data).grid(row=2, column=2, padx=(5, 0))
        
        # 考试选择区域
        exam_frame = ttk.LabelFrame(main_frame, text="考试选择", padding="5")
        exam_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        exam_frame.columnconfigure(1, weight=1)
        
        ttk.Label(exam_frame, text="选择考试:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.exam_combo = ttk.Combobox(exam_frame, state="readonly", width=60)
        self.exam_combo.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        self.exam_combo.bind('<<ComboboxSelected>>', self.on_exam_selected)
        
        ttk.Button(exam_frame, text="加载考试", command=self.load_exam_details).grid(row=0, column=2, padx=(5, 0))
        
        # 测评控制区域
        control_frame = ttk.LabelFrame(main_frame, text="测评控制", padding="5")
        control_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Button(control_frame, text="开始批量测评", command=self.start_batch_evaluation).grid(row=0, column=0, padx=(0, 10))
        ttk.Button(control_frame, text="导出结果", command=self.export_results).grid(row=0, column=1, padx=(0, 10))
        ttk.Button(control_frame, text="清空结果", command=self.clear_results).grid(row=0, column=2, padx=(0, 10))
        
        # 进度条
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(control_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))
        
        # 结果显示区域
        result_frame = ttk.LabelFrame(main_frame, text="测评结果", padding="5")
        result_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        result_frame.columnconfigure(0, weight=1)
        result_frame.rowconfigure(0, weight=1)
        
        # 创建Treeview显示结果
        columns = ('学生', '题目', '语言', '状态', '得分', '执行时间', '错误信息')
        self.result_tree = ttk.Treeview(result_frame, columns=columns, show='headings', height=15)
        
        # 设置列标题和宽度
        for col in columns:
            self.result_tree.heading(col, text=col)
            if col == '学生':
                self.result_tree.column(col, width=100)
            elif col == '题目':
                self.result_tree.column(col, width=150)
            elif col == '语言':
                self.result_tree.column(col, width=80)
            elif col == '状态':
                self.result_tree.column(col, width=80)
            elif col == '得分':
                self.result_tree.column(col, width=60)
            elif col == '执行时间':
                self.result_tree.column(col, width=80)
            else:
                self.result_tree.column(col, width=200)
        
        # 添加滚动条
        scrollbar_y = ttk.Scrollbar(result_frame, orient=tk.VERTICAL, command=self.result_tree.yview)
        scrollbar_x = ttk.Scrollbar(result_frame, orient=tk.HORIZONTAL, command=self.result_tree.xview)
        self.result_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.result_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar_y.grid(row=0, column=1, sticky=(tk.N, tk.S))
        scrollbar_x.grid(row=1, column=0, sticky=(tk.W, tk.E))
        
        # 状态栏
        self.status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
    def login(self):
        """用户登录"""
        if not self.email.get() or not self.password.get():
            messagebox.showerror("登录失败", "请输入邮箱和密码")
            return
            
        try:
            url = f"{self.server_url.get()}/api/auth/login"
            data = {
                "email": self.email.get(),
                "password": self.password.get()
            }
            
            response = requests.post(url, json=data, timeout=10)
            if response.status_code == 200:
                # 从响应的cookies中获取token
                if 'token' in response.cookies:
                    self.auth_token = response.cookies['token']
                    messagebox.showinfo("登录成功", "用户登录成功")
                    self.status_var.set("用户已登录")
                else:
                    messagebox.showerror("登录失败", "未能获取认证token")
            else:
                error_msg = response.json().get('error', '登录失败')
                messagebox.showerror("登录失败", error_msg)
        except Exception as e:
            messagebox.showerror("登录失败", f"登录时出错: {str(e)}")
            
    def test_connection(self):
        """测试服务器连接"""
        try:
            url = f"{self.server_url.get()}/api/auth/me"
            headers = {}
            cookies = {}
            if self.auth_token:
                cookies['token'] = self.auth_token
            
            response = requests.get(url, headers=headers, cookies=cookies, timeout=10)
            if response.status_code == 200:
                user_data = response.json()
                messagebox.showinfo("连接成功", f"服务器连接正常\n当前用户: {user_data.get('name', 'Unknown')} ({user_data.get('email', 'Unknown')})")
                self.status_var.set("服务器连接正常")
            else:
                messagebox.showerror("连接失败", f"服务器返回错误: {response.status_code}")
        except Exception as e:
            messagebox.showerror("连接失败", f"无法连接到服务器: {str(e)}")
            
    def sync_data(self):
        """同步考试数据"""
        if not self.auth_token:
            messagebox.showerror("同步失败", "请先登录")
            return
            
        try:
            self.status_var.set("正在同步数据...")
            url = f"{self.server_url.get()}/api/teacher/exams"
            headers = {}
            cookies = {'token': self.auth_token}
            
            response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
            if response.status_code == 200:
                response_data = response.json()
                
                # 验证返回的数据格式
                if isinstance(response_data, dict) and 'exams' in response_data:
                    # API返回格式: { exams: [...] }
                    exams_list = response_data['exams']
                    if isinstance(exams_list, list):
                        self.exams_data = exams_list
                        
                        # 更新考试下拉框
                        exam_names = []
                        for exam in self.exams_data:
                            if isinstance(exam, dict) and 'title' in exam and '_id' in exam:
                                exam_names.append(f"{exam['title']} (ID: {exam['_id']})")
                            else:
                                print(f"警告：考试数据格式异常: {exam}")
                        
                        self.exam_combo['values'] = exam_names
                        
                        messagebox.showinfo("同步成功", f"成功同步 {len(self.exams_data)} 个考试")
                        self.status_var.set(f"已同步 {len(self.exams_data)} 个考试")
                    else:
                        messagebox.showerror("同步失败", f"exams字段不是列表格式: {type(exams_list)}")
                        print(f"exams字段内容: {exams_list}")
                elif isinstance(response_data, list):
                    # 兼容直接返回数组的情况
                    self.exams_data = response_data
                    
                    # 更新考试下拉框
                    exam_names = []
                    for exam in self.exams_data:
                        if isinstance(exam, dict) and 'title' in exam and '_id' in exam:
                            exam_names.append(f"{exam['title']} (ID: {exam['_id']})")
                        else:
                            print(f"警告：考试数据格式异常: {exam}")
                    
                    self.exam_combo['values'] = exam_names
                    
                    messagebox.showinfo("同步成功", f"成功同步 {len(self.exams_data)} 个考试")
                    self.status_var.set(f"已同步 {len(self.exams_data)} 个考试")
                else:
                    messagebox.showerror("同步失败", f"服务器返回数据格式错误，期望包含exams字段的对象或数组，但收到: {type(response_data)}")
                    print(f"API返回数据: {response_data}")
            else:
                messagebox.showerror("同步失败", f"服务器返回错误: {response.status_code}")
        except Exception as e:
            messagebox.showerror("同步失败", f"同步数据时出错: {str(e)}")
            self.status_var.set("同步失败")
            
    def on_exam_selected(self, event):
        """考试选择事件"""
        selection = self.exam_combo.current()
        if selection >= 0 and selection < len(self.exams_data):
            self.current_exam = self.exams_data[selection]
            if isinstance(self.current_exam, dict) and 'title' in self.current_exam:
                self.status_var.set(f"已选择考试: {self.current_exam['title']}")
            else:
                self.status_var.set("已选择考试，但数据格式异常")
                print(f"考试数据格式异常: {self.current_exam}")
            
    def load_exam_details(self):
        """加载考试详细信息"""
        if not self.current_exam:
            messagebox.showwarning("警告", "请先选择一个考试")
            return
            
        if not self.auth_token:
            messagebox.showerror("加载失败", "请先登录")
            return
            
        try:
            self.status_var.set("正在加载考试详情...")
            exam_id = self.current_exam['_id']
            
            # 获取考试详情
            url = f"{self.server_url.get()}/api/teacher/exams/{exam_id}"
            headers = {}
            cookies = {'token': self.auth_token}
            
            response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
            if response.status_code == 200:
                response_data = response.json()
                
                # 验证返回的数据格式
                if isinstance(response_data, dict) and 'exam' in response_data:
                    self.exam_details = response_data['exam']
                    with open('exam_details.log', 'w') as f:
                        f.write(str(response_data))
                else:
                    # 兼容直接返回考试对象的情况
                    self.exam_details = response_data
                
                # 验证考试详情数据格式
                if not isinstance(self.exam_details, dict) or 'title' not in self.exam_details:
                    messagebox.showerror("加载失败", "考试详情数据格式错误")
                    print(f"考试详情数据: {self.exam_details}")
                    return
                
                # 获取学生答案
                results_url = f"{self.server_url.get()}/api/teacher/exams/{exam_id}/results"
                results_response = requests.get(results_url, headers=headers, cookies=cookies, timeout=30)
                
                if results_response.status_code == 200:
                    results_response_data = results_response.json()
                    
                    # 验证学生答案数据格式
                    if isinstance(results_response_data, dict) and 'exam' in results_response_data:
                        exam_with_results = results_response_data['exam']
                        results_data = exam_with_results.get('examResults', [])
                    else:
                        # 兼容直接返回数组的情况
                        results_data = results_response_data if isinstance(results_response_data, list) else []
                    
                    # 保存数据
                    self.current_exam['details'] = self.exam_details
                    self.current_exam['results'] = results_data
                    
                    # 统计编程题数量
                    programming_questions = [q for q in self.exam_details.get('questions', []) if q.get('type') == 'PROGRAMMING']
                    
                    messagebox.showinfo("加载成功", 
                                      f"考试: {self.exam_details['title']}\n"
                                      f"编程题数量: {len(programming_questions)}\n"
                                      f"学生答案数量: {len(results_data)}")
                    
                    self.status_var.set(f"已加载考试详情，{len(programming_questions)} 道编程题，{len(results_data)} 份答案")
                else:
                    messagebox.showerror("加载失败", "无法获取学生答案数据")
            else:
                messagebox.showerror("加载失败", f"无法获取考试详情: {response.status_code}")
                
        except Exception as e:
            messagebox.showerror("加载失败", f"加载考试详情时出错: {str(e)}")
            self.status_var.set("加载失败")
            
    def start_batch_evaluation(self):
        """开始批量测评"""
        if not self.current_exam or 'details' not in self.current_exam:
            messagebox.showwarning("警告", "请先加载考试详情")
            return
            
        # 在新线程中执行测评
        threading.Thread(target=self.batch_evaluate, daemon=True).start()
        
    def batch_evaluate(self):
        """批量测评函数"""
        try:
            self.exam_details = self.current_exam['details']

            results_data = self.current_exam['results']
            
            # 获取编程题
            programming_questions = [q for q in self.exam_details.get('questions', []) if q.get('type') == 'PROGRAMMING']
            
            if not programming_questions:
                messagebox.showinfo("提示", "该考试没有编程题")
                return
                
            total_tasks = len(results_data) * len(programming_questions)
            completed_tasks = 0
            
            self.progress_var.set(0)
            self.status_var.set("开始批量测评...")
            
            for result in results_data:
                # 根据API返回的数据结构调整字段访问
                if 'student' in result and isinstance(result['student'], dict):
                    student_name = result['student'].get('name', '未知学生')
                else:
                    student_name = result.get('studentName', '未知学生')
                
                answers = result.get('answers', {})
                # 确保answers是字典类型
                if isinstance(answers, str):
                    try:
                        import json
                        answers = json.loads(answers)
                    except:
                        answers = {}
                elif not isinstance(answers, dict):
                    answers = {}
                
                for question in programming_questions:
                    question_id = question['_id']
                    question_title = question.get('title', '未知题目')
                    
                    if question_id in answers:
                        answer_data = answers[question_id]
                        
                        # 确保answer_data是字典类型
                        if isinstance(answer_data, str):
                            # 如果是字符串，尝试解析为JSON
                            try:
                                import json
                                answer_data = json.loads(answer_data)
                            except:
                                # 解析失败，将字符串作为代码内容
                                answer_data = {'code': answer_data, 'language': 'python'}
                        elif not isinstance(answer_data, dict):
                            # 如果不是字典类型，跳过这个答案
                            continue
                        
                        code = answer_data.get('code', '')
                        language = self.exam_details.get('language', 'cpp')
                        
                        if code.strip():
                            # 执行代码测评
                            result_data = self.evaluate_code(code, language, question_id)
                            
                            # 添加到结果列表
                            self.student_results.append({
                                'student': student_name,
                                'question': question_title,
                                'question_id': question_id,
                                'language': language,
                                'status': result_data['status'],
                                'score': result_data['score'],
                                'execution_time': result_data['execution_time'],
                                'error': result_data.get('error', '')
                            })
                            
                            # 更新UI
                            self.root.after(0, self.update_result_display)
                    
                    completed_tasks += 1
                    progress = (completed_tasks / total_tasks) * 100
                    self.progress_var.set(progress)
                    
            self.status_var.set(f"批量测评完成，共处理 {completed_tasks} 个任务")
            messagebox.showinfo("完成", "批量测评已完成")
            
        except Exception as e:
            messagebox.showerror("测评失败", f"批量测评时出错: {str(e)}")
            self.status_var.set("测评失败")
            
    def evaluate_code(self, code, language, question_id):
        """评测单个代码"""
        try:
            start_time = time.time()
            
            # 获取测试用例
            questions_url = f"{self.server_url.get()}/api/teacher/questions/"
            headers = {}
            cookies = {'token': self.auth_token}
            response = requests.get(questions_url, headers=headers, cookies=cookies, timeout=30)
            
            # 初始化测试用例变量
            test_cases = []
            test_score = 0
            
            # 遍历所有题目找到匹配的编程题
            for question in response.json().get('questions', []):
                if question.get('type') == 'PROGRAMMING' and question.get('_id') == question_id:
                    test_cases_raw = question.get('testCases', [])
                    test_score = question.get('points', 0)
                    
                    # 处理测试用例数据
                    if isinstance(test_cases_raw, str):
                        try:
                            test_cases = json.loads(test_cases_raw)
                            if not isinstance(test_cases, list):
                                test_cases = []
                        except json.JSONDecodeError:
                            print(f"警告：无法解析testCases JSON: {test_cases_raw}")
                    elif isinstance(test_cases_raw, list):
                        test_cases = test_cases_raw
                    break
            
            # 检查是否有有效的测试用例
            if not test_cases:
                return {
                    'status': '无测试用例',
                    'score': 0,
                    'execution_time': 0,
                    'error': '该题目没有配置测试用例，请检查题目配置。'
                }
            
            # 执行测试用例
            passed_cases = 0
            total_cases = len(test_cases)
            error_messages = []
            
            for i, test_case in enumerate(test_cases):
                input_data = test_case.get('input', '')
                expected_output = test_case.get('expectedOutput', '').strip()
                
                # 执行代码
                execution_result = self.execute_code(code, language, input_data)
                
                if execution_result['success']:
                    actual_output = execution_result['output'].strip()
                    if actual_output == expected_output:
                        passed_cases += 1
                    else:
                        error_messages.append(f"测试用例{i+1}失败: 输入'{input_data}'，期望'{expected_output}'，实际'{actual_output}'")
                else:
                    error_messages.append(f"测试用例{i+1}执行错误: 输入'{input_data}'，错误信息'{execution_result['error']}'")
            
            # 计算执行时间和得分
            execution_time = time.time() - start_time
            score = (passed_cases / total_cases) * test_score if total_cases > 0 else 0
            
            # 确定状态
            status = "通过" if passed_cases == total_cases else f"部分通过({passed_cases}/{total_cases})"
            if passed_cases == 0:
                status = "失败"
            
            return {
                'status': status,
                'score': round(score, 1),
                'execution_time': round(execution_time * 1000, 2),  # 转换为毫秒
                'error': '; '.join(error_messages[:3])  # 只显示前3个错误
            }
            
        except Exception as e:
            return {
                'status': '评测错误',
                'score': 0,
                'execution_time': 0,
                'error': str(e)
            }
            
    def execute_code(self, code, language, input_data):
        """执行代码"""
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(mode='w', suffix=self.get_file_extension(language), delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            try:
                # 根据语言选择执行命令
                if language.lower() == 'python':
                    cmd = ['python3', temp_file]
                elif language.lower() == 'java':
                    # Java需要编译
                    compile_result = subprocess.run(['javac', temp_file], 
                                                  capture_output=True, text=True, timeout=10)
                    if compile_result.returncode != 0:
                        return {
                            'success': False,
                            'error': f'编译错误: {compile_result.stderr}'
                        }
                    
                    class_name = os.path.splitext(os.path.basename(temp_file))[0]
                    cmd = ['java', '-cp', os.path.dirname(temp_file), class_name]
                elif language.lower() in ['c', 'cpp', 'c++']:
                    # C/C++需要编译
                    exe_file = temp_file + '.exe' if os.name == 'nt' else temp_file + '.out'
                    compiler = 'gcc' if language.lower() == 'c' else 'g++'
                    
                    compile_result = subprocess.run([compiler, temp_file, '-o', exe_file], 
                                                  capture_output=True, text=True, timeout=10)
                    if compile_result.returncode != 0:
                        return {
                            'success': False,
                            'error': f'编译错误: {compile_result.stderr}'
                        }
                    
                    cmd = [exe_file]
                else:
                    return {
                        'success': False,
                        'error': f'不支持的语言: {language}'
                    }
                
                # 执行代码
                result = subprocess.run(cmd, input=input_data, capture_output=True, 
                                      text=True, timeout=5)
                
                if result.returncode == 0:
                    return {
                        'success': True,
                        'output': result.stdout
                    }
                else:
                    return {
                        'success': False,
                        'error': result.stderr or '程序执行失败'
                    }
                    
            finally:
                # 清理临时文件
                try:
                    os.unlink(temp_file)
                    if language.lower() == 'java':
                        class_file = temp_file.replace('.java', '.class')
                        if os.path.exists(class_file):
                            os.unlink(class_file)
                    elif language.lower() in ['c', 'cpp', 'c++']:
                        exe_file = temp_file + '.exe' if os.name == 'nt' else temp_file + '.out'
                        if os.path.exists(exe_file):
                            os.unlink(exe_file)
                except:
                    pass
                    
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': '代码执行超时'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
            
    def get_file_extension(self, language):
        """获取文件扩展名"""
        extensions = {
            'python': '.py',
            'java': '.java',
            'c': '.c',
            'cpp': '.cpp',
            'c++': '.cpp',
            'javascript': '.js',
            'js': '.js'
        }
        return extensions.get(language.lower(), '.txt')
        
    def update_result_display(self):
        """更新结果显示"""
        # 清空现有结果
        for item in self.result_tree.get_children():
            self.result_tree.delete(item)
        
        # 添加新结果
        for result in self.student_results:
            print(result)
            # 直接使用结果中的题目标题，避免复杂的查找逻辑
            self.result_tree.insert('', 'end', values=(
                result['student'],
                result['question'],
                result['language'],
                result['status'],
                f"{result['score']}%",
                f"{result['execution_time']}ms",
                result['error']
            ))
            
    def export_results(self):
        """导出结果"""
        if not self.student_results:
            messagebox.showwarning("警告", "没有可导出的结果")
            return
            
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        
        if filename:
            try:
                import csv
                with open(filename, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(['学生', '得分'])
                    
                    for result in self.student_results:
                        writer.writerow([
                            result['student'],
                            f"{result['score']}"
                        ])
                        
                messagebox.showinfo("导出成功", f"结果已导出到: {filename}")
            except Exception as e:
                messagebox.showerror("导出失败", f"导出时出错: {str(e)}")
                
    def clear_results(self):
        """清空结果"""
        if messagebox.askyesno("确认", "确定要清空所有测评结果吗？"):
            self.student_results.clear()
            self.update_result_display()
            self.progress_var.set(0)
            self.status_var.set("结果已清空")

def main():
    root = tk.Tk()
    app = LocalJudgeApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()