#!/bin/bash
cd /home/ivis/visuall/pangenographer
git checkout -- .
echo "git pull started $(date)"
git pull
echo "git pull ended $(date)"