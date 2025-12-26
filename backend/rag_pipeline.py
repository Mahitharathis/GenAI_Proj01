# rag_pipeline.py
import os
import shutil
from PyPDF2 import PdfReader
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
# RetrievalQA import removed - using direct retriever approach

UPLOAD_DIR = "uploaded_docs"
VECTOR_DIR = "vector_store"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VECTOR_DIR, exist_ok=True)

# Global vectorstore variable
vectorstore = None


def extract_text(file_path: str) -> str:
    """Extract text from PDF or TXT file."""
    if file_path.endswith(".pdf"):
        pdf = PdfReader(file_path)
        return "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
    elif file_path.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        raise ValueError("Unsupported file format. Use PDF or TXT.")


def create_vector_store(text: str):
    """Create Chroma vector store from text."""
    global vectorstore
    
    try:
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = splitter.create_documents([text])
        
        # Check if OpenAI API key is available
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY is required for embeddings. Please set it in .env file.")
        
        embeddings = OpenAIEmbeddings()
        store = Chroma.from_documents(docs, embeddings, persist_directory=VECTOR_DIR)
        # Note: persist() method has been removed in newer Chroma versions
        # The data is automatically persisted when using persist_directory
        
        # Update global vectorstore
        vectorstore = store
        print(f"✅ Vector store created with {len(docs)} documents.")
        return store
        
    except Exception as e:
        print(f"❌ Error creating vector store: {e}")
        raise


def load_vector_store():
    """Load an existing vector store if available."""
    try:
        if os.path.exists(VECTOR_DIR) and os.listdir(VECTOR_DIR):
            if not os.getenv("OPENAI_API_KEY"):
                print("⚠️ Warning: OPENAI_API_KEY not found for loading vector store.")
                return None
            embeddings = OpenAIEmbeddings()
            return Chroma(persist_directory=VECTOR_DIR, embedding_function=embeddings)
    except Exception as e:
        print(f"❌ Error loading vector store: {e}")
    return None


def process_pdf(uploaded_file) -> str:
    """Save uploaded file and return text."""
    file_path = os.path.join(UPLOAD_DIR, uploaded_file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(uploaded_file.file, buffer)
    text = extract_text(file_path)
    return text


def query_rag(query: str):
    """Query the vector store with natural language."""
    global vectorstore
    
    # Try to use global vectorstore first, then load from disk
    current_store = vectorstore or load_vector_store()
    if not current_store:
        return "No documents found. Please upload a file first."

    # Get relevant documents
    retriever = current_store.as_retriever(search_kwargs={"k": 5})
    try:
        # Try the new invoke method first
        docs = retriever.invoke(query)
    except AttributeError:
        # Fallback to older method if invoke doesn't exist
        docs = retriever.get_relevant_documents(query)
    
    if not docs:
        return "No relevant documents found for your query."
    
    # Create context from retrieved documents
    context = "\n\n".join([doc.page_content for doc in docs])
    
    # Check if OpenAI API key is available
    if not os.getenv("OPENAI_API_KEY"):
        return f"Context found:\n{context}\n\n⚠️ Note: OpenAI API key not configured for LLM response."
    
    # Use ChatOpenAI to generate answer
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    prompt = f"Answer the question based on the following context:\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    
    try:
        # Try the new invoke method first
        try:
            response = llm.invoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)
        except AttributeError:
            # Fallback to older predict method
            response = llm.predict(prompt)
            return response
    except Exception as e:
        return f"Error generating response: {str(e)}\n\nContext:\n{context}"
