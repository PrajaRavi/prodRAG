
```
ProductionRAGFromScratch
├─ backend
│  ├─ .env
│  ├─ .logfire
│  │  └─ logfire_credentials.json
│  ├─ app
│  │  ├─ agents
│  │  │  ├─ Main_agent
│  │  │  │  ├─ graph.py
│  │  │  │  ├─ nodes
│  │  │  │  │  ├─ decision.py
│  │  │  │  │  ├─ genrator.py
│  │  │  │  │  ├─ retriever.py
│  │  │  │  │  ├─ router.py
│  │  │  │  │  └─ __init__.py
│  │  │  │  ├─ state.py
│  │  │  │  └─ __init__.py
│  │  │  └─ __init__.py
│  │  ├─ config.py
│  │  ├─ DB
│  │  │  └─ database.py
│  │  ├─ genrator
│  │  │  └─ __init__.py
│  │  ├─ Ingestion
│  │  │  ├─ chunker
│  │  │  │  ├─ doc_chunker.py
│  │  │  │  └─ __init__.py
│  │  │  ├─ pdfloder
│  │  │  │  ├─ loader.py
│  │  │  │  └─ __init__.py
│  │  │  ├─ processor.py
│  │  │  ├─ txtloader
│  │  │  │  ├─ loader.py
│  │  │  │  └─ __init__.py
│  │  │  ├─ vectorstore
│  │  │  │  ├─ pinecone_service.py
│  │  │  │  └─ __init__.py
│  │  │  └─ __init__.py
│  │  ├─ main.py
│  │  └─ __init__.py
│  ├─ assets
│  │  ├─ DBMS_Full_Notes.pdf
│  │  ├─ second.pdf
│  │  └─ third.pdf
│  ├─ DB
│  │  └─ database.py
│  ├─ README.md
│  ├─ requirement.txt
│  ├─ services
│  │  └─ llms.py
│  └─ utils
│     ├─ prompts.py
│     └─ utils.py
└─ frontend

```