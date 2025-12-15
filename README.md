# PanGenoGrapher (PG2) - visual analyzer for pan genomes via graphs

PanGenoGrapher is a web-based tool for analyzing pan-genome graphs visually. The tool is based on [Visu*all*](https://github.com/ugurdogrusoz/visuall), which in turn is based on the [Cytoscape.js](http://js.cytoscape.org) library.

A sample demo deployment can be found [here](http://ivis.cs.bilkent.edu.tr:5200/). Below is a sample screenshot from PG2. A demo video highlighting PG2 features can be found [here](https://www.youtube.com/watch?v=yCd7-aGY6CQ).

<img width="2401" height="1918" alt="image" src="https://github.com/user-attachments/assets/cb16cca7-be78-4dd0-8bf0-995427c187bf" />

### How to Cite Usage

Please cite the following when you use PG2:

G.K. Solun, U. Dogrusoz, Z. Bingol and C. Alkan, *"PG2: algorithms and a web-based tool for effective layout and visual analysis of pangenome graphs"*, under revision, 2025.

## Running a local instance

`docker compose up prod` starts the production build using Docker.

`docker compose up dev` starts the development build using Docker.

Use Node.js version 14.20.1.

`npm install` installs the dependencies.

`npm run ng serve` starts the server for development and debugging.

`npm run serve-public` makes the development server accessible over the network.

`npm run ng build` generates a production build. `npm run build-prod` generates a minified, uglified production build.

The `npm run ng build` and `npm run build-prod` commands generate files inside the `dist/ng-visuall` folder. These files should be served by an HTTP server. You can use [server.js](server.js) to run a server with the command `node server.js`.

Run `cd src` followed by `node style-generator.js {application description filename}` to generate a customized application. This updates [styles.css](src/styles.css) and [index.html](src/index.html). Note that the application description file must be located in the `assets` folder.

Run `cd src/app/blast` and `node blast.js` to run the BLAST server. This allows the application to process BLAST queries. Note that the BLAST standalone must be installed beforehand.

## User Guide

A User Guide for the sample application of PanGenoGrapher can be found [here](https://docs.google.com/document/d/1mcU4-yAy6IvdUOxchygTyjTWp144sjvDrJE_gzmAbmA).

## Credits

Icons made by [Freepik](http://www.freepik.com),
[Daniel Bruce](http://www.flaticon.com/authors/daniel-bruce),
[TutsPlus](http://www.flaticon.com/authors/tutsplus),
[Robin Kylander](http://www.flaticon.com/authors/robin-kylander),
[Catalin Fertu](http://www.flaticon.com/authors/catalin-fertu),
[Yannick](http://www.flaticon.com/authors/yannick),
[Icon Works](http://www.flaticon.com/authors/icon-works),
[Flaticon](http://www.flaticon.com) and licensed with
[Creative Commons BY 3.0](http://creativecommons.org/licenses/by/3.0/)

Third-party libraries:
[Cytoscape.js](https://github.com/cytoscape/cytoscape.js) and many of its extensions,
[Angular](https://angular.io/),
[Google Charts](https://developers.google.com/chart/) and npm dependencies inside package.json file.

For the database, it uses the free and openly available Neo4j database. To use advanced queries, a plugin in `src/assets/` named `advanced-queries-0.0.1.jar` must be present in the Neo4j plugins folder.

## Team

[Gorkem Kadir Solun](https://github.com/gorkemsolun), [Ugur Dogrusoz](https://github.com/ugurdogrusoz), [Zulal Bingol](https://github.com/zulal-b) and [Can Alkan](https://github.com/calkan)

PG2 is a collaborative project by [i-Vis Research Lab](http://www.cs.bilkent.edu.tr/~ivis/) and [Alkan Lab](https://www.alkanlab.org/) at Bilkent University.
