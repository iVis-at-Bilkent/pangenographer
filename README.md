# PanGenoGrapher (PG2) - visual analyzer for pan genomes via graphs

PanGenoGrapher is a web-based tool for analyzing pan-genome graphs visually. The tool is based on [Visu*all*](https://github.com/ugurdogrusoz/visuall), which in turn is based on the [Cytoscape.js](http://js.cytoscape.org) library.

A sample demo deployment can be found [here](http://ivis.cs.bilkent.edu.tr:5200/). Below is a sample screenshot from PG2.

![image](https://github.com/iVis-at-Bilkent/pangenographer/assets/3874988/49608774-9b00-4f7d-a710-d434209d7dda)

## Running a local instance

`npm install` for loading dependencies

`npm run ng serve` for development and debugging

`npm run serve-public` for making development server accesible on network

`npm run ng build` to generate a production build, `npm run build-prod` to generate a minified, uglified production build

`npm run ng build` and `npm run build-prod` commands generate files inside ***dist\ng-visuall*** folder. An HTTP server should serve these files. You should use [server.js](server.js) file to run a server with command `node server.js`.

`cd src` and `node style-generator.js {application description filename}` to generate customized application, this changes [styles.css](src/styles.css) and [index.html](src/index.html). Notice that the application description file is inside the `assets` folder.

`cd src/app/blast` and `node blast.js` to run the BLAST server. This setup allows the application to process BLAST queries. Note that the BLAST standalone must be installed beforehand.

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

For the database, it uses the free and openly available Neo4j database.

## Team

[Gorkem Kadir Solun](https://github.com/gorkemsolun), [Ugur Dogrusoz](https://github.com/ugurdogrusoz), [Zulal Bingol](https://github.com/zulal-b) and [Can Alkan](https://github.com/calkan)

PG2 is a collaborative project by [i-Vis Research Lab](http://www.cs.bilkent.edu.tr/~ivis/) and [Alkan Lab](https://www.alkanlab.org/) at Bilkent University.
