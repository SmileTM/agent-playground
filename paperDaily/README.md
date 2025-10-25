# Daily arXiv Paper Digest with Gemini AI

## 项目简介
本项目旨在自动化从 arXiv 抓取最新论文，利用 Google Gemini AI 进行相关性评分和深度内容分析，并将每日摘要通过邮件发送给用户。它能够智能筛选与用户关注领域最相关的论文，并避免重复分析，从而大大提高研究效率。

## 主要功能

*   **自动化论文抓取**：
    *   从 arXiv 自动获取最新论文的元数据（标题、摘要、PDF URL、作者、发布日期）。
    *   支持通过关键词查询 (`ARXIV_QUERY`)、特定 arXiv ID (`ARXIV_IDS`) 或 arXiv 分类 (`ARXIV_CATEGORIES`) 进行灵活筛选。
    *   可配置时间间隔 (`DAYS_TO_FETCH_PAPERS`)，确保只获取指定天数内（例如，从 `t-DAYS_TO_FETCH_PAPERS` 天的0点到 `t-1` 天的23:59:59）提交的论文。

*   **Gemini AI 智能筛选与分析**：
    *   **相关性打分**：利用 Gemini AI 根据论文标题、摘要和预设搜索条件对每篇论文进行 0-100 的相关性评分。
    *   **高效筛选**：优先对论文元数据进行打分和排序，仅对最相关且尚未分析的论文下载 PDF 并进行深度内容分析，显著减少 API 调用和运行时间。
    *   **深度内容分析**：对筛选出的论文全文进行结构化分析，包括摘要、引言、相关工作、方法论、实验与结果、讨论、结论，并新增作者与机构分析。

*   **持久化与去重**：
    *   `analyzed_papers.txt` 文件用于记录已分析论文的 ID、标题和相关性分数。
    *   每次运行时，会自动过滤掉已分析过的论文，避免重复工作。

*   **邮件摘要发送**：
    *   将分析结果格式化为美观的 HTML 邮件。
    *   邮件内容包含每篇论文的序号、标题、PDF 链接、相关性分数、作者信息以及 Gemini AI 生成的结构化分析。
    *   支持向多个收件人发送邮件 (`RECEIVER_EMAIL` 支持列表)。

*   **用户体验优化**：
    *   在论文元数据获取、相关性打分和深度分析过程中显示详细的进度条 (`tqdm`)，包括当前处理的论文标题和 ID。

## 如何使用

### 1. 前提条件

*   Python 3.8+
*   `pip` (Python 包管理器)

### 2. 环境搭建

1.  **克隆项目**：
    ```bash
    git clone <项目仓库地址>
    cd paperDaily
    ```
    (请将 `<项目仓库地址>` 替换为实际的项目仓库 URL)

2.  **安装依赖**：
    ```bash
    pip install -r requirements.txt
    ```

3.  **配置环境变量 (`.env`)**：
    在项目根目录下创建 `.env` 文件，并添加以下内容：
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    EMAIL_PASSWORD="YOUR_EMAIL_APP_PASSWORD"
    SENDER_EMAIL="YOUR_SENDER_EMAIL"
    RECEIVER_EMAILS="email1@example.com,email2@example.com" # 逗号分隔的多个邮箱地址
    SMTP_SERVER="smtp.gmail.com"
    SMTP_PORT=587
    ```
    *   `YOUR_GEMINI_API_KEY`：您的 Google Gemini API 密钥。
    *   `YOUR_EMAIL_APP_PASSWORD`：您的发件邮箱的应用程序密码（而非普通登录密码）。对于 Gmail，您需要在 Google 账户安全设置中生成。
    *   `YOUR_SENDER_EMAIL`：您的发件邮箱地址。
    *   `RECEIVER_EMAILS`：收件邮箱地址列表，以逗号分隔。
    *   `SMTP_SERVER`：SMTP 服务器地址（Gmail 默认已配置）。
    *   `SMTP_PORT`：SMTP 服务器端口（Gmail 默认已配置）。

4.  **配置 `config.py`**：
    打开 `config.py` 文件，根据您的需求修改以下配置项：
    *   `ARXIV_QUERY`：arXiv 搜索关键词。
    *   `MAX_RESULTS`：从 arXiv 获取的论文元数据总数（应大于 `MAX_NEW_PAPERS_TO_ANALYZE`）。
    *   `ARXIV_IDS`：可选，特定 arXiv ID 列表。
    *   `ARXIV_CATEGORIES`：可选，arXiv 分类列表。
    *   `MAX_NEW_PAPERS_TO_ANALYZE`：每次运行实际进行深度分析的新论文最大数量。
    *   `DAYS_TO_FETCH_PAPERS`：获取过去多少天内提交的论文（例如，`1` 表示获取昨天一天的论文）。

### 3. 运行项目

项目现在支持两种模式：每日定时摘要和对特定PDF的即时分析。

#### a. 每日定时摘要

此模式会按计划抓取、分析并发送最新的 arXiv 论文摘要。

1.  **手动运行一次 (用于测试或即时执行)**：
    ```bash
    python main.py
    ```
    脚本会立即执行一次 `job()` 函数，然后进入调度循环。

2.  **定时调度运行**：
    脚本启动后，会根据 `schedule.every().day.at("08:00").do(job)` 的设置，在每天的指定时间（例如早上8点）自动运行 `job()` 函数。您需要保持脚本运行，或者将其配置为系统服务以实现后台持续调度。

#### b. 分析指定的PDF

您可以直接分析来自本地文件路径或URL的单个PDF文件。

*   **分析本地PDF文件**：
    ```bash
    python main.py --pdf /path/to/your/paper.pdf
    ```

*   **分析来自URL的PDF文件**：
    ```bash
    python main.py --pdf http://example.com/paper.pdf
    ```
脚本将直接分析指定的PDF，并将分析结果发送到您配置的邮箱。

### 4. 文件说明

*   `main.py`：项目主入口，负责调度、协调论文获取、分析和邮件发送流程。
*   `arxiv_fetcher.py`：负责从 arXiv API 获取论文元数据，进行初步筛选和相关性打分，并提供 PDF 下载功能。
*   `gemini_analyzer.py`：封装了 Google Gemini API 调用，用于论文相关性评分和深度内容分析。
*   `email_sender.py`：负责格式化分析结果为 HTML 邮件，并发送邮件。
*   `config.py`：项目所有可配置参数的定义文件。
*   `requirements.txt`：项目依赖库列表。
*   `analyzed_papers.txt`：记录已分析论文的 ID、标题和相关性分数，用于去重和缓存。

## 项目核心驱动
**Powered By Gemini**
