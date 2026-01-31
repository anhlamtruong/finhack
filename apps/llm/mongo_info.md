## User Financial Memory + RAG
> https://youtu.be/bBA9rUdqmgY

### Info
Use **MongoDB Atlas** as our **long-term memory store** for the finance assistant:
- **User Financial Memory**: profile + preferences (risk tolerance, goals, budgets)
- **Rolling summaries**: daily/ weekly/ monthly spending rollups
- **AI insights history**: previous coaching outputs so responses stay consistent over time
- **Knowledge Base (KB)**: policies/FAQs/runbooks stored as docs + metadata
- **Vector Search (RAG)**: embed memory + KB docs and retrieve the most relevant context for each question

### Why 
- Flexible schema for evolving “memory” objects
- Built-in **Atlas Vector Search** for RAG retrieval
- Easy cloud hosting + secure connection via `MONGODB_URI`

---

### Plan from now to Violettt

1) **Create Atlas cluster + DB user + IP allowlist**
   - Get `MONGODB_URI` (SRV string) and put it in `apps/llm/.env`

2) **Define collections + schema conventions**
   - `users`, `memory_rollups`, `insights`, `kb_docs`, `kb_chunks`, `embeddings`

3) **Create indexes**
   - Normal indexes (e.g., `userId`, `createdAt`)
   - Vector index for `kb_chunks.embedding` (Atlas Vector Search)

4) **Ingestion pipeline**
   - Store user events + summaries
   - Load KB docs --> chunk --> embed -->  store in `kb_chunks`

5) **RAG query path**
   - On user message: embed query --> vector search topK --> build prompt with evidence -->  generate coach answer
   - Save the final insight back to Mongo -memory writeback