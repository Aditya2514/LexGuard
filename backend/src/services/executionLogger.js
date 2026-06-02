const mongoose = require('mongoose');

class ExecutionLogger {
  constructor(contractId) {
    this.contractId = contractId;
    this.startTime = Date.now();
    this.trace = {
      contractId: contractId,
      timestamp: new Date().toISOString(),
      total_latency_ms: 0,
      graph_metrics: {
        neo4j_calls: 0,
        edges_traversed: 0,
        circuit_breaker_tripped: false
      },
      token_metrics: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0
      },
      agent_cascade: []
    };
  }

  logAgentStep(agentName, tokensUsed = 0, latency = 0) {
    this.trace.agent_cascade.push({
      agent: agentName,
      timestamp: new Date().toISOString(),
      latency_ms: latency
    });
    this.trace.token_metrics.total_tokens += tokensUsed;
  }

  logGraphTraversal(edgesCount, fallbackTriggered = false) {
    this.trace.graph_metrics.neo4j_calls += 1;
    this.trace.graph_metrics.edges_traversed += edgesCount;
    if (fallbackTriggered) {
      this.trace.graph_metrics.circuit_breaker_tripped = true;
    }
  }

  async finalize() {
    this.trace.total_latency_ms = Date.now() - this.startTime;
    
    // 1. Unified Structured Log output for cloud monitoring
    console.log(JSON.stringify({ type: "EXECUTION_TRACE", ...this.trace }, null, 2));

    // 2. Pluggable Database Commit (Optional hook for internal storage)
    try {
      if (mongoose.connection.readyState === 1) {
        // Uncomment to persist logs automatically if required in future
        // await mongoose.connection.collection('execution_traces').insertOne(this.trace);
      }
    } catch (err) {
      console.error("🔴 Telemetry DB persistence failed:", err.message);
    }
  }
}

class ExecutionLoggerManager {
  constructor() {
    this.loggers = new Map();
  }

  createLogger(contractId) {
    const logger = new ExecutionLogger(contractId);
    this.loggers.set(contractId.toString(), logger);
    return logger;
  }

  getLogger(contractId) {
    return this.loggers.get(contractId.toString());
  }

  removeLogger(contractId) {
    this.loggers.delete(contractId.toString());
  }
}

module.exports = {
  ExecutionLogger,
  loggerManager: new ExecutionLoggerManager()
};
