const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

module.exports = {
  read: (cypher, params = {}) => {
    const session = driver.session();
    return session.run(cypher, params).finally(() => session.close());
  },
  write: (cypher, params = {}) => {
    const session = driver.session();
    return session.run(cypher, params).finally(() => session.close());
  },
  close: () => driver.close()
};
