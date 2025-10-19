import schedule

import time

from datetime import datetime

from arxiv_fetcher import fetch_latest_papers, _download_and_extract_text

from gemini_analyzer import analyze_paper_content

from email_sender import send_email, format_papers_to_html

from config import MAX_NEW_PAPERS_TO_ANALYZE

import os

from tqdm import tqdm

ANALYZED_PAPERS_FILE = "/Users/smiletm/Documents/code/playground/leetcode/paperDaily/analyzed_papers.txt"


def _load_analyzed_papers_info():
    """Loads the info (ID, title, relevance score) of already analyzed papers."""

    analyzed_info = {}

    if os.path.exists(ANALYZED_PAPERS_FILE):

        with open(ANALYZED_PAPERS_FILE, 'r') as f:

            for line in f:

                line = line.strip()

                if line:

                    parts = line.split(',', 2)  # Split into at most 3 parts

                    if len(parts) == 3:

                        arxiv_id, title, relevance_score_str = parts

                        try:

                            relevance_score = int(relevance_score_str)



                        except ValueError:

                            relevance_score = 0  # Default if score is not a valid integer

                        analyzed_info[arxiv_id] = (title, relevance_score)



                    elif len(parts) == 2:  # Handle older format (ID, Title) without score

                        arxiv_id, title = parts

                        analyzed_info[arxiv_id] = (title, 0)  # Default score for older entries



                    elif len(parts) == 1:  # Handle even older format (ID) without title or score

                        arxiv_id = parts[0]

                        analyzed_info[arxiv_id] = ('Unknown Title', 0)

    return analyzed_info


def _save_analyzed_paper_info(arxiv_id, title, relevance_score):
    """

    Saves a new arXiv ID, title, and relevance score to the list of analyzed papers.



    """

    with open(ANALYZED_PAPERS_FILE, 'a') as f:
        f.write(f"{arxiv_id},{title},{relevance_score}\n")

def job():
    print(f"Running job at {datetime.now()}...")
    

    analyzed_papers_info = _load_analyzed_papers_info()
    existing_analyzed_paper_ids = set(analyzed_papers_info.keys())
    print(f"Loaded {len(existing_analyzed_paper_ids)} previously analyzed paper IDs.")

    # 1. Fetch paper metadata and score relevance
    print("Fetching latest paper metadata from arXiv and scoring relevance...")
    papers_metadata = fetch_latest_papers(analyzed_papers_info)
    if not papers_metadata:
        print("No new papers found.")
        return

    print(f"Found {len(papers_metadata)} papers from arXiv (metadata only).")

    # Filter out already analyzed papers and select top N new papers
    new_papers_to_consider = []
    for paper in papers_metadata:
        if paper['arxiv_id'] not in existing_analyzed_paper_ids:
            new_papers_to_consider.append(paper)
        else:
            print(f"  Skipping already analyzed paper: '{paper['title']}' (ID: {paper['arxiv_id']})")

    if not new_papers_to_consider:
        print("No new papers to analyze after filtering.")
        return

    # Select top N new papers based on relevance (already sorted by fetch_latest_papers)
    new_papers_to_analyze = new_papers_to_consider[:MAX_NEW_PAPERS_TO_ANALYZE]
    print(f"Selected {len(new_papers_to_analyze)} top new papers for detailed analysis.")

    # 2. Download PDFs and Analyze papers
    print("Downloading PDFs and analyzing papers with Gemini (this may take a while)...")
    analyzed_papers = []
    for i, paper in enumerate(tqdm(new_papers_to_analyze, desc="Analyzing papers")):
        print(f"  ({i + 1}/{len(new_papers_to_analyze)}) Downloading PDF for '{paper['title']}'")
        content = _download_and_extract_text(paper['pdf_url'])
        if content:
            print(f"  ({i + 1}/{len(new_papers_to_analyze)}) Analyzing '{paper['title']}' (ID: {paper['arxiv_id']})")
            analysis = analyze_paper_content(content)
            
            analyzed_papers.append({
                **paper,
                'content': content, # Add content for completeness if needed later
                'analysis': analysis
            })
            _save_analyzed_paper_info(paper['arxiv_id'], paper['title'], paper['relevance_score'])
        else:
            print(f"  Skipping analysis for '{paper['title']}' due to PDF download failure.")
    
    if analyzed_papers:
        print(f"Successfully analyzed {len(analyzed_papers)} new papers.")
    else:
        print("No new papers were analyzed in this run.")
        return

    # 3. Format and send email
    print("Formatting email...")
    subject = f"Daily arXiv Digest: Top {len(analyzed_papers)} New Papers - {datetime.now().strftime('%Y-%m-%d')}"
    html_content = format_papers_to_html(analyzed_papers)

    print("Sending email...")
    send_email(subject, html_content)
    print("Job finished.")


if __name__ == "__main__":
    # Schedule the job every day at a specific time, e.g., 8:00 AM
    schedule.every().day.at("08:00").do(job)
    
    print("Scheduler started. Waiting for the scheduled time...")
    
    # Run once immediately for testing
    job()

    while True:
        schedule.run_pending()
        time.sleep(1)
