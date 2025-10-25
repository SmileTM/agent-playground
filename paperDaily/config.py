
import os
from dotenv import load_dotenv

load_dotenv()

# arXiv search settings
ARXIV_QUERY = '"large language model" OR "LLM" OR "transformer" OR "natural language processing" OR "NLP" OR "artificial intelligence" OR "AI" OR "reinforcement learning" OR "world model" OR "visual pre-training" OR "ViT" OR "Vision-Language-Action Model"'
MAX_RESULTS = 20
ARXIV_IDS = [] # Optional: List of specific arXiv IDs to fetch, e.g., ["2301.00001", "2302.00002"]
ARXIV_CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG', 'stat.ML'] # Optional: List of arXiv categories to filter by
MAX_NEW_PAPERS_TO_ANALYZE = 5 # Maximum number of *new* papers to analyze in a single run
DAYS_TO_FETCH_PAPERS = 7 # Number of days back from the current date to fetch papers (e.g., 1 for yesterday and today)

# Email settings loaded from environment variables
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
RECEIVER_EMAILS_STR = os.getenv("RECEIVER_EMAILS")
RECEIVER_EMAIL = [email.strip() for email in RECEIVER_EMAILS_STR.split(',')] if RECEIVER_EMAILS_STR else []
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Gemini API settings loaded from environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
