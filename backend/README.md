---
title: LexGuard AI Backend
emoji: ⚖️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
---

# LexGuard Backend API

This backend is containerized via Docker and runs autonomously on Hugging Face Spaces.
Analysis jobs are queued in Redis (Upstash) when it is reachable, with MongoDB polling as the fallback.
