from google import genai
from config import GEMINI_API_KEY, ARXIV_QUERY, ARXIV_CATEGORIES
import os
from dotenv import load_dotenv

load_dotenv()

# The new SDK doesn't require a global configure call.
# The API key will be passed during client initialization or read from env.

def _get_search_criteria_string():
    criteria = []
    if ARXIV_QUERY:
        criteria.append(f"关键词: {ARXIV_QUERY}")
    if ARXIV_CATEGORIES:
        criteria.append(f"分类: {', '.join(ARXIV_CATEGORIES)}")
    return "; ".join(criteria) if criteria else "无特定搜索条件"

def score_paper_relevance(title, summary):
    """
    Uses the Gemini API to score a paper's relevance based on its title and summary
    against the predefined search criteria.
    Returns a score between 0 and 100.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
        return 0 # Cannot score without API key

    try:
        model_name = os.getenv("MODEL_NAME", "gemini-2.5-flash")
        client = genai.Client(api_key=GEMINI_API_KEY)
        search_criteria_str = _get_search_criteria_string()

        prompt = f"""
        你是一个专业的AI研究助手。请根据以下搜索条件，评估一篇论文的相关性，并给出一个0到100分的相关性分数。100分表示高度相关，0分表示完全不相关。

        搜索条件: {search_criteria_str}

        论文标题: {title}
        论文摘要: {summary}

        请直接输出一个整数分数，不要包含任何其他文字或解释。
        """
        
        response = client.models.generate_content_stream(
            model=model_name,
            contents=prompt
        )

        full_response = []
        for chunk in response:
            full_response.append(chunk.text)
        
        score_str = "".join(full_response).strip()
        try:
            return int(score_str)
        except ValueError:
            print(f"Warning: Gemini returned non-integer score: {score_str}. Defaulting to 0.")
            return 0

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"An error occurred during Gemini API call for scoring: {e}")
        return 0

def analyze_paper_content(content):
    """
    Uses the Gemini API to analyze a paper's full content.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
        return {
            "highlights": "Gemini API key not configured. Please add it to your .env file.",
            "concrete_work": "No analysis performed."
        }

    try:
        model_name = os.getenv("MODEL_NAME", "gemini-2.5-flash")
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""
        作为一名专业的人工智能大模型AI研究员，请根据提供的论文全文，以严谨、专业的视角，用中文进行深入分析，并**直接输出以下结构化的总结内容，不要包含任何额外的介绍性文字或开场白。**

        论文全文: "{content}"

        请按照以下结构进行分析和总结：

        0.  **作者与机构分析 (Author & Institution Analysis)**:
            *   简要分析论文作者（包括作者邮箱，如果能从全文中提取到）。
            *   简要介绍这篇论文主要来自哪个机构、公司或学校发表。

        1.  **摘要 (Abstract)**:
            *   简要概括论文的核心内容、目标、方法和主要发现。

        2.  **引言 (Introduction)**:
            *   论文的研究背景、动机、试图解决的关键问题。
            *   论文的主要贡献和创新点。

        3.  **相关工作 (Related Work)**:
            *   与现有研究的对比分析，说明本文的独特性和进步。

        4.  **方法论 (Methodology)**:
            *   详细阐述论文提出的核心方法、模型、算法或框架。
            *   说明其关键技术细节和理论基础。

        5.  **实验与结果 (Experiments & Results)**:
            *   描述实验设置、数据集、评估指标。
            *   呈现关键实验结果，并进行初步分析。

        6.  **讨论 (Discussion)**:
            *   对实验结果进行深入解读，分析其意义和局限性。
            *   探讨潜在的影响和未来的研究方向。

        7.  **结论 (Conclusion)**:
            *   总结论文的主要发现和贡献。
            *   重申研究的价值。

        请确保你的回答内容翔实、逻辑清晰、重点突出，并严格遵循上述结构进行输出。
        """
        
        response = client.models.generate_content_stream(
            model=model_name,
            contents=prompt
        )

        full_response = []
        for chunk in response:
            full_response.append(chunk.text)
        
        return "".join(full_response)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"An error occurred during Gemini API call: {e}"

if __name__ == '__main__':
    test_content = "We introduce a new large language model called 'SuperModel' that outperforms GPT-4 on all benchmarks. We trained it on a dataset of 10 trillion tokens and used a novel attention mechanism."
    analysis = analyze_paper_content(test_content)
    print(analysis)