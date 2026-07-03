const neo4j = require('neo4j-driver');
require('dotenv').config();

// Graceful no-op stubs when Neo4j is not configured
const noopDriver = {
  read: async () => ({ records: [] }),
  write: async () => ({ records: [] }),
  close: () => {}
};

if (!process.env.NEO4J_URI) {
  console.warn('⚠️ NEO4J_URI is not set in .env — Graph RAG features will be disabled.');
  module.exports = noopDriver;
} else {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  module.exports = {
    read: async (cypher, params = {}) => {
      const session = driver.session();
      try {
        return await session.run(cypher, params);
      } catch (err) {
        console.warn(`⚠️ [Neo4j] Query failed (Aura DB may be paused or unreachable): ${err.message}`);
        return { records: [] };
      } finally {
        await session.close();
      }
    },
    write: async (cypher, params = {}) => {
      const session = driver.session();
      try {
        return await session.run(cypher, params);
      } catch (err) {
        console.warn(`⚠️ [Neo4j] Write failed: ${err.message}`);
        return { records: [] };
      } finally {
        await session.close();
      }
    },
    close: () => driver.close()
  };
}
