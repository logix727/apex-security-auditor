# LLM Sequence Analysis Plan: Behavioral AI & Logic Flaw Detection

## 🎯 Objective

Leverage Large Language Models (LLMs) to analyze *sequences* of API requests/responses to detect sophisticated business logic flaws that static pattern matching (regex) and single-request analysis miss.

## 🧠 Core Problem

Current detectors suffer from:

1. **Contextual Blindness**: They analyze requests in isolation, missing vulnerabilities that only appear across multiple steps (e.g., using a leaked token from Request A in Request B).
2. **Logic Flaw Detection**: They rely on static signatures, failing to identify complex logic abuse like price manipulation, race conditions, or broken access control (IDOR) that requires understanding the business domain.

## 🏗️ Proposed Architecture

### 1. Sequence Capture & Session Management

To analyze sequences, we must first define and capture them.

- **Session Grouping**: Group requests by `Session ID`, `User Flow`, or time window.
- **Context Window**: Maintain a rolling window of the last *N* requests/responses (e.g., last 5-10 interactions) to feed into the LLM.
- **Data Structure**:

  ```json
  {
    "sequence_id": "uuid",
    "timestamp": "2023-10-27T10:00:00Z",
    "flow_name": "Checkout Process",
    "steps": [
      { "id": 1, "method": "POST", "url": "/api/cart", "body": "...", "response_code": 200, "response_body": "..." },
      { "id": 2, "method": "POST", "url": "/api/checkout", "body": "...", "response_code": 200, "response_body": "..." }
    ]
  }
  ```

### 2. LLM Integration Strategy

We will use an LLM (currently Phi 3.5 or an external larger model if needed) to act as a "Virtual Security Analyst".

#### A. Contextual Blindness Resolver

*Goal: Connect the dots between requests.*

- **Mechanism**: Feed the LLM a summary of the previous request's *outputs* (leaked tokens, IDs, sensitive data) and the current request's *inputs*.
- **Prompt Strategy**:
  > "Review this sequence of 3 requests. Did Request #2 use any sensitive data returned in Request #1? Was it used securely?"

#### B. Logic Flaw Detection

*Goal: Identify business rule violations.*

- **Mechanism**: Ask the LLM to infer the business logic from the `flow_name` and the request sequence, then check for violations.
- **Target Vulnerabilities**:
  - **Price Manipulation**: "Check if the 'price' or 'total' field in the checkout request matches the sum of items from the cart request."
  - **Race Conditions**: "Identify if two requests in this sequence modify the same resource in a way that suggests a race condition if sent in parallel."
  - **IDOR / Broken Access Control**: "Did the user ID in the URL change between requests without a corresponding change in authorization token?"
  - **State Inconsistency**: "Did the order status jump from 'Pending' to 'Shipped' without a 'Payment' step?"

### 3. Implementation Phases

#### Phase 2.1: Data Structure & Collection

- [ ] Define `RequestSequence` struct in Rust.
- [ ] Update `Inspector` or `Proxy` to tag requests with a `SessionID`.
- [ ] Implement a "Sequence Buffer" that stores the last *N* requests.

#### Phase 2.2: The "vAnalyst" Prompt Engine

- [ ] Develop system prompts for "Logic Analysis".
- [ ] Create a prompt template builder that dynamically inserts request/response pairs.
- [ ] Optimization: Truncate large response bodies (keep keys, remove long arrays/strings) to fit validation context windows.

#### Phase 2.3: UI & Feedback Loop

- [ ] Add a "Analyze Flow" button in the Inspector.
- [ ] Display findings not just as "Vulnerability detected" but as a narrative: "Potential Price Manipulation: Request #3 sent a price of 0.01, but Request #1 listed the item at 10.00."

## 🔬 Validation Strategy

1. **Synthetic Test Cases**: Create recorded sequences of:
   - A valid checkout flow.
   - A checkout flow with price tampering.
   - A login flow with a leaked token reused by an attacker.
2. **Benchmark**: Run the LLM analyzer against these known bad sequences and measure detection rate.
