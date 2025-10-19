
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re
from config import SENDER_EMAIL, RECEIVER_EMAIL, EMAIL_PASSWORD, SMTP_SERVER, SMTP_PORT

def send_email(subject, html_content):
    """
    Sends an email with the given subject and HTML content.
    """
    if not SENDER_EMAIL or SENDER_EMAIL == "your_email@gmail.com":
        print("Email not sent. Please configure sender and receiver emails in config.py")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = SENDER_EMAIL
    message["To"] = ", ".join(RECEIVER_EMAIL) # Join multiple recipients with a comma

    # Attach HTML content
    message.attach(MIMEText(html_content, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SENDER_EMAIL, EMAIL_PASSWORD)
            server.sendmail(SENDER_EMAIL, RECEIVER_EMAIL, message.as_string()) # Pass the list of receivers
        print("Email sent successfully!")
    except Exception as e:
        print(f"Failed to send email: {e}")

def format_papers_to_html(analyzed_papers):
    """
    Formats the list of analyzed papers into an HTML string, converting markdown-like syntax to HTML.
    """
    html = "<html><head><style>body { font-family: sans-serif; } h1, h2, h3 { color: #333; } a { color: #1a73e8; text-decoration: none; } hr { border: 0; border-top: 1px solid #eee; }</style></head><body><h1>Daily arXiv Paper Digest</h1>"
    for i, paper in enumerate(analyzed_papers):
        html += f"<h2>{i+1}. <a href='{paper['pdf_url']}'>{paper['title']}</a> (Relevance Score: {paper.get('relevance_score', 'N/A')})</h2>"
        if paper.get('authors'):
            html += f"<p><strong>Authors:</strong> {', '.join(paper['authors'])}</p>"
        html += "<h3>Summary:</h3>"
        html += f"<p>{paper['summary']}</p>"
        html += "<h3>Gemini Analysis:</h3>"
        
        analysis_content = paper['analysis']
        
        # Convert markdown bold to HTML strong
        analysis_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', analysis_content)
        
        # Convert markdown headings to HTML headings (more robustly)
        def replace_heading(match):
            num_hashes = len(match.group(1))
            content = match.group(2).strip()
            if num_hashes == 1:
                return f'<h1>{content}</h1>'
            elif num_hashes == 2:
                return f'<h2>{content}</h2>'
            elif num_hashes == 3:
                return f'<h3>{content}</h3>'
            else: # For more than 3 hashes, default to h3
                return f'<h3>{content}</h3>'

        analysis_content = re.sub(r'^(#+)\s*(.*)$', replace_heading, analysis_content, flags=re.MULTILINE)

        # Convert markdown unordered lists to HTML ul/li
        # This is a bit more complex as it needs to handle multiple lines.
        # A simple approach: replace leading '* ' with <li> and wrap in <ul>
        lines = analysis_content.split('\n')
        formatted_lines = []
        in_list = False
        for line in lines:
            if line.strip().startswith('- ') or line.strip().startswith('* '):
                if not in_list:
                    formatted_lines.append('<ul>')
                    in_list = True
                formatted_lines.append(f'<li>{line.strip()[2:].strip()}</li>')
            else:
                if in_list:
                    formatted_lines.append('</ul>')
                    in_list = False
                if line.strip(): # Only add non-empty lines as paragraphs
                    formatted_lines.append(f'<p>{line.strip()}</p>')
                else: # Preserve empty lines for spacing
                    formatted_lines.append('<br>')
        if in_list: # Close list if it was open at the end
            formatted_lines.append('</ul>')
        
        analysis_html = '\n'.join(formatted_lines)
        
        html += f"<div>{analysis_html}</div>"
        html += "<hr>"
    html += "</body></html>"
    return html

if __name__ == '__main__':
    # Example usage
    test_papers = [
        {
            'title': 'Test Paper 1',
            'summary': 'This is a test summary.',
            'pdf_url': 'http://example.com/test1.pdf',
            'analysis': '**Highlights**\n- Point 1\n- Point 2\n\n**Concrete Work**\n- Method A\n- Experiment B'
        }
    ]
    html_body = format_papers_to_html(test_papers)
    # To test, you would call send_email here, but we'll just print
    print("Generated HTML:\n", html_body)
    # send_email("Test Daily Papers", html_body) # Uncomment to test sending
