// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
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
  blastStandaloneUrl: "https://pg2.cs.bilkent.edu.tr/blast",
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
