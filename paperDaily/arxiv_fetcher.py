import arxiv
import requests
import fitz  # PyMuPDF
from datetime import datetime, timedelta
from config import ARXIV_QUERY, MAX_RESULTS, ARXIV_IDS, ARXIV_CATEGORIES, DAYS_TO_FETCH_PAPERS
from gemini_analyzer import score_paper_relevance
from tqdm import tqdm

def _download_and_extract_text(pdf_url):
    """
    Downloads a PDF and extracts text from it.
    """
    try:
        response = requests.get(pdf_url, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        # Open the PDF from the in-memory content
        with fitz.open(stream=response.content, filetype="pdf") as doc:
            text = ""
            for page in doc:
                text += page.get_text()
        return text
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {pdf_url}: {e}")
        return None
    except Exception as e:
        print(f"Error processing PDF from {pdf_url}: {e}")
        return None

def fetch_latest_papers(analyzed_papers_info: dict = None):
    """
    Fetches the latest papers from arXiv, gets their metadata, and scores their relevance.
    PDF content is NOT downloaded at this stage.
    Prioritizes fetching by specific arXiv IDs, then by categories, and finally by query.
    """
    if analyzed_papers_info is None:
        analyzed_papers_info = {}

    base_query = []

    # Add date range filter
    if DAYS_TO_FETCH_PAPERS > 0:
        today_midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = today_midnight - timedelta(days=DAYS_TO_FETCH_PAPERS)
        end_date = today_midnight - timedelta(seconds=1) # End of yesterday
        date_query = f"submittedDate:[{start_date.strftime('%Y%m%d%H%M%S')} TO {end_date.strftime('%Y%m%d%H%M%S')}]"
        base_query.append(date_query)

    if ARXIV_IDS:
        print(f"Fetching papers by IDs: {ARXIV_IDS}")
        search = arxiv.Search(
            id_list=ARXIV_IDS,
            max_results=MAX_RESULTS,
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )
        results = list(search.results())
        if DAYS_TO_FETCH_PAPERS > 0:
            results = [r for r in results if start_date <= r.published.replace(tzinfo=None) <= end_date.replace(tzinfo=None)]

    elif ARXIV_CATEGORIES:
        category_query_str = " OR ".join([f"cat:{cat}" for cat in ARXIV_CATEGORIES])
        if base_query:
            final_query = f"({' AND '.join(base_query)}) AND ({category_query_str})"
        else:
            final_query = category_query_str
        print(f"Fetching papers by categories: {ARXIV_CATEGORIES} (Query: {final_query})")
        search = arxiv.Search(
            query=final_query,
            max_results=MAX_RESULTS,
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )
        results = search.results()
    else:
        if base_query:
            final_query = f"({' AND '.join(base_query)}) AND ({ARXIV_QUERY})"
        else:
            final_query = ARXIV_QUERY
        print(f"Fetching papers by query: {ARXIV_QUERY} (Query: {final_query})")
        search = arxiv.Search(
            query=final_query,
            max_results=MAX_RESULTS,
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )
        results = search.results()

    papers_metadata = []
    tqdm_results = tqdm(results, desc="Fetching paper metadata and scoring relevance")
    for result in tqdm_results:
        arxiv_id = result.entry_id.split('/')[-1]
        tqdm_results.set_postfix(title=result.title, id=arxiv_id, refresh=True)
        if arxiv_id in analyzed_papers_info:
            # Use stored relevance score if available
            _, relevance_score = analyzed_papers_info[arxiv_id]
            print(f"  Using stored relevance score for '{result.title}' (ID: {arxiv_id}): {relevance_score}")
        else:
            relevance_score = score_paper_relevance(result.title, result.summary)
            print(f"  Scored relevance for '{result.title}' (ID: {arxiv_id}): {relevance_score}")

        papers_metadata.append({
            'arxiv_id': arxiv_id,
            'title': result.title,
            'summary': result.summary,
            'pdf_url': result.pdf_url,
            'published': result.published,
            'relevance_score': relevance_score,
            'authors': [author.name for author in result.authors] # Extract author names
        })
    
    papers_metadata.sort(key=lambda x: (x['relevance_score'], x['published']), reverse=True)
    
    return papers_metadata

if __name__ == '__main__':
    latest_papers_metadata = fetch_latest_papers({}) # Pass an empty dict for testing
    for paper in latest_papers_metadata:
        print(f"Title: {paper['title']}"
              f"URL: {paper['pdf_url']}"
              f"Relevance Score: {paper.get('relevance_score', 'N/A')}"
              f"Published Date: {paper.get('published', 'N/A')}")