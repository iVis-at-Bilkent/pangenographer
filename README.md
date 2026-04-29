# PanGenoGrapher (PG2) - visual analyzer for pan genomes via graphs

PanGenoGrapher is a web-based tool for analyzing pan-genome graphs visually. The tool is based on [Visu*all*](https://github.com/ugurdogrusoz/visuall), which in turn is based on the [Cytoscape.js](http://js.cytoscape.org) library.

A sample demo deployment can be found [here](http://ivis.cs.bilkent.edu.tr:5200/). Below is a sample screenshot from PG2. A demo video highlighting PG2 features can be found [here](https://www.youtube.com/watch?v=yCd7-aGY6CQ).

<img width="2401" height="1918" alt="image" src="https://github.com/user-attachments/assets/cb16cca7-be78-4dd0-8bf0-995427c187bf" />

### How to Cite Usage

Please cite the following when you use PG2:

G.K. Solun, U. Dogrusoz, Z. Bingol and C. Alkan, *"PG2: algorithms and a web-based tool for effective layout and visual analysis of pangenome graphs"*, under revision, 2025.

## Database setup and running the application

### Database setup (Neo4j)

Follow these steps to prepare a local Neo4j database for PG2.

1. Install Neo4j (Neo4j Desktop is optional; it may be used, but it is not required).
2. Create a local database with Neo4j version `5.10`.
3. Use password `12345678` for user `neo4j`. If you prefer a different password or username, update [src/environments/environment.ts](src/environments/environment.ts) at `dbConfig`.
4. Install the APOC plugin for the database.
5. Open the database configuration file `neo4j.conf` and comment out this line:

   ```properties
   #dbms.security.procedures.allowlist=apoc.*
   ```

6. Download the custom plugin JAR from:
   `https://github.com/iVis-at-Bilkent/visuall-advanced-query/blob/pangenographer/advanced-queries-0.0.1.jar`
   (this is the same `advanced-queries-0.0.1.jar` file also present under `src/assets/`).
7. Copy `advanced-queries-0.0.1.jar` into the Neo4j database `plugins` folder.
8. Start the Neo4j database.

After startup, PG2 can connect to the local database using the configuration in [src/environments/environment.ts](src/environments/environment.ts).

### Bulk-importing a GFA file into Neo4j

[import_gfa_to_neo4j.py](import_gfa_to_neo4j.py) loads a `.gfa` file directly into Neo4j using the same schema the web app writes. It is significantly faster than importing through the UI for large files.

#### With Docker

[import_gfa_docker.sh](import_gfa_docker.sh) builds a one-shot image from [Dockerfile.importer](Dockerfile.importer), runs the import against the Neo4j instance on the host, and removes both the container (`--rm`) and the image when the import finishes or fails.

```sh
./import_gfa_docker.sh sample_1.gfa --clear
./import_gfa_docker.sh sample_1.gfa --password 12345678 --batch-size 100000
```

Any flag supported by the Python importer can be appended — they are forwarded to the script inside the container. The default `--uri` targets `bolt://host.docker.internal:7687` so the container reaches Neo4j running on the host (works on macOS, Windows, and Linux via a host-gateway mapping). Override with `--uri bolt://<host>:7687` to point at a remote Neo4j instance.

#### Without Docker

```sh
pip install neo4j
python import_gfa_to_neo4j.py sample_1.gfa --clear
python import_gfa_to_neo4j.py sample_1.gfa --uri bolt://localhost:7687 --password 12345678 --batch-size 100000
```

Run `python import_gfa_to_neo4j.py --help` for the full flag list.

### Running the application with Docker

`docker compose up prod` starts the production build using Docker.

`docker compose up dev` starts the development build using Docker.

### Running the application without Docker

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

## Team

[Gorkem Kadir Solun](https://github.com/gorkemsolun), [Ugur Dogrusoz](https://github.com/ugurdogrusoz), [Zulal Bingol](https://github.com/zulal-b) and [Can Alkan](https://github.com/calkan)

PG2 is a collaborative project by [i-Vis Research Lab](http://www.cs.bilkent.edu.tr/~ivis/) and [Alkan Lab](https://www.alkanlab.org/) at Bilkent University.
