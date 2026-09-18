> citations future updates->regenrate,simplify,shorter,improve

> document intelligance
```

                    ProdRAG
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   Core RAG        UX/Product      Production
        │              │              │
        ├─ Streaming   ├─ Citations   ├─ Rate limiting
        ├─ Hybrid      ├─ Regenerate  ├─ Caching
        ├─ Reranking   ├─ Doc mgmt    ├─ Circuit breaker
        ├─ Rewriting   ├─ Comparison  ├─ Observability
        └─ Multi-query └─ Suggestions └─ Evaluation
                       │
                       ↓
                  Deep Think
                       │
            ┌──────────┴──────────┐
            ↓                     ↓
       Normal RAG           Deep RAG
                             ├─ Planning
                             ├─ Multi retrieval
                             ├─ Evidence
                             └─ Synthesis

```


```
ProductionRAGFromScratch
├─ backend
│  ├─ .dockerignore
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
│  │  ├─ ApiKeyConfig
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
│  │  ├─ user_config.py
│  │  └─ __init__.py
│  ├─ DB
│  │  └─ database.py
│  ├─ Dockerfile
│  ├─ README.md
│  ├─ requirements.txt
│  ├─ services
│  └─ utils
│     ├─ prompts.py
│     └─ utils.py
├─ docker-compose.yaml
├─ frontend
│  ├─ .env
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ favicon.svg
│  │  └─ icons.svg
│  ├─ README.md
│  ├─ src
│  │  ├─ App.css
│  │  ├─ App.tsx
│  │  ├─ assets
│  │  │  ├─ 3dravi.png
│  │  │  ├─ app.png
│  │  │  ├─ clean-clothes.png
│  │  │  ├─ clothing-hanger.png
│  │  │  ├─ iron.png
│  │  │  ├─ logo.png
│  │  │  ├─ logo.svg
│  │  │  ├─ logo1.png
│  │  │  ├─ music
│  │  │  │  ├─ reciver.mp3
│  │  │  │  └─ send.mp3
│  │  │  ├─ react.svg
│  │  │  ├─ sport-shoe.png
│  │  │  ├─ t-shirt.png
│  │  │  └─ washing_machine.png
│  │  ├─ components
│  │  │  ├─ analyze
│  │  │  │  ├─ Apikey.tsx
│  │  │  │  ├─ ChatMessage.tsx
│  │  │  │  ├─ ChatWindow.tsx
│  │  │  │  ├─ conversationList.tsx
│  │  │  │  └─ sidebar.tsx
│  │  │  ├─ layout
│  │  │  │  └─ Navbar.tsx
│  │  │  ├─ MarkdownRenderer.tsx
│  │  │  ├─ ThinkingIndicator.tsx
│  │  │  └─ ui
│  │  │     ├─ button.tsx
│  │  │     ├─ ChatList.tsx
│  │  │     ├─ CircularLoader.tsx
│  │  │     ├─ Input.tsx
│  │  │     └─ processing_Loader.tsx
│  │  ├─ context
│  │  │  └─ Global.tsx
│  │  ├─ data
│  │  │  └─ dummyData.ts
│  │  ├─ index.css
│  │  ├─ main.tsx
│  │  ├─ pages
│  │  │  ├─ Analyze.tsx
│  │  │  ├─ ApiKeyOnBoarding.tsx
│  │  │  ├─ DocumentOnBording.tsx
│  │  │  ├─ landing.tsx
│  │  │  ├─ Login.tsx
│  │  │  ├─ NotFound.tsx
│  │  │  └─ signup.tsx
│  │  ├─ README.md
│  │  ├─ types
│  │  │  └─ index.ts
│  │  └─ utils
│  │     ├─ const.ts
│  │     └─ supabase.ts
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
└─ README.md

```