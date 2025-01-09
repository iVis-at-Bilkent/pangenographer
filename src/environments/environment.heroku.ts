export const environment = {
  production: true,
  dbConfig: {
    urls: [
      "https://pg2.cs.bilkent.edu.tr/browser/db/neo4j/tx/commit",
      "https://pg2.cs.bilkent.edu.tr/browser/sample1/db/neo4j/tx/commit",
      "https://pg2.cs.bilkent.edu.tr/browser/sample2/db/neo4j/tx/commit",
      "https://pg2.cs.bilkent.edu.tr/browser/sample3/db/neo4j/tx/commit",
      "https://pg2.cs.bilkent.edu.tr/browser/sample4/db/neo4j/tx/commit",
    ],
    username: "neo4j",
    password: "12345678",
  },
  blastStandaloneUrl: "http://ivis.cs.bilkent.edu.tr:5201",
};
