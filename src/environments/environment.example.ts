export const environment = {
  production: false,
  dbConfig: {
    urls: [
      "http://your-server-host:PORT/db/neo4j/tx/commit"
    ],
    username: "your-neo4j-username",
    password: "your-neo4j-password",
  },
  blastStandaloneUrl: "http://your-server-host:5205",
};
