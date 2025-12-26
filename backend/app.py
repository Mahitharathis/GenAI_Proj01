# app.py
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from rag_pipeline import process_pdf, create_vector_store, query_rag

app = FastAPI(title="RAG API - Document Upload and Query")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins; adjust in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Welcome to the RAG API. Use /upload and /query endpoints."}


@app.post("/upload")
async def upload_doc(file: UploadFile):
    """Upload document and create vector store."""
    try:
        text = process_pdf(file)
        create_vector_store(text)
        return {"status": "success", "message": f"{file.filename} uploaded and indexed."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile):
    """Upload PDF document and create vector store (frontend endpoint)."""
    try:
        text = process_pdf(file)
        create_vector_store(text)
        return {"status": "PDF processed", "message": f"{file.filename} uploaded and indexed.", "tables": []}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Processing failed: {str(e)}"})


@app.post("/query")
async def query_vector(query: str = Form(...)):
    """Query the vector store."""
    try:
        result = query_rag(query)
        return {"query": query, "response": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/query/")
async def query_endpoint(q: str):
    """Query endpoint using GET method with URL parameter (frontend endpoint)."""
    try:
        result = query_rag(q)
        return {"answer": result, "query": q}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Query failed: {str(e)}"})
