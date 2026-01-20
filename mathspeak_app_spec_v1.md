# MathSpeak — App Specification (v1)

## Overview
MathSpeak is a quiz/flashcard application designed to help young children practice basic math by answering questions **out loud**. The app displays a math prompt, listens to the child’s spoken response, validates correctness using speech recognition, and tracks performance based on **speed and accuracy**.

The design emphasizes:
- Low-latency interaction
- Clean, distraction-minimal UI
- Parent-controlled content
- Forward compatibility with web and Kindle platforms

---

## Target Audience
- **Age range:** Early elementary (approx. 5–8)
- **Primary user:** Child
- **Secondary user:** Parent (content creation, review)

---

## Core Features

### 1. Question Types (v1)
- **Single-digit arithmetic**
  - Addition
  - Subtraction
  - Multiplication
  - Division (where results are whole numbers)
- **Number identification**
  - App displays a number (e.g., `1,234`)
  - Child reads the number aloud (e.g., “one thousand two hundred thirty four”)
  - Accepts variants with/without “and”

---

### 2. Speech-Based Answering
- Child answers verbally; no typing required
- Optimized for **low latency**
- Grading logic supports:
  - Homophones (“four” / “for”)
  - Minor speech recognition variance
  - Numeric normalization (spoken words → numeric value)
- Exact numeric correctness required after normalization

---

### 3. Deck System
- **Decks** are parent-created collections of cards
- Decks are **static** (fixed set of questions)
- Each deck includes:
  - Name
  - Question type(s)
  - Ordered or fixed list of cards

---

### 4. Timing & Scoring
- **Best Time**:
  - Total elapsed time to complete all cards in a deck
- Timer:
  - Starts on first question
  - Stops when final card is answered correctly
- Mistakes:
  - Child must retry until correct
  - Timer continues running during retries
- Best time is saved per deck

---

### 5. Progress & Feedback
- Subtle gamification only
- **XP Counter**
  - Located bottom-left
  - +1 XP per correct answer
  - Small visual “ping” animation
- **Timer**
  - Located bottom-right
  - Always visible during a run
- No streaks, leaderboards, or complex rewards in v1

---

## User Model & Data

### Child Profile (v1)
- Single child per device
- Stored locally

### Forward Compatibility
- Data model should support:
  - Multiple child profiles per device
  - Per-child deck performance tracking
- No UI for profile switching required in v1

---

## UI / UX Principles
- High-contrast black-and-white design
- Large, readable typography
- Minimal on-screen elements
- No ads
- No external links
- Focus on:
  - Question
  - Timer
  - XP feedback

---

## Platform Strategy

### Primary Goal
- **Single codebase** capable of deployment as:
  - Web app (desktop & tablet)
  - Kindle app (future)

### Architectural Implications
- Avoid platform-specific UI assumptions
- Abstract:
  - Speech recognition layer
  - Storage layer
- Touch-first interaction model
- Offline-first where possible

---

## Non-Goals (v1)
- Multiplayer or competitive features
- Teacher dashboards
- Analytics beyond best time
- Account login or cloud sync

---

## Open for v2+
- Multiple child profiles
- Dynamic deck generation
- Difficulty scaling
- Cloud sync
- Expanded math curriculum
